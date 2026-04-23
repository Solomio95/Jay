import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const role = (session.user as unknown as { role: string }).role;
    if (role === "VIEWER") {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Read-only role" } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const alert = await prisma.stockAlert.findUnique({ where: { id } });
    if (!alert) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Alert not found" } },
        { status: 404 }
      );
    }

    if (alert.isAcknowledged) {
      return Response.json({ data: alert });
    }

    const updated = await prisma.stockAlert.update({
      where: { id },
      data: {
        isAcknowledged: true,
        acknowledgedById: session.user.id,
        acknowledgedAt: new Date(),
      },
    });

    return Response.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
