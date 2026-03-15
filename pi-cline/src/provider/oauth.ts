import type {
  OAuthCredentials,
  OAuthLoginCallbacks,
} from "@mariozechner/pi-ai";
import { ClineAuthApi } from "../api/auth";
import {
  ClineAuthService,
  type ClineCredentials,
  type ClineLoginCallbacks,
} from "../lib/auth";
import { CLINE_API_BASE_URL } from "../lib/env";
import { updateCachedPiModelsIfStale } from "./models";

const auth = new ClineAuthService(new ClineAuthApi(CLINE_API_BASE_URL));

const stripWorkosPrefix = (token: string): string => {
  return token.startsWith("workos:") ? token.slice("workos:".length) : token;
};

const addWorkosPrefix = (token: string): string => {
  return token.startsWith("workos:") ? token : `workos:${token}`;
};

const toOAuthCredentials = (
  credentials: ClineCredentials,
): OAuthCredentials => {
  return {
    access: credentials.accessToken,
    refresh: credentials.refreshToken,
    expires: credentials.expiresAt,
  };
};

const toClineCredentials = (
  credentials: OAuthCredentials,
): ClineCredentials => {
  return {
    accessToken: stripWorkosPrefix(credentials.access),
    refreshToken: credentials.refresh,
    expiresAt: credentials.expires,
  };
};

const updateCachedModelsInBackground = (): void => {
  void updateCachedPiModelsIfStale().catch(() => {
    // ignore
  });
};

export const login = async (
  callbacks: OAuthLoginCallbacks,
): Promise<OAuthCredentials> => {
  const loginCallbacks: ClineLoginCallbacks = {
    onAuth: callbacks.onAuth,
  };
  if (callbacks.onProgress) {
    loginCallbacks.onProgress = callbacks.onProgress;
  }
  if (callbacks.signal) {
    loginCallbacks.signal = callbacks.signal;
  }
  const credentials = await auth.login(loginCallbacks);

  updateCachedModelsInBackground();
  return toOAuthCredentials(credentials);
};

export const refreshToken = async (
  credentials: OAuthCredentials,
): Promise<OAuthCredentials> => {
  const refreshed = await auth.refresh(toClineCredentials(credentials));
  updateCachedModelsInBackground();
  return toOAuthCredentials(refreshed);
};

export const getApiKey = (credentials: OAuthCredentials): string => {
  return addWorkosPrefix(credentials.access);
};
