export const SYSTEM_CONTENT_MARKERS = [
  "[TASK RESUMPTION]",
  "<hook_context",
  "[Response interrupted",
  "Task was interrupted",
] as const;

export function containsSystemMarker(text: string): boolean {
  return SYSTEM_CONTENT_MARKERS.some((marker) => text.includes(marker));
}
