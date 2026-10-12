// Em desenvolvimento (localhost) usa a API local; em produção usa o mesmo domínio (/api via Nginx).
const isLocalhost =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);

export const API_BASE_URL = isLocalhost ? 'http://localhost:5102/api' : '/api';
