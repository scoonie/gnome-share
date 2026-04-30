import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Logger,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { User } from "../generated/prisma/client";
import { Request, Response } from "express";
import { ConfigService } from "src/config/config.service";
import { AuthService } from "./auth.service";
import { AuthTotpService } from "./authTotp.service";
import { GetUser } from "./decorator/getUser.decorator";
import { AuthRegisterDTO } from "./dto/authRegister.dto";
import { AuthSignInDTO } from "./dto/authSignIn.dto";
import { AuthSignInTotpDTO } from "./dto/authSignInTotp.dto";
import { EnableTotpDTO } from "./dto/enableTotp.dto";
import { ResetPasswordDTO } from "./dto/resetPassword.dto";
import { TokenDTO } from "./dto/token.dto";
import { UpdatePasswordDTO } from "./dto/updatePassword.dto";
import { VerifyTotpDTO } from "./dto/verifyTotp.dto";
import { JwtGuard } from "./guard/jwt.guard";

@Controller("auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  // Sunset date for the plaintext refresh-token cookie fallback. After this
  // date the fallback is rejected outright; callers must re-authenticate so
  // a new encrypted refresh-token cookie is issued. The window can also be
  // closed early by setting DISABLE_PLAINTEXT_REFRESH_TOKEN_FALLBACK=true.
  private static readonly PLAINTEXT_REFRESH_TOKEN_SUNSET = new Date(
    "2026-10-31T00:00:00Z",
  );
  private plaintextFallbackWarned = false;

  constructor(
    private authService: AuthService,
    private authTotpService: AuthTotpService,
    private config: ConfigService,
  ) {}

  @Post("signUp")
  @Throttle({
    default: {
      limit: 20,
      ttl: 5 * 60,
    },
  })
  async signUp(
    @Body() dto: AuthRegisterDTO,
    @Req() { ip }: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!this.config.get("share.allowRegistration"))
      throw new ForbiddenException("Registration is not allowed");

    const result = await this.authService.signUp(dto, ip);

    this.authService.addTokensToResponse(
      response,
      result.refreshToken,
      result.accessToken,
    );

    return result;
  }

  @Post("signIn")
  @Throttle({
    default: {
      limit: 20,
      ttl: 5 * 60,
    },
  })
  @HttpCode(200)
  async signIn(
    @Body() dto: AuthSignInDTO,
    @Req() { ip }: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.signIn(dto, ip);

    if (result.accessToken && result.refreshToken) {
      this.authService.addTokensToResponse(
        response,
        result.refreshToken,
        result.accessToken,
      );
    }

    return result;
  }

  @Post("signIn/totp")
  @Throttle({
    default: {
      limit: 20,
      ttl: 5 * 60,
    },
  })
  @HttpCode(200)
  async signInTotp(
    @Body() dto: AuthSignInTotpDTO,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authTotpService.signInTotp(dto);

    this.authService.addTokensToResponse(
      response,
      result.refreshToken,
      result.accessToken,
    );

    return new TokenDTO().from(result);
  }

  @Post("resetPassword/:email")
  @Throttle({
    default: {
      limit: 20,
      ttl: 5 * 60,
    },
  })
  @HttpCode(202)
  async requestResetPassword(@Param("email") email: string) {
    await this.authService.requestResetPassword(email);
  }

  @Post("resetPassword")
  @Throttle({
    default: {
      limit: 20,
      ttl: 5 * 60,
    },
  })
  @HttpCode(204)
  async resetPassword(@Body() dto: ResetPasswordDTO) {
    return await this.authService.resetPassword(dto.token, dto.password);
  }

  @Patch("password")
  @UseGuards(JwtGuard)
  async updatePassword(
    @GetUser() user: User,
    @Res({ passthrough: true }) response: Response,
    @Body() dto: UpdatePasswordDTO,
  ) {
    const result = await this.authService.updatePassword(
      user,
      dto.password,
      dto.oldPassword,
    );

    this.authService.addTokensToResponse(response, result.refreshToken);
    return new TokenDTO().from(result);
  }

  @Post("token")
  @HttpCode(200)
  async refreshAccessToken(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!request.cookies.refresh_token) throw new UnauthorizedException();

    let refreshToken: string;
    try {
      // Try to decrypt assuming the new encrypted refresh token format.
      refreshToken = this.authService.decryptRefreshToken(
        request.cookies.refresh_token,
      );
    } catch {
      // Backward compatibility: treat the cookie as a plaintext refresh
      // token. This fallback exists only to keep pre-encryption sessions
      // alive across the upgrade and is being sunset.
      const fallbackDisabled =
        process.env.DISABLE_PLAINTEXT_REFRESH_TOKEN_FALLBACK === "true";
      const sunsetReached =
        Date.now() >=
        AuthController.PLAINTEXT_REFRESH_TOKEN_SUNSET.getTime();
      if (fallbackDisabled || sunsetReached) {
        this.logger.warn(
          "Rejected plaintext refresh-token cookie: fallback is disabled" +
            (sunsetReached ? " (sunset date reached)" : "") +
            ". The client must re-authenticate.",
        );
        throw new UnauthorizedException();
      }
      if (!this.plaintextFallbackWarned) {
        this.plaintextFallbackWarned = true;
        this.logger.warn(
          `DEPRECATED: accepting plaintext refresh-token cookie. This ` +
            `fallback will be removed on ` +
            `${AuthController.PLAINTEXT_REFRESH_TOKEN_SUNSET.toISOString()}. ` +
            `Set DISABLE_PLAINTEXT_REFRESH_TOKEN_FALLBACK=true to reject ` +
            `these cookies immediately. Affected users will be signed out ` +
            `and need to re-authenticate to receive an encrypted cookie.`,
        );
      } else {
        this.logger.debug(
          "Accepted deprecated plaintext refresh-token cookie",
        );
      }
      refreshToken = request.cookies.refresh_token;
    }

    const accessToken = await this.authService.refreshAccessToken(
      refreshToken,
    );
    this.authService.addTokensToResponse(response, undefined, accessToken);
    return new TokenDTO().from({ accessToken });
  }

  @Post("signOut")
  async signOut(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const redirectURI = await this.authService.signOut(
      request.cookies.access_token,
    );

    const isSecure = this.config.get("general.secureCookies");
    response.cookie("access_token", "", {
      maxAge: -1,
      secure: isSecure,
    });
    response.cookie("refresh_token", "", {
      path: "/api/auth/token",
      httpOnly: true,
      maxAge: -1,
      secure: isSecure,
    });

    if (typeof redirectURI === "string") {
      return { redirectURI: redirectURI.toString() };
    }
  }

  @Post("totp/enable")
  @UseGuards(JwtGuard)
  async enableTotp(@GetUser() user: User, @Body() body: EnableTotpDTO) {
    return this.authTotpService.enableTotp(user, body.password);
  }

  @Post("totp/verify")
  @UseGuards(JwtGuard)
  async verifyTotp(@GetUser() user: User, @Body() body: VerifyTotpDTO) {
    return this.authTotpService.verifyTotp(user, body.password, body.code);
  }

  @Post("totp/disable")
  @UseGuards(JwtGuard)
  async disableTotp(@GetUser() user: User, @Body() body: VerifyTotpDTO) {
    // Note: We use VerifyTotpDTO here because it has both fields we need: password and totp code
    return this.authTotpService.disableTotp(user, body.password, body.code);
  }
}
