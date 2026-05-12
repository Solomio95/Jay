"use client";

import { Bell, Search, LogOut, User, ChevronRight, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type HeaderProps = {
  user: {
    name: string;
    email: string;
    role: string;
  };
  onMenuToggle?: () => void;
};

const pathLabels: Record<string, string> = {
  "/": "Dashboard",
  "/inventory": "Inventory",
  "/inventory/products": "Products",
  "/inventory/products/new": "New Product",
  "/inventory/categories": "Categories",
  "/inventory/locations": "Locations",
  "/inventory/stock": "Stock Levels",
  "/inventory/stock/in": "Stock In",
  "/inventory/stock/out": "Stock Out",
  "/inventory/transfers": "Transfers",
  "/inventory/transfers/new": "New Transfer",
  "/inventory/adjustments": "Adjustments",
  "/inventory/reports": "Reports",
  "/sales": "Sales Overview",
  "/sales/orders": "Orders",
  "/sales/orders/new": "New Order",
  "/sales/pos": "Point of Sale",
  "/sales/customers": "Customers",
  "/sales/reports": "Reports",
  "/purchases": "Purchases",
  "/purchases/orders": "Purchase Orders",
  "/purchases/orders/new": "New Purchase Order",
  "/purchases/suppliers": "Suppliers",
  "/purchases/receipts": "Receipts",
  "/purchases/payments": "Payments",
  "/consignment": "Consignment",
  "/consignment/shipments": "Shipments",
  "/consignment/shipments/new": "New Shipment",
  "/consignment/stock": "Stock",
  "/consignment/partners": "Partners",
  "/consignment/reports": "Reports",
  "/consignment/invoices": "Invoices",
  "/settings": "Settings",
  "/settings/users": "Users & Roles",
  "/settings/channels": "Sales Channels",
  "/settings/currency": "Currency & Exchange Rates",
};

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [{ label: "Home", href: "/" }];

  let currentPath = "";
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const label = pathLabels[currentPath] || segment.charAt(0).toUpperCase() + segment.slice(1);
    crumbs.push({ label, href: currentPath });
  }

  return crumbs;
}

export function Header({ user, onMenuToggle }: HeaderProps) {
  const pathname = usePathname();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const activePathname = mounted ? pathname : "/";
  const breadcrumbs = getBreadcrumbs(activePathname);
  const pageTitle = breadcrumbs[breadcrumbs.length - 1]?.label || "Dashboard";
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-30 flex h-14 md:h-16 items-center justify-between border-b bg-background px-3 md:px-6">
      {/* Left: Menu + Breadcrumbs */}
      <div className="flex items-center gap-2">
        {onMenuToggle && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onMenuToggle}
            aria-label="Toggle navigation menu"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Button>
        )}
        <div className="flex flex-col">
        <nav className="hidden sm:flex items-center text-xs text-muted-foreground" aria-label="Breadcrumb">
          <ol className="flex items-center">
          {breadcrumbs.map((crumb, i) => (
            <li key={crumb.href} className="flex items-center">
              {i > 0 && <ChevronRight className="h-3 w-3 mx-1" aria-hidden="true" />}
              {i < breadcrumbs.length - 1 ? (
                <Link href={crumb.href} className="hover:text-foreground transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium" aria-current="page">{crumb.label}</span>
              )}
            </li>
          ))}
          </ol>
        </nav>
        <h1 className="text-base md:text-lg font-semibold truncate">{pageTitle}</h1>
        </div>
      </div>

      {/* Right: Search, Notifications, User */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <Button variant="outline" size="sm" className="hidden md:flex gap-2 text-muted-foreground">
          <Search className="h-4 w-4" />
          <span className="text-xs">Search...</span>
          <kbd className="pointer-events-none ml-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications (3 unread)">
          <Bell className="h-5 w-5" aria-hidden="true" />
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground" aria-hidden="true">
            3
          </span>
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start">
                <span className="text-sm font-medium">{user.name}</span>
                <span className="text-xs text-muted-foreground capitalize">{user.role.toLowerCase()}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{user.name}</span>
                <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function emptySubscribe() {
  return () => {};
}
