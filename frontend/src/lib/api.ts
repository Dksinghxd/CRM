import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor - add auth token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('smartreach_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor - handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('smartreach_token');
      localStorage.removeItem('smartreach_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (name: string, email: string, password: string) =>
    api.post('/auth/register', { name, email, password }),
  me: () => api.get('/auth/me'),
};

// ─── Customers ────────────────────────────────────────────────────────────────
export const customerApi = {
  list: (params?: Record<string, any>) =>
    api.get('/customers', { params }),
  get: (id: string) => api.get(`/customers/${id}`),
  create: (data: any) => api.post('/customers', data),
  update: (id: string, data: any) => api.put(`/customers/${id}`, data),
  delete: (id: string) => api.delete(`/customers/${id}`),
  stats: () => api.get('/customers/stats'),
  importSample: () => api.post('/customers/import-sample'),
};

// ─── Orders ───────────────────────────────────────────────────────────────────
export const orderApi = {
  list: (params?: Record<string, any>) =>
    api.get('/orders', { params }),
  byCustomer: (customerId: string, params?: Record<string, any>) =>
    api.get(`/orders/customer/${customerId}`, { params }),
  create: (data: any) => api.post('/orders', data),
  stats: () => api.get('/orders/stats'),
};

// ─── Segments ─────────────────────────────────────────────────────────────────
export const segmentApi = {
  list: () => api.get('/segments'),
  get: (id: string) => api.get(`/segments/${id}`),
  create: (data: any) => api.post('/segments', data),
  update: (id: string, data: any) => api.put(`/segments/${id}`, data),
  delete: (id: string) => api.delete(`/segments/${id}`),
  evaluate: (id: string, params?: Record<string, any>) =>
    api.post(`/segments/${id}/evaluate`, {}, { params }),
  preview: (rules: any[], operator?: string) =>
    api.post('/segments/preview', { rules, operator }),
};

// ─── Campaigns ────────────────────────────────────────────────────────────────
export const campaignApi = {
  list: (params?: Record<string, any>) =>
    api.get('/campaigns', { params }),
  get: (id: string) => api.get(`/campaigns/${id}`),
  create: (data: any) => api.post('/campaigns', data),
  update: (id: string, data: any) => api.put(`/campaigns/${id}`, data),
  delete: (id: string) => api.delete(`/campaigns/${id}`),
  launch: (id: string) => api.post(`/campaigns/${id}/launch`),
  communications: (id: string, params?: Record<string, any>) =>
    api.get(`/campaigns/${id}/communications`, { params }),
};

// ─── Analytics ────────────────────────────────────────────────────────────────
export const analyticsApi = {
  dashboard: () => api.get('/analytics/dashboard'),
  campaigns: () => api.get('/analytics/campaigns'),
  revenue: () => api.get('/analytics/revenue'),
};

// ─── AI ───────────────────────────────────────────────────────────────────────
export const aiApi = {
  buildSegment: (prompt: string) =>
    api.post('/ai/segment-builder', { prompt }),
  generateMessage: (data: { goal: string; audience: string; tone: string; channel: string }) =>
    api.post('/ai/generate-message', data),
  analyzePerformance: (campaignId: string) =>
    api.post('/ai/analyze-performance', { campaignId }),
  chat: (messages: Array<{ role: string; content: string }>) =>
    api.post('/ai/chat', { messages }),
  audienceSuggestions: () =>
    api.get('/ai/audience-suggestions'),
};

export default api;
