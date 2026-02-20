/**
 * Auditor Service — Full read-only access to everything.
 * Delegates to reporting.service for aggregated views.
 * Direct read access to all entity tables for drill-down.
 * NO mutations allowed — enforced by _guards.assertCanMutate.
 */

import { reportingService } from "./reporting.service";
import type {
    AuditTrailEntry,
    CrossLocationVariance,
} from "./reporting.service";

export type { AuditTrailEntry, CrossLocationVariance };

export const auditorService = {
    getFullAuditTrail: () => reportingService.getFullAuditTrail(),
    getCrossLocationVariance: () => reportingService.getCrossLocationVariance(),
    getEntitySummary: () => reportingService.getEntitySummary(),
    getExecutiveSummary: () => reportingService.getExecutiveSummary(),
    getBranchRanking: () => reportingService.getBranchRanking(),
};
