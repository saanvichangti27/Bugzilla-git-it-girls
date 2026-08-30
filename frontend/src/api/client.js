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

export const bugService = {
  searchSimilar: async (query) => {
    const response = await api.get(`/bugs/similar?q=${encodeURIComponent(query)}`);
    return response.data;
  },

  followBug: async (bugId) => {
    const response = await api.post(`/bugs/${bugId}/follow`);
    return response.data;
  },

  unfollowBug: async (bugId) => {
    const response = await api.post(`/bugs/${bugId}/unfollow`);
    return response.data;
  },

  uploadAttachment: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/bugs/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }
};

export const notificationService = {
  list: async (unreadOnly = false) => {
    const res = await api.get(`/notifications${unreadOnly ? '?unread_only=true' : ''}`);
    return res.data;
  },
  count: async () => {
    const res = await api.get('/notifications/count');
    return res.data;
  },
  markRead: async (id) => {
    const res = await api.patch(`/notifications/${id}/read`);
    return res.data;
  },
  markAllRead: async () => {
    const res = await api.patch('/notifications/read-all');
    return res.data;
  },
  getPreferences: async () => {
    const res = await api.get('/notifications/preferences');
    return res.data;
  },
  updatePreferences: async (preferences) => {
    const res = await api.put('/notifications/preferences', { preferences });
    return res.data;
  },
};

export const automationService = {
  listRules: async () => {
    const res = await api.get('/admin/automation-rules');
    return res.data;
  },
  createRule: async (rule) => {
    const res = await api.post('/admin/automation-rules', rule);
    return res.data;
  },
  toggleRule: async (ruleId, enabled) => {
    const res = await api.patch(`/admin/automation-rules/${ruleId}`, { enabled });
    return res.data;
  },
  deleteRule: async (ruleId) => {
    const res = await api.delete(`/admin/automation-rules/${ruleId}`);
    return res.data;
  },
  getLogs: async (ruleId) => {
    const destination = ruleId ? `automation_rule:${ruleId}` : undefined;
    const params = destination ? `?destination=${encodeURIComponent(destination)}` : '';
    const res = await api.get(`/webhook-logs${params}`);
    return res.data;
  },
};

export const userService = {
  list: async (search) => {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await api.get(`/users${params}`);
    return res.data;
  },
};
