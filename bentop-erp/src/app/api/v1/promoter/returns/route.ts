import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { createPromoterReturn } from "@/lib/promoter/returns";
import { promoterReturnSchema } from "@/lib/validators/promoter";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 },
      );
    }

    const parsed = promoterReturnSchema.safeParse(await request.json());
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

    const promoterReturn = await createPromoterReturn({
      userId: session.user.id,
      data: parsed.data,
    });

    return Response.json({ data: promoterReturn }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === "PROMOTER_ACCESS_REQUIRED" ||
        error.message === "PROMOTER_RETURN_NOT_ALLOWED"
      ) {
        return Response.json(
          { error: { code: "FORBIDDEN", message: error.message } },
          { status: 403 },
        );
      }
      if (
        error.message === "PROMOTER_ORDER_NOT_FOUND" ||
        error.message === "PROMOTER_ORDER_ITEM_NOT_FOUND"
      ) {
        return Response.json(
          { error: { code: "NOT_FOUND", message: error.message } },
          { status: 404 },
        );
      }
      if (error.message.startsWith("RETURN_QUANTITY_EXCEEDED:")) {
        return Response.json(
          {
            error: {
              code: "RETURN_QUANTITY_EXCEEDED",
              message: error.message.slice("RETURN_QUANTITY_EXCEEDED:".length),
            },
          },
          { status: 409 },
        );
      }
    }

    return handleApiError(error);
  }
}
