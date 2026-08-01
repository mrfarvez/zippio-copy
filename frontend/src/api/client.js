/* ============================================================
   ZIPPIO — API client
   Thin fetch wrapper used by src/api/index.js.
   - Base URL comes from VITE_API_URL (set when Laravel deploys).
   - JWT is read from localStorage and sent as a Bearer token.
   Until a backend is deployed, nothing here is called at runtime —
   the api/index.js functions resolve mock data. Swap them one by
   one to `return get('/employees')` when endpoints exist.
   ============================================================ */

const BASE_URL = import.meta.env.VITE_API_URL || '';

const TOKEN_KEY = 'zippio_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const err = new Error(`Request failed: ${res.status} ${res.statusText}`);
    err.status = res.status;
    throw err;
  }
  const body = await res.json();
  return body.data !== undefined ? body.data : body;
}

export const get = (path) => request(path);
export const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) });
export const put = (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) });
export const del = (path) => request(path, { method: 'DELETE' });
