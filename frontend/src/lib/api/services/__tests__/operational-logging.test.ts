import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/core/operational-logger", () => {
  return {
    logMutationStart: vi.fn(),
    logMutationSuccess: vi.fn(),
    logMutationFailure: vi.fn(),
  };
});

import { logMutationFailure, logMutationStart, logMutationSuccess } from "@/lib/core/operational-logger";
import { withAuditGuard } from "../_auditGuard";
import { mockDB } from "@/lib/mock-db";
import { DomainError } from "@/lib/runtime/errors";
import { resetMockDBFromSnapshot } from "./testUtils";

const initial = structuredClone(mockDB);

beforeEach(() => {
  resetMockDBFromSnapshot(mockDB, initial);
  vi.clearAllMocks();
});

describe("Operational logging contract (withAuditGuard envelope)", () => {
  it("logs start + success with executionTimeMs and traceId from ctx", async () => {
    await withAuditGuard(
      async (ctx) => {
        ctx.referenceChainId = "tr_test_success";
        mockDB.auditLogs.push({ ...structuredClone(mockDB.auditLogs[0]), id: "aud_test_1", referenceChainId: "tr_test_success" });
        return "ok";
      },
      {
        actorId: "u1",
        actorRole: "GENERAL_MANAGER",
        locationId: "loc1",
        entityType: "TEST_ENTITY",
        action: "TEST_ACTION",
      }
    );

    expect(logMutationStart).toHaveBeenCalledTimes(1);
    expect(logMutationSuccess).toHaveBeenCalledTimes(1);
    expect(logMutationFailure).toHaveBeenCalledTimes(0);

    const start = vi.mocked(logMutationStart).mock.calls[0]?.[0];
    expect(start).toBeTruthy();
    expect(start).toMatchObject({
      actorId: "u1",
      actorRole: "GENERAL_MANAGER",
      locationId: "loc1",
      entityType: "TEST_ENTITY",
      action: "TEST_ACTION",
      executionTimeMs: 0,
    });
    expect(typeof start!.traceId).toBe("string");
    expect(start!.traceId.length).toBeGreaterThan(0);

    const success = vi.mocked(logMutationSuccess).mock.calls[0]?.[0];
    expect(success).toBeTruthy();
    expect(success).toMatchObject({
      traceId: "tr_test_success",
      actorId: "u1",
      actorRole: "GENERAL_MANAGER",
      locationId: "loc1",
      entityType: "TEST_ENTITY",
      action: "TEST_ACTION",
    });
    expect(typeof success!.executionTimeMs).toBe("number");
    expect(success!.executionTimeMs).toBeGreaterThanOrEqual(0);

    expect(JSON.stringify(success)).not.toMatch(/amount|total|beforeState|afterState|changes/);
  });

  it("logs failure with errorType mapped from typed errors and uses provisional traceId if ctx lacks trace", async () => {
    await expect(
      withAuditGuard(
        async () => {
          throw new DomainError("Boom", { code: "DOMAIN_ERROR" });
        },
        {
          actorId: "u2",
          actorRole: "FINANCE_MANAGER",
          locationId: "loc2",
          entityType: "TEST_ENTITY",
          action: "TEST_FAIL",
        }
      )
    ).rejects.toThrow(/Boom/);

    expect(logMutationStart).toHaveBeenCalledTimes(1);
    expect(logMutationSuccess).toHaveBeenCalledTimes(0);
    expect(logMutationFailure).toHaveBeenCalledTimes(1);

    const fail = vi.mocked(logMutationFailure).mock.calls[0]?.[0];
    expect(fail).toBeTruthy();
    expect(fail).toMatchObject({
      actorId: "u2",
      actorRole: "FINANCE_MANAGER",
      locationId: "loc2",
      entityType: "TEST_ENTITY",
      action: "TEST_FAIL",
      errorType: "DOMAIN_ERROR",
    });
    expect(typeof fail!.traceId).toBe("string");
    expect(fail.traceId.length).toBeGreaterThan(0);
    expect(typeof fail.executionTimeMs).toBe("number");
    expect(fail.executionTimeMs).toBeGreaterThanOrEqual(0);

    expect(JSON.stringify(fail)).not.toMatch(/amount|total|beforeState|afterState|changes/);
  });
});
