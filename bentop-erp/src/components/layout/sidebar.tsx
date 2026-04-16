"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Package,
  ShoppingCart,
  LayoutDashboard,
  Boxes,
  ArrowLeftRight,
  ClipboardList,
  BarChart3,
  Users,
  Store,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

type NavItem = {
  title: string;
  href: string;
  icon: React.ReactNode;
  children?: { title: string; href: string }[];
};

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    title: "Inventory",
    href: "/inventory",
    icon: <Package className="h-5 w-5" />,
    children: [
      { title: "Overview", href: "/inventory" },
      { title: "Products", href: "/inventory/products" },
      { title: "Categories", href: "/inventory/categories" },
      { title: "Locations", href: "/inventory/locations" },
      { title: "Stock Levels", href: "/inventory/stock" },
      { title: "Transfers", href: "/inventory/transfers" },
      { title: "Adjustments", href: "/inventory/adjustments" },
      { title: "Reports", href: "/inventory/reports" },
    ],
  },
  {
    title: "Sales",
    href: "/sales",
    icon: <ShoppingCart className="h-5 w-5" />,
    children: [
      { title: "Overview", href: "/sales" },
      { title: "Orders", href: "/sales/orders" },
      { title: "POS", href: "/sales/pos" },
      { title: "Customers", href: "/sales/customers" },
      { title: "Reports", href: "/sales/reports" },
    ],
  },
  {
    title: "Consignment",
    href: "/consignment",
    icon: <Boxes className="h-5 w-5" />,
    children: [
      { title: "Overview", href: "/consignment" },
      { title: "New Shipment", href: "/consignment/shipments/new" },
    ],
  },
  {
    title: "Settings",
    href: "/settings",
    icon: <Settings className="h-5 w-5" />,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    // Auto-expand the section that matches current path
    const matching = navItems.find(
      (item) => item.children && pathname.startsWith(item.href) && item.href !== "/"
    );
    return matching ? [matching.title] : [];
  });

  const toggleExpanded = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
          {!collapsed && (
            <Link href="/" className="flex items-center gap-2">
              <Store className="h-7 w-7 text-blue-400" />
              <div>
                <h1 className="text-base font-bold tracking-tight">Bentop</h1>
                <p className="text-[10px] text-sidebar-foreground/60 -mt-0.5">Collection ERP</p>
              </div>
            </Link>
          )}
          {collapsed && (
            <Link href="/" className="mx-auto">
              <Store className="h-7 w-7 text-blue-400" />
            </Link>
          )}
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-3">
          <nav className="space-y-1 px-2">
            {navItems.map((item) => {
              const active = isActive(item.href);
              const expanded = expandedItems.includes(item.title);

              if (item.children) {
                return (
                  <div key={item.title}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            href={item.children[0].href}
                            className={cn(
                              "flex items-center justify-center h-10 w-full rounded-md transition-colors",
                              active
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                            )}
                          >
                            {item.icon}
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right">{item.title}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <>
                        <button
                          onClick={() => toggleExpanded(item.title)}
                          className={cn(
                            "flex items-center w-full gap-3 px-3 h-10 rounded-md text-sm font-medium transition-colors",
                            active
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                          )}
                        >
                          {item.icon}
                          <span className="flex-1 text-left">{item.title}</span>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform",
                              expanded && "rotate-180"
                            )}
                          />
                        </button>
                        {expanded && (
                          <div className="ml-5 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
                            {item.children.map((child) => (
                              <Link
                                key={child.href}
                                href={child.href}
                                className={cn(
                                  "flex items-center h-8 px-3 rounded-md text-sm transition-colors",
                                  pathname === child.href
                                    ? "text-sidebar-accent-foreground font-medium bg-sidebar-accent/60"
                                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/30"
                                )}
                              >
                                {child.title}
                              </Link>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              }

              return collapsed ? (
                <Tooltip key={item.title}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center justify-center h-10 w-full rounded-md transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      {item.icon}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.title}</TooltipContent>
                </Tooltip>
              ) : (
                <Link
                  key={item.title}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 h-10 rounded-md text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  {item.icon}
                  <span>{item.title}</span>
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Collapse toggle */}
        <div className="border-t border-sidebar-border p-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full h-9 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
