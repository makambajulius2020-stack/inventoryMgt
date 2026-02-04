import type { LoginResponseDTO } from "@/lib/auth/types";

export type AuthState = {
  token: string | null;
  user: LoginResponseDTO["user"] | null;
  roles: string[];
  allowedLocations: string[];
};

const STORAGE_KEY = "inventory_mgt_auth";

type Persisted = {
  token: string;
  user: LoginResponseDTO["user"];
  roles: string[];
  allowedLocations: string[];
};

function safeParse(json: string): Persisted | null {
  try {
    return JSON.parse(json) as Persisted;
  } catch {
    return null;
  }
}

export const authStore = {
  load(): AuthState {
    if (typeof window === "undefined") {
      return { token: null, user: null, roles: [], allowedLocations: [] };
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, user: null, roles: [], allowedLocations: [] };

    const parsed = safeParse(raw);
    if (!parsed?.token) return { token: null, user: null, roles: [], allowedLocations: [] };

    return {
      token: parsed.token,
      user: parsed.user,
      roles: parsed.roles ?? [],
      allowedLocations: parsed.allowedLocations ?? [],
    };
  },

  save(session: LoginResponseDTO) {
    if (typeof window === "undefined") return;
    const persisted: Persisted = {
      token: session.token,
      user: session.user,
      roles: session.roles,
      allowedLocations: session.allowedLocations,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  },

  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(STORAGE_KEY);
  },
};
