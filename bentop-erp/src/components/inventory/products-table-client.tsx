"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Search, Pencil, ChevronLeft, ChevronRight, Package2,
  ChevronDown, ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";

type Variant = {
  id: string;
  sku: string;
  color: string;
  colorHex: string;
  size: string;
  isActive: boolean;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  skuPrefix: string;
  category: { id: string; name: string };
  baseCostMyr: string;
  isActive: boolean;
  variantCount: number;
  variants: Variant[];
  updatedAt: string;
};

type Category = { id: string; name: string };

type Props = {
  products: Product[];
  categories: Category[];
  currentSearch: string;
  currentCategory: string;
  currentStatus: string;
  page: number;
  totalPages: number;
  total: number;
};

export function ProductsTableClient({
  products,
  categories,
  currentSearch,
  currentCategory,
  currentStatus,
  page,
  totalPages,
  total,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(currentSearch);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    if (key !== "page") params.delete("page");
    router.push(`/inventory/products?${params.toString()}`);
  };

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam("search", searchInput);
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(products.map((p) => p.id)));
  const collapseAll = () => setExpanded(new Set());
  const allExpanded = products.length > 0 && expanded.size === products.length;

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-4 border-b">
        <form onSubmit={onSearchSubmit} className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or SKU..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </form>
        <Select value={currentCategory || "all"} onValueChange={(v) => updateParam("category", v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={currentStatus || "all"} onValueChange={(v) => updateParam("status", v)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={allExpanded ? collapseAll : expandAll}>
          {allExpanded ? "Collapse All" : "Expand All"}
        </Button>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Parent SKU</TableHead>
            <TableHead>Product Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-center">Variants</TableHead>
            <TableHead className="text-right">Base Cost</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-12">
                <Package2 className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No products found.</p>
              </TableCell>
            </TableRow>
          ) : (
            products.map((p) => {
              const isExpanded = expanded.has(p.id);
              // Group variants by color for display
              const colorGroups = Array.from(
                p.variants.reduce((map, v) => {
                  if (!map.has(v.color)) map.set(v.color, { color: v.color, hex: v.colorHex, variants: [] });
                  map.get(v.color)!.variants.push(v);
                  return map;
                }, new Map<string, { color: string; hex: string; variants: Variant[] }>())
                .values()
              );

              return (
                <>
                  {/* Parent row */}
                  <TableRow
                    key={p.id}
                    className={`cursor-pointer hover:bg-muted/50 ${isExpanded ? "bg-muted/30 border-b-0" : ""}`}
                    onClick={() => toggleExpand(p.id)}
                  >
                    <TableCell className="pl-4">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-bold text-sm tracking-wide">
                        {p.skuPrefix}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.category.name}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm font-medium">{p.variantCount}</span>
                      <span className="text-xs text-muted-foreground ml-1">SKUs</span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(p.baseCostMyr))}
                    </TableCell>
                    <TableCell>
                      {p.isActive ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/inventory/products/${p.id}/edit`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>

                  {/* Expanded child SKUs */}
                  {isExpanded && (
                    <TableRow key={`${p.id}-children`} className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={8} className="py-0 px-0">
                        <div className="mx-6 my-3 border rounded-md overflow-hidden">
                          {p.variants.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-3">
                              No active variants — <Link href={`/inventory/products/${p.id}/variants`} className="underline">add variants</Link>
                            </p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-muted/50 border-b">
                                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Child SKU</th>
                                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Color</th>
                                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Size</th>
                                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {p.variants.map((v, i) => (
                                  <tr
                                    key={v.id}
                                    className={i % 2 === 0 ? "bg-background" : "bg-muted/10"}
                                  >
                                    <td className="px-3 py-1.5 font-mono font-medium">{v.sku}</td>
                                    <td className="px-3 py-1.5">
                                      <div className="flex items-center gap-1.5">
                                        <span
                                          className="inline-block h-3 w-3 rounded-full ring-1 ring-border"
                                          style={{ backgroundColor: v.colorHex }}
                                        />
                                        {v.color}
                                      </div>
                                    </td>
                                    <td className="px-3 py-1.5 font-medium">{v.size}</td>
                                    <td className="px-3 py-1.5">
                                      {v.isActive ? (
                                        <span className="text-green-600 font-medium">Active</span>
                                      ) : (
                                        <span className="text-muted-foreground">Inactive</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                        {/* Colour summary */}
                        {colorGroups.length > 0 && (
                          <div className="mx-6 mb-3 flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">Colours:</span>
                            {colorGroups.map((g) => (
                              <span key={g.color} className="flex items-center gap-1 text-xs bg-background border rounded px-2 py-0.5">
                                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.hex }} />
                                {g.color}
                                <span className="text-muted-foreground">×{g.variants.length}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4 border-t">
          <div className="text-sm text-muted-foreground">
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => updateParam("page", String(page - 1))}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm px-2">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => updateParam("page", String(page + 1))}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
