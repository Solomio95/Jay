import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { csvResponse } from "@/lib/csv/response";
import { canViewReports, forbiddenResponse } from "@/lib/permissions";
import { toSalesReportCsvRows } from "@/lib/reports/export";
import { getSalesReport } from "@/lib/reports/sales";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    const role = (session.user as unknown as { role: string }).role;
    if (!canViewReports(role)) return forbiddenResponse();

    const sp = request.nextUrl.searchParams;
    const days = sp.get("days");
    const data = await getSalesReport({
      days: days ? parseInt(days, 10) : undefined,
      from: sp.get("from"),
      to: sp.get("to"),
      locationId: sp.get("locationId"),
      productId: sp.get("productId"),
      productVariantId: sp.get("productVariantId"),
      search: sp.get("search"),
    });

    return csvResponse(`bentop-sales-report-${dateStamp()}.csv`, toSalesReportCsvRows(data));
  } catch (error) {
    return handleApiError(error);
  }
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}
