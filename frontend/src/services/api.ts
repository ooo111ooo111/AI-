import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // AI分析可能需要较长时间
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

api.defaults.withCredentials = true;

// 请求拦截器：自动从 localStorage 中读取 token 并添加到 Authorization Header
api.interceptors.request.use(
  (config) => {
    // 从 localStorage 中获取 access_token
    const token = localStorage.getItem('access_token');

    // 如果存在 token 且请求头中没有 Authorization，则添加
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器：处理 401 错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 如果是 401 错误，清除本地认证状态并跳转到登录页
      console.warn('认证失败，请重新登录');
      // 可以在这里添加跳转到登录页的逻辑
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
