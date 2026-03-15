import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export function createWorkspace(
  prefix: string,
  options: { readme?: boolean } = { readme: true },
) {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  if (options.readme) {
    writeFileSync(path.join(dir, "README.md"), "# workspace\n", "utf8");
  }
  return dir;
}

export async function withWorkspace(
  prefix: string,
  fn: (dir: string) => Promise<void>,
  options: { readme?: boolean } = { readme: true },
) {
  const dir = createWorkspace(prefix, options);
  try {
    await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
