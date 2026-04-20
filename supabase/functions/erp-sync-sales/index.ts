// Hourly job: pull incremental sales from Bentop ERP and upsert into
// sales_records. Idempotent — see packages/erp-sync for the decision logic
// and its unit tests. This file is the thin IO wrapper: it fetches from
// the ERP, resolves counter/employee codes, groups existing DB rows by
// base external id, and applies the per-sale action decideSaleAction
// returns.
//
// Triggered by pg_cron or invoked manually by HR to force a full re-sync.

import { corsHeaders } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.46.1";
import {
    decideSaleAction,
    extractBaseExternalId,
    type ErpSaleInput,
    type ExistingSaleRow,
} from "@bentop/erp-sync";

interface ErpSale {
    external_id: string;
    counter_code: string;
    employee_code: string | null;
    sale_date: string;
    gross: number;
    returns: number;
    currency: string;
    version: number;
    last_modified_at: string;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const supabase = serviceClient();
    const { from, to } = await req.json().catch(() => ({ from: null, to: null }));

    const fromDate = from ?? defaultFromDate();
    const toDate = to ?? new Date().toISOString().slice(0, 10);

    const run = await supabase
        .from("sales_sync_runs")
        .insert({ from_date: fromDate, to_date: toDate })
        .select("id")
        .single();
    const runId = run.data?.id as string | undefined;

    try {
        const erpSales = await fetchFromErp(fromDate, toDate);
        const existingByBase = await loadExistingByBase(
            supabase,
            erpSales.map((s) => s.external_id),
        );

        let inserted = 0;
        let updated = 0;
        let superseded = 0;
        let skipped = 0;

        for (const sale of erpSales) {
            const { counterId, employeeId } = await resolveCodes(
                supabase,
                sale.counter_code,
                sale.employee_code,
            );
            if (!counterId) {
                skipped++;
                continue;
            }

            const input: ErpSaleInput = {
                baseExternalId: sale.external_id,
                counterId,
                employeeId,
                saleDate: sale.sale_date,
                grossAmount: sale.gross,
                returnsAmount: sale.returns,
                currency: sale.currency,
                erpVersion: sale.version,
                erpLastModifiedAt: sale.last_modified_at,
            };
            const existingRows = existingByBase.get(sale.external_id) ?? [];
            const action = decideSaleAction(existingRows, input);

            if (action.kind === "skip") {
                skipped++;
                continue;
            }

            const payload = {
                external_id: action.row.externalId,
                counter_id: action.row.counterId,
                employee_id: action.row.employeeId,
                sale_date: action.row.saleDate,
                gross_amount: action.row.grossAmount,
                returns_amount: action.row.returnsAmount,
                currency: action.row.currency,
                erp_version: action.row.erpVersion,
                erp_last_modified_at: action.row.erpLastModifiedAt,
            };
            const insertRes = await supabase
                .from("sales_records")
                .insert(payload)
                .select("id")
                .single();
            if (insertRes.error || !insertRes.data) {
                throw new Error(
                    `insert failed for ${action.row.externalId}: ${insertRes.error?.message}`,
                );
            }

            if (action.kind === "amend") {
                await supabase
                    .from("sales_records")
                    .update({ superseded_by: insertRes.data.id })
                    .eq("id", action.supersedesId);
                superseded++;
                updated++;
            } else {
                inserted++;
            }

            // Keep the in-memory cache coherent so a duplicate sale later in
            // the same batch is seen as "already applied".
            const list = existingByBase.get(sale.external_id) ?? [];
            list.push({
                id: insertRes.data.id,
                externalId: action.row.externalId,
                erpVersion: action.row.erpVersion,
                supersededBy: null,
            });
            if (action.kind === "amend") {
                const prev = list.find((r) => r.id === action.supersedesId);
                if (prev) prev.supersededBy = insertRes.data.id;
            }
            existingByBase.set(sale.external_id, list);
        }

        if (runId) {
            await supabase
                .from("sales_sync_runs")
                .update({
                    ended_at: new Date().toISOString(),
                    records_inserted: inserted,
                    records_updated: updated,
                    records_superseded: superseded,
                    success: true,
                })
                .eq("id", runId);
        }

        return new Response(
            JSON.stringify({ inserted, updated, superseded, skipped }),
            { headers: { ...corsHeaders, "content-type": "application/json" } },
        );
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (runId) {
            await supabase
                .from("sales_sync_runs")
                .update({
                    ended_at: new Date().toISOString(),
                    error_message: message,
                    success: false,
                })
                .eq("id", runId);
        }
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { ...corsHeaders, "content-type": "application/json" },
        });
    }
});

const defaultFromDate = (): string => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return d.toISOString().slice(0, 10);
};

const fetchFromErp = async (from: string, to: string): Promise<ErpSale[]> => {
    const base = Deno.env.get("BENTOP_ERP_URL")!;
    const token = Deno.env.get("BENTOP_ERP_TOKEN")!;
    const res = await fetch(`${base}/api/v1/sales?from=${from}&to=${to}`, {
        headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`ERP returned ${res.status}`);
    const body = await res.json();
    return body.data as ErpSale[];
};

// deno-lint-ignore no-explicit-any
const resolveCodes = async (
    supabase: SupabaseClient,
    counterCode: string,
    employeeCode: string | null,
): Promise<{ counterId: string | null; employeeId: string | null }> => {
    const counter = await supabase
        .from("counters")
        .select("id")
        .eq("code", counterCode)
        .maybeSingle();
    const employee = employeeCode
        ? await supabase
              .from("employees")
              .select("id")
              .eq("employee_no", employeeCode)
              .maybeSingle()
        : { data: null as { id: string } | null };
    return {
        counterId: (counter.data?.id as string | undefined) ?? null,
        employeeId: (employee.data?.id as string | undefined) ?? null,
    };
};

// Fetch every existing row (including superseded ones) for the base ids in
// this batch, so decideSaleAction has full history when it makes its call.
const loadExistingByBase = async (
    supabase: SupabaseClient,
    baseIds: readonly string[],
): Promise<Map<string, ExistingSaleRow[]>> => {
    const out = new Map<string, ExistingSaleRow[]>();
    if (baseIds.length === 0) return out;

    const patterns = baseIds.flatMap((id) => [id, `${id}#v%`]);
    const { data, error } = await supabase
        .from("sales_records")
        .select("id, external_id, erp_version, superseded_by")
        .or(patterns.map((p) => `external_id.like.${p}`).join(","));
    if (error) {
        throw new Error(`existing row lookup failed: ${error.message}`);
    }

    for (const row of (data ?? []) as Array<{
        id: string;
        external_id: string;
        erp_version: number;
        superseded_by: string | null;
    }>) {
        const base = extractBaseExternalId(row.external_id);
        const list = out.get(base) ?? [];
        list.push({
            id: row.id,
            externalId: row.external_id,
            erpVersion: row.erp_version,
            supersededBy: row.superseded_by,
        });
        out.set(base, list);
    }
    return out;
};
