import type { AuthUser } from "@/lib/auth/types";

export function makeUser(params: Partial<AuthUser> & { id: string; role: AuthUser["role"] }): AuthUser {
  return {
    id: params.id,
    name: params.name ?? "Test User",
    email: params.email ?? "test@company.com",
    role: params.role,
    scope: params.scope ?? { allLocations: false, locationId: undefined, departmentId: undefined },
  };
}

function entries<T extends object>(obj: T) {
  return Object.entries(obj) as Array<[keyof T, T[keyof T]]>;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function resetMockDBFromSnapshot<TDb extends object>(db: TDb, snapshot: TDb) {
  for (const [key, value] of entries(snapshot)) {
    const current = (db as TDb)[key];

    if (Array.isArray(value) && Array.isArray(current)) {
      current.length = 0;
      current.push(...structuredClone(value));
      continue;
    }

    if (isObject(value) && isObject(current)) {
      for (const k of Object.keys(current)) delete current[k];
      Object.assign(current, structuredClone(value));
      continue;
    }

    (db as TDb)[key] = structuredClone(value);
  }
}
