import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { JwtService } from "@nestjs/jwt";
import type { User } from "../generated/prisma/client";
import { Prisma } from "../generated/prisma/client";
import * as argon from "argon2";
import { Request, Response } from "express";
import dayjs, { ManipulateType } from "dayjs";
import { ConfigService } from "src/config/config.service";
import { EmailService } from "src/email/email.service";
import { PrismaService } from "src/prisma/prisma.service";
import { OAuthService } from "../oauth/oauth.service";
import { GenericOidcProvider } from "../oauth/provider/genericOidc.provider";
import { UserService } from "../user/user.service";
import { AuthRegisterDTO } from "./dto/authRegister.dto";
import { AuthSignInDTO } from "./dto/authSignIn.dto";
import * as crypto from "crypto";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private emailService: EmailService,
    private userService: UserService,
    @Inject(forwardRef(() => OAuthService)) private oAuthService: OAuthService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}
  private readonly logger = new Logger(AuthService.name);

  async signUp(dto: AuthRegisterDTO, ip: string, isAdmin?: boolean) {
    const isFirstUser = (await this.prisma.user.count()) == 0;

    const hash = dto.password ? await argon.hash(dto.password) : null;
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          username: dto.username,
          password: hash,
          isAdmin: isAdmin ?? isFirstUser,
        },
      });

      const { refreshToken, refreshTokenId } = await this.createRefreshToken(
        user.id,
      );
      const accessToken = await this.createAccessToken(user, refreshTokenId);

      this.logger.log(`User ${user.email} signed up from IP ${ip}`);
      return { accessToken, refreshToken, user };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code == "P2002") {
          const duplicatedField: string = e.meta.target[0];
          throw new BadRequestException(
            `A user with this ${duplicatedField} already exists`,
          );
        }
      }
      // Any other error (Prisma or otherwise) must propagate so callers
      // never receive `undefined` from a failed signup.
      throw e;
    }
  }

  async signIn(dto: AuthSignInDTO, ip: string) {
    if (!dto.email && !dto.username) {
      throw new BadRequestException("Email or username is required");
    }

    if (!this.config.get("oauth.disablePassword")) {
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [{ email: dto.email }, { username: dto.username }],
        },
      });

      if (user?.password && (await argon.verify(user.password, dto.password))) {
        this.logger.log(
          `Successful password login for user ${user.email} from IP ${ip}`,
        );
        return this.generateToken(user);
      }
    }

    this.logger.log(
      `Failed login attempt for user ${dto.email || dto.username} from IP ${ip}`,
    );
    throw new UnauthorizedException("Wrong email or password");
  }

  async generateToken(user: User, oauth?: { idToken?: string }) {
    // Check if the user has TOTP enabled
    if (user.totpVerified && !(oauth && this.config.get("oauth.ignoreTotp"))) {
      // Invalidate any existing outstanding login tokens before issuing a new one
      await this.prisma.loginToken.deleteMany({
        where: { userId: user.id, used: false },
      });
      const loginToken = await this.createLoginToken(user.id);

      return { loginToken };
    }

    const { refreshToken, refreshTokenId } = await this.createRefreshToken(
      user.id,
      oauth?.idToken,
    );
    const accessToken = await this.createAccessToken(user, refreshTokenId);

    return { accessToken, refreshToken };
  }

  async requestResetPassword(email: string) {
    if (this.config.get("oauth.disablePassword"))
      throw new ForbiddenException("Password sign in is disabled");

    // Per-email rate limit (in addition to the per-IP throttle on the
    // controller). The per-IP limit alone lets an attacker spam the same
    // address from many IPs; this caps a single email at 3 reset requests
    // per 5 minutes regardless of source IP.
    const RESET_LIMIT = 3;
    const RESET_WINDOW_MS = 5 * 60 * 1000;
    const normalizedEmail = email.trim().toLowerCase();
    const key = `pwreset:${normalizedEmail}`;
    // NOTE: This get()+set() counter is best-effort and not strictly atomic;
    // under heavy concurrent load a small number of requests above RESET_LIMIT
    // can slip through. The per-IP throttle on the controller bounds the
    // worst case. If we later move to a dedicated Redis cache store we should
    // switch this to an atomic INCR + EXPIRE.
    const current = (await this.cacheManager.get<number>(key)) ?? 0;
    if (current >= RESET_LIMIT) {
      throw new HttpException(
        "Too many password reset requests for this email. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.cacheManager.set(key, current + 1, RESET_WINDOW_MS);

    const user = await this.prisma.user.findFirst({
      where: { email },
      include: { resetPasswordToken: true },
    });

    if (!user) return;

    // Delete old reset password token
    if (user.resetPasswordToken) {
      await this.prisma.resetPasswordToken.delete({
        where: { token: user.resetPasswordToken.token },
      });
    }

    const { token } = await this.prisma.resetPasswordToken.create({
      data: {
        expiresAt: dayjs().add(1, "hour").toDate(),
        user: { connect: { id: user.id } },
      },
    });

    this.emailService.sendResetPasswordEmail(user.email, token);
  }

  async resetPassword(token: string, newPassword: string) {
    if (this.config.get("oauth.disablePassword"))
      throw new ForbiddenException("Password sign in is disabled");

    const user = await this.prisma.user.findFirst({
      where: { resetPasswordToken: { token } },
    });

    if (!user) throw new BadRequestException("Token invalid or expired");

    const newPasswordHash = await argon.hash(newPassword);

    await this.prisma.resetPasswordToken.delete({
      where: { token },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: newPasswordHash },
    });
  }

  async updatePassword(user: User, newPassword: string, oldPassword?: string) {
    const isPasswordValid =
      !user.password || (await argon.verify(user.password, oldPassword));

    if (!isPasswordValid) throw new ForbiddenException("Invalid password");

    const hash = await argon.hash(newPassword);

    await this.prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hash },
    });

    return this.createRefreshToken(user.id);
  }

  async createAccessToken(user: User, refreshTokenId: string) {
    return this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
        refreshTokenId,
      },
      {
        expiresIn: "15min",
        secret: this.config.get("internal.jwtSecret"),
      },
    );
  }

  async signOut(accessToken: string) {
    let refreshTokenId: string | undefined;
  
    try {
      const payload = await this.jwtService.verifyAsync(accessToken, {
        secret: this.config.get("internal.jwtSecret"),
        ignoreExpiration: true, // Allow logging out with an expired token
      });
      refreshTokenId = payload.refreshTokenId;
    } catch (e) {
      // If the token is entirely invalid or tampered with, just return
      return;
    }

    if (refreshTokenId) {
      const oauthIDToken = await this.prisma.refreshToken
        .findFirst({
          select: { oauthIDToken: true },
          where: { id: refreshTokenId },
        })
        .then((refreshToken) => refreshToken?.oauthIDToken)
        .catch((e) => {
          // Ignore error if refresh token doesn't exist
          if (e.code != "P2025") throw e;
        });
      await this.prisma.refreshToken
        .delete({ where: { id: refreshTokenId } })
        .catch((e) => {
          // Ignore error if refresh token doesn't exist
          if (e.code != "P2025") throw e;
        });

      if (typeof oauthIDToken === "string") {
        const [providerName, idTokenHint] = oauthIDToken.split(":");
        const provider = this.oAuthService.availableProviders()[providerName];
        let signOutFromProviderSupportedAndActivated = false;
        try {
          signOutFromProviderSupportedAndActivated = this.config.get(
            `oauth.${providerName}-signOut`,
          );
        } catch (_) {
          // Ignore error if the provider is not supported or if the provider sign out is not activated
        }
        if (
          provider instanceof GenericOidcProvider &&
          signOutFromProviderSupportedAndActivated
        ) {
          const configuration = await provider.getConfiguration();
          if (URL.canParse(configuration.end_session_endpoint)) {
            const redirectURI = new URL(configuration.end_session_endpoint);
            // Defense in depth: only forward post_logout_redirect_uri when
            // the configured appUrl parses as a valid http(s) URL. The IdP
            // is expected to additionally allowlist redirect URIs, but we
            // avoid forwarding garbage / non-http schemes here.
            const appUrlRaw = this.config.get("general.appUrl");
            if (URL.canParse(appUrlRaw)) {
              const appUrl = new URL(appUrlRaw);
              if (appUrl.protocol === "http:" || appUrl.protocol === "https:") {
                redirectURI.searchParams.append(
                  "post_logout_redirect_uri",
                  appUrl.toString(),
                );
              }
            }
            redirectURI.searchParams.append("id_token_hint", idTokenHint);
            redirectURI.searchParams.append(
              "client_id",
              this.config.get(`oauth.${providerName}-clientId`),
            );
            return redirectURI.toString();
          }
        }
      }
    }
  }

  async refreshAccessToken(refreshToken: string) {
    const refreshTokenMetaData = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!refreshTokenMetaData || refreshTokenMetaData.expiresAt < new Date())
      throw new UnauthorizedException();

    return this.createAccessToken(
      refreshTokenMetaData.user,
      refreshTokenMetaData.id,
    );
  }

  async createRefreshToken(userId: string, idToken?: string) {
    const sessionDuration = this.config.get("general.sessionDuration");
    const { id, token } = await this.prisma.refreshToken.create({
      data: {
        userId,
        expiresAt: dayjs()
          .add(sessionDuration.value, sessionDuration.unit)
          .toDate(),
        oauthIDToken: idToken,
      },
    });

    return { refreshTokenId: id, refreshToken: token };
  }

  private getCookieEncryptionKey(): Buffer {
    const key = this.config.get("internal.cookieEncryptionKey");
    if (!key || typeof key !== "string") {
      throw new InternalServerErrorException(
        "Cookie encryption key is not configured",
      );
    }
    // The seed always provisions a canonical 32-byte base64 key. Operators
    // overriding this value must supply the same: exactly 32 random bytes,
    // base64-encoded (44 chars including padding). We deliberately do NOT
    // derive a key from arbitrary passphrase input — SHA-256 is not a KDF,
    // and a real KDF (scrypt/argon2id) would silently mask weak inputs.
    // Generate one with: `openssl rand -base64 32`.
    const trimmedKey = key.trim();
    if (trimmedKey.length === 44) {
      const decoded = Buffer.from(trimmedKey, "base64");
      if (decoded.length === 32 && trimmedKey === decoded.toString("base64")) {
        return decoded;
      }
    }
    throw new InternalServerErrorException(
      "internal.cookieEncryptionKey must be exactly 32 random bytes encoded " +
        "as canonical base64 (44 chars). Generate one with: " +
        "`openssl rand -base64 32`.",
    );
  }

  private encryptRefreshToken(plainText: string): string {
    const iv = crypto.randomBytes(12); // 96-bit nonce for AES-GCM
    const key = this.getCookieEncryptionKey();
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainText, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    // Concatenate iv + authTag + ciphertext and encode as base64
    return Buffer.concat([iv, authTag, encrypted]).toString("base64");
  }

  decryptRefreshToken(cipherText: string): string {
    const data = Buffer.from(cipherText, "base64");
    const iv = data.subarray(0, 12);
    const authTag = data.subarray(12, 28);
    const encrypted = data.subarray(28);
    const key = this.getCookieEncryptionKey();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  }

  async createLoginToken(userId: string) {
    const loginToken = (
      await this.prisma.loginToken.create({
        data: { userId, expiresAt: dayjs().add(5, "minutes").toDate() },
      })
    ).token;

    return loginToken;
  }

  addTokensToResponse(
    response: Response,
    refreshToken?: string,
    accessToken?: string,
  ) {
    const isSecure = this.config.get("general.secureCookies");
    if (accessToken)
      response.cookie("access_token", accessToken, {
        httpOnly: true,
        sameSite: "strict",
        secure: isSecure,
        maxAge: 1000 * 60 * 60 * 24 * 30 * 3, // 3 months
      });
    if (refreshToken) {
      const now = dayjs();
      const sessionDuration = this.config.get("general.sessionDuration");
      const maxAge = now
        .add(sessionDuration.value, sessionDuration.unit as ManipulateType)
        .diff(now);
      const encryptedRefreshToken = this.encryptRefreshToken(refreshToken);
      response.cookie("refresh_token", encryptedRefreshToken, {
        path: "/api/auth/token",
        httpOnly: true,
        sameSite: "strict",
        secure: isSecure,
        maxAge,
      });
    }
  }

  /**
   * Returns the user id if the user is logged in, null otherwise
   */
  async getIdOfCurrentUser(request: Request): Promise<string | null> {
    if (!request.cookies.access_token) return null;
    try {
      const payload = await this.jwtService.verifyAsync(
        request.cookies.access_token,
        {
          secret: this.config.get("internal.jwtSecret"),
        },
      );
      return payload.sub;
    } catch {
      return null;
    }
  }

  async verifyPassword(user: User, password: string) {
    if (!user.password) return false;
    return argon.verify(user.password, password);
  }
}
