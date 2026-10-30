import axios from 'axios';
import { reportWorkspaceRequestError } from './error-reporting';

// Create a custom axios instance
const axiosInstance = axios.create({
  withCredentials: true
});

axiosInstance.interceptors.request.use((config) => {
  try {
    const base = new URL(config.baseURL ?? window.location.origin, window.location.origin);
    const destination = new URL(config.url ?? '', base);
    if (destination.origin === window.location.origin && destination.pathname.includes('/shift/api/')
      && typeof crypto.randomUUID === 'function') {
      config.headers.set('X-Shift-Correlation-ID', crypto.randomUUID());
    }
  } catch {
    // Diagnostic metadata must not change normal request handling.
  }
  return config;
});

// Add a response interceptor to handle authentication errors
axiosInstance.interceptors.response.use(
  response => response,
  error => {
    reportWorkspaceRequestError(error);
    // Check if the error is due to authentication issues (401 Unauthorized or 419 Session Expired)
    if (error.response && (error.response.status === 401 || error.response.status === 419)) {
      // Dispatch a custom event that components can listen for
      const event = new CustomEvent('shift:auth-error', {
        detail: {
          status: error.response.status,
          message: error.response.data?.message || 'Authentication error'
        }
      });
      window.dispatchEvent(event);
    }

    // Return the error to be handled by the component
    return Promise.reject(error);
  }
);

export default axiosInstance;
