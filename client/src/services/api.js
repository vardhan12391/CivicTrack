import axios from 'axios';

// Central axios instance.
// - In dev, Vite proxies /api to Express (same origin => cookies just work).
// - In production, VITE_API_BASE_URL points at the deployed Render backend.
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 20000,
});

let inMemoryCsrf = null;

// Capture CSRF token from response headers (supports cross-origin where document.cookie cannot read cross-site cookies)
api.interceptors.response.use(
  (response) => {
    const headerToken = response.headers?.['x-csrf-token'];
    if (headerToken) {
      inMemoryCsrf = headerToken;
      try { sessionStorage.setItem('ct_csrf', headerToken); } catch { /* ignore */ }
    }
    return response;
  },
  (error) => {
    const headerToken = error.response?.headers?.['x-csrf-token'];
    if (headerToken) {
      inMemoryCsrf = headerToken;
      try { sessionStorage.setItem('ct_csrf', headerToken); } catch { /* ignore */ }
    }
    return Promise.reject(error);
  }
);

/** Read a cookie value by name (used for the CSRF double-submit token). */
export function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// Attach the CSRF token on every mutating request (double-submit pattern).
api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  if (method !== 'get') {
    let sessionStoredCsrf = null;
    try { sessionStoredCsrf = sessionStorage.getItem('ct_csrf'); } catch { /* ignore */ }
    const token = readCookie('ct_csrf') || inMemoryCsrf || sessionStoredCsrf;
    if (token) config.headers['x-csrf-token'] = token;
  }
  return config;
});

export default api;
