// client/src/api.js
import axios from 'axios';
import { getStoredLanguage } from './i18n/context';

// Backend portuna dikkat (3001)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const nextConfig = { ...config, headers: { ...(config.headers || {}) } };
  if (!nextConfig.headers['Accept-Language']) {
    nextConfig.headers['Accept-Language'] = getStoredLanguage();
  }
  return nextConfig;
});

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
