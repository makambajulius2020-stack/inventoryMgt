import { mockDB } from "../../mock-db";
import { AuthUser, LoginResponseDTO } from "../../auth/types";
import { normalizeRole } from "../../auth/roles";
import { AuthorizationError, DomainError } from "@/lib/runtime/errors";

const DELAY = 0;

export const authService = {
    async login({ email }: { email: string; password: string }): Promise<LoginResponseDTO> {
        await new Promise((resolve) => setTimeout(resolve, DELAY));

        const user = mockDB.users.find((u) => u.email === email);

        if (!user) {
            throw new AuthorizationError("Invalid credentials");
        }

        const role = normalizeRole(user.role);
        if (!role) throw new DomainError("Invalid role assigned to user", { metadata: { role: user.role, userId: user.id } });

        const authUser: AuthUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            role,
            scope: {
                allLocations: role === "CEO" || role === "SYSTEM_AUDITOR",
                locationId: user.locationId,
                departmentId: user.departmentId,
            },
        };

        return {
            user: authUser,
            token: `mock_jwt_${authUser.id}_${Date.now()}`,
        };
    },
};
