import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { withAuditGuard } from "../_auditGuard";
import { mockDB } from "@/lib/mock-db";
import { RateLimitExceededError } from "@/lib/runtime/errors";
import { resetRateLimiterForTests } from "@/lib/core/rate-limiter";
import { resetMockDBFromSnapshot } from "./testUtils";

vi.mock("@/lib/core/operational-logger", () => {
  return {
    logMutationStart: vi.fn(),
    logMutationSuccess: vi.fn(),
    logMutationFailure: vi.fn(),
  };
});

import { logMutationFailure } from "@/lib/core/operational-logger";

const initial = structuredClone(mockDB);

beforeEach(() => {
  resetMockDBFromSnapshot(mockDB, initial);
  resetRateLimiterForTests();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-02-20T00:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Internal rate limiting (withAuditGuard envelope)", () => {
  it("throttle hit: throws RateLimitExceededError after 10 mutations in window", async () => {
    for (let i = 0; i < 10; i++) {
      await withAuditGuard(
        async (ctx) => {
          ctx.referenceChainId = `tr_ok_${i}`;
          mockDB.auditLogs.push({ ...structuredClone(mockDB.auditLogs[0]), id: `aud_ok_${i}`, referenceChainId: `tr_ok_${i}` });
          return "ok";
        },
        {
          actorId: "actor_1",
          actorRole: "STORE_MANAGER",
          locationId: "loc_1",
          entityType: "StockMovement",
          action: "ADJUSTMENT",
        }
      );
    }

    await expect(
      withAuditGuard(
        async (ctx) => {
          ctx.referenceChainId = "tr_should_not_run";
          mockDB.auditLogs.push({ ...structuredClone(mockDB.auditLogs[0]), id: "aud_should_not_run", referenceChainId: "tr_should_not_run" });
          return "nope";
        },
        {
          actorId: "actor_1",
          actorRole: "STORE_MANAGER",
          locationId: "loc_1",
          entityType: "StockMovement",
          action: "ADJUSTMENT",
        }
      )
    ).rejects.toBeInstanceOf(RateLimitExceededError);

    expect(logMutationFailure).toHaveBeenCalledTimes(1);
    const evt = vi.mocked(logMutationFailure).mock.calls[0]?.[0];
    expect(evt).toBeTruthy();
    expect(evt).toMatchObject({
      actorId: "actor_1",
      locationId: "loc_1",
      entityType: "StockMovement",
      action: "ADJUSTMENT",
      errorType: "RATE_LIMIT_EXCEEDED",
    });
  });

  it("throttle reset after window: allows after 60s", async () => {
    for (let i = 0; i < 10; i++) {
      await withAuditGuard(
        async (ctx) => {
          ctx.referenceChainId = `tr_ok_${i}`;
          mockDB.auditLogs.push({ ...structuredClone(mockDB.auditLogs[0]), id: `aud_ok_${i}`, referenceChainId: `tr_ok_${i}` });
          return "ok";
        },
        {
          actorId: "actor_2",
          actorRole: "STORE_MANAGER",
          locationId: "loc_1",
          entityType: "StockMovement",
          action: "ADJUSTMENT",
        }
      );
    }

    await expect(
      withAuditGuard(
        async () => "nope",
        {
          actorId: "actor_2",
          actorRole: "STORE_MANAGER",
          locationId: "loc_1",
          entityType: "StockMovement",
          action: "ADJUSTMENT",
        }
      )
    ).rejects.toBeInstanceOf(RateLimitExceededError);

    vi.advanceTimersByTime(60_001);

    await expect(
      withAuditGuard(
        async (ctx) => {
          ctx.referenceChainId = "tr_ok_after";
          mockDB.auditLogs.push({ ...structuredClone(mockDB.auditLogs[0]), id: "aud_ok_after", referenceChainId: "tr_ok_after" });
          return "ok";
        },
        {
          actorId: "actor_2",
          actorRole: "STORE_MANAGER",
          locationId: "loc_1",
          entityType: "StockMovement",
          action: "ADJUSTMENT",
        }
      )
    ).resolves.toBe("ok");
  });

  it("cross-actor isolation: actor A throttled does not throttle actor B", async () => {
    for (let i = 0; i < 10; i++) {
      await withAuditGuard(
        async (ctx) => {
          ctx.referenceChainId = `tr_a_${i}`;
          mockDB.auditLogs.push({ ...structuredClone(mockDB.auditLogs[0]), id: `aud_a_${i}`, referenceChainId: `tr_a_${i}` });
          return "ok";
        },
        {
          actorId: "actor_A",
          actorRole: "STORE_MANAGER",
          locationId: "loc_1",
          entityType: "StockMovement",
          action: "ADJUSTMENT",
        }
      );
    }

    await expect(
      withAuditGuard(
        async () => "nope",
        {
          actorId: "actor_A",
          actorRole: "STORE_MANAGER",
          locationId: "loc_1",
          entityType: "StockMovement",
          action: "ADJUSTMENT",
        }
      )
    ).rejects.toBeInstanceOf(RateLimitExceededError);

    await expect(
      withAuditGuard(
        async (ctx) => {
          ctx.referenceChainId = "tr_b_1";
          mockDB.auditLogs.push({ ...structuredClone(mockDB.auditLogs[0]), id: "aud_b_1", referenceChainId: "tr_b_1" });
          return "ok";
        },
        {
          actorId: "actor_B",
          actorRole: "STORE_MANAGER",
          locationId: "loc_1",
          entityType: "StockMovement",
          action: "ADJUSTMENT",
        }
      )
    ).resolves.toBe("ok");
  });
});
