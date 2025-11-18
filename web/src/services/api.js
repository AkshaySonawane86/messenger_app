


// src/services/api.js
import axios from "axios";
import useAuthStore from "../store/useAuthStore";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

const api = axios.create({
  baseURL: API_BASE.replace(/\/$/, ""),
  timeout: 15000,
  withCredentials: false,
});

api.interceptors.request.use(
  (config) => {
    try {
      const token = useAuthStore.getState()?.token;
      if (token) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        };
      }
    } catch (err) {
      console.warn("⚠️ Failed to attach token:", err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status >= 500) {
      console.error("❌ API Server Error:", error.response?.data || error);
    }
    return Promise.reject(error);
  }
);

export default api;
