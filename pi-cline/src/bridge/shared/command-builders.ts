import { normalizePath } from "../../lib/path";

export function toBooleanFlag(value: unknown) {
  return String(value).toLowerCase() === "true";
}

export function shellQuote(value: string) {
  return `'${value.replace(/'/g, `"'"'`)}'`;
}

export function buildListFilesCommand(targetPath: string, recursive: boolean) {
  const quotedPath = shellQuote(normalizePath(targetPath));
  return recursive
    ? `find ${quotedPath} | sort`
    : `find ${quotedPath} -mindepth 1 -maxdepth 1 | sort`;
}

export function buildSearchFilesCommand(
  targetPath: string,
  regex: string,
  filePattern: string | undefined,
) {
  return [
    "rg",
    "-n",
    "--no-heading",
    "--color",
    "never",
    filePattern ? `-g ${shellQuote(filePattern)}` : "",
    `-e ${shellQuote(regex)}`,
    shellQuote(normalizePath(targetPath)),
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildListCodeDefinitionNamesCommand(targetPath: string) {
  const quotedPath = shellQuote(normalizePath(targetPath));
  const globArgs = [
    "-g '*.ts'",
    "-g '*.tsx'",
    "-g '*.js'",
    "-g '*.jsx'",
    "-g '*.mjs'",
    "-g '*.cjs'",
    "-g '*.py'",
    "-g '*.go'",
    "-g '*.rs'",
    "-g '*.java'",
    "-g '*.kt'",
    "-g '*.swift'",
  ].join(" ");
  const regex =
    "^(export\\s+)?(async\\s+function|function|class|interface|type|enum)\\s+[A-Za-z_][A-Za-z0-9_]*|^(export\\s+)?const\\s+[A-Za-z_][A-Za-z0-9_]*\\s*=\\s*(async\\s*)?\\(";

  return [
    "rg",
    "-n",
    "--no-heading",
    "--color",
    "never",
    globArgs,
    `-e ${shellQuote(regex)}`,
    quotedPath,
  ].join(" ");
}
