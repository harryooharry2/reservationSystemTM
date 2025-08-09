// Simple client-side auth helpers

export const API_BASE: string =
  (import.meta as any)?.env?.PUBLIC_API_BASE || 'http://localhost:3000/api';

const TOKEN_KEY = 'sb_token';

export function saveToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export function requireAuthRedirect(path: string = '/login'): void {
  if (typeof window !== 'undefined' && !getToken()) {
    window.location.href = path;
  }
}

export async function authFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  };
  if (token) {
    (headers as any)['Authorization'] = `Bearer ${token}`;
  }
  return fetch(input, { ...init, headers });
}
