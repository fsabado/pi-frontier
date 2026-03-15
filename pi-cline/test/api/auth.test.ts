import assert from "node:assert/strict";
import test from "node:test";
import { ClineAuthApi } from "../../src/api/auth";
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

const mockCurrentUserFetch = () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl: string | undefined;
  let requestedInit: RequestInit | undefined;

  globalThis.fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    requestedUrl = input instanceof Request ? input.url : input.toString();
    requestedInit = init;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: "user_123",
          email: "user@example.com",
          displayName: "Cline User",
          createdAt: "2026-01-01T00:00:00.000Z",
          organizations: [],
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  };

  return {
    restore: () => {
      globalThis.fetch = originalFetch;
    },
    getRequestedUrl: () => requestedUrl,
    getRequestedInit: () => requestedInit,
  };
};

test("getCurrentUser calls the upstream /users/me endpoint with a workos bearer token", async () => {
  const fetchMock = mockCurrentUserFetch();

  try {
    const api = new ClineAuthApi("https://api.cline.bot/api/v1");
    const user = await api.getCurrentUser({
      accessToken: "abc123",
      headers: expectedClineAuthHeaders(),
    });

    assert.equal(
      fetchMock.getRequestedUrl(),
      "https://api.cline.bot/api/v1/users/me",
    );
    assert.equal(fetchMock.getRequestedInit()?.method, "GET");
    assert.equal(
      (fetchMock.getRequestedInit()?.headers as Record<string, string>)
        .Authorization,
      "Bearer workos:abc123",
    );
    assert.deepEqual(user, {
      id: "user_123",
      email: "user@example.com",
      displayName: "Cline User",
      createdAt: "2026-01-01T00:00:00.000Z",
      organizations: [],
    });
  } finally {
    fetchMock.restore();
  }
});
