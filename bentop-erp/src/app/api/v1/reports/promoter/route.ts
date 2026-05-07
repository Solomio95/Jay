import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { canViewReports, forbiddenResponse } from "@/lib/permissions";
import { getPromoterReport } from "@/lib/reports/promoter";

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
    const data = await getPromoterReport({
      month: sp.get("month"),
      locationId: sp.get("locationId"),
      promoterId: sp.get("promoterId"),
    });

    return Response.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
