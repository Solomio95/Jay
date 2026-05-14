"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Location = {
  id: string;
  name: string;
  type: string;
};

type ProfileUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  department: string | null;
  role: string;
  isActive: boolean;
  defaultLocation: Location | null;
  supervisedLocations: Location[];
  temporaryLocations: Array<{
    id: string;
    startsAt: string | Date;
    endsAt: string | Date;
    location: Location;
  }>;
  createdAt: string | Date;
  updatedAt: string | Date;
  lastLoginAt: string | Date | null;
};

export function ProfileFormClient({ user }: { user: ProfileUser }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [department, setDepartment] = useState(user.department ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveProfile() {
    setMessage("");
    setError("");

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/v1/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          phone: phone || null,
          department: department || null,
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        setError(json?.error?.message ?? "Could not update profile");
        return;
      }
      setMessage("Profile updated");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <Card className="p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold">Employee Information</h3>
          <p className="text-sm text-muted-foreground">
            Update your personal details. Admin controls account role, email, and assigned locations.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="employeeId">Employee ID</Label>
            <Input id="employeeId" value={user.id} readOnly className="font-mono text-xs" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user.email} readOnly />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        {message && (
          <div className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            {message}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button onClick={saveProfile} disabled={saving}>
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="p-5">
          <h3 className="font-semibold">Access</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Role</span>
              <Badge variant="outline">{formatRole(user.role)}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={user.isActive ? "success" : "secondary"}>
                {user.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <InfoRow label="Default location" value={user.defaultLocation?.name ?? "-"} />
            <InfoRow label="Last login" value={user.lastLoginAt ? formatDate(user.lastLoginAt) : "-"} />
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold">Location Coverage</h3>
          <div className="mt-4 space-y-3 text-sm">
            <InfoRow
              label="Supervises"
              value={
                user.supervisedLocations.length
                  ? user.supervisedLocations.map((location) => location.name).join(", ")
                  : "-"
              }
            />
            <div>
              <div className="text-muted-foreground">Temporary coverage</div>
              <div className="mt-1 space-y-1">
                {user.temporaryLocations.length ? (
                  user.temporaryLocations.map((coverage) => (
                    <div key={coverage.id} className="rounded-md bg-muted/40 px-2 py-1">
                      {coverage.location.name}
                    </div>
                  ))
                ) : (
                  <span>-</span>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function formatRole(role: string) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
