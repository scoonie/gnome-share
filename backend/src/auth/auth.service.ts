import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
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
import { UserSevice } from "../user/user.service";
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
    private userService: UserSevice,
    @Inject(forwardRef(() => OAuthService)) private oAuthService: OAuthService,
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
    // TODO: Make all old loginTokens invalid when a new one is created
    // Check if the user has TOTP enabled
    if (user.totpVerified && !(oauth && this.config.get("oauth.ignoreTotp"))) {
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
            redirectURI.searchParams.append(
              "post_logout_redirect_uri",
              this.config.get("general.appUrl"),
            );
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
      throw new InternalServerErrorException("Cookie encryption key is not configured");
    }
    // Prefer a base64-encoded 32-byte key if provided, otherwise derive one from the passphrase
    const trimmedKey = key.trim();
    // For a 32-byte key, the canonical base64 length is 44 characters (including padding)
    if (trimmedKey.length === 44) {
      const decoded = Buffer.from(trimmedKey, "base64");
      // Check for an exact 32-byte key and ensure the original value is canonical base64
      if (
        decoded.length === 32 &&
        trimmedKey === decoded.toString("base64")
      ) {
        return decoded;
      }
    }
    // Derive a 32-byte key for AES-256 from the configured value (passphrase-style)
    return crypto.createHash("sha256").update(key, "utf8").digest();
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
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
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
        sameSite: "lax",
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
