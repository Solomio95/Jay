"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Boxes,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { title: "Home", href: "/", icon: LayoutDashboard },
  { title: "Inventory", href: "/inventory", icon: Package },
  { title: "Sales", href: "/sales", icon: ShoppingCart },
  { title: "Consign", href: "/consignment", icon: Boxes },
  { title: "Settings", href: "/settings", icon: Settings },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t safe-bottom" aria-label="Mobile navigation">
      <div className="flex items-center justify-around h-14" role="menubar">
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.title}
              aria-current={active ? "page" : undefined}
              role="menuitem"
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-2 py-1 min-w-[56px] transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="text-[10px] font-medium">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
