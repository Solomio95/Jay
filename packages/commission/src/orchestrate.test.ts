import { describe, expect, it } from "vitest";
import {
    type CommissionLineItem,
    type CommissionRule,
    type Employee,
    type KpiMetricValue,
    type KpiRule,
    type SalesRecord,
    toSen,
} from "@bentop/domain";
import {
    type CommissionOrchestrationProvider,
    type CommissionPipelineFacts,
    type CommissionRunMeta,
    orchestrateCommissionRun,
} from "./orchestrate.js";

const aishah: Employee = {
    id: "emp-aishah",
    profileId: "p-aishah",
    employeeNo: "E001",
    fullName: "Aishah",
    role: "promoter",
    wageType: "monthly",
    baseSalary: toSen(1800),
    dependents: 0,
};

const tieredRule: CommissionRule = {
    id: "rule-tier",
    schemeId: "scheme-2026-04",
    appliesToRole: "promoter",
    ruleType: "tiered_personal",
    priority: 10,
    config: {
        basis: "personal_net_sales",
        tiers: [
            { min: toSen(0), max: toSen(10000), pct: 3 },
            { min: toSen(10000), max: toSen(20000), pct: 5 },
            { min: toSen(20000), max: null, pct: 7 },
        ],
    },
};

const sale: SalesRecord = {
    id: "s1",
    externalId: "erp-1",
    counterId: "c1",
    employeeId: "emp-aishah",
    saleDate: "2026-04-10",
    grossAmount: toSen(32400),
    returnsAmount: toSen(0),
    netAmount: toSen(32400),
    currency: "MYR",
    erpVersion: 1,
};

const facts: CommissionPipelineFacts = {
    schemeId: "scheme-2026-04",
    employees: [aishah],
    sales: [sale],
    commissionRules: [tieredRule],
    kpiRules: [],
    kpiMetrics: [],
    directReports: new Map(),
    allSubordinates: new Map(),
    regionEmployees: new Map(),
    regionNames: new Map(),
};

class FakeProvider implements CommissionOrchestrationProvider {
    public runs: Array<{ id: string; meta: CommissionRunMeta; facts: CommissionPipelineFacts }> = [];
    public lineItems: Array<{ runId: string; items: CommissionLineItem[] }> = [];
    public approved: string[] = [];

    async loadFacts(_meta: CommissionRunMeta): Promise<CommissionPipelineFacts> {
        return facts;
    }
    async createRunRow(
        f: CommissionPipelineFacts,
        meta: CommissionRunMeta,
    ): Promise<string> {
        const id = `run-${this.runs.length + 1}`;
        this.runs.push({ id, meta, facts: f });
        return id;
    }
    async writeLineItems(runId: string, items: CommissionLineItem[]): Promise<void> {
        this.lineItems.push({ runId, items });
    }
    async markApproved(runId: string): Promise<void> {
        this.approved.push(runId);
    }
}

const dummyUnused: KpiRule[] | KpiMetricValue[] = [];
void dummyUnused;

describe("orchestrateCommissionRun", () => {
    it("dry run returns totals without writing anything", async () => {
        const provider = new FakeProvider();
        const result = await orchestrateCommissionRun(
            { periodMonth: "2026-04-01", dryRun: true },
            provider,
        );

        expect(result.runId).toBeNull();
        expect(result.status).toBe("draft");
        expect(result.lineItemCount).toBeGreaterThan(0);
        expect(result.totalPayoutSen).toBeGreaterThan(0);
        expect(provider.runs).toHaveLength(0);
        expect(provider.lineItems).toHaveLength(0);
        expect(provider.approved).toHaveLength(0);

        const aishahTotal = result.totalsByEmployee.find(
            (t) => t.employeeId === "emp-aishah",
        );
        expect(aishahTotal).toBeDefined();
        // 3% × 10k + 5% × 10k + 7% × 12.4k = 300 + 500 + 868 = 1,668
        expect(aishahTotal!.totalSen).toBe(toSen(1668));
    });

    it("persists run + line items and marks approved when dryRun=false", async () => {
        const provider = new FakeProvider();
        const result = await orchestrateCommissionRun(
            { periodMonth: "2026-04-01", dryRun: false, runBy: "user-1" },
            provider,
        );

        expect(result.runId).toBe("run-1");
        expect(result.status).toBe("approved");
        expect(provider.runs).toHaveLength(1);
        expect(provider.lineItems).toHaveLength(1);
        expect(provider.lineItems[0]!.runId).toBe("run-1");
        expect(provider.lineItems[0]!.items.length).toBe(result.lineItemCount);
        expect(provider.approved).toEqual(["run-1"]);
    });

    it("produces zero line items when there are no employees", async () => {
        const provider = new FakeProvider();
        provider.loadFacts = async () => ({ ...facts, employees: [], sales: [] });
        const result = await orchestrateCommissionRun(
            { periodMonth: "2026-04-01", dryRun: true },
            provider,
        );
        expect(result.lineItemCount).toBe(0);
        expect(result.totalPayoutSen).toBe(0);
    });
});
