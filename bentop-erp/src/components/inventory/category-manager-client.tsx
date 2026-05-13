"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  description: string | null;
  sortOrder: number;
  productCount: number;
  hasChildren: boolean;
};

type Props = {
  initialCategories: Category[];
  rootCategoryIds: string[];
};

export function CategoryManagerClient({ initialCategories, rootCategoryIds }: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(rootCategoryIds));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    parentId: "",
    sortOrder: 0,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const openCreate = (parentId: string | null = null) => {
    setEditing(null);
    setForm({ name: "", slug: "", description: "", parentId: parentId || "", sortOrder: 0 });
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || "",
      parentId: cat.parentId || "",
      sortOrder: cat.sortOrder,
    });
    setError("");
    setDialogOpen(true);
  };

  const editingRootCategory = editing ? !editing.parentId : false;

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    const payload = {
      name: form.name,
      slug: form.slug || undefined,
      description: form.description || undefined,
      parentId: form.parentId || null,
      sortOrder: Number(form.sortOrder) || 0,
    };

    try {
      const url = editing ? `/api/v1/categories/${editing.id}` : "/api/v1/categories";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Failed to save category");
        return;
      }
      setDialogOpen(false);
      router.refresh();

      // Optimistically update local state
      if (editing) {
        setCategories((prev) =>
          prev.map((c) =>
            c.id === editing.id
              ? {
                  ...c,
                  name: payload.name,
                  slug: payload.slug || c.slug,
                  parentId: payload.parentId,
                  description: payload.description || null,
                  sortOrder: payload.sortOrder,
                }
              : c
          )
        );
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    if (cat.productCount > 0) {
      alert(`Cannot delete: this category has ${cat.productCount} products.`);
      return;
    }
    if (!confirm(`Delete category "${cat.name}"?`)) return;

    const res = await fetch(`/api/v1/categories/${cat.id}`, { method: "DELETE" });
    if (res.ok) {
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error?.message || "Failed to delete");
    }
  };

  const getChildren = (parentId: string | null) =>
    categories.filter((c) => c.parentId === parentId);

  const renderTree = (parentId: string | null, depth = 0): React.ReactNode => {
    const nodes = getChildren(parentId).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    if (nodes.length === 0 && depth === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No categories yet. Create your first category to get started.
        </div>
      );
    }

    return nodes.map((cat) => {
      const children = getChildren(cat.id);
      const isExpanded = expanded.has(cat.id);
      const hasKids = children.length > 0;

      return (
        <div key={cat.id}>
          <div
            className={cn(
              "flex items-center gap-2 py-2 px-2 hover:bg-muted/50 rounded-md border-b last:border-b-0"
            )}
            style={{ paddingLeft: `${depth * 24 + 8}px` }}
          >
            <button
              onClick={() => hasKids && toggleExpanded(cat.id)}
              className="w-5 h-5 flex items-center justify-center"
            >
              {hasKids ? (
                isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
              )}
            </button>
            <Folder className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{cat.name}</span>
                {!cat.parentId && (
                  <Badge variant="outline" className="text-xs">
                    Root
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground font-mono">{cat.slug}</span>
                <Badge variant="secondary" className="text-xs">
                  {cat.productCount} products
                </Badge>
              </div>
              {cat.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{cat.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => openCreate(cat.id)} title="Add subcategory">
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => openEdit(cat)}
                title={cat.parentId ? "Edit category" : "Edit root category"}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleDelete(cat)}
                title="Delete"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {isExpanded && renderTree(cat.id, depth + 1)}
        </div>
      );
    });
  };

  const availableParents = categories.filter((c) => !editing || c.id !== editing.id);

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button onClick={() => openCreate(null)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Root Category
        </Button>
      </div>
      <div className="border rounded-lg divide-y">
        <div className="[&>*]:group">{renderTree(null)}</div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? (editingRootCategory ? "Edit Root Category" : "Edit Category") : "New Category"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update category details, including whether it stays as a root category."
                : "Add a new category to organize products."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. T-Shirts"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (optional — auto-generated)</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="e.g. t-shirts"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parent">Parent Category</Label>
              <p className="text-xs text-muted-foreground">
                Choose None to keep this category at the root level.
              </p>
              <Select
                value={form.parentId || "none"}
                onValueChange={(v) => setForm({ ...form, parentId: v === "none" ? "" : v })}
              >
                <SelectTrigger id="parent">
                  <SelectValue placeholder="None (root)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (root)</SelectItem>
                  {availableParents.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sort">Sort Order</Label>
              <Input
                id="sort"
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || !form.name.trim()}>
              {loading ? "Saving..." : editing ? "Save Changes" : "Create Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
