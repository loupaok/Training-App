import React, { createContext, useContext, useEffect, useState } from 'react';
import { API_BASE_URL } from '../services/api';

const AuthContext = createContext();

async function authFetch(endpoint, options = {}) {
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

export function getAuthRedirect(user) {
  if (!user) return '/login';
  if (user.redirectTo) return user.redirectTo;
  if (user.role === 'coach' || user.role === 'admin') return '/coach/dashboard';
  if (user.role === 'client' && !user.onboardingCompleted) return '/client-onboarding';
  if (user.role === 'client' && user.status === 'active') return '/client/dashboard';
  if (user.role === 'client' && user.status === 'expired') return '/client/expired';
  if (user.role === 'client') return '/client/pending';
  return '/login';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(false);
  const [refreshingProfile, setRefreshingProfile] = useState(true);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  useEffect(() => {
    let ignore = false;
    setRefreshingProfile(true);

    const loadMe = async (allowRefresh = true) => {
      const headers = {};
      const storedToken = localStorage.getItem('token');
      const storedRefreshToken = localStorage.getItem('refreshToken');

      if (!storedToken && !storedRefreshToken) {
        throw new Error('No stored session');
      }

      if (storedToken) headers.Authorization = `Bearer ${storedToken}`;

      const response = await authFetch('/auth/me', {
        credentials: 'include',
        headers,
      });

      if (!response.ok) {
        if (!allowRefresh || !storedRefreshToken) {
          throw new Error('Profile refresh failed');
        }

        const refreshResponse = await authFetch('/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: storedRefreshToken })
        });
        const refreshData = await refreshResponse.json().catch(() => ({}));
        if (!refreshResponse.ok) throw new Error(refreshData.message || 'Profile refresh failed');
        if (refreshData.accessToken) {
          localStorage.setItem('token', refreshData.accessToken);
          setToken(refreshData.accessToken);
        }
        return loadMe(false);
      }

      return response.json();
    };

    loadMe()
      .then((data) => {
        if (ignore) return;
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
      })
      .catch(() => {
        if (ignore) return;
        localStorage.removeItem('user');
        setUser(null);
      })
      .finally(() => {
        if (!ignore) setRefreshingProfile(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await authFetch('/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('token', data.accessToken);
        if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.accessToken);
        setUser(data.user);
        return { success: true, redirectTo: data.redirectTo || getAuthRedirect(data.user) };
      }
      return { success: false, message: data.message };
    } catch (error) {
      return { success: false, message: error.message };
    } finally {
      setLoading(false);
    }
  };

  const register = async (email, password, fullName) => {
    setLoading(true);
    try {
      const response = await authFetch('/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName })
      });

      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('token', data.accessToken || data.token);
        if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
        if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.accessToken || data.token);
        if (data.user) setUser(data.user);
        return { success: true, redirectTo: data.redirectTo || getAuthRedirect(data.user) };
      }
      return { success: false, message: data.message };
    } catch (error) {
      return { success: false, message: error.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    authFetch('/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    }).catch(() => {});

    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
  };

  const updateUser = (nextUser) => {
    localStorage.setItem('user', JSON.stringify(nextUser));
    setUser(nextUser);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, authReady: !refreshingProfile, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
