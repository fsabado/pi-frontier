import { fetchWithTimeout, safeJson } from "./http";

interface ClineAuthTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface ClineAuthOrganization {
  active: boolean;
  memberId: string;
  name: string;
  organizationId: string;
  roles: string[];
}

export interface ClineAuthUserInfo {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  organizations: ClineAuthOrganization[];
  appBaseUrl?: string;
  subject?: string;
}

interface ClineTokenEnvelope {
  success?: boolean;
  data?: {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: string;
  };
  redirect_url?: string;
}

interface ClineUserEnvelope {
  success?: boolean;
  data?: ClineAuthUserInfo;
}

const AUTHORIZE_TIMEOUT_MS = 8000;
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

const toWorkosBearerToken = (accessToken: string): string => {
  const normalized = accessToken.startsWith("workos:")
    ? accessToken
    : `workos:${accessToken}`;
  return `Bearer ${normalized}`;
};

const trimTrailingSlashes = (value: string): string => {
  return value.replace(/\/+$/, "");
};

export interface GetAuthorizeUrlParams {
  callbackUrl: string;
  headers: Record<string, string>;
  signal?: AbortSignal;
}

export interface ExchangeAuthorizationCodeParams {
  code: string;
  callbackUrl: string;
  provider: string | null;
  headers: Record<string, string>;
  signal?: AbortSignal;
}

export interface RefreshAccessTokenParams {
  refreshToken: string;
  headers: Record<string, string>;
  signal?: AbortSignal;
}

export interface GetCurrentUserParams {
  accessToken: string;
  headers: Record<string, string>;
  signal?: AbortSignal;
}

export class ClineAuthApi {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = trimTrailingSlashes(baseUrl);
  }

  async getAuthorizeUrl({
    callbackUrl,
    headers,
    signal,
  }: GetAuthorizeUrlParams): Promise<string> {
    const url = this.buildApiUrl("auth/authorize");
    url.searchParams.set("client_type", "extension");
    url.searchParams.set("callback_url", callbackUrl);
    url.searchParams.set("redirect_uri", callbackUrl);

    try {
      const response = await fetchWithTimeout(url, AUTHORIZE_TIMEOUT_MS, {
        method: "GET",
        redirect: "manual",
        credentials: "include",
        headers,
        signal: signal ?? null,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("Location");
        if (location) {
          return location;
        }
        throw new Error("No redirect URL found in auth response");
      }

      const payload = await safeJson<ClineTokenEnvelope>(response);
      if (
        typeof payload?.redirect_url === "string" &&
        payload.redirect_url.length > 0
      ) {
        return payload.redirect_url;
      }

      throw new Error("Unexpected response from auth server");
    } catch (error) {
      throw new Error(
        `Authentication request failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }

  async exchangeAuthorizationCode({
    code,
    callbackUrl,
    provider,
    headers,
    signal,
  }: ExchangeAuthorizationCodeParams): Promise<ClineAuthTokenData> {
    const response = await this.request("auth/token", {
      method: "POST",
      headers,
      signal: signal ?? null,
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        client_type: "extension",
        redirect_uri: callbackUrl,
        provider,
      }),
    });

    return await this.parseTokenResponse(response, "token exchange");
  }

  async refreshAccessToken({
    refreshToken,
    headers,
    signal,
  }: RefreshAccessTokenParams): Promise<ClineAuthTokenData> {
    const response = await this.request("auth/refresh", {
      method: "POST",
      headers,
      signal: signal ?? null,
      body: JSON.stringify({ refreshToken, grantType: "refresh_token" }),
    });

    return await this.parseTokenResponse(response, "token refresh");
  }

  async getCurrentUser({
    accessToken,
    headers,
    signal,
  }: GetCurrentUserParams): Promise<ClineAuthUserInfo> {
    const response = await this.request("users/me", {
      method: "GET",
      headers: { ...headers, Authorization: toWorkosBearerToken(accessToken) },
      signal: signal ?? null,
    });

    const payload = await safeJson<ClineUserEnvelope>(response);
    if (!response.ok) {
      const errorBody = payload
        ? JSON.stringify(payload)
        : "invalid json response";
      throw new Error(
        `Cline current user lookup failed: ${response.status} ${errorBody}`,
      );
    }

    if (!payload?.data) {
      throw new Error("Cline current user lookup returned invalid response");
    }

    return payload.data;
  }

  private buildApiUrl(path: string): URL {
    const normalizedPath = path.replace(/^\/+/, "");
    return new URL(normalizedPath, `${this.baseUrl}/`);
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    return await fetchWithTimeout(
      this.buildApiUrl(path),
      DEFAULT_REQUEST_TIMEOUT_MS,
      init,
    );
  }

  private async parseTokenResponse(
    response: Response,
    context: string,
  ): Promise<ClineAuthTokenData> {
    const payload = await safeJson<ClineTokenEnvelope>(response);

    if (!response.ok) {
      const errorBody = payload
        ? JSON.stringify(payload)
        : "invalid json response";
      throw new Error(
        `Cline ${context} failed: ${response.status} ${errorBody}`,
      );
    }

    const data = payload?.data;
    if (
      !payload?.success ||
      !data?.accessToken ||
      !data?.refreshToken ||
      !data.expiresAt
    ) {
      throw new Error(`Cline ${context} returned invalid response`);
    }

    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
    };
  }
}
