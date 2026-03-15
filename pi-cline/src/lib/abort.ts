export interface RequestAbortContext {
  signal: AbortSignal;
  cleanup(): void;
  wasAborted(): boolean;
}

export function createRequestAbortContext(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): RequestAbortContext {
  const timeoutController = new AbortController();

  const timeout = setTimeout(() => {
    timeoutController.abort(
      new Error(`Request timed out after ${timeoutMs}ms`),
    );
  }, timeoutMs);

  const mergedSignal = signal
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal;

  return {
    signal: mergedSignal,
    cleanup: () => clearTimeout(timeout),
    wasAborted: () => mergedSignal.aborted,
  };
}
