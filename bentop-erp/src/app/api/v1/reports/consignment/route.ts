import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { canViewReports, forbiddenResponse } from "@/lib/permissions";
import { getConsignmentReport } from "@/lib/reports/consignment";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 },
      );
    }

    const role = (session.user as unknown as { role: string }).role;
    if (!canViewReports(role)) {
      return forbiddenResponse();
    }

    const sp = request.nextUrl.searchParams;
    const days = sp.get("days");
    const data = await getConsignmentReport({
      days: days ? parseInt(days, 10) : undefined,
      from: sp.get("from"),
      to: sp.get("to"),
      partnerId: sp.get("partnerId"),
      locationId: sp.get("locationId"),
      productId: sp.get("productId"),
      productVariantId: sp.get("productVariantId"),
    });

    return Response.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
