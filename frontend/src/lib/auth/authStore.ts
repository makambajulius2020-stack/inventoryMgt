import type { AuthUser, LoginResponseDTO } from "@/lib/auth/types";

export type AuthState = {
  token: string | null;
  user: AuthUser | null;
  roles: string[]; // For backward compatibility with components that check state.roles
  allowedLocations: string[]; // For backward compatibility
};

const STORAGE_KEY = "enterprise_mgmt_auth";

export const authStore = {
  load(): AuthState {
    if (typeof window === "undefined") {
      return { token: null, user: null, roles: [], allowedLocations: [] };
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, user: null, roles: [], allowedLocations: [] };

    try {
      const parsed = JSON.parse(raw) as LoginResponseDTO;
      return {
        token: parsed.token,
        user: parsed.user,
        roles: parsed.user ? [parsed.user.role] : [],
        allowedLocations: parsed.user?.scope.allLocations ? ["ALL"] : (parsed.user?.scope.locationId ? [parsed.user.scope.locationId] : []),
      };
    } catch {
      return { token: null, user: null, roles: [], allowedLocations: [] };
    }
  },

  save(session: LoginResponseDTO) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  },

  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(STORAGE_KEY);
  },
};
