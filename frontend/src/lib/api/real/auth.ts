import type { AuthApi } from "@/lib/api/types";
import type { LoginResponseDTO } from "@/lib/auth/types";
import { DEMO_LOCATIONS } from "@/lib/locations";
import { getBaseUrl } from "./baseUrl";

const BRANCH_ID_TO_NAME: Record<number, string> = {
  1: "The Patiobela",
  2: "The Maze Bistro",
  3: "The Maze Forest Mall",
  4: "Itaru",
  5: "Rosa Dames",
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
      userContext?: {
        userId: number;
        role: string;
        branchId: number | null;
        departmentId?: number | null;
      };
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
      userContext = (await meRes.json()) as LoginResponseDTO["userContext"];
    }

    const role = userContext?.role ? [userContext.role] : [];

    const branchName =
      userContext?.branchId != null ? BRANCH_ID_TO_NAME[Number(userContext.branchId)] : undefined;

    const allowedLocations = role.includes("CEO") ? [...DEMO_LOCATIONS] : branchName ? [branchName] : [];

    return {
      user: {
        id: String(userContext?.userId ?? ""),
        name: email,
        email,
      },
      roles: role,
      allowedLocations,
      token: accessToken,
      userContext: userContext ?? undefined,
    };
  },
};
