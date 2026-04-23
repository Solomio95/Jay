import { Prisma } from "@prisma/client";

export function handleApiError(error: unknown): Response {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        return Response.json(
          { error: { code: "DUPLICATE", message: "A record with this value already exists" } },
          { status: 409 }
        );
      case "P2025":
        return Response.json(
          { error: { code: "NOT_FOUND", message: "Record not found" } },
          { status: 404 }
        );
      case "P2003":
        return Response.json(
          { error: { code: "REFERENCE_ERROR", message: "Related record not found" } },
          { status: 400 }
        );
      default:
        return Response.json(
          { error: { code: "DATABASE_ERROR", message: "A database error occurred" } },
          { status: 500 }
        );
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid data provided" } },
      { status: 400 }
    );
  }

  if (error instanceof SyntaxError) {
    return Response.json(
      { error: { code: "INVALID_JSON", message: "Request body is not valid JSON" } },
      { status: 400 }
    );
  }

  console.error("Unhandled API error:", error);
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
    { status: 500 }
  );
}
