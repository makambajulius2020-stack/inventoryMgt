import { describe, expect, it } from "vitest";

import { aiService } from "@/lib/ai/ai.service";
import { makeUser } from "@/lib/api/services/__tests__/testUtils";
import { mockDB } from "@/lib/mock-db";

describe("ai.service", () => {
  it("denies cross-location insights for location-scoped user", async () => {
    const user = makeUser({
      id: "gm_1",
      role: "GENERAL_MANAGER",
      scope: { allLocations: false, locationId: mockDB.locations[0].id },
    });

    await expect(
      aiService.getInsights(user, {
        from: "2026-02-01T00:00:00Z",
        to: "2026-02-28T23:59:59Z",
        locationId: mockDB.locations[1].id,
      })
    ).rejects.toThrow(/cross-location/i);
  });

  it("denies global role when requesting single-location insights", async () => {
    const ceo = makeUser({ id: "ceo_1", role: "CEO", scope: { allLocations: true } });

    await expect(
      aiService.getInsights(ceo, {
        from: "2026-02-01T00:00:00Z",
        to: "2026-02-28T23:59:59Z",
        locationId: mockDB.locations[0].id,
      })
    ).rejects.toThrow(/must not request single-location/i);
  });

  it("returns deterministic insight objects for allowed user", async () => {
    const user = makeUser({
      id: "fin_1",
      role: "FINANCE_MANAGER",
      scope: { allLocations: false, locationId: mockDB.locations[0].id },
    });

    const res = await aiService.getInsights(user, {
      from: "2026-02-01T00:00:00Z",
      to: "2026-02-28T23:59:59Z",
    });

    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBeGreaterThan(0);
    for (const i of res) {
      expect(i).toHaveProperty("id");
      expect(i).toHaveProperty("kind");
      expect(i).toHaveProperty("severity");
      expect(i).toHaveProperty("title");
      expect(i).toHaveProperty("message");
    }

    expect(res.some((i) => i.kind === "NEXT_BEST_ACTION")).toBe(true);
  });

  it("does not attempt SKU-level inventory insights for CEO", async () => {
    const ceo = makeUser({ id: "ceo_2", role: "CEO", scope: { allLocations: true } });

    const res = await aiService.getInsights(ceo, {
      from: "2026-02-01T00:00:00Z",
      to: "2026-02-28T23:59:59Z",
    });

    const inv = res.find((i) => i.kind === "INVENTORY_DEPLETION");
    expect(inv).toBeTruthy();
    expect(inv?.message.toLowerCase()).toContain("not available");
  });
});
