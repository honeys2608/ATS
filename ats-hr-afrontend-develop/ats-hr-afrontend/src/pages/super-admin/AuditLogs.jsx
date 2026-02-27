import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AuditHeader from "./audit-logs/AuditHeader";
import AuditSummaryCards from "./audit-logs/AuditSummaryCards";
import AuditFiltersBar from "./audit-logs/AuditFiltersBar";
import AuditTable from "./audit-logs/AuditTable";
import UserActivityDrawer from "./audit-logs/UserActivityDrawer";
import ExportLogsModal from "./audit-logs/ExportLogsModal";
import AuditPagination from "./audit-logs/AuditPagination";
import { csvCell, label, normalizeAuditLog, text } from "./audit-logs/utils";
import {
  exportAuditLogs,
  listAuditLogs,
  logAuditExportEvent,
} from "../../services/auditLogService";

const EMPTY_FILTERS = {
  date_from: "",
  date_to: "",
  role: "",
  user_id: "",
  module: "",
  action_type: "",
  severity: "",
  status: "",
};

const GROUP_OPTIONS = ["none", "role", "user", "module", "action_type", "date", "severity"];
const PAGE_SIZES = [25, 50, 100];

function buildApiParams(page, limit, search, filters) {
  const params = { page, limit, search: text(search), ...filters };
  const from = text(filters?.date_from);
  const to = text(filters?.date_to);
  if (from) params.date_from = `${from}T00:00:00`;
  if (to) params.date_to = `${to}T23:59:59`;
  return params;
}

function parseApiError(err) {
  const detail = err?.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const field = Array.isArray(item?.loc) ? item.loc.join(".") : "";
        return field ? `${field}: ${item?.msg || "Invalid value"}` : item?.msg || "Invalid value";
      })
      .join("; ");
  }
  return text(detail || err?.message || "Failed to fetch audit logs");
}

function getFilename(res, fallback) {
  const header = text(res?.headers?.["content-disposition"]);
  const match = header.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
  return decodeURIComponent((match?.[1] || fallback).replace(/"/g, ""));
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function buildCsv(rows) {
  const columns = [
    "id",
    "log_id",
    "timestamp",
    "created_at",
    "actor_id",
    "actor_name",
    "actor_role",
    "actor_email",
    "action_type",
    "action_label",
    "module",
    "entity_type",
    "entity_id",
    "entity_name",
    "ip_address",
    "device",
    "browser",
    "os",
    "location",
    "endpoint",
    "http_method",
    "response_code",
    "status",
    "severity",
    "failure_reason",
    "old_value",
    "new_value",
  ];
  const header = columns.join(",");
  const lines = rows.map((row) =>
    columns
      .map((key) => {
        const value =
          key === "old_value" || key === "new_value" ? row[key] ?? null : row[key];
        return csvCell(value);
      })
      .join(","),
  );
  return [header, ...lines].join("\n");
}

export default function AuditLogs() {
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [groupBy, setGroupBy] = useState("none");
  const [expandedRow, setExpandedRow] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [selectedUser, setSelectedUser] = useState(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [refreshTick, setRefreshTick] = useState(0);
  const [sortBy, setSortBy] = useState("time");
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    const userId = text(searchParams.get("user_id"));
    if (userId) {
      setDraft((prev) => ({ ...prev, user_id: userId }));
      setFilters((prev) => ({ ...prev, user_id: userId }));
      setPage(1);
    }
  }, [searchParams]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = buildApiParams(page, limit, search, filters);
      Object.keys(params).forEach((key) => {
        if (params[key] === "") delete params[key];
      });
      const payload = await listAuditLogs(params);
      const normalized = (payload?.items || []).map((item, idx) =>
        normalizeAuditLog(item, idx),
      );
      setRows(normalized);
      setTotalCount(Number(payload?.total ?? normalized.length));
    } catch (err) {
      setRows([]);
      setTotalCount(0);
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [filters, limit, page, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs, refreshTick]);

  const options = useMemo(() => {
    const uniq = (arr) => Array.from(new Set(arr.map(text).filter(Boolean))).sort();
    return {
      roles: uniq(rows.map((r) => r.actor_role)),
      users: uniq(rows.map((r) => r.actor_id || r.actor_email || r.actor_name)),
      modules: uniq(rows.map((r) => r.module)),
      actions: uniq(rows.map((r) => r.action_type)),
    };
  }, [rows]);

  const sortedRows = useMemo(() => {
    const items = [...rows];
    items.sort((a, b) => {
      if (sortBy === "user") {
        const av = text(a.actor_name).toLowerCase();
        const bv = text(b.actor_name).toLowerCase();
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      }
      const at = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bt = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return sortDir === "asc" ? at - bt : bt - at;
    });
    return items;
  }, [rows, sortBy, sortDir]);

  const groupedRows = useMemo(() => {
    if (groupBy === "none") return [];
    const byKey = sortedRows.reduce((acc, row) => {
      let key = "Unknown";
      if (groupBy === "role") key = label(row.actor_role || "unknown");
      if (groupBy === "user") key = row.actor_name || row.actor_email || "Unknown";
      if (groupBy === "module") key = label(row.module || "unknown");
      if (groupBy === "action_type") key = label(row.action_type || "unknown");
      if (groupBy === "severity") key = label(row.severity || "unknown");
      if (groupBy === "date") key = row.timestamp ? new Date(row.timestamp).toLocaleDateString() : "Unknown";
      if (!acc.has(key)) acc.set(key, []);
      acc.get(key).push(row);
      return acc;
    }, new Map());
    return Array.from(byKey.entries());
  }, [groupBy, sortedRows]);

  const summary = useMemo(() => {
    const critical = sortedRows.filter((r) => r.severity === "critical").length;
    const failedLogin = sortedRows.filter(
      (r) =>
        r.status === "failed" &&
        (r.action_type.includes("login") || r.action_label.toLowerCase().includes("login")),
    ).length;
    const exportsCount = sortedRows.filter((r) => r.action_type.includes("export")).length;
    const today = new Date().toDateString();
    const activeUsers = new Set(
      sortedRows
        .filter((r) => (r.timestamp ? new Date(r.timestamp).toDateString() === today : false))
        .map((r) => r.actor_id || r.actor_email || r.actor_name),
    ).size;
    return {
      total: totalCount,
      critical,
      failedLogin,
      activeUsers,
      exports: exportsCount,
    };
  }, [sortedRows, totalCount]);

  const allVisibleSelected = useMemo(
    () => sortedRows.length > 0 && sortedRows.every((row) => selected.has(row.id)),
    [selected, sortedRows],
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const toggleExpand = (id) => {
    setExpandedRow((prev) => (prev === id ? null : id));
  };

  const toggleSelect = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleExport = async (scope, format) => {
    const isServerAll = scope === "all";
    try {
      if (isServerAll) {
        const params = { ...buildApiParams(page, limit, search, filters), format, scope: "all" };
        Object.keys(params).forEach((key) => {
          if (params[key] === "") delete params[key];
        });
        const res = await exportAuditLogs(params);
        const file = getFilename(
          res,
          `audit-logs-all-${new Date().toISOString().slice(0, 10)}.${format === "xlsx" ? "xlsx" : "csv"}`,
        );
        downloadBlob(res.data, file);
      } else {
        const targetRows =
          scope === "selected" ? sortedRows.filter((r) => selected.has(r.id)) : sortedRows;
        const csv = buildCsv(targetRows);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const file = `audit-logs-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
        downloadBlob(blob, file);
      }
      await logAuditExportEvent({
        action_label: "Audit Logs Exported",
        status: "success",
        severity: "warning",
        module: "audit_logs",
        entity_type: "audit_log_export",
        new_value: {
          scope,
          format,
          filters,
          search: text(search),
          page,
          limit,
          selected_count: selected.size,
        },
      });
      setIsExportOpen(false);
    } catch (err) {
      setError(parseApiError(err));
      await logAuditExportEvent({
        action_label: "Audit Logs Export Failed",
        status: "failed",
        severity: "critical",
        module: "audit_logs",
        entity_type: "audit_log_export",
        new_value: {
          scope,
          format,
          error: text(err?.response?.data?.detail || err?.message || "unknown_error"),
        },
      });
    }
  };

  const applyFilters = () => {
    setFilters(draft);
    setPage(1);
  };

  const clearFilters = () => {
    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setSearch("");
    setPage(1);
  };

  const handleSummaryClick = (key) => {
    if (key === "critical") {
      setDraft((prev) => ({ ...prev, severity: "critical" }));
      setFilters((prev) => ({ ...prev, severity: "critical" }));
      setPage(1);
      return;
    }
    if (key === "failed_login") {
      setDraft((prev) => ({ ...prev, status: "failed" }));
      setFilters((prev) => ({ ...prev, status: "failed" }));
      setPage(1);
      return;
    }
    if (key === "exports") {
      setDraft((prev) => ({ ...prev, action_type: "data_export" }));
      setFilters((prev) => ({ ...prev, action_type: "data_export" }));
      setPage(1);
      return;
    }
    clearFilters();
  };

  return (
    <div className="space-y-6">
      <AuditHeader
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        onExport={() => setIsExportOpen(true)}
        onRefresh={() => setRefreshTick((v) => v + 1)}
      />

      <AuditSummaryCards summary={summary} onCardClick={handleSummaryClick} />

      <AuditFiltersBar
        draft={draft}
        setDraft={setDraft}
        options={options}
        groupBy={groupBy}
        groupOptions={GROUP_OPTIONS}
        onGroupChange={setGroupBy}
        onApply={applyFilters}
        onClear={clearFilters}
      />

      <AuditTable
        loading={loading}
        error={error}
        rows={sortedRows}
        groups={groupedRows}
        groupBy={groupBy}
        expandedRow={expandedRow}
        selected={selected}
        sortBy={sortBy}
        sortDir={sortDir}
        allVisibleSelected={allVisibleSelected}
        onToggleSelectAll={() =>
          setSelected((prev) => {
            const next = new Set(prev);
            if (allVisibleSelected) {
              sortedRows.forEach((row) => next.delete(row.id));
            } else {
              sortedRows.forEach((row) => next.add(row.id));
            }
            return next;
          })
        }
        onSort={(key) => {
          if (sortBy === key) {
            setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
            return;
          }
          setSortBy(key);
          setSortDir(key === "user" ? "asc" : "desc");
        }}
        onToggleExpand={toggleExpand}
        onToggleSelect={toggleSelect}
        onOpenUser={setSelectedUser}
        onSeverityClick={(severity) => {
          setDraft((prev) => ({ ...prev, severity }));
          setFilters((prev) => ({ ...prev, severity }));
          setPage(1);
        }}
      />

      <AuditPagination
        page={page}
        totalPages={totalPages}
        limit={limit}
        pageSizes={PAGE_SIZES}
        totalCount={totalCount}
        onPageChange={setPage}
        onLimitChange={(size) => {
          setLimit(size);
          setPage(1);
        }}
      />

      <UserActivityDrawer
        user={selectedUser}
        logs={sortedRows}
        onClose={() => setSelectedUser(null)}
        onViewFull={(user) => {
          const userKey = user?.actor_id || user?.actor_email || user?.actor_name || "";
          setDraft((prev) => ({ ...prev, user_id: userKey }));
          setFilters((prev) => ({ ...prev, user_id: userKey }));
          setSelectedUser(null);
          setPage(1);
        }}
      />

      <ExportLogsModal
        open={isExportOpen}
        counts={{ current: sortedRows.length, all: totalCount, selected: selected.size }}
        onClose={() => setIsExportOpen(false)}
        onExport={handleExport}
      />
    </div>
  );
}
