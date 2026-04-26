type FetchBudgetOptions = {
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
  retryStatuses?: number[];
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithBudget(
  url: string,
  init: RequestInit,
  options?: FetchBudgetOptions
): Promise<Response> {
  const timeoutMs = Math.max(500, Number(options?.timeoutMs ?? 8000) || 8000);
  const retries = Math.max(0, Number(options?.retries ?? 1) || 1);
  const backoffMs = Math.max(0, Number(options?.backoffMs ?? 250) || 250);
  const retryStatuses = options?.retryStatuses || [408, 425, 429, 500, 502, 503, 504];

  let lastError: unknown = null;
  const maxAttempts = retries + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok || !retryStatuses.includes(response.status) || attempt >= maxAttempts) {
        return response;
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;

      if (attempt >= maxAttempts) {
        break;
      }
    }

    if (attempt < maxAttempts) {
      await delay(backoffMs * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("fetchWithBudget failed");
}
