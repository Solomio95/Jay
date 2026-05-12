import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { auth } from "@/lib/auth";
import { canManageProducts, forbiddenResponse } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-error";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    if (!canManageProducts(session.user.role)) {
      return forbiddenResponse();
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: { code: "VALIDATION_ERROR", message: "Image file is required" } }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ error: { code: "FILE_TOO_LARGE", message: "Image must be 5MB or smaller" } }, { status: 400 });
    }

    const extension = ALLOWED_TYPES.get(file.type);
    if (!extension) {
      return Response.json(
        { error: { code: "UNSUPPORTED_FILE", message: "Upload JPG, PNG, WebP, or GIF images only" } },
        { status: 400 },
      );
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
    await mkdir(uploadDir, { recursive: true });

    const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
    const filePath = path.join(uploadDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    return Response.json({
      data: {
        url: `/uploads/products/${fileName}`,
        fileName,
        size: file.size,
        contentType: file.type,
      },
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
