const BASE = "/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get<T>(path: string, token?: string): Promise<T> {
    return request<T>(path, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
  post<T>(path: string, body: unknown, token?: string): Promise<T> {
    return request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
  delete<T>(path: string, token: string): Promise<T> {
    return request<T>(path, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};
