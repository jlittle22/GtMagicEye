"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  clearStoredToken,
  decodeJwtPayload,
  getStoredToken,
  login as loginRequest,
  type AuthUser,
} from "./auth";

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  // Distinguishes "not logged in" from "haven't checked localStorage yet" so
  // the header doesn't flash a "Log in" button for a split second on every
  // page load before hydration has a chance to read the stored token.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = getStoredToken();
    setToken(stored);
    setUser(stored ? decodeJwtPayload(stored) : null);
    setReady(true);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await loginRequest(username, password);
    setToken(result.token);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
