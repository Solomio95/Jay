// Hourly job: pull incremental sales from Bentop ERP and upsert into sales_records.
// Idempotent: external_id is UNIQUE. Amendments set superseded_by on the old row.
// Triggered by pg_cron or invoked manually by HR to force a full re-sync.

import { corsHeaders } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";

interface ErpSale {
    external_id: string;
    counter_code: string;
    employee_code: string | null;
    sale_date: string;          // YYYY-MM-DD
    gross: number;              // ringgit
    returns: number;            // ringgit
    currency: string;           // "MYR"
    version: number;
    last_modified_at: string;   // ISO timestamp
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
        .select()
        .single();
    const runId = run.data?.id;

    try {
        const erpSales = await fetchFromErp(fromDate, toDate);
        let inserted = 0;
        let updated = 0;
        let superseded = 0;

        for (const sale of erpSales) {
            const { counterId, employeeId } = await resolveCodes(
                supabase,
                sale.counter_code,
                sale.employee_code,
            );
            if (!counterId) continue;  // skip sales for unknown counters

            const existing = await supabase
                .from("sales_records")
                .select("id, erp_version")
                .eq("external_id", sale.external_id)
                .maybeSingle();

            if (!existing.data) {
                await supabase.from("sales_records").insert({
                    external_id: sale.external_id,
                    counter_id: counterId,
                    employee_id: employeeId,
                    sale_date: sale.sale_date,
                    gross_amount: sale.gross,
                    returns_amount: sale.returns,
                    currency: sale.currency,
                    erp_version: sale.version,
                    erp_last_modified_at: sale.last_modified_at,
                });
                inserted++;
            } else if (sale.version > existing.data.erp_version) {
                // Amendment: mark old row superseded and insert the new one.
                const newRow = await supabase
                    .from("sales_records")
                    .insert({
                        external_id: `${sale.external_id}#v${sale.version}`,
                        counter_id: counterId,
                        employee_id: employeeId,
                        sale_date: sale.sale_date,
                        gross_amount: sale.gross,
                        returns_amount: sale.returns,
                        currency: sale.currency,
                        erp_version: sale.version,
                        erp_last_modified_at: sale.last_modified_at,
                    })
                    .select("id")
                    .single();
                await supabase
                    .from("sales_records")
                    .update({ superseded_by: newRow.data!.id })
                    .eq("id", existing.data.id);
                superseded++;
                updated++;
            }
        }

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

        return new Response(JSON.stringify({ inserted, updated, superseded }), {
            headers: { ...corsHeaders, "content-type": "application/json" },
        });
    } catch (err) {
        await supabase
            .from("sales_sync_runs")
            .update({
                ended_at: new Date().toISOString(),
                error_message: (err as Error).message,
                success: false,
            })
            .eq("id", runId);
        return new Response(JSON.stringify({ error: (err as Error).message }), {
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

const resolveCodes = async (
    supabase: ReturnType<typeof serviceClient>,
    counterCode: string,
    employeeCode: string | null,
) => {
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
        : { data: null };
    return {
        counterId: counter.data?.id ?? null,
        employeeId: employee.data?.id ?? null,
    };
};
