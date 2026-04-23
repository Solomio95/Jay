import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const sp = request.nextUrl.searchParams;
    const includeAcknowledged = sp.get("includeAcknowledged") === "true";

    const alerts = await prisma.stockAlert.findMany({
      where: includeAcknowledged ? {} : { isAcknowledged: false },
      include: {
        productVariant: {
          select: {
            sku: true, size: true, color: true,
            product: { select: { name: true } },
          },
        },
        location: { select: { name: true, type: true } },
        acknowledgedBy: { select: { name: true } },
      },
      orderBy: [{ isAcknowledged: "asc" }, { createdAt: "desc" }],
    });

    return Response.json({ data: alerts });
  } catch (error) {
    return handleApiError(error);
  }
}
