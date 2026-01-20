import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Token storage keys
const TOKEN_KEY = 'solar_access_token';
const REFRESH_TOKEN_KEY = 'solar_refresh_token';

function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function storeTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();

  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    storeTokens(data.tokens.accessToken, data.tokens.refreshToken);
    return data.tokens.accessToken;
  } catch (error) {
    console.error('Failed to refresh token:', error);
    return null;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const accessToken = getStoredToken();

  const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};

  // Add Authorization header if token exists
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  let res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // If 401 Unauthorized, try to refresh token and retry
  if (res.status === 401) {
    const newToken = await refreshAccessToken();

    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;

      res = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });
    } else {
      // Clear tokens and redirect to login
      clearTokens();
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const accessToken = getStoredToken();
    const headers: Record<string, string> = {};

    // Add Authorization header if token exists
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    let res = await fetch(queryKey.join("/") as string, {
      headers,
      credentials: "include",
    });

    // If 401 Unauthorized, try to refresh token and retry
    if (res.status === 401) {
      const newToken = await refreshAccessToken();

      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;

        res = await fetch(queryKey.join("/") as string, {
          headers,
          credentials: "include",
        });
      } else if (unauthorizedBehavior === "returnNull") {
        return null;
      } else {
        // Clear tokens and redirect to login
        clearTokens();
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
