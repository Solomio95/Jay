import { auth } from "@/lib/auth";
import {
  Package,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Boxes,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const kpiCards = [
  {
    title: "Total Revenue",
    value: "RM 124,500",
    change: "+12.5%",
    trend: "up" as const,
    icon: DollarSign,
    description: "vs last month",
  },
  {
    title: "Orders Today",
    value: "23",
    change: "+4",
    trend: "up" as const,
    icon: ShoppingCart,
    description: "vs yesterday",
  },
  {
    title: "Total Products",
    value: "156",
    change: "+8",
    trend: "up" as const,
    icon: Package,
    description: "active SKUs",
  },
  {
    title: "Low Stock Alerts",
    value: "7",
    change: "+2",
    trend: "down" as const,
    icon: AlertTriangle,
    description: "items below reorder point",
  },
];

const recentOrders = [
  { id: "BT-SO-20260413-0001", customer: "Sarah Ahmad", total: "RM 450.00", status: "CONFIRMED", channel: "Retail Store" },
  { id: "BT-SO-20260413-0002", customer: "TechStyle Sdn Bhd", total: "RM 8,200.00", status: "PROCESSING", channel: "Wholesale" },
  { id: "BT-SO-20260412-0015", customer: "Online Customer", total: "RM 189.00", status: "SHIPPED", channel: "Shopee" },
  { id: "BT-SO-20260412-0014", customer: "Fashion Hub", total: "RM 3,400.00", status: "DELIVERED", channel: "Consignment" },
  { id: "BT-SO-20260412-0013", customer: "Walk-in", total: "RM 275.00", status: "DELIVERED", channel: "Retail Store" },
];

const lowStockItems = [
  { sku: "BT-TS-001-BLK-M", name: "Classic Tee - Black M", location: "Main Warehouse", qty: 3, reorder: 20 },
  { sku: "BT-PN-003-NVY-L", name: "Slim Pants - Navy L", location: "Pavilion Store", qty: 1, reorder: 10 },
  { sku: "BT-JK-002-GRY-XL", name: "Bomber Jacket - Grey XL", location: "Main Warehouse", qty: 5, reorder: 15 },
  { sku: "BT-DR-001-WHT-S", name: "Summer Dress - White S", location: "Main Warehouse", qty: 2, reorder: 10 },
];

const statusColors: Record<string, string> = {
  DRAFT: "secondary",
  CONFIRMED: "default",
  PROCESSING: "default",
  PACKED: "default",
  SHIPPED: "warning",
  DELIVERED: "success",
  CANCELLED: "destructive",
  RETURNED: "destructive",
};

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Welcome back, {session?.user?.name?.split(" ")[0]}
        </h2>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening with your business today.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                {card.trend === "up" ? (
                  <ArrowUpRight className="h-3 w-3 text-green-600 mr-1" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-red-600 mr-1" />
                )}
                <span className={card.trend === "up" && card.title !== "Low Stock Alerts" ? "text-green-600" : "text-red-600"}>
                  {card.change}
                </span>
                <span className="ml-1">{card.description}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium font-mono">{order.id}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.customer} &middot; {order.channel}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{order.total}</span>
                    <Badge variant={statusColors[order.status] as "default" | "secondary" | "destructive" | "outline" | "success" | "warning"}>
                      {order.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lowStockItems.map((item) => (
                <div
                  key={item.sku}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {item.sku} &middot; {item.location}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-600">{item.qty} left</p>
                    <p className="text-xs text-muted-foreground">
                      Reorder at {item.reorder}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
