import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { calculateNetLeaderboardAmount } from "@/lib/promoter/leaderboard";
import { handleApiError } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 },
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!currentUser || currentUser.role !== "PROMOTER" || !currentUser.defaultLocationId) {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Promoter access required" } },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    const month = url.searchParams.get("month") ?? formatMonth(new Date());
    const { start, end } = getMonthRange(month);

    const group = await prisma.leaderboardGroup.findFirst({
      where: {
        isActive: true,
        locations: { some: { locationId: currentUser.defaultLocationId } },
      },
      include: {
        locations: true,
        tiers: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!group) {
      return Response.json({
        data: { month, group: null, rows: [] },
      });
    }

    const groupLocationIds = group.locations.map((location) => location.locationId);
    const promoters = await prisma.user.findMany({
      where: {
        role: "PROMOTER",
        isActive: true,
        defaultLocationId: { in: groupLocationIds },
      },
      include: { defaultLocation: { select: { id: true, name: true } } },
    });

    const rows = await Promise.all(
      promoters.map(async (promoter) => {
        const [orders, returns] = await Promise.all([
          prisma.order.findMany({
            where: {
              createdById: promoter.id,
              createdAt: { gte: start, lt: end },
              status: { not: "CANCELLED" },
            },
            include: { items: true },
          }),
          prisma.promoterReturn.findMany({
            where: {
              promoterId: promoter.id,
              createdAt: { gte: start, lt: end },
            },
          }),
        ]);

        const net = calculateNetLeaderboardAmount({
          sales: orders.map((order) => ({
            amount: Number(order.totalAmount),
            quantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
          })),
          returns: returns.map((item) => ({
            amount: Number(item.amount),
            quantity: item.quantity,
          })),
        });

        return {
          promoterId: promoter.id,
          promoterName: promoter.name,
          locationId: promoter.defaultLocationId,
          locationName: promoter.defaultLocation?.name ?? "Unassigned",
          netSalesAmount: net.amount,
          netQuantity: net.quantity,
          tierName: findTierName(group.tiers, net.amount),
        };
      }),
    );

    const rankedRows = rows
      .sort((a, b) => b.netSalesAmount - a.netSalesAmount || b.netQuantity - a.netQuantity)
      .map((row, index) => ({ rank: index + 1, ...row }));

    return Response.json({
      data: {
        month,
        group: { id: group.id, name: group.name },
        rows: rankedRows,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_MONTH") {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Month must use YYYY-MM format" } },
        { status: 400 },
      );
    }
    return handleApiError(error);
  }
}

function findTierName(
  tiers: { name: string; minSales: unknown; maxSales: unknown | null }[],
  amount: number,
) {
  const tier = tiers.find((item) => {
    const min = Number(item.minSales);
    const max = item.maxSales == null ? null : Number(item.maxSales);
    return amount >= min && (max == null || amount <= max);
  });

  return tier?.name ?? null;
}

function getMonthRange(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("INVALID_MONTH");
  }

  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthNumber, 1, 0, 0, 0));
  return { start, end };
}

function formatMonth(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
