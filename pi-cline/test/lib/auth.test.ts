import assert from "node:assert/strict";
import test from "node:test";
import { ClineAuthService } from "../../src/lib/auth";
import {
  CLINE_AUTH_CLIENT_TYPE,
  CLINE_AUTH_PLATFORM,
  CLINE_CLIENT_VERSION,
  CLINE_CORE_VERSION,
} from "../../src/lib/env";

const expectedClineAuthHeaders = (): Record<string, string> => {
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
};

test("refresh calls /users/me best-effort after refreshing the access token", async () => {
  const calls: Array<{
    accessToken: string;
    headers: Record<string, string>;
  }> = [];

  const authApi = {
    getAuthorizeUrl: async () => {
      throw new Error("not used");
    },
    exchangeAuthorizationCode: async () => {
      throw new Error("not used");
    },
    refreshAccessToken: async () => ({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
      expiresAt: "2030-01-01T00:10:00.000Z",
    }),
    getCurrentUser: async ({ accessToken, headers }) => {
      calls.push({ accessToken, headers });
      return {
        id: "user_123",
        email: "user@example.com",
        displayName: "Cline User",
        createdAt: "2026-01-01T00:00:00.000Z",
        organizations: [],
      };
    },
  } satisfies ConstructorParameters<typeof ClineAuthService>[0];

  const service = new ClineAuthService(authApi);
  const credentials = await service.refresh({
    accessToken: "old-access-token",
    refreshToken: "old-refresh-token",
    expiresAt: 0,
  });

  assert.deepEqual(calls, [
    { accessToken: "new-access-token", headers: expectedClineAuthHeaders() },
  ]);
  assert.equal(credentials.accessToken, "new-access-token");
  assert.equal(credentials.refreshToken, "new-refresh-token");
  assert.equal(
    credentials.expiresAt,
    Date.parse("2030-01-01T00:10:00.000Z") - 5 * 60 * 1000,
  );
});

test("refresh still succeeds when /users/me lookup fails", async () => {
  const authApi = {
    getAuthorizeUrl: async () => {
      throw new Error("not used");
    },
    exchangeAuthorizationCode: async () => {
      throw new Error("not used");
    },
    refreshAccessToken: async () => ({
      accessToken: "workos:new-access-token",
      refreshToken: "new-refresh-token",
      expiresAt: "2030-01-01T00:10:00.000Z",
    }),
    getCurrentUser: async () => {
      throw new Error("temporary failure");
    },
  } satisfies ConstructorParameters<typeof ClineAuthService>[0];

  const service = new ClineAuthService(authApi);
  const credentials = await service.refresh({
    accessToken: "old-access-token",
    refreshToken: "old-refresh-token",
    expiresAt: 0,
  });

  assert.equal(credentials.accessToken, "new-access-token");
  assert.equal(credentials.refreshToken, "new-refresh-token");
});
