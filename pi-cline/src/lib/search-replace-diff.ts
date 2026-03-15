export interface SearchReplaceBlock {
  search: string;
  replace: string;
}

const SEARCH_REPLACE_BLOCK_REGEX =
  /------- SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n\+\+\+\+\+\+\+ REPLACE/g;

export function parseSearchReplaceBlocks(
  diff: string,
): SearchReplaceBlock[] | null {
  const matches: SearchReplaceBlock[] = [];
  const normalized = diff.replace(/\r\n/g, "\n");
  let match = SEARCH_REPLACE_BLOCK_REGEX.exec(normalized);

  while (match !== null) {
    matches.push({
      search: match[1] ?? "",
      replace: match[2] ?? "",
    });
    match = SEARCH_REPLACE_BLOCK_REGEX.exec(normalized);
  }

  return matches.length > 0 ? matches : null;
}

export function buildSearchReplaceDiff(
  oldText: string,
  newText: string,
): string {
  return [
    "------- SEARCH",
    oldText,
    "=======",
    newText,
    "+++++++ REPLACE",
  ].join("\n");
}

export function applySearchReplaceDiff(
  content: string,
  diff: string,
  absolutePath: string,
): string {
  const blocks = parseSearchReplaceBlocks(diff);
  if (!blocks) {
    throw new Error("No SEARCH/REPLACE blocks found");
  }

  let nextContent = content;
  for (const block of blocks) {
    const index = nextContent.indexOf(block.search);
    if (index === -1) {
      throw new Error(
        `SEARCH block not found in ${absolutePath}: ${JSON.stringify(block.search)}`,
      );
    }

    nextContent =
      nextContent.slice(0, index) +
      block.replace +
      nextContent.slice(index + block.search.length);
  }

  return nextContent;
}
