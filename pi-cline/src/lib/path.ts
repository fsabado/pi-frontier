export function normalizePath(value: unknown): string {
  if (typeof value !== "string") {
    return ".";
  }

  return value.trim().replace(/^@/, "") || ".";
}

/**
 * Normalize a relative path for Cline CLI tool-result text.
 * The Cline CLI always uses a `./` prefix for workspace-relative paths.
 */
export function clineDisplayPath(value: unknown): string {
  const p = normalizePath(value);
  if (p !== "." && !p.startsWith("/") && !p.startsWith("./")) {
    return `./${p}`;
  }
  return p;
}
