import type { AuthApi } from "@/lib/api/types";
import type { AuthUser, LoginResponseDTO, RoleName } from "@/lib/auth/types";
import { getBaseUrl } from "./baseUrl";

type BackendUserContext = {
  userId: string;
  role: string;
  branchId: string | null;
  departmentId?: string | null;
};

export const realAuthApi: AuthApi = {
  async login({ email, password }): Promise<LoginResponseDTO> {
    const baseUrl = getBaseUrl();

    const form = new URLSearchParams();
    form.set("username", email);
    form.set("password", password);

    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });

    if (!loginRes.ok) {
      const msg = await loginRes.text().catch(() => "");
      throw new Error(msg || "Login failed");
    }

    const tokenPair = (await loginRes.json()) as {
      access_token: string;
      refresh_token: string;
      token_type: string;
      access_token_expires_at: string;
      refresh_token_expires_at: string;
      userContext?: BackendUserContext;
    };

    const accessToken = tokenPair.access_token;

    let userContext = tokenPair.userContext;
    if (!userContext) {
      const meRes = await fetch(`${baseUrl}/auth/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!meRes.ok) {
        const msg = await meRes.text().catch(() => "");
        throw new Error(msg || "Failed to fetch user context");
      }
      userContext = (await meRes.json()) as BackendUserContext;
    }

    const roleName = (userContext?.role ?? "STORE_MANAGER") as RoleName;
    const isGlobal = roleName === "CEO" || roleName === "SYSTEM_AUDITOR";

    const user: AuthUser = {
      id: String(userContext?.userId ?? ""),
      name: email,
      email,
      role: roleName,
      scope: {
        allLocations: isGlobal,
        locationId: userContext?.branchId ?? undefined,
        departmentId: userContext?.departmentId ?? undefined,
      },
    };

    return { user, token: accessToken };
  },
};
