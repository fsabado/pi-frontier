import assert from "node:assert/strict";
import test from "node:test";
import { getApiKey, modifyModels, refreshToken } from "../src/provider/oauth";

test("modifyModels adds organization header for kilocode models only", () => {
  const models = modifyModels(
    [
      {
        id: "kilo-auto/free",
        name: "Kilo Free",
        api: "openai-completions",
        provider: "kilocode",
        baseUrl: "https://api.kilo.ai/api/openrouter",
        reasoning: true,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 1,
        maxTokens: 1,
      },
      {
        id: "claude-sonnet",
        name: "Other",
        api: "openai-completions",
        provider: "other",
        baseUrl: "https://example.com",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 1,
        maxTokens: 1,
      },
    ] as any,
    {
      refresh: "token",
      access: "token",
      expires: 0,
      accountId: "org_123",
    },
  );

  assert.equal(models[0]?.headers?.["X-KiloCode-OrganizationId"], "org_123");
  assert.equal(models[1]?.headers?.["X-KiloCode-OrganizationId"], undefined);
});

test("refreshToken validates token via profile fetch and extends expiry", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ user: { email: "user@example.com" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;

  const refreshed = await refreshToken({
    refresh: "abc",
    access: "abc",
    expires: 1,
    accountId: "org_123",
  });

  assert.equal(getApiKey(refreshed), "abc");
  assert.equal(refreshed.accountId, "org_123");
  assert.ok(typeof refreshed.expires === "number");
  assert.ok(refreshed.expires > Date.now());
});
