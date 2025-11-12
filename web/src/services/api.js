

// // src/services/api.js
// import axios from "axios";
// import useAuthStore from "../store/useAuthStore";

// const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

// const api = axios.create({
//   baseURL: API_BASE,
//   timeout: 15000,
//   withCredentials: false,
// });

// api.interceptors.request.use((config) => {
//   const token = useAuthStore.getState().token;
//   if (token)
//     config.headers = {
//       ...(config.headers || {}),
//       Authorization: `Bearer ${token}`,
//     };
//   return config;
// });

// export default api;





// src/services/api.js
import axios from "axios";
import useAuthStore from "../store/useAuthStore";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  withCredentials: false,
});

/* -------------------------------------------------------------------------- */
/* ✅ Always attach auth token (if available)                                 */
/* -------------------------------------------------------------------------- */
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

/* -------------------------------------------------------------------------- */
/* ✅ Global error handler (optional & safe)                                  */
/* -------------------------------------------------------------------------- */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only log server issues (not 404/validation errors)
    if (error?.response?.status >= 500) {
      console.error("❌ API Server Error:", error.response?.data || error);
    }
    return Promise.reject(error);
  }
);

export default api;
