// src/api/axios.js
import axios from "axios";

const resolveDefaultApiBaseUrl = () => {
  if (typeof window !== "undefined") {
    const host = window.location.hostname || "localhost";
    return `http://${host}:8000`;
  }
  return "http://localhost:8000";
};

const buildLocalFallbackBaseUrl = (baseURL) => {
  if (!baseURL) return "";
  if (baseURL.includes("127.0.0.1")) {
    return baseURL.replace("127.0.0.1", "localhost");
  }
  if (baseURL.includes("localhost")) {
    return baseURL.replace("localhost", "127.0.0.1");
  }
  return "";
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || resolveDefaultApiBaseUrl(),
  withCredentials: false,
});

api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("access_token") || localStorage.getItem("token");

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const isNetworkError =
      !error?.response &&
      (error?.code === "ERR_NETWORK" ||
        String(error?.message || "")
          .toLowerCase()
          .includes("network error"));

    const canRetryWithLocalFallback =
      isNetworkError &&
      error?.config &&
      !error.config.__localHostRetried &&
      typeof error.config.url === "string";

    if (canRetryWithLocalFallback) {
      const currentBaseUrl =
        error.config.baseURL || api.defaults.baseURL || "";
      const fallbackBaseUrl = buildLocalFallbackBaseUrl(currentBaseUrl);
      if (fallbackBaseUrl) {
        error.config.__localHostRetried = true;
        error.config.baseURL = fallbackBaseUrl;
        return api.request(error.config);
      }
    }

    const requestUrl = String(error?.config?.url || "");
    const isLoginRequest = requestUrl.includes("/auth/login");

    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  },
);

export default api;
export const apiService = api;
