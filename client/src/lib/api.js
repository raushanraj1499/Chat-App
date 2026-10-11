import axios from 'axios';

const api = axios.create({ withCredentials: true, timeout: 15000 });
let sessionVersion = 0;
const expiryListeners = new Set();

export const advanceSession = () => ++sessionVersion;
export const onSessionExpired = (listener) => {
  expiryListeners.add(listener);
  return () => expiryListeners.delete(listener);
};

api.interceptors.request.use((config) => {
  config.sessionVersion = sessionVersion;
  return config;
});

api.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401 && !error.config?.skipAuthExpiry &&
      error.config?.sessionVersion === sessionVersion) {
    expiryListeners.forEach((listener) => listener());
  }
  return Promise.reject(error);
});

export const isCanceled = (error) => axios.isCancel(error);
export const errorMessage = (error, fallback = 'Request failed. Please try again.') => {
  if (!error.response) return 'Cannot reach the server. Check your connection and try again.';
  return error.response.data?.message || fallback;
};

export default api;
