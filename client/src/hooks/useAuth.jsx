import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as resource from '../services/resource';

// Auth context: the single source of truth for "who is logged in".
// The JWT lives in an httpOnly cookie, so we ask the server who we are.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await resource.me();
      setUser(data.user || null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const { data } = await resource.login(email, password);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await resource.register(payload);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await resource.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const isOfficial = user?.role === 'official' || user?.role === 'administrator';
  const isAdmin = user?.role === 'administrator';

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    refresh,
    isOfficial,
    isAdmin,
    isAuthenticated: Boolean(user),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
