import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const settingsSections = [
  {
    title: "Company Profile",
    description: "Company name, logo, address, and tax ID configuration",
    href: null,
    comingSoon: true,
  },
  {
    title: "User Management",
    description: "Manage users, roles, and permissions",
    href: "/settings/users",
    comingSoon: false,
  },
  {
    title: "Locations",
    description: "Configure warehouses, retail stores, and consignment locations",
    href: "/inventory/locations",
    comingSoon: false,
  },
  {
    title: "Sales Channels",
    description: "Manage sales channel configuration and commission rates",
    href: "/settings/channels",
    comingSoon: false,
  },
  {
    title: "Currency & Exchange Rates",
    description: "Configure currencies and manage exchange rates",
    href: "/settings/currency",
    comingSoon: false,
  },
  {
    title: "Notifications",
    description: "Set up email and in-app notification preferences",
    href: null,
    comingSoon: true,
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">System configuration and administration.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {settingsSections.map((section) => {
          const card = (
            <Card
              className={
                section.href
                  ? "cursor-pointer hover:border-primary/50 transition-colors h-full"
                  : "opacity-60 h-full"
              }
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  {section.comingSoon && (
                    <Badge variant="secondary" className="text-[10px]">
                      Coming Soon
                    </Badge>
                  )}
                </div>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
            </Card>
          );
          return section.href ? (
            <Link key={section.title} href={section.href} aria-label={section.title}>
              {card}
            </Link>
          ) : (
            <div key={section.title} aria-label={`${section.title} — coming soon`}>
              {card}
            </div>
          );
        })}
      </div>
    </div>
  );
}
