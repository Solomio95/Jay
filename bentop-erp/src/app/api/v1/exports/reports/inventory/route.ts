import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { csvResponse } from "@/lib/csv/response";
import { canViewReports, forbiddenResponse } from "@/lib/permissions";
import { toInventoryReportCsvRows } from "@/lib/reports/export";
import { getInventoryReport } from "@/lib/reports/inventory";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    const role = (session.user as unknown as { role: string }).role;
    if (!canViewReports(role)) return forbiddenResponse();

    const sp = request.nextUrl.searchParams;
    const data = await getInventoryReport({
      locationId: sp.get("locationId"),
      productId: sp.get("productId"),
      productVariantId: sp.get("productVariantId"),
      search: sp.get("search"),
    });

    return csvResponse(`bentop-inventory-report-${dateStamp()}.csv`, toInventoryReportCsvRows(data));
  } catch (error) {
    return handleApiError(error);
  }
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}
