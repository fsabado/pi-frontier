import { spawn } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";

interface Turn {
  model: string;
  prompt: string;
}

interface Scenario {
  name: string;
  turns(ctx: { model: string; other: string }): Turn[];
}

interface CapturedCall {
  scope: string;
  path: string;
  body: unknown;
  response: unknown;
  rawHeaders: Record<string, string>;
  reqheaders: Record<string, string>;
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT_CLINE_GLOBAL_STATE = path.join(
  ROOT,
  "scripts",
  "cline-global-state.json",
);
const OUT = path.join(ROOT, "test/scenarios");
const ENTRY = path.join(ROOT, "node_modules/cline/dist/cli.mjs");
const RUNNER = path.join(ROOT, "scripts/cline-single-turn-runner.mjs");
const RETRIES = 5;
const MARKER = "__PI_CAPTURE_CALL__";
const KAT = "cline/kwaipilot/kat-coder-pro";
const TRINITY = "cline/arcee-ai/trinity-large-preview:free";

const lines = (...parts: string[]) => parts.join("\n");

function completionPrompt(
  tag: string,
  result: string,
  options?: {
    inst?: string[];
    resultLine?: string;
    attempt?: string;
    trail?: string[];
  },
): string {
  return lines(
    tag,
    ...(options?.inst ?? []),
    options?.attempt ?? "Use attempt_completion tool.",
    options?.resultLine ?? "Set result to exactly this text and nothing else:",
    result,
    ...(options?.trail ?? []),
  );
}

const SCENARIOS: Scenario[] = [
  {
    name: "test-stream",
    turns: ({ model }) => {
      const cont = { inst: ["Continue the same task context."] };
      return [
        { model, prompt: completionPrompt("[stream/1]", "STREAM-ACK-1") },
        { model, prompt: completionPrompt("[stream/2]", "STREAM-ACK-2", cont) },
        {
          model,
          prompt: completionPrompt(
            "[stream/3]",
            '{"status":"ok","case":"test-stream"}',
            {
              ...cont,
              resultLine: "Set result to exactly this JSON and nothing else:",
            },
          ),
        },
      ];
    },
  },
  {
    name: "test-stream-with-tool-call-simple",
    turns: ({ model }) => [
      {
        model,
        prompt: lines(
          "[tool-simple/1]",
          "Use tools:",
          "1) Create ./tmp/note.txt: line1=hello, line2=world",
          "2) Read the file back",
          "3) Run: shasum -a 256 ./tmp/note.txt",
          "End with token SIMPLE-TOOL-OK.",
        ),
      },
      {
        model,
        prompt: lines(
          "[tool-simple/2]",
          "Append line3=done to ./tmp/note.txt, read it, end with SIMPLE-TOOL-TURN2-OK.",
        ),
      },
    ],
  },
  {
    name: "test-stream-with-tool-call-complex",
    turns: ({ model }) => {
      const shellCommand =
        "set -euo pipefail; mkdir -p .tmp/cx; echo hello > .tmp/cx/a.txt; echo world >> .tmp/cx/a.txt; wc -l .tmp/cx/a.txt > .tmp/cx/stats.txt";
      return [
        {
          model,
          prompt: lines(
            "[tool-complex/1]",
            `Run: ${shellCommand}`,
            "Read .tmp/cx/stats.txt, summarize in one line. End with COMPLEX-TOOL-OK.",
          ),
        },
        {
          model,
          prompt: lines(
            "[tool-complex/2]",
            "Create .tmp/cx/report.md with title + bullet list.",
            "Read it and end with COMPLEX-TOOL-TURN2-OK.",
          ),
        },
      ];
    },
  },
  {
    name: "test-stream-with-model-switch",
    turns: ({ model, other }) => [
      { model, prompt: completionPrompt("[switch/1]", "SWITCH-TURN1-OK") },
      {
        model: other,
        prompt: completionPrompt("[switch/2]", "SWITCH-TURN2-OK", {
          inst: ["Model switched. Keep same taskId."],
        }),
      },
      {
        model,
        prompt: completionPrompt("[switch/3]", "SWITCH-TURN3-OK", {
          inst: ["Model switched back."],
        }),
      },
    ],
  },
  {
    name: "test-stream-with-tool-call-and-model-switch",
    turns: ({ model, other }) => [
      {
        model,
        prompt: lines(
          "[tool-switch/1]",
          "Create .tmp/cross.txt with: CROSS-1. Read it, end with CROSS-TURN1-OK.",
        ),
      },
      {
        model: other,
        prompt: lines(
          "[tool-switch/2]",
          "Append CROSS-2 to .tmp/cross.txt. cat -n .tmp/cross.txt. End with CROSS-TURN2-OK.",
        ),
      },
      {
        model,
        prompt: lines(
          "[tool-switch/3]",
          "Read .tmp/cross.txt, one-line summary. End with CROSS-TURN3-OK.",
        ),
      },
    ],
  },
  {
    name: "test-context-overflow-kat-to-trinity",
    turns: () => {
      const chunkCount = 4;
      const chunkSize = 2_000;
      const result: Turn[] = [];
      for (let i = 1; i <= chunkCount; i++) {
        let fill = "";
        const seed = `blk${i}-`;
        while (fill.length < chunkSize)
          fill += `${seed}${result.length.toString(36)} abcdefghij `;
        result.push({
          model: KAT,
          prompt: lines(
            `[overflow/${i}]`,
            `Chunk ${i}/${chunkCount}. Store this block in task context for later turns.`,
            "Do not quote or repeat the block.",
            "Only use attempt_completion.",
            "",
            "[BLOCK-START]",
            fill.slice(0, chunkSize),
            "[BLOCK-END]",
            "",
            "Use attempt_completion tool immediately.",
            "Set result to exactly this text and nothing else:",
            `OVF-ACK-${i}`,
          ),
        });
      }
      result.push({
        model: TRINITY,
        prompt: completionPrompt("[overflow/switch]", "OVF-SWITCH-OK", {
          inst: ["Model switched. Only use attempt_completion."],
        }),
      });
      return result;
    },
  },
];

function createRuntimeClineDir(): string {
  const runtimeDir = mkdtempSync(path.join(os.tmpdir(), "pi-cline-record-"));
  const dataDir = path.join(runtimeDir, "data");
  mkdirSync(dataDir, { recursive: true });
  copyFileSync(
    SCRIPT_CLINE_GLOBAL_STATE,
    path.join(dataDir, "globalState.json"),
  );
  return runtimeDir;
}

function spawnRunner(
  args: string[],
  clineDir: string,
): Promise<{ code: number; out: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [RUNNER], {
      cwd: ROOT,
      stdio: "pipe",
      env: {
        ...process.env,
        FORCE_COLOR: "0",
        NO_COLOR: "1",
        CLINE_DIR: clineDir,
        CLINE_NON_INTERACTIVE: "1",
        CLINE_RUNNER_ARGS_JSON: JSON.stringify(args),
        CLINE_RUNNER_ENTRY: ENTRY,
      },
    });
    let out = "";
    const onData = (chunk: Buffer) => {
      out += chunk;
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    const timer = setTimeout(() => child.kill("SIGTERM"), 600_000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ code: exitCode ?? 1, out });
    });
  });
}

function parseCaptures(raw: string) {
  const calls: CapturedCall[] = [];
  const clean: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(MARKER)) {
      clean.push(line);
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed.slice(MARKER.length));
      if (parsed.scope) calls.push(parsed);
    } catch {
      /* malformed */
    }
  }
  return { clean: clean.join("\n"), calls };
}

async function runTurn(
  prompt: string,
  model: string,
  cwd: string,
  clineDir: string,
  taskId?: string,
) {
  const modelId = model.replace(/^cline\//, "");
  const args = ["task", prompt, "--model", modelId, "-y", "--json"];
  args.push("--max-consecutive-mistakes", "10", "--cwd", cwd);
  if (taskId) args.push("--taskId", taskId);

  let lastErr = new Error("runTurn: no attempts");
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    const startTime = Date.now();
    const { code, out } = await spawnRunner(args, clineDir);
    const raw = stripVTControlCharacters(out);
    const { clean, calls } = parseCaptures(raw);

    if (code === 0 && calls.length > 0) {
      const tid = clean.match(/"taskId"\s*:\s*"([^"]+)"/)?.[1] ?? taskId;
      if (!tid) throw new Error("No taskId found");
      return { taskId: tid, durationMs: Date.now() - startTime, calls };
    }

    const msg = code !== 0 ? `exit ${code}` : "no captures";
    lastErr = new Error(`${msg}\n${clean}`);
    const retryable =
      code === 143 ||
      /unauthorized|sign in|auth|rate.?limit|429|503/i.test(clean);
    if (attempt < RETRIES && retryable) {
      const delay = 10_000 * attempt;
      console.log(
        `[record]     ⟳ retry ${attempt}/${RETRIES} in ${delay / 1000}s (${msg})`,
      );
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    } else {
      throw lastErr;
    }
  }
  throw lastErr;
}

function sanitize(json: string, workspace: string): string {
  let result = json;
  if (workspace) result = result.replaceAll(workspace, "/workspace");
  result = result.replace(/\/(?:Users|home)\/[a-zA-Z0-9._-]+/g, "/home/user");
  result = result.replace(
    /# Current Time\\n[^<\\]*/g,
    "# Current Time\\n1/1/1970, 12:00:00 AM (UTC, UTC+0:00)\\n",
  );
  result = result.replace(
    /\\?"latestGitCommitHash\\?":\s*\\?"[a-f0-9]{40}\\?"/g,
    (matched) => matched.replace(/[a-f0-9]{40}/, "0".repeat(40)),
  );
  result = result.replace(
    /origin:\s*https:\/\/github\.com\/[^\s"\\]+\.git/g,
    "origin: https://github.com/test/test.git",
  );
  return result;
}

function parseJsonSafe(value: unknown): unknown {
  if (typeof value !== "string") return value ?? null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function buildFixture(call: CapturedCall) {
  const origin = new URL(call.scope).origin;
  const apiPath = call.path.startsWith("/") ? call.path : `/${call.path}`;
  return {
    request: {
      method: "POST",
      url: `${origin}${apiPath}`,
      headers: call.reqheaders,
      body: parseJsonSafe(call.body),
    },
    response: {
      headers: call.rawHeaders,
      body: parseJsonSafe(call.response),
    },
  };
}

function buildSlug(name: string, turns: Turn[]): string {
  const encodeModel = (id: string) =>
    id.replace(/^cline\//, "").replace(/[/:]/g, "__");
  const models = [...new Set(turns.map((turn) => turn.model))];
  return `${name}--${models.map(encodeModel).join("--")}`;
}

function writeJsonFile(filePath: string, data: unknown) {
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function record(slug: string, turns: Turn[]) {
  const root = path.join(OUT, slug);
  const fixturesDir = path.join(root, "fixtures");
  const logsDir = path.join(root, "logs");
  const workspaceDir = path.join(root, "workspace");
  const clineDir = createRuntimeClineDir();

  try {
    for (const dir of [fixturesDir, logsDir, workspaceDir])
      mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(workspaceDir, "README.md"), "# workspace\n");
    writeJsonFile(
      path.join(logsDir, "prompts.json"),
      turns.map((turn, index) => ({
        turn: index + 1,
        model: turn.model,
        prompt: turn.prompt,
      })),
    );

    const turnLogs: unknown[] = [];
    let taskId: string | undefined;

    for (let index = 0; index < turns.length; index++) {
      const turn = turns[index];
      if (!turn) {
        throw new Error(`Missing turn at index ${index}`);
      }

      console.log(
        `[record]   turn ${index + 1}/${turns.length} [${turn.model}]`,
      );
      const result = await runTurn(
        turn.prompt,
        turn.model,
        workspaceDir,
        clineDir,
        taskId,
      );
      taskId = result.taskId;

      const lastCall = result.calls[result.calls.length - 1];
      if (!lastCall) {
        throw new Error(`No captured calls for turn ${index + 1}`);
      }

      const fixture = JSON.parse(
        sanitize(JSON.stringify(buildFixture(lastCall)), workspaceDir),
      );
      const fileName = `turn-${String(index + 1).padStart(2, "0")}.json`;
      writeJsonFile(path.join(fixturesDir, fileName), fixture);
      turnLogs.push({
        turn: index + 1,
        model: turn.model,
        taskId: "0000000000000",
        durationMs: result.durationMs,
        recordedCalls: result.calls.length,
      });
    }
    writeJsonFile(path.join(logsDir, "turns.json"), turnLogs);
  } finally {
    rmSync(clineDir, { recursive: true, force: true });
  }
}

async function main() {
  for (const dep of [ENTRY, RUNNER, SCRIPT_CLINE_GLOBAL_STATE]) {
    if (!existsSync(dep)) {
      console.error(`Not found: ${dep}`);
      process.exit(1);
    }
  }

  mkdirSync(OUT, { recursive: true });
  const seen = new Set<string>();
  let total = 0;
  let failed = 0;

  for (const model of [KAT, TRINITY]) {
    const other = model === KAT ? TRINITY : KAT;
    for (const scenario of SCENARIOS) {
      const turns = scenario.turns({ model, other });
      const slug = buildSlug(scenario.name, turns);
      if (seen.has(slug)) continue;
      seen.add(slug);

      if (existsSync(path.join(OUT, slug, "logs/turns.json"))) {
        console.log(`[record] ● ${slug} (cached)`);
        total++;
        continue;
      }

      total++;
      console.log(`[record] ▶ ${slug}`);
      try {
        await record(slug, turns);
        console.log(`[record] ✓ ${slug}`);
      } catch (error) {
        failed++;
        const msg = error instanceof Error ? error.message : String(error);
        console.log(`[record] ✗ ${slug}\n  ${msg}`);
      }
    }
  }

  console.log(
    `\n[record] Done: ${total - failed}/${total} passed, ${failed} failed`,
  );
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
