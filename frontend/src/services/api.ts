import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // AI分析可能需要较长时间
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
