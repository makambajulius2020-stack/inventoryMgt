"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

import type { LoginResponseDTO } from "@/lib/auth/types";
import { authStore, type AuthState } from "@/lib/auth/authStore";

type AuthContextValue = {
  state: AuthState;
  login: (session: LoginResponseDTO) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => authStore.load());

  const login = useCallback((session: LoginResponseDTO) => {
    authStore.save(session);
    setState({
      token: session.token,
      user: session.user,
      roles: session.roles,
      allowedLocations: session.allowedLocations,
    });
  }, []);

  const logout = useCallback(() => {
    authStore.clear();
    setState({ token: null, user: null, roles: [], allowedLocations: [] });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ state, login, logout }), [state, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
