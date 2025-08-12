// Simple client-side auth helpers

export const API_BASE =
  import.meta.env?.PUBLIC_API_BASE || 'http://localhost:3000/api';

const TOKEN_KEY = 'sb_token';

export function saveToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export function requireAuthRedirect(path = '/login') {
  if (typeof window !== 'undefined' && !getToken()) {
    window.location.href = path;
  }
}

export async function authFetch(input, init = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(input, { ...init, headers });
}
