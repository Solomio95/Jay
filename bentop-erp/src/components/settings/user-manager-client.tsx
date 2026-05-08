"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, ShieldCheck, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type UserRole = "ADMIN" | "MANAGER" | "STAFF" | "VIEWER" | "PROMOTER" | "SUPERVISOR";

type Location = {
  id: string;
  name: string;
  type: string;
};

type ManagedUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  department: string | null;
  role: UserRole;
  isActive: boolean;
  defaultLocationId: string | null;
  defaultLocation: Location | null;
  supervisedLocations: Location[];
  lastLoginAt: Date | string | null;
};

type UserForm = {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  phone: string;
  department: string;
  defaultLocationId: string;
  supervisedLocationIds: string[];
  isActive: boolean;
};

const ROLES: Array<{ value: UserRole; label: string; description: string }> = [
  { value: "ADMIN", label: "Admin", description: "Full system access" },
  { value: "MANAGER", label: "Manager", description: "Operations and reports" },
  { value: "STAFF", label: "Staff", description: "HQ stock and sales operations" },
  { value: "SUPERVISOR", label: "Supervisor", description: "Location transfer handling" },
  { value: "PROMOTER", label: "Promoter", description: "Locked location sales workflow" },
  { value: "VIEWER", label: "Viewer", description: "Read-only reporting access" },
];

const emptyForm: UserForm = {
  email: "",
  name: "",
  password: "",
  role: "STAFF",
  phone: "",
  department: "",
  defaultLocationId: "",
  supervisedLocationIds: [],
  isActive: true,
};

export function UserManagerClient({
  initialUsers,
  locations,
}: {
  initialUsers: ManagedUser[];
  locations: Location[];
}) {
  const router = useRouter();
  const [users] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) =>
      [user.name, user.email, user.phone, user.department, user.role, user.defaultLocation?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [query, users]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setDialogOpen(true);
  }

  function openEdit(user: ManagedUser) {
    setEditing(user);
    setForm({
      email: user.email,
      name: user.name,
      password: "",
      role: user.role,
      phone: user.phone ?? "",
      department: user.department ?? "",
      defaultLocationId: user.defaultLocationId ?? "",
      supervisedLocationIds: user.supervisedLocations.map((location) => location.id),
      isActive: user.isActive,
    });
    setError("");
    setDialogOpen(true);
  }

  function toggleSupervisedLocation(locationId: string) {
    setForm((current) => ({
      ...current,
      supervisedLocationIds: current.supervisedLocationIds.includes(locationId)
        ? current.supervisedLocationIds.filter((id) => id !== locationId)
        : [...current.supervisedLocationIds, locationId],
    }));
  }

  async function submit() {
    setError("");

    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and email are required");
      return;
    }

    if (!editing && form.password.length < 6) {
      setError("New account password must be at least 6 characters");
      return;
    }

    if (form.role === "PROMOTER" && !form.defaultLocationId) {
      setError("Promoter needs a default location");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        email: form.email,
        name: form.name,
        password: form.password,
        role: form.role,
        phone: form.phone || null,
        department: form.department || null,
        defaultLocationId: form.defaultLocationId || null,
        supervisedLocationIds: form.role === "SUPERVISOR" ? form.supervisedLocationIds : [],
        isActive: form.isActive,
      };
      const response = await fetch(editing ? `/api/v1/users/${editing.id}` : "/api/v1/users", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        setError(json?.error?.message ?? "Could not save user");
        return;
      }
      setDialogOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-md">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search users, email, role, or location"
          />
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Account
        </Button>
      </div>

      <div className="grid gap-3">
        {filteredUsers.map((user) => (
          <div key={user.id} className="rounded-lg border bg-card p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                  <div className="font-medium">{user.name}</div>
                  <Badge variant={user.isActive ? "success" : "secondary"}>
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant="outline">{roleLabel(user.role)}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">{user.email}</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {user.phone && <span>{user.phone}</span>}
                  {user.department && <span>{user.department}</span>}
                  {user.defaultLocation && <span>Default: {user.defaultLocation.name}</span>}
                  {user.supervisedLocations.length > 0 && (
                    <span>
                      Supervises: {user.supervisedLocations.map((location) => location.name).join(", ")}
                    </span>
                  )}
                  {user.lastLoginAt && <span>Last login: {formatDate(user.lastLoginAt)}</span>}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => openEdit(user)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Account" : "Register Account"}</DialogTitle>
            <DialogDescription>
              Create ERP logins for HQ users, supervisors, promoters, and report viewers.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {error && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">{editing ? "New password" : "Password"}</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  placeholder={editing ? "Leave blank to keep current password" : ""}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value as UserRole })}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <ShieldCheck className="h-4 w-4" />
                {roleLabel(form.role)}
              </div>
              <p className="mt-1 text-muted-foreground">
                {ROLES.find((role) => role.value === form.role)?.description}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={form.department}
                  onChange={(event) => setForm({ ...form, department: event.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultLocation">Default location</Label>
              <Select
                value={form.defaultLocationId || "none"}
                onValueChange={(value) => setForm({ ...form, defaultLocationId: value === "none" ? "" : value })}
              >
                <SelectTrigger id="defaultLocation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No default location</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.role === "PROMOTER" && (
                <p className="text-xs text-muted-foreground">
                  Promoter sales will be locked to this location unless HQ adds temporary coverage later.
                </p>
              )}
            </div>

            {form.role === "SUPERVISOR" && (
              <div className="space-y-2">
                <Label>Supervised locations</Label>
                <div className="grid max-h-44 gap-2 overflow-y-auto rounded-md border p-3 md:grid-cols-2">
                  {locations.map((location) => (
                    <label key={location.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.supervisedLocationIds.includes(location.id)}
                        onChange={() => toggleSupervisedLocation(location.id)}
                        className="h-4 w-4 rounded border"
                      />
                      <span>{location.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {editing && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                  className="h-4 w-4 rounded border"
                />
                Account active
              </label>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={loading}>
              {loading ? "Saving..." : editing ? "Save Account" : "Register Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function roleLabel(role: UserRole) {
  return ROLES.find((item) => item.value === role)?.label ?? role;
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
