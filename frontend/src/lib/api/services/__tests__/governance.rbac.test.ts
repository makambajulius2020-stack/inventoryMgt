import { beforeEach, describe, expect, it } from "vitest";

import { adminService } from "../admin.service";
import { mockDB } from "@/lib/mock-db";
import { Role } from "@/lib/auth/roles";
import { makeUser, resetMockDBFromSnapshot } from "./testUtils";
import {
  assertCanMutate,
  assertDepartmentAccess,
  assertLocationAccess,
  hasGlobalScope,
} from "../_guards";

const initial = structuredClone(mockDB);

beforeEach(() => {
  resetMockDBFromSnapshot(mockDB, initial);
});

describe("Phase 3 Governance: RBAC context invariants + admin anti-escalation", () => {
  it("rejects spoofed global scope for non-global role", () => {
    const gmSpoof = makeUser({
      id: "gm_spoof",
      role: Role.GENERAL_MANAGER,
      scope: { allLocations: true, locationId: mockDB.locations[0].id },
    });

    expect(() => hasGlobalScope(gmSpoof)).toThrow(/non-global role cannot have allLocations=true/i);
    expect(() => assertLocationAccess(gmSpoof, mockDB.locations[0].id)).toThrow(/non-global role cannot have allLocations=true/i);
  });

  it("rejects missing location scope for location-scoped roles", () => {
    const financeBad = makeUser({ id: "fin_bad", role: Role.FINANCE_MANAGER, scope: { allLocations: false } });
    expect(() => assertCanMutate(financeBad)).toThrow(/missing locationId/i);
  });

  it("rejects missing department scope for department head", () => {
    const pb = mockDB.locations[0].id;
    const deptHeadBad = makeUser({ id: "dh_bad", role: Role.DEPARTMENT_HEAD, scope: { allLocations: false, locationId: pb } });
    expect(() => assertDepartmentAccess(deptHeadBad, mockDB.departments[0].id, pb)).toThrow(/missing departmentId/i);
  });

  it("prevents GM from creating global roles", async () => {
    const pb = mockDB.locations[0].id;
    const gm = makeUser({ id: "gm", role: Role.GENERAL_MANAGER, scope: { allLocations: false, locationId: pb } });

    await expect(
      adminService.createUser(gm, {
        name: "Bad",
        email: "bad@company.com",
        role: Role.CEO,
        locationId: pb,
      })
    ).rejects.toThrow(/GM cannot create global-scope roles/i);
  });

  it("prevents GM from creating users in other locations", async () => {
    const pb = mockDB.locations[0].id;
    const mk = mockDB.locations[1].id;
    const gmPb = makeUser({ id: "gm_pb", role: Role.GENERAL_MANAGER, scope: { allLocations: false, locationId: pb } });

    await expect(
      adminService.createUser(gmPb, {
        name: "Cross",
        email: "cross@company.com",
        role: Role.STORE_MANAGER,
        locationId: mk,
      })
    ).rejects.toThrow(/GM can only create users within their own location/i);
  });

  it("blocks auditor from admin mutations", async () => {
    const auditor = makeUser({ id: "aud", role: Role.SYSTEM_AUDITOR, scope: { allLocations: true } });

    await expect(
      adminService.createUser(auditor, {
        name: "Nope",
        email: "nope@company.com",
        role: Role.STORE_MANAGER,
        locationId: mockDB.locations[0].id,
      })
    ).rejects.toThrow(/read-only/i);
  });
});
