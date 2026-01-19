import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '@shared/models/auth';

// ============ TIPOS ============

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface AuthUser extends User {
  role: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

// ============ STORAGE DE TOKENS ============

const TOKEN_KEY = 'solar_access_token';
const REFRESH_TOKEN_KEY = 'solar_refresh_token';

function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function storeTokens(tokens: AuthTokens): void {
  localStorage.setItem(TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// ============ API CALLS ============

async function fetchUserInfo(accessToken: string): Promise<AuthUser> {
  const response = await fetch('/api/auth/me', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }

  return response.json();
}

async function loginAPI(email: string, password: string): Promise<{ user: AuthUser; tokens: AuthTokens }> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Login failed');
  }

  return response.json();
}

async function refreshTokenAPI(refreshToken: string): Promise<AuthTokens> {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }

  const data = await response.json();
  return data.tokens;
}

async function logoutAPI(refreshToken: string, accessToken: string): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ refreshToken }),
    });
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// ============ CONTEXT ============

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar usuário ao iniciar
  useEffect(() => {
    async function loadUser() {
      const accessToken = getStoredToken();

      if (!accessToken) {
        setIsLoading(false);
        return;
      }

      try {
        const userData = await fetchUserInfo(accessToken);
        setUser(userData);
      } catch (error) {
        console.error('Failed to load user:', error);

        // Tentar refresh token
        const refreshToken = getStoredRefreshToken();
        if (refreshToken) {
          try {
            const newTokens = await refreshTokenAPI(refreshToken);
            storeTokens(newTokens);

            const userData = await fetchUserInfo(newTokens.accessToken);
            setUser(userData);
          } catch (refreshError) {
            console.error('Failed to refresh token:', refreshError);
            clearTokens();
          }
        } else {
          clearTokens();
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, []);

  // Auto-refresh token antes de expirar (13 minutos - 2 minutos antes dos 15 minutos)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      const refreshToken = getStoredRefreshToken();
      if (!refreshToken) return;

      try {
        const newTokens = await refreshTokenAPI(refreshToken);
        storeTokens(newTokens);
      } catch (error) {
        console.error('Auto-refresh failed:', error);
        // Se falhar, fazer logout
        await logout();
      }
    }, 13 * 60 * 1000); // 13 minutos

    return () => clearInterval(interval);
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);

    try {
      const { user: userData, tokens } = await loginAPI(email, password);

      storeTokens(tokens);
      setUser(userData);
    } catch (error) {
      clearTokens();
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getStoredRefreshToken();
    const accessToken = getStoredToken();

    if (refreshToken && accessToken) {
      await logoutAPI(refreshToken, accessToken);
    }

    clearTokens();
    setUser(null);
  }, []);

  const refreshToken = useCallback(async () => {
    const refreshTokenValue = getStoredRefreshToken();

    if (!refreshTokenValue) {
      throw new Error('No refresh token available');
    }

    const newTokens = await refreshTokenAPI(refreshTokenValue);
    storeTokens(newTokens);

    const userData = await fetchUserInfo(newTokens.accessToken);
    setUser(userData);
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }

  return context;
}

// ============ UTILITY ============

// Hook para pegar o access token em requests
export function useAccessToken(): string | null {
  return getStoredToken();
}

// Função helper para fazer requests autenticadas
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const accessToken = getStoredToken();

  if (!accessToken) {
    throw new Error('No access token available');
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  // Se token expirou, tentar refresh
  if (response.status === 401) {
    const refreshToken = getStoredRefreshToken();

    if (refreshToken) {
      try {
        const newTokens = await refreshTokenAPI(refreshToken);
        storeTokens(newTokens);

        // Retry request com novo token
        return fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${newTokens.accessToken}`,
          },
        });
      } catch (error) {
        clearTokens();
        window.location.href = '/login';
        throw new Error('Session expired');
      }
    }
  }

  return response;
}
