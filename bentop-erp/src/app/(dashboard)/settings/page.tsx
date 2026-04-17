import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const settingsSections = [
  {
    title: "Company Profile",
    description: "Company name, logo, address, and tax ID configuration",
    href: null,
  },
  {
    title: "User Management",
    description: "Manage users, roles, and permissions",
    href: null,
  },
  {
    title: "Locations",
    description: "Configure warehouses, retail stores, and consignment locations",
    href: "/inventory/locations",
  },
  {
    title: "Sales Channels",
    description: "Manage sales channel configuration and commission rates",
    href: "/settings/channels",
  },
  {
    title: "Currency & Exchange Rates",
    description: "Configure currencies and manage exchange rates",
    href: "/settings/currency",
  },
  {
    title: "Notifications",
    description: "Set up email and in-app notification preferences",
    href: null,
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
          const content = (
            <Card
              className={
                section.href
                  ? "cursor-pointer hover:border-primary/50 transition-colors h-full"
                  : "opacity-60 h-full"
              }
            >
              <CardHeader>
                <CardTitle className="text-base">{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
            </Card>
          );
          return section.href ? (
            <Link key={section.title} href={section.href}>
              {content}
            </Link>
          ) : (
            <div key={section.title}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
