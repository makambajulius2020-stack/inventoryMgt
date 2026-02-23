"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

import type { LoginResponseDTO } from "@/lib/auth/types";
import { authStore, type AuthState } from "@/lib/auth/authStore";

type AuthContextValue = {
  state: AuthState;
  login: (session: LoginResponseDTO) => void;
  logout: () => void;
  setActiveLocation: (locationId: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    user: null,
    roles: [],
    allowedLocations: [],
  });

  // Load from localStorage on mount
  React.useEffect(() => {
    setState(authStore.load());
  }, []);

  const login = useCallback((session: LoginResponseDTO) => {
    authStore.save(session);
    setState({
      token: session.token,
      user: session.user,
      roles: [session.user.role],
      allowedLocations: session.user.scope.allLocations ? ["ALL"] : (session.user.scope.locationId ? [session.user.scope.locationId] : []),
    });
  }, []);

  const logout = useCallback(() => {
    authStore.clear();
    setState({ token: null, user: null, roles: [], allowedLocations: [] });
  }, []);

  const setActiveLocation = useCallback((locationId: string) => {
    setState((prev) => {
      if (!prev.user) return prev;

      const canSelectAll = prev.user.scope.allLocations;
      const nextIsAll = locationId === "ALL";
      if (nextIsAll && !canSelectAll) return prev;

      return {
        ...prev,
        user: {
          ...prev.user,
          scope: nextIsAll
            ? { ...prev.user.scope, allLocations: true, locationId: undefined }
            : { ...prev.user.scope, allLocations: false, locationId },
        },
      };
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ state, login, logout, setActiveLocation }), [state, login, logout, setActiveLocation]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
