import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { toCsv } from "@/lib/csv/csv";
import { importTemplateHeaders, type ImportType } from "@/lib/imports/validation";

const allowedTypes = ["product-variants", "locations", "consignment-partners", "opening-stock"] as const;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  const { type } = await params;
  if (!allowedTypes.includes(type as ImportType)) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Unknown import template" } }, { status: 404 });
  }

  const headers = importTemplateHeaders(type as ImportType);
  return new Response(toCsv([Object.fromEntries(headers.map((header) => [header, ""]))], headers), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="bentop-${type}-template.csv"`,
    },
  });
}
