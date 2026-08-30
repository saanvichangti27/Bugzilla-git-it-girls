import axios from 'axios';

// Create a configured axios instance
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Basic auth service
export const authService = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    if (response.data?.data?.token) {
      localStorage.setItem('token', response.data.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.data.user));
    }
    return response.data;
  },

  signup: async (name, email, password, role) => {
    const response = await api.post('/auth/signup', { name, email, password, role });
    if (response.data?.data?.token) {
      localStorage.setItem('token', response.data.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.data.user));
    }
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  updateGithubSettings: async (github_token, github_repo) => {
    const response = await api.patch('/users/me/github', { github_token, github_repo });
    if (response.data?.data) {
      localStorage.setItem('user', JSON.stringify(response.data.data));
    }
    return response.data;
  },

  getCurrentUser: () => {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch {
      return null;
    }
  }
};

// AI service (Phase 3)
export const aiService = {
  suggestFields: async (title, description) => {
    const response = await api.post('/bugs/suggest-fields', { title, description });
    return response.data;
  },

  summarizeBug: async (bugId) => {
    const response = await api.post(`/bugs/${bugId}/summarize`);
    return response.data;
  }
};
