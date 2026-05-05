import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { createPromoterSale } from "@/lib/promoter/sales";
import { promoterSaleSchema } from "@/lib/validators/promoter";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 },
      );
    }

    const parsed = promoterSaleSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      );
    }

    const order = await createPromoterSale({
      userId: session.user.id,
      sale: parsed.data,
    });

    return Response.json({ data: order }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PROMOTER_ACCESS_REQUIRED") {
        return Response.json(
          { error: { code: "FORBIDDEN", message: "Promoter access required" } },
          { status: 403 },
        );
      }
      if (error.message === "PROMOTER_LOCATION_NOT_ALLOWED") {
        return Response.json(
          { error: { code: "FORBIDDEN", message: "Location is not allowed" } },
          { status: 403 },
        );
      }
      if (
        error.message === "PROMOTER_LOCATION_NOT_FOUND" ||
        error.message === "PROMOTER_VARIANT_NOT_FOUND" ||
        error.message === "PROMOTER_CUSTOMER_NOT_FOUND"
      ) {
        return Response.json(
          { error: { code: "NOT_FOUND", message: error.message } },
          { status: 404 },
        );
      }
      if (error.message.startsWith("INSUFFICIENT_STOCK:")) {
        return Response.json(
          {
            error: {
              code: "INSUFFICIENT_STOCK",
              message: error.message.slice("INSUFFICIENT_STOCK:".length),
            },
          },
          { status: 409 },
        );
      }
    }

    return handleApiError(error);
  }
}
