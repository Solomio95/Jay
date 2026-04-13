import { Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const settingsSections = [
  { title: "Company Profile", description: "Company name, logo, address, and tax ID configuration" },
  { title: "User Management", description: "Manage users, roles, and permissions" },
  { title: "Locations", description: "Configure warehouses, retail stores, and consignment locations" },
  { title: "Sales Channels", description: "Manage sales channel configuration and commission rates" },
  { title: "Currency & Exchange Rates", description: "Configure currencies and manage exchange rates" },
  { title: "Notifications", description: "Set up email and in-app notification preferences" },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">System configuration and administration.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {settingsSections.map((section) => (
          <Card key={section.title} className="cursor-pointer hover:border-primary/50 transition-colors">
            <CardHeader>
              <CardTitle className="text-base">{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
