import axios, { type AxiosInstance } from "axios";

export const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: false,
});

// Attach the access token (stored by the auth layer) to every request.
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Single in-flight refresh to avoid stampede on 401.
let refreshPromise: Promise<string | null> | null = null;

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const token = await (refreshPromise ?? (refreshPromise = refreshAccessToken()));
        refreshPromise = null;
        if (token) {
          original.headers.Authorization = `Bearer ${token}`;
          return apiClient(original);
        }
      } catch {
        refreshPromise = null;
      }
    }
    return Promise.reject(error);
  },
);

// --- access token storage ( bridging backend JWT with the client ) ---
const ACCESS_KEY = "zentra.access";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function setAccessToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(ACCESS_KEY, token);
  else window.localStorage.removeItem(ACCESS_KEY);
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = window.localStorage.getItem("zentra.refresh");
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/refresh`,
      { refreshToken },
    );
    setAccessToken(data.accessToken);
    window.localStorage.setItem("zentra.refresh", data.refreshToken);
    return data.accessToken as string;
  } catch {
    setAccessToken(null);
    window.localStorage.removeItem("zentra.refresh");
    return null;
  }
}
