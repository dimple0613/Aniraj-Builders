import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Request interceptor to add company header
api.interceptors.request.use(async (config) => {
  // Get session to access token
  const session = await fetch('/api/auth/me').then(res => res.json()).catch(() => null);
  
  if (session?.user?.company_id) {
    config.headers.set('x-company-id', session.user.company_id);
  }
  
  return config;
});

export default api;