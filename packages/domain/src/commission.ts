import type { Sen } from "./money.js";
import type { Role } from "./roles.js";

export type CommissionRuleType =
    | "tiered_personal"
    | "override_team"
    | "override_region"
    | "flat";

export interface Tier {
    min: Sen;
    max: Sen | null;  // null = no upper bound
    pct: number;      // percentage, e.g. 5 = 5%
}

export interface TieredPersonalConfig {
    basis: "personal_net_sales";
    tiers: Tier[];
}

export interface OverrideTeamConfig {
    basis: "team_net_sales";
    teamScope: "direct_reports" | "all_subordinates";
    pct: number;
}

export interface OverrideRegionConfig {
    basis: "region_net_sales";
    pct: number;
}

export interface FlatConfig {
    basis: "flat";
    amount: Sen;
    perUnit?: "sale" | "customer" | "signup";
}

export type CommissionRuleConfig =
    | TieredPersonalConfig
    | OverrideTeamConfig
    | OverrideRegionConfig
    | FlatConfig;

export interface CommissionRule {
    id: string;
    schemeId: string;
    appliesToRole: Role;
    ruleType: CommissionRuleType;
    priority: number;
    config: CommissionRuleConfig;
}

export interface CommissionLineItem {
    employeeId: string;
    ruleId: string | null;
    kpiRuleId: string | null;
    basisAmount: Sen;
    rate: number;         // pct or flat multiplier
    computedAmount: Sen;
    notes: Record<string, unknown>;
}
