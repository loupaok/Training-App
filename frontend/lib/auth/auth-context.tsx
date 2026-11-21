"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { API_BASE_URL } from "@/lib/api/client";
import { getNativePreference, isNativePlatform, nativeStorageKeys, removeNativePreference, setNativePreference } from "@/lib/native/preferences";
import { registerPushToken } from "@/lib/pushNotifications";
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
      headers: {
        ...(isNativePlatform() ? { "X-Client-Platform": "native" } : {}),
        ...(options.headers || {}),
      },
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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshingProfile, setRefreshingProfile] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const native = isNativePlatform();
    void Promise.all([native ? getNativePreference(nativeStorageKeys.accessToken) : Promise.resolve(null), getNativePreference(nativeStorageKeys.user)]).then(([storedToken, storedUser]) => {
      if (cancelled) return;
      setToken(storedToken);
      try { setUser(storedUser ? JSON.parse(storedUser) as AuthUser : null); } catch { setUser(null); }
      setStorageReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    if (!isNativePlatform()) {
      void removeNativePreference(nativeStorageKeys.accessToken);
      void removeNativePreference(nativeStorageKeys.refreshToken);
      return;
    }
    if (token) void setNativePreference(nativeStorageKeys.accessToken, token);
    else void removeNativePreference(nativeStorageKeys.accessToken);
  }, [storageReady, token]);

  useEffect(() => {
    let ignore = false;

    if (!storageReady) return () => { ignore = true; };

    // Visitors do not need a profile refresh on public auth pages. An existing
    // session does: without it, a signed-in client could reopen /register and
    // see an old wizard draft instead of being redirected to their account.
    const native = isNativePlatform();
    // On public auth pages, a visitor without a cached session has no reason
    // to call /auth/me or /auth/refresh. This avoids expected 401/400 noise
    // while an existing signed-in browser session still gets refreshed.
    if ((pathname === "/login" || pathname === "/register") && !token && !user) {
      setRefreshingProfile(false);
      return () => {
        ignore = true;
      };
    }

    const loadMe = async (allowRefresh = true): Promise<{ user: AuthUser }> => {
      const headers: Record<string, string> = {};
      const storedToken = native ? await getNativePreference(nativeStorageKeys.accessToken) : null;
      const storedRefreshToken = native ? await getNativePreference(nativeStorageKeys.refreshToken) : null;

      if (native && !storedToken && !storedRefreshToken) {
        throw new Error("No stored session");
      }

      if (storedToken) headers.Authorization = `Bearer ${storedToken}`;

      const response = await authFetch("/auth/me", {
        credentials: "include",
        headers,
      });

      if (!response.ok) {
        // Missing cookies return 401. Only an invalid/expired access token
        // should attempt a refresh; a visitor must not call refresh at all.
        if (!allowRefresh || response.status === 401 || (native && !storedRefreshToken)) {
          throw new Error("Profile refresh failed");
        }

        const refreshResponse = await authFetch("/auth/refresh", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(native ? { refreshToken: storedRefreshToken } : {}),
        });
        const refreshData = await refreshResponse.json().catch(() => ({}));
        if (!refreshResponse.ok) throw new Error(refreshData.message || "Profile refresh failed");
        if (native && refreshData.accessToken) {
          await setNativePreference(nativeStorageKeys.accessToken, refreshData.accessToken);
          setToken(refreshData.accessToken);
        }
        return loadMe(false);
      }

      return response.json();
    };

    loadMe()
      .then((data) => {
        if (ignore) return;
        void setNativePreference(nativeStorageKeys.user, JSON.stringify(data.user));
        setUser(data.user);
      })
      .catch(() => {
        if (ignore) return;
        void removeNativePreference(nativeStorageKeys.user);
        setUser(null);
      })
      .finally(() => {
        if (!ignore) setRefreshingProfile(false);
      });

    return () => {
      ignore = true;
    };
  }, [pathname, storageReady, token]);

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
        const native = isNativePlatform();
        if (native) {
          await setNativePreference(nativeStorageKeys.accessToken, data.accessToken);
          if (data.refreshToken) await setNativePreference(nativeStorageKeys.refreshToken, data.refreshToken);
        }
        await setNativePreference(nativeStorageKeys.user, JSON.stringify(data.user));
        setToken(native ? data.accessToken : null);
        setUser(data.user);
        void registerPushToken();
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
        const native = isNativePlatform();
        const accessToken = data.accessToken || data.token;
        if (native && accessToken) await setNativePreference(nativeStorageKeys.accessToken, accessToken);
        if (native && data.refreshToken) await setNativePreference(nativeStorageKeys.refreshToken, data.refreshToken);
        if (data.user) await setNativePreference(nativeStorageKeys.user, JSON.stringify(data.user));
        setToken(native ? accessToken : null);
        if (data.user) setUser(data.user);
        void registerPushToken();
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
    const native = isNativePlatform();
    const refreshToken = native ? await getNativePreference(nativeStorageKeys.refreshToken) : null;
    authFetch("/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(native && refreshToken ? { refreshToken } : {}),
    }).catch(() => {});

    await Promise.all([
      removeNativePreference(nativeStorageKeys.accessToken),
      removeNativePreference(nativeStorageKeys.refreshToken),
      removeNativePreference(nativeStorageKeys.user),
    ]);
    setUser(null);
    setToken(null);
  };

  const updateUser = (nextUser: AuthUser) => {
    void setNativePreference(nativeStorageKeys.user, JSON.stringify(nextUser));
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
