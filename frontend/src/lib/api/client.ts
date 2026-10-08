import axios, { type AxiosInstance } from "axios";

export const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  headers: { "Content-Type": "application/json" },

  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const scope = getActiveTermScope();
  if (scope?.schoolYearId) {
    (config.headers as Record<string, string>)["x-school-year-id"] = scope.schoolYearId;
  }
  if (scope?.termId) {
    (config.headers as Record<string, string>)["x-term-id"] = scope.termId;
  }
  return config;
});

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
        redirectToUnauthorized();
      } catch {
        refreshPromise = null;
        redirectToUnauthorized();
      }
    }
    return Promise.reject(error);
  },
);

function redirectToUnauthorized() {
  if (typeof window === "undefined") return;
  setAccessToken(null);
  if (window.location.pathname !== "/errors/403") {
    window.location.href = "/errors/403";
  }
}

const TERM_SCOPE_KEY = "zentra.activeTerm";

export interface ActiveTermScope {
  schoolYearId: string;
  schoolYearName: string;
  termId: string;
  termNumber: number;
}

export function getActiveTermScope(): ActiveTermScope | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TERM_SCOPE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveTermScope;
    if (!parsed.schoolYearId || !parsed.termId) return null;
    return parsed;
  } catch {
    return null;
  }
}

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
  try {
    const { data } = await axios.post(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/refresh`,
      {},
      { withCredentials: true },
    );
    setAccessToken(data.accessToken);
    return data.accessToken as string;
  } catch {
    setAccessToken(null);
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await axios.post(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/logout`,
      {},
      { withCredentials: true },
    );
  } catch {

  }
  setAccessToken(null);
  if (typeof window !== "undefined") {

    window.localStorage.removeItem("zentra.refresh");
  }
}
