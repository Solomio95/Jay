import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { parseCsv } from "@/lib/csv/csv";
import { validateImportRows, type ImportType } from "@/lib/imports/validation";

const allowedTypes = ["product-variants", "locations", "consignment-partners", "opening-stock"] as const;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    const role = (session.user as unknown as { role: string }).role;
    if (role !== "ADMIN" && role !== "MANAGER") {
      return Response.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
    }

    const body = await request.json();
    const type = String(body.type ?? "");
    const csv = String(body.csv ?? "");

    if (!allowedTypes.includes(type as ImportType)) {
      return Response.json({ error: { code: "VALIDATION_ERROR", message: "Unknown import type" } }, { status: 400 });
    }

    const rows = parseCsv(csv);
    return Response.json({ data: validateImportRows(type as ImportType, rows) });
  } catch (error) {
    return handleApiError(error);
  }
}
