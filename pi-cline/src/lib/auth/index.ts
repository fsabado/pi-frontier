import type { ClineAuthApi } from "../../api/auth";
import {
  CLINE_AUTH_CLIENT_TYPE,
  CLINE_CLIENT_VERSION,
  CLINE_CORE_VERSION,
  CLINE_AUTH_PLATFORM,
} from "../env";
import { startCallbackServer } from "./callback-server";
import { withTimeout } from "./utils";

export interface ClineCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface ClineAuthInfo {
  url: string;
  instructions?: string;
}

export interface ClineLoginCallbacks {
  onAuth(info: ClineAuthInfo): void;
  onProgress?(message: string): void;
  signal?: AbortSignal;
}

type ClineAuthApiMethods = {
  getAuthorizeUrl: ClineAuthApi["getAuthorizeUrl"];
  exchangeAuthorizationCode: ClineAuthApi["exchangeAuthorizationCode"];
  refreshAccessToken: ClineAuthApi["refreshAccessToken"];
  getCurrentUser: ClineAuthApi["getCurrentUser"];
};

export class ClineAuthService {
  private readonly authApi: ClineAuthApiMethods;

  constructor(authApi: ClineAuthApiMethods) {
    this.authApi = authApi;
  }

  async login(callbacks: ClineLoginCallbacks): Promise<ClineCredentials> {
    callbacks.onProgress?.("Preparing Cline authentication...");

    const callbackServer = await startCallbackServer(callbacks.signal);

    try {
      const authUrl = await this.authApi.getAuthorizeUrl({
        callbackUrl: callbackServer.callbackUrl,
        headers: this.buildClineAuthHeaders(),
        ...(callbacks.signal ? { signal: callbacks.signal } : {}),
      });

      callbacks.onAuth({
        url: authUrl,
        instructions: "Complete the sign-in in your browser.",
      });

      callbacks.onProgress?.("Waiting for authentication callback...");

      const authCode = await withTimeout(
        callbackServer.waitForCode,
        5 * 60 * 1000,
        "Authentication timed out. Please try again.",
      );

      callbacks.onProgress?.("Completing Cline authentication...");

      const tokens = await this.authApi.exchangeAuthorizationCode({
        code: authCode.code,
        callbackUrl: callbackServer.callbackUrl,
        provider: authCode.provider,
        headers: this.buildClineAuthHeaders(),
        ...(callbacks.signal ? { signal: callbacks.signal } : {}),
      });

      await this.fetchCurrentUser(tokens.accessToken, callbacks.signal);

      return this.toCredentials(tokens);
    } finally {
      callbackServer.close();
    }
  }

  async refresh(credentials: ClineCredentials): Promise<ClineCredentials> {
    const tokens = await this.authApi.refreshAccessToken({
      refreshToken: credentials.refreshToken,
      headers: this.buildClineAuthHeaders(),
    });

    await this.fetchCurrentUser(tokens.accessToken);

    return this.toCredentials(tokens, credentials.refreshToken);
  }

  private toCredentials(
    tokens: {
      accessToken: string;
      refreshToken: string;
      expiresAt: string;
    },
    fallbackRefreshToken?: string,
  ): ClineCredentials {
    const refreshToken = tokens.refreshToken || fallbackRefreshToken;
    if (!refreshToken) {
      throw new Error("Cline auth response missing refresh token");
    }

    const expiresAtMs = Date.parse(tokens.expiresAt);
    if (Number.isNaN(expiresAtMs)) {
      throw new Error("Cline auth response has invalid expiresAt");
    }

    const now = Date.now();
    const bufferedExpiresAt = Math.max(
      now + 30 * 1000,
      expiresAtMs - 5 * 60 * 1000,
    );

    return {
      accessToken: this.normalizeAccessToken(tokens.accessToken),
      refreshToken,
      expiresAt: bufferedExpiresAt,
    };
  }

  private normalizeAccessToken(token: string): string {
    return token.startsWith("workos:") ? token.slice("workos:".length) : token;
  }

  private buildClineAuthHeaders(): Record<string, string> {
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": `Cline/${CLINE_CORE_VERSION}`,
      "X-PLATFORM": CLINE_AUTH_PLATFORM,
      "X-PLATFORM-VERSION": CLINE_CLIENT_VERSION,
      "X-CLIENT-TYPE": CLINE_AUTH_CLIENT_TYPE,
      "X-CLIENT-VERSION": CLINE_CLIENT_VERSION,
      "X-CORE-VERSION": CLINE_CORE_VERSION,
    };
  }

  private async fetchCurrentUser(
    accessToken: string,
    signal?: AbortSignal,
  ): Promise<void> {
    try {
      await this.authApi.getCurrentUser({
        accessToken,
        headers: this.buildClineAuthHeaders(),
        ...(signal ? { signal } : {}),
      });
    } catch {}
  }
}
