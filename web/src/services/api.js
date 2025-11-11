

// src/services/api.js
import axios from "axios";
import useAuthStore from "../store/useAuthStore";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token)
    config.headers = {
      ...(config.headers || {}),
      Authorization: `Bearer ${token}`,
    };
  return config;
});

export default api;
