import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor to handle global 401s if needed
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Potentially emit an event or handle global logout
      console.warn("Unauthorized access - 401");
    }
    return Promise.reject(error);
  }
);

export default api;
