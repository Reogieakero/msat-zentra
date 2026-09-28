import axios, { type AxiosInstance } from "axios";

export const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: false,
});

// Attach the access token (stored by the auth layer) to every request,
// plus the session's active School Year + Term (chosen once after login).
// The backend scopes all reads to this selection and saves all writes
// under it — pages never pick a year/term per action.
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
        redirectToUnauthorized();
      } catch {
        refreshPromise = null;
        redirectToUnauthorized();
      }
    }
    return Promise.reject(error);
  },
);

// When auth recovery fails on a 401, route the user to the 403 page.
function redirectToUnauthorized() {
  if (typeof window === "undefined") return;
  setAccessToken(null);
  window.localStorage.removeItem("zentra.refresh");
  if (window.location.pathname !== "/errors/403") {
    window.location.href = "/errors/403";
  }
}

// --- active term scope (Login → select → session context) ---
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

export function setRefreshToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem("zentra.refresh", token);
  else window.localStorage.removeItem("zentra.refresh");
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
