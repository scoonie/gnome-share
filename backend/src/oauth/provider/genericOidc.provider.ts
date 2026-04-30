import { InternalServerErrorException, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Cache } from "cache-manager";
import * as jmespath from "jmespath";
import {
  createRemoteJWKSet,
  errors as joseErrors,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from "jose";
import { nanoid } from "nanoid";
import { ConfigService } from "../../config/config.service";
import { OAuthCallbackDto } from "../dto/oauthCallback.dto";
import { OAuthSignInDto } from "../dto/oauthSignIn.dto";
import { ErrorPageException } from "../exceptions/errorPage.exception";
import { OAuthProvider, OAuthToken } from "./oauthProvider.interface";

export abstract class GenericOidcProvider implements OAuthProvider<OidcToken> {
  protected discoveryUri: string;
  private configuration: OidcConfigurationCache;
  private jwks?: { uri: string; getKey: JWTVerifyGetKey };
  private logger: Logger = new Logger(
    Object.getPrototypeOf(this).constructor.name,
  );

  protected constructor(
    protected name: string,
    protected keyOfConfigUpdateEvents: string[],
    protected config: ConfigService,
    protected jwtService: JwtService,
    protected cache: Cache,
  ) {
    this.discoveryUri = this.getDiscoveryUri();
    this.config.addListener("update", (key: string) => {
      if (this.keyOfConfigUpdateEvents.includes(key)) {
        this.deinit();
        this.discoveryUri = this.getDiscoveryUri();
      }
    });
  }

  protected getRedirectUri(): string {
    return `${this.config.get("general.appUrl")}/api/oauth/callback/${
      this.name
    }`;
  }

  async getConfiguration(): Promise<OidcConfiguration> {
    if (!this.configuration || this.configuration.expires < Date.now()) {
      await this.fetchConfiguration();
    }
    return this.configuration.data;
  }

  /**
   * Returns a JWKS resolver that lazily fetches the provider's signing keys
   * (with built-in rotation/caching from `jose`'s `createRemoteJWKSet`).
   */
  private async getJwks(): Promise<JWTVerifyGetKey> {
    const configuration = await this.getConfiguration();
    if (!configuration.jwks_uri) {
      throw new InternalServerErrorException(
        `OIDC provider "${this.name}" did not advertise a jwks_uri`,
      );
    }
    if (!this.jwks || this.jwks.uri !== configuration.jwks_uri) {
      this.jwks = {
        uri: configuration.jwks_uri,
        getKey: createRemoteJWKSet(new URL(configuration.jwks_uri)),
      };
    }
    return this.jwks.getKey;
  }

  async getAuthEndpoint(state: string) {
    const configuration = await this.getConfiguration();
    const endpoint = configuration.authorization_endpoint;

    const nonce = nanoid();
    await this.cache.set(
      `oauth-${this.name}-nonce-${state}`,
      nonce,
      1000 * 60 * 5,
    );

    return (
      endpoint +
      "?" +
      new URLSearchParams({
        client_id: this.config.get(`oauth.${this.name}-clientId`),
        response_type: "code",
        scope:
          this.name == "oidc"
            ? this.config.get(`oauth.oidc-scope`)
            : "openid email profile",
        redirect_uri: this.getRedirectUri(),
        state,
        nonce,
      }).toString()
    );
  }

  async getToken(query: OAuthCallbackDto): Promise<OAuthToken<OidcToken>> {
    const configuration = await this.getConfiguration();
    const endpoint = configuration.token_endpoint;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: this.config.get(`oauth.${this.name}-clientId`),
        client_secret: this.config.get(`oauth.${this.name}-clientSecret`),
        grant_type: "authorization_code",
        code: query.code,
        redirect_uri: this.getRedirectUri(),
      }).toString(),
    });
    const token = (await res.json()) as OidcToken;
    return {
      accessToken: token.access_token,
      expiresIn: token.expires_in,
      idToken: token.id_token,
      refreshToken: token.refresh_token,
      tokenType: token.token_type,
      rawToken: token,
    };
  }

  async getUserInfo(
    token: OAuthToken<OidcToken>,
    query: OAuthCallbackDto,
    claim?: string,
    roleConfig?: {
      path?: string;
      generalAccess?: string;
      adminAccess?: string;
    },
  ): Promise<OAuthSignInDto> {
    if (!token.idToken) {
      this.logger.error(
        `OIDC provider "${this.name}" did not return an id_token in ${JSON.stringify(token.rawToken, undefined, 2)}`,
      );
      throw new InternalServerErrorException();
    }

    const idTokenData = await this.verifyIdToken(token.idToken);

    const key = `oauth-${this.name}-nonce-${query.state}`;
    const nonce = await this.cache.get(key);
    await this.cache.del(key);
    if (nonce !== idTokenData.nonce) {
      this.logger.error(
        `Invalid nonce. Expected ${nonce}, but got ${idTokenData.nonce}`,
      );
      throw new ErrorPageException("invalid_token");
    }

    const username = claim
      ? idTokenData[claim]
      : idTokenData.preferred_username ||
        idTokenData.name ||
        idTokenData.nickname;

    let isAdmin: boolean;

    if (roleConfig?.path) {
      // A path to read roles from the token is configured
      let roles: string[] = [];
      try {
        const rolesClaim = jmespath.search(idTokenData, roleConfig.path);
        if (Array.isArray(rolesClaim)) {
          roles = rolesClaim;
        }
      } catch (e) {
        this.logger.warn(
          `Roles not found at path ${roleConfig.path} in ID Token ${JSON.stringify(
            idTokenData,
            undefined,
            2,
          )}`,
        );
      }

      if (
        roleConfig.generalAccess &&
        !roles.includes(roleConfig.generalAccess)
      ) {
        // Role for general access is configured and the user does not have it
        this.logger.error(
          `User roles ${roles} do not include ${roleConfig.generalAccess}`,
        );
        throw new ErrorPageException("user_not_allowed");
      }
      if (roleConfig.adminAccess) {
        // Role for admin access is configured
        isAdmin = roles.includes(roleConfig.adminAccess);
      }
    }

    if (!username) {
      this.logger.error(
        `Can not get username from ID Token ${JSON.stringify(
          idTokenData,
          undefined,
          2,
        )}`,
      );
      throw new ErrorPageException("cannot_get_user_info", undefined, [
        `provider_${this.name}`,
      ]);
    }

    return {
      provider: this.name as any,
      email: idTokenData.email,
      providerId: idTokenData.sub,
      providerUsername: username,
      ...(isAdmin !== undefined && { isAdmin }),
      idToken: `${this.name}:${token.idToken}`,
    };
  }

  protected abstract getDiscoveryUri(): string;

  private async fetchConfiguration(): Promise<void> {
    const res = await fetch(this.discoveryUri);
    const expires = res.headers.has("expires")
      ? new Date(res.headers.get("expires")).getTime()
      : Date.now() + 1000 * 60 * 60 * 24;
    this.configuration = {
      expires,
      data: (await res.json()) as OidcConfiguration,
    };
  }

  private deinit() {
    this.discoveryUri = undefined;
    this.configuration = undefined;
    this.jwks = undefined;
  }

  /**
   * Cryptographically verify the ID token using the provider's published JWKS
   * and validate the standard OIDC claims (signature, `iss`, `aud`, `exp`,
   * `iat`/`nbf`). The returned payload can then be trusted for things like
   * `sub`, `email`, and the role-claim lookup.
   */
  private async verifyIdToken(idToken: string): Promise<OidcIdToken> {
    const configuration = await this.getConfiguration();
    const clientId = this.config.get(`oauth.${this.name}-clientId`) as string;
    if (!clientId) {
      throw new InternalServerErrorException(
        `OIDC provider "${this.name}" is missing a configured clientId`,
      );
    }
    const jwks = await this.getJwks();
    try {
      const { payload } = await jwtVerify(idToken, jwks, {
        issuer: configuration.issuer,
        audience: clientId,
      });
      return payload as JWTPayload & OidcIdToken;
    } catch (err) {
      // Treat any signature, claim, or expiry failure as an invalid token —
      // never trust the unverified payload.
      const message =
        err instanceof joseErrors.JOSEError
          ? `${err.code}: ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err);
      this.logger.error(
        `OIDC ID token verification failed for provider "${this.name}": ${message}`,
      );
      throw new ErrorPageException("invalid_token");
    }
  }
}

export interface OidcCache<T> {
  expires: number;
  data: T;
}

export interface OidcConfiguration {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri: string;
  response_types_supported: string[];
  id_token_signing_alg_values_supported: string[];
  scopes_supported?: string[];
  claims_supported?: string[];
  frontchannel_logout_supported?: boolean;
  end_session_endpoint?: string;
}

export type OidcConfigurationCache = OidcCache<OidcConfiguration>;

export interface OidcToken {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  id_token: string;
}

export interface OidcIdToken {
  iss: string;
  sub: string;
  exp: number;
  iat: number;
  email: string;
  name: string;
  nickname: string;
  preferred_username: string;
  nonce: string;
}
