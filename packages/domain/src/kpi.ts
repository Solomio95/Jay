import type { Sen } from "./money.js";
import type { Role } from "./roles.js";

export type KpiMetric =
    | "attendance_rate"
    | "return_rate"
    | "review_score"
    | "new_members"
    | "custom";

// Banded threshold — first matching band wins.
export interface KpiBand {
    // For "above" comparisons (e.g. attendance_rate >= 0.95), set `gte`.
    // For "below" (return_rate <= 0.03), set `lte`.
    gte?: number;
    lte?: number;
    bonus: Sen;
}

export interface KpiRuleConfig {
    metric: KpiMetric;
    bands: KpiBand[];
}

export interface KpiRule {
    id: string;
    schemeId: string;
    appliesToRole: Role;
    name: string;
    config: KpiRuleConfig;
}

export interface KpiMetricValue {
    employeeId: string;
    periodMonth: string;  // ISO first-of-month
    metric: KpiMetric;
    value: number;
}
