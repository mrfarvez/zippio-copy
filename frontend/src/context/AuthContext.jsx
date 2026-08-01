import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { api } from '../api';

const AuthCtx = createContext(null);
const STORE = 'zippio_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORE));
    } catch {
      return null;
    }
  });

  const login = useCallback(async (email, password) => {
    const { token, user } = await api.auth.login({ email, password });
    localStorage.setItem(STORE, JSON.stringify({ ...user, token }));
    setUser({ ...user, token });
    return user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORE);
    setUser(null);
  }, []);

  const value = useMemo(() => ({
    user,
    login,
    logout,
    isAuthed: !!user,
    isRole: (...keys) => !!user && keys.includes(user.role),
  }), [user, login, logout]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}

export const ROLE_HOME = {
  'super-admin': '/app/hr/users',
  hr: '/app/hr/employees',
  manager: '/app/team',
  employee: '/app',
};
