"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Search, Pencil, ChevronLeft, ChevronRight, Package2 } from "lucide-react";
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
import { formatCurrency, formatDateTime } from "@/lib/utils";

type Product = {
  id: string;
  name: string;
  slug: string;
  skuPrefix: string;
  category: { id: string; name: string };
  baseCostMyr: string;
  isActive: boolean;
  variantCount: number;
  colors: { name: string; hex: string }[];
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
    // Reset page when filters change
    if (key !== "page") params.delete("page");
    router.push(`/inventory/products?${params.toString()}`);
  };

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam("search", searchInput);
  };

  return (
    <>
      {/* Filters */}
      <div className="flex items-center gap-3 p-4 border-b">
        <form onSubmit={onSearchSubmit} className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or SKU..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </form>
        <Select
          value={currentCategory || "all"}
          onValueChange={(v) => updateParam("category", v)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={currentStatus || "all"}
          onValueChange={(v) => updateParam("status", v)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>SKU Prefix</TableHead>
            <TableHead>Variants</TableHead>
            <TableHead>Colors</TableHead>
            <TableHead className="text-right">Base Cost</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-12">
                <Package2 className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No products found.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try adjusting your filters or add a new product.
                </p>
              </TableCell>
            </TableRow>
          ) : (
            products.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/inventory/products/${p.id}/edit`}
                    className="hover:underline"
                  >
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{p.category.name}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{p.skuPrefix}</TableCell>
                <TableCell>
                  <span className="text-sm">{p.variantCount}</span>
                </TableCell>
                <TableCell>
                  <div className="flex -space-x-1">
                    {p.colors.slice(0, 5).map((c) => (
                      <span
                        key={c.name}
                        className="inline-block h-5 w-5 rounded-full ring-2 ring-background"
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      />
                    ))}
                    {p.colors.length > 5 && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        +{p.colors.length - 5}
                      </span>
                    )}
                  </div>
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
                <TableCell className="text-xs text-muted-foreground">
                  {formatDateTime(p.updatedAt)}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/inventory/products/${p.id}/edit`}>
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))
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
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => updateParam("page", String(page - 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm px-2">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => updateParam("page", String(page + 1))}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
