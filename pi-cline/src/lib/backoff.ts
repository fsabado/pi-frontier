export interface BackoffOptions {
  retries: number;
  delayMs: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function backoff<T>(
  fn: () => Promise<T>,
  options: BackoffOptions,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= options.retries) {
        throw error;
      }

      if (options.shouldRetry && !options.shouldRetry(error, attempt)) {
        throw error;
      }

      await sleep(options.delayMs * attempt);
    }
  }

  throw lastError;
}
