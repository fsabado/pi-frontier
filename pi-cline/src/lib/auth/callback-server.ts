import http from "node:http";
import { URL } from "node:url";

interface ClineCallbackCode {
  code: string;
  provider: string | null;
}

export interface CallbackServerHandle {
  callbackUrl: string;
  waitForCode: Promise<ClineCallbackCode>;
  close(): void;
}

const tryListenOnPort = (server: http.Server, port: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException): void => {
      server.off("error", onError);
      reject(error);
    };

    server.once("error", onError);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", onError);
      resolve();
    });
  });
};

const parseCallback = (rawUrl: string, port: number): ClineCallbackCode => {
  const parsedUrl = new URL(rawUrl, `http://127.0.0.1:${port}`);
  const queryString = parsedUrl.search.slice(1);
  const query = new URLSearchParams(queryString.replace(/\+/g, "%2B"));

  const token =
    query.get("refreshToken") || query.get("idToken") || query.get("code");
  if (!token) {
    throw new Error("Missing authorization code in callback URL");
  }

  return {
    code: token,
    provider: query.get("provider"),
  };
};

export const startCallbackServer = async (
  signal: AbortSignal | undefined,
): Promise<CallbackServerHandle> => {
  const authPath = "/auth";
  const startPort = 48801;
  const endPort = 48811;
  const authCallbackPorts = Array.from(
    { length: Math.max(startPort, endPort) - Math.min(startPort, endPort) + 1 },
    (_, i) => Math.min(startPort, endPort) + i,
  );
  const successPageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cline - Authentication Success</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, sans-serif;
      background: #ffffff;
      color: #333333;
    }

    .container {
      text-align: center;
      padding: 24px;
      border: 1px solid #e1e1e1;
      border-radius: 8px;
      background: #f8f8f8;
    }

    .ok {
      color: #2f855a;
      font-size: 20px;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="ok">✓ Authentication Successful</div>
    <div>You can close this window and return to your terminal.</div>
  </div>
</body>
</html>`;

  let selectedPort = 0;
  let server: http.Server | undefined;
  let serverTimeout: NodeJS.Timeout | undefined;
  let abortListener: (() => void) | undefined;
  let settled = false;

  let resolveWait: ((result: ClineCallbackCode) => void) | undefined;
  let rejectWait: ((error: Error) => void) | undefined;

  const waitForCode = new Promise<ClineCallbackCode>((resolve, reject) => {
    resolveWait = resolve;
    rejectWait = (error: Error) => reject(error);
  });

  void waitForCode.catch(() => undefined);

  const cleanup = (): void => {
    if (serverTimeout) {
      clearTimeout(serverTimeout);
      serverTimeout = undefined;
    }

    if (signal && abortListener) {
      signal.removeEventListener("abort", abortListener);
      abortListener = undefined;
    }

    if (server) {
      server.close();
      server = undefined;
    }
  };

  const settle = (fn: () => void): void => {
    if (settled) {
      return;
    }

    settled = true;
    cleanup();
    fn();
  };

  server = http.createServer((req, res) => {
    if (!req.url) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      settle(() => rejectWait?.(new Error("Missing callback URL")));
      return;
    }

    try {
      const parsedUrl = new URL(req.url, `http://127.0.0.1:${selectedPort}`);
      if (parsedUrl.pathname !== authPath) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        settle(() =>
          rejectWait?.(
            new Error(`Unexpected callback path: ${parsedUrl.pathname}`),
          ),
        );
        return;
      }

      const callback = parseCallback(req.url, selectedPort);
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(successPageHtml);
      settle(() => resolveWait?.(callback));
    } catch (error) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Bad request");
      settle(() =>
        rejectWait?.(
          error instanceof Error
            ? error
            : new Error("Failed to process auth callback"),
        ),
      );
    }
  });

  for (const port of authCallbackPorts) {
    try {
      await tryListenOnPort(server, port);
      selectedPort = port;
      break;
    } catch (error) {
      const errno = error as NodeJS.ErrnoException;
      if (errno.code === "EADDRINUSE") {
        continue;
      }
      throw error;
    }
  }

  if (selectedPort === 0) {
    cleanup();
    throw new Error(
      `No available port found for auth callback (tried ${authCallbackPorts[0]}-${authCallbackPorts[authCallbackPorts.length - 1]}).`,
    );
  }

  serverTimeout = setTimeout(
    () => {
      settle(() => rejectWait?.(new Error("Callback server timed out")));
    },
    10 * 60 * 1000,
  );

  abortListener = () => {
    settle(() => rejectWait?.(new Error("Login cancelled")));
  };

  if (signal) {
    signal.addEventListener("abort", abortListener, { once: true });
    if (signal.aborted) {
      abortListener();
    }
  }

  return {
    callbackUrl: `http://127.0.0.1:${selectedPort}${authPath}`,
    waitForCode,
    close: (): void => {
      settle(() => rejectWait?.(new Error("Login cancelled")));
    },
  };
};
