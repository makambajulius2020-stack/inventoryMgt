import { describe, expect, it } from "vitest";

import { financeService } from "../finance.service";
import { reportingService } from "../reporting.service";
import { makeUser } from "./testUtils";
import { Role } from "@/lib/auth/roles";
import { mockDB } from "@/lib/mock-db";

describe("forecasting", () => {
  it("financeService revenueForecast returns horizon points", async () => {
    const user = makeUser({
      id: "fin_loc",
      role: Role.FINANCE_MANAGER,
      scope: { allLocations: false, locationId: mockDB.locations[0].id },
    });

    const points = await financeService.revenueForecast(user, {
      from: "2026-02-01T00:00:00Z",
      to: "2026-02-28T23:59:59Z",
      horizonDays: 7,
    });

    expect(points).toHaveLength(7);
    expect(points[0]).toHaveProperty("period");
    expect(points[0]).toHaveProperty("value");
  });

  it("reportingService blocks global roles from requesting a single location", async () => {
    const auditor = makeUser({ id: "aud", role: Role.SYSTEM_AUDITOR, scope: { allLocations: true } });

    await expect(
      reportingService.revenueForecast(auditor, {
        from: "2026-02-01T00:00:00Z",
        to: "2026-02-28T23:59:59Z",
        locationId: mockDB.locations[0].id,
        horizonDays: 7,
      })
    ).rejects.toThrow(/must not request a single-location/i);
  });

  it("reportingService allows CEO single-location forecast", async () => {
    const ceo = makeUser({ id: "ceo", role: Role.CEO, scope: { allLocations: true } });

    const points = await reportingService.revenueForecast(ceo, {
      from: "2026-02-01T00:00:00Z",
      to: "2026-02-28T23:59:59Z",
      locationId: mockDB.locations[0].id,
      horizonDays: 7,
    });

    expect(points).toHaveLength(7);
  });

  it("reportingService allows location-scoped forecast without locationId override", async () => {
    const gm = makeUser({
      id: "gm_loc",
      role: Role.GENERAL_MANAGER,
      scope: { allLocations: false, locationId: mockDB.locations[0].id },
    });

    const points = await reportingService.cashPositionForecast(gm, {
      from: "2026-02-01T00:00:00Z",
      to: "2026-02-28T23:59:59Z",
      horizonDays: 5,
    });

    expect(points).toHaveLength(5);
  });
});
