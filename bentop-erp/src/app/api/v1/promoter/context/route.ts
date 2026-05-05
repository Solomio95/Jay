import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getAllowedPromoterLocationIds } from "@/lib/promoter/access";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        defaultLocation: true,
        temporaryLocations: { include: { location: true } },
      },
    });

    if (!user || user.role !== "PROMOTER") {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Promoter access required" } },
        { status: 403 },
      );
    }

    const allowedLocationIds = getAllowedPromoterLocationIds({
      now: new Date(),
      defaultLocationId: user.defaultLocationId,
      temporaryLocations: user.temporaryLocations,
    });

    const activeLocations = [
      user.defaultLocation,
      ...user.temporaryLocations.map((item) => item.location),
    ].filter(
      (location): location is NonNullable<typeof user.defaultLocation> =>
        Boolean(location?.isActive),
    );

    const locationById = new Map(
      activeLocations.map((location) => [location.id, location]),
    );

    const allowedLocations = allowedLocationIds
      .map((locationId) => locationById.get(locationId))
      .filter((location): location is NonNullable<typeof location> => Boolean(location));

    return Response.json({
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        defaultLocationId: user.defaultLocationId,
        allowedLocations: allowedLocations.map((location) => ({
          id: location.id,
          name: location.name,
          type: location.type,
          isDefault: location.id === user.defaultLocationId,
        })),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
