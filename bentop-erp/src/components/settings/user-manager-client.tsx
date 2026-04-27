"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, UserX, UserCheck, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const ROLES = ["ADMIN", "MANAGER", "STAFF", "VIEWER"] as const;
type Role = (typeof ROLES)[number];

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  department: string | null;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

type Props = {
  initialUsers: UserRow[];
  currentUserId: string;
};

const ROLE_COLORS: Record<Role, string> = {
  ADMIN: "destructive",
  MANAGER: "default",
  STAFF: "secondary",
  VIEWER: "outline",
};

function formatDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function UserManagerClient({ initialUsers, currentUserId }: Props) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "", email: "", password: "", role: "STAFF" as Role, phone: "", department: "",
  });

  // Edit dialog
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", phone: "", department: "", role: "STAFF" as Role, password: "",
  });

  const filtered = users.filter((u) => {
    if (!showInactive && !u.isActive) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.department ?? "").toLowerCase().includes(q)
    );
  });

  async function handleCreate() {
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          phone: createForm.phone || undefined,
          department: createForm.department || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Failed to create user");
        return;
      }
      setShowCreate(false);
      setCreateForm({ name: "", email: "", password: "", role: "STAFF", phone: "", department: "" });
      router.refresh();
      const updated = await fetch("/api/v1/users?includeInactive=true").then((r) => r.json());
      if (updated.data) setUsers(updated.data);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(user: UserRow) {
    setEditUser(user);
    setEditForm({
      name: user.name,
      phone: user.phone ?? "",
      department: user.department ?? "",
      role: user.role,
      password: "",
    });
    setError("");
  }

  async function handleEdit() {
    if (!editUser) return;
    setError("");
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: editForm.name,
        role: editForm.role,
        phone: editForm.phone || undefined,
        department: editForm.department || undefined,
      };
      if (editForm.password) body.password = editForm.password;

      const res = await fetch(`/api/v1/users/${editUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Failed to update user");
        return;
      }
      setEditUser(null);
      router.refresh();
      const updated = await fetch("/api/v1/users?includeInactive=true").then((r) => r.json());
      if (updated.data) setUsers(updated.data);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: UserRow) {
    if (user.id === currentUserId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      if (res.ok) {
        router.refresh();
        const updated = await fetch("/api/v1/users?includeInactive=true").then((r) => r.json());
        if (updated.data) setUsers(updated.data);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search by name, email, department…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
          aria-label="Search users"
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded"
          />
          Show inactive
        </label>
        <div className="sm:ml-auto">
          <Button onClick={() => { setShowCreate(true); setError(""); }}>
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
            Add User
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden md:table-cell">Department</TableHead>
              <TableHead className="hidden lg:table-cell">Last Login</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  No users found
                </TableCell>
              </TableRow>
            )}
            {filtered.map((user) => (
              <TableRow key={user.id} className={!user.isActive ? "opacity-50" : undefined}>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{user.name}</p>
                    <p className="text-xs text-muted-foreground sm:hidden">{user.email}</p>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-sm">{user.email}</TableCell>
                <TableCell>
                  <Badge variant={ROLE_COLORS[user.role] as "default" | "secondary" | "destructive" | "outline"}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {user.department ?? "—"}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                  {formatDate(user.lastLoginAt)}
                </TableCell>
                <TableCell>
                  <Badge variant={user.isActive ? "default" : "secondary"}>
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${user.name}`}
                      onClick={() => openEdit(user)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {user.id !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={user.isActive ? `Deactivate ${user.name}` : `Activate ${user.name}`}
                        onClick={() => toggleActive(user)}
                        disabled={saving}
                      >
                        {user.isActive ? (
                          <UserX className="h-4 w-4 text-destructive" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-green-600" />
                        )}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="grid gap-2">
              <Label htmlFor="c-name">Full Name *</Label>
              <Input id="c-name" value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-email">Email *</Label>
              <Input id="c-email" type="email" value={createForm.email} onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-password">Password * (min 8 chars)</Label>
              <Input id="c-password" type="password" value={createForm.password} onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-role">Role *</Label>
              <Select value={createForm.role} onValueChange={(v) => setCreateForm((p) => ({ ...p, role: v as Role }))}>
                <SelectTrigger id="c-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="c-phone">Phone</Label>
                <Input id="c-phone" value={createForm.phone} onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="c-dept">Department</Label>
                <Input id="c-dept" value={createForm.department} onChange={(e) => setCreateForm((p) => ({ ...p, department: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !createForm.name || !createForm.email || !createForm.password}>
              {saving ? "Creating…" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User — {editUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="grid gap-2">
              <Label htmlFor="e-name">Full Name *</Label>
              <Input id="e-name" value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="e-role">Role *</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm((p) => ({ ...p, role: v as Role }))}>
                <SelectTrigger id="e-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="e-phone">Phone</Label>
                <Input id="e-phone" value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="e-dept">Department</Label>
                <Input id="e-dept" value={editForm.department} onChange={(e) => setEditForm((p) => ({ ...p, department: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="e-pw" className="flex items-center gap-2">
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                New Password (leave blank to keep current)
              </Label>
              <Input id="e-pw" type="password" value={editForm.password} onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))} placeholder="••••••••" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving || !editForm.name}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
