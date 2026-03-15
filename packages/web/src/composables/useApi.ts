/** API error with an optional machine-readable code (e.g. `DUPLICATE_NAME`). */
export class ApiError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

/** Thin fetch wrapper for the `/api` backend. Returns typed JSON or throws on error. */
export function useApi() {
  async function request<T>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    const res = await fetch(`/api${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new ApiError(body?.error ?? `Request failed (${res.status})`, body?.code);
    }

    return res.json();
  }

  return {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body: unknown) =>
      request<T>(path, { method: "POST", body: JSON.stringify(body) }),
    put: <T>(path: string, body: unknown) =>
      request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
    del: (path: string) =>
      request<void>(path, { method: "DELETE" }),
  };
}
