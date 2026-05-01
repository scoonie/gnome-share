import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const api = axios.create({
  baseURL: "/api",
});

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

let refreshPromise: Promise<unknown> | null = null;

function refreshAccessToken() {
  refreshPromise ??= api.post("/auth/token").finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const axiosError = error as AxiosError;
    const config = axiosError.config as RetryableRequestConfig | undefined;
    if (
      axiosError.response?.status === 401 &&
      config &&
      !config._retry &&
      config.url !== "/auth/token"
    ) {
      config._retry = true;
      await refreshAccessToken();
      return api(config);
    }
    throw error;
  },
);

export default api;
