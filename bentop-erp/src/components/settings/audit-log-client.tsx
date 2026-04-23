"use client";

import { useState, useCallback } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
  user: { name: string; email: string };
};

type Props = {
  initialLogs: AuditRow[];
  initialTotal: number;
  entityTypes: string[];
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "success",
  UPDATE: "default",
  DELETE: "destructive",
  CANCEL: "warning",
  SHIP: "default",
  SETTLE: "success",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-MY", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const LIMIT = 50;

export function AuditLogClient({ initialLogs, initialTotal, entityTypes }: Props) {
  const [logs, setLogs] = useState(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const fetchLogs = useCallback(async (newSearch: string, newType: string, newPage: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), page: String(newPage) });
      if (newSearch) params.set("search", newSearch);
      if (newType && newType !== "all") params.set("entityType", newType);
      const res = await fetch(`/api/v1/audit-log?${params}`);
      const json = await res.json();
      if (json.data) {
        setLogs(json.data);
        setTotal(json.meta.total);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
    fetchLogs(value, entityType, 1);
  }

  function handleType(value: string) {
    setEntityType(value);
    setPage(1);
    fetchLogs(search, value, 1);
  }

  function handlePage(newPage: number) {
    setPage(newPage);
    fetchLogs(search, entityType, newPage);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative sm:max-w-xs w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search by action, type, user…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-8"
            aria-label="Search audit log"
          />
        </div>
        <Select value={entityType} onValueChange={handleType}>
          <SelectTrigger className="sm:w-48" aria-label="Filter by entity type">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {entityTypes.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground self-center sm:ml-auto">
          {total.toLocaleString()} entries
        </span>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead className="hidden md:table-cell">Changes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No audit entries found
                </TableCell>
              </TableRow>
            )}
            {logs.map((log) => (
              <TableRow key={log.id} className={loading ? "opacity-50" : undefined}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {fmt(log.createdAt)}
                </TableCell>
                <TableCell>
                  <p className="text-sm font-medium">{log.user.name}</p>
                  <p className="text-xs text-muted-foreground">{log.user.email}</p>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={(ACTION_COLORS[log.action] ?? "secondary") as "default" | "secondary" | "destructive" | "outline" | "success" | "warning"}
                  >
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell>
                  <p className="text-sm font-medium">{log.entityType}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate max-w-[120px]">
                    {log.entityId}
                  </p>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {log.newValue ? (
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded max-w-xs block truncate">
                      {JSON.stringify(log.newValue)}
                    </code>
                  ) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePage(page - 1)}
              disabled={page <= 1 || loading}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePage(page + 1)}
              disabled={page >= totalPages || loading}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
