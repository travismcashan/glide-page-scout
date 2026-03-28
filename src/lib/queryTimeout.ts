export class QueryTimeoutError extends Error {
  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'QueryTimeoutError';
  }
}

export async function withQueryTimeout<T>(promise: Promise<T>, timeoutMs = 12000, message?: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new QueryTimeoutError(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}