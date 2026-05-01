import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (
      error.response?.status === 401 &&
      config &&
      !config._retry &&
      config.url !== "/auth/token"
    ) {
      config._retry = true;
      await api.post("/auth/token");
      return api(config);
    }
    throw error;
  },
);

export default api;
