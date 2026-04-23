import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SalesChannelClient } from "@/components/sales/sales-channel-client";

export default async function SalesChannelsSettingsPage() {
  const session = await auth();
  const role = (session?.user as unknown as { role: string } | undefined)?.role ?? "VIEWER";
  const canEdit = role === "ADMIN" || role === "MANAGER";

  const channels = await prisma.salesChannel.findMany({
    include: { _count: { select: { orders: true } } },
    orderBy: [{ isActive: "desc" }, { type: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Sales Channels</h2>
        <p className="text-muted-foreground">
          Configure storefronts, marketplaces, and wholesale channels for order attribution.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Channels</CardTitle>
          <CardDescription>
            Each order can be attributed to a channel. Commission rates apply to marketplace channels (Shopee, TikTok, etc.).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SalesChannelClient
            canEdit={canEdit}
            initialChannels={channels.map((c) => ({
              id: c.id,
              name: c.name,
              type: c.type,
              commissionRate: c.commissionRate != null ? Number(c.commissionRate) : null,
              isActive: c.isActive,
              orderCount: c._count.orders,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
