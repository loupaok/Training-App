"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { API_BASE_URL } from "@/lib/api/client";
import type { AuthResult, AuthUser } from "@/types/auth";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  authReady: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (email: string, password: string, fullName: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  updateUser: (nextUser: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function authFetch(endpoint: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10000);

  try {
    return await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function getAuthRedirect(user: AuthUser | null | undefined): string {
  if (!user) return "/login";
  if (user.redirectTo) return user.redirectTo;
  if (user.role === "coach" || user.role === "admin" || user.role === "moderator") return "/coach/dashboard";
  if (user.role === "client" && !user.onboardingCompleted) return "/register";
  if (user.role === "client" && user.status === "active") return "/client/dashboard";
  if (user.role === "client" && user.status === "expired") return "/client/expired";
  if (user.role === "client") return "/client/pending";
  return "/login";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = window.localStorage.getItem("user");
      return stored ? (JSON.parse(stored) as AuthUser) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() =>
    typeof window !== "undefined" ? window.localStorage.getItem("token") : null,
  );
  const [loading, setLoading] = useState(false);
  const [refreshingProfile, setRefreshingProfile] = useState(true);

  useEffect(() => {
    if (token) {
      window.localStorage.setItem("token", token);
    } else {
      window.localStorage.removeItem("token");
    }
  }, [token]);

  useEffect(() => {
    let ignore = false;

    // Public auth pages do not need a profile refresh. Avoid surfacing expected
    // 403/401 responses when a visitor has an expired session in local storage.
    if (pathname === "/login" || pathname === "/register") {
      setRefreshingProfile(false);
      return () => {
        ignore = true;
      };
    }

    const loadMe = async (allowRefresh = true): Promise<{ user: AuthUser }> => {
      const headers: Record<string, string> = {};
      const storedToken = window.localStorage.getItem("token");
      const storedRefreshToken = window.localStorage.getItem("refreshToken");

      if (!storedToken && !storedRefreshToken) {
        throw new Error("No stored session");
      }

      if (storedToken) headers.Authorization = `Bearer ${storedToken}`;

      const response = await authFetch("/auth/me", {
        credentials: "include",
        headers,
      });

      if (!response.ok) {
        if (!allowRefresh || !storedRefreshToken) {
          throw new Error("Profile refresh failed");
        }

        const refreshResponse = await authFetch("/auth/refresh", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: storedRefreshToken }),
        });
        const refreshData = await refreshResponse.json().catch(() => ({}));
        if (!refreshResponse.ok) throw new Error(refreshData.message || "Profile refresh failed");
        if (refreshData.accessToken) {
          window.localStorage.setItem("token", refreshData.accessToken);
          setToken(refreshData.accessToken);
        }
        return loadMe(false);
      }

      return response.json();
    };

    loadMe()
      .then((data) => {
        if (ignore) return;
        window.localStorage.setItem("user", JSON.stringify(data.user));
        setUser(data.user);
      })
      .catch(() => {
        if (ignore) return;
        window.localStorage.removeItem("user");
        setUser(null);
      })
      .finally(() => {
        if (!ignore) setRefreshingProfile(false);
      });

    return () => {
      ignore = true;
    };
  }, [pathname]);

  const login = async (email: string, password: string): Promise<AuthResult> => {
    setLoading(true);
    try {
      const response = await authFetch("/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (response.ok) {
        window.localStorage.setItem("token", data.accessToken);
        if (data.refreshToken) window.localStorage.setItem("refreshToken", data.refreshToken);
        window.localStorage.setItem("user", JSON.stringify(data.user));
        setToken(data.accessToken);
        setUser(data.user);
        return { success: true, redirectTo: data.redirectTo || getAuthRedirect(data.user) };
      }
      return { success: false, message: data.message };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, fullName: string): Promise<AuthResult> => {
    setLoading(true);
    try {
      const response = await authFetch("/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName }),
      });

      const data = await response.json();
      if (response.ok) {
        const accessToken = data.accessToken || data.token;
        window.localStorage.setItem("token", accessToken);
        if (data.refreshToken) window.localStorage.setItem("refreshToken", data.refreshToken);
        if (data.user) window.localStorage.setItem("user", JSON.stringify(data.user));
        setToken(accessToken);
        if (data.user) setUser(data.user);
        return { success: true, redirectTo: data.redirectTo || getAuthRedirect(data.user) };
      }
      return { success: false, message: data.message };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    const refreshToken = window.localStorage.getItem("refreshToken");
    authFetch("/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {});

    window.localStorage.removeItem("token");
    window.localStorage.removeItem("refreshToken");
    window.localStorage.removeItem("user");
    setUser(null);
    setToken(null);
  };

  const updateUser = (nextUser: AuthUser) => {
    window.localStorage.setItem("user", JSON.stringify(nextUser));
    setUser(nextUser);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, authReady: !refreshingProfile, login, register, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
