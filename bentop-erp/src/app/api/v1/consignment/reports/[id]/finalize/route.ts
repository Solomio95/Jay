import { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import {
  canFinalizeConsignmentReport,
  ConsignmentReportFinalizeError,
  finalizeConsignmentReport,
} from "@/lib/consignment/finalize-report";
import { prisma } from "@/lib/db";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 },
      );
    }

    const role = (session.user as unknown as { role?: string }).role;
    if (!canFinalizeConsignmentReport(role)) {
      return Response.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Only admins and managers can finalize consignment reports",
          },
        },
        { status: 403 },
      );
    }

    const { id } = await params;
    const result = await prisma.$transaction((tx) =>
      finalizeConsignmentReport(tx, id, session.user.id),
    );

    return Response.json({ data: result });
  } catch (error) {
    if (error instanceof ConsignmentReportFinalizeError) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }

    return handleApiError(error);
  }
}
