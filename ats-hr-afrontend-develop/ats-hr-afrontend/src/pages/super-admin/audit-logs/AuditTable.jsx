import React from "react";
import { ChevronRight, ArrowUpDown } from "lucide-react";
import { chipClass, exact, label, rel } from "./utils";
import AuditChangeDiff from "../../../components/audit/AuditChangeDiff";

function SortButton({ active, direction, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-left font-semibold text-slate-700 hover:text-slate-900"
      type="button"
    >
      {children}
      <ArrowUpDown size={13} className={active ? "text-indigo-600" : "text-slate-400"} />
      {active && <span className="text-xs text-indigo-600">{direction === "asc" ? "ASC" : "DESC"}</span>}
    </button>
  );
}

function Row({
  row,
  expandedRow,
  selected,
  onToggleExpand,
  onToggleSelect,
  onOpenUser,
  onSeverityClick,
}) {
  const isOpen = expandedRow === row.id;

  return (
    <React.Fragment key={row.id}>
      <tr className={`border-b transition hover:bg-gray-50 ${row.severity === "critical" ? "bg-purple-50/30" : ""}`}>
        <td className="px-4 py-3 align-top">
          <input type="checkbox" checked={selected.has(row.id)} onChange={() => onToggleSelect(row.id)} />
        </td>
        <td className="px-4 py-3 align-top" title={exact(row.timestamp)}>
          {rel(row.timestamp)}
        </td>
        <td className="px-4 py-3 align-top">
          <button className="text-left font-medium hover:underline" onClick={() => onOpenUser(row)}>
            {row.actor_name}
          </button>
          <div className="mt-1 text-xs text-slate-500">{label(row.actor_role)}</div>
        </td>
        <td className="px-4 py-3 align-top">
          <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{label(row.module)}</span>
        </td>
        <td className="px-4 py-3 align-top">
          <span className={`rounded px-2 py-1 text-xs font-medium ${chipClass.status(row.status)}`}>{label(row.status)}</span>
        </td>
        <td className="px-4 py-3 align-top">
          <button
            onClick={() => onSeverityClick(row.severity)}
            className={`rounded px-2 py-1 text-xs font-medium ${chipClass.severity(row.severity)}`}
            type="button"
            title={`Filter by ${label(row.severity)}`}
          >
            {label(row.severity)}
          </button>
        </td>
        <td className="px-4 py-3 align-top">
          <button
            onClick={() => onToggleExpand(row.id)}
            className="cursor-pointer rounded-md p-2 transition hover:bg-gray-200"
            type="button"
            title={isOpen ? "Collapse details" : "Expand details"}
          >
            <ChevronRight className={`transition-transform ${isOpen ? "rotate-90" : ""}`} size={16} />
          </button>
        </td>
      </tr>
      <tr>
        <td colSpan="7" className="p-0">
          <div
            className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-96" : "max-h-0"}`}
          >
            <div className="bg-gray-50 px-6 py-4 text-sm text-slate-700">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <p><span className="font-semibold">IP Address:</span> {row.ip_address || "--"}</p>
                <p><span className="font-semibold">Device:</span> {row.device || "--"}</p>
                <p><span className="font-semibold">Browser:</span> {row.browser || "--"}</p>
                <p><span className="font-semibold">OS:</span> {row.os || "--"}</p>
                <p><span className="font-semibold">Location:</span> {row.location || "--"}</p>
                <p>
                  <span className="font-semibold">Endpoint:</span>{" "}
                  {row.endpoint || "--"}{" "}
                  {row.http_method ? `(${row.http_method})` : ""}{" "}
                  {row.response_code ? `- ${row.response_code}` : ""}
                </p>
                <p><span className="font-semibold">Failure Reason:</span> {row.failure_reason || "--"}</p>
                <p><span className="font-semibold">Created At:</span> {exact(row.created_at || row.timestamp)}</p>
              </div>
              <AuditChangeDiff oldValue={row.old_value} newValue={row.new_value} actionType={row.action_type} />
            </div>
          </div>
        </td>
      </tr>
    </React.Fragment>
  );
}

export default function AuditTable({
  loading,
  error,
  rows,
  groups,
  groupBy,
  expandedRow,
  selected,
  sortBy,
  sortDir,
  allVisibleSelected,
  onToggleSelectAll,
  onSort,
  onToggleExpand,
  onToggleSelect,
  onOpenUser,
  onSeverityClick,
}) {
  const Header = (
    <thead className="sticky top-0 z-10 bg-gray-100 text-left text-sm font-semibold">
      <tr>
        <th className="px-4 py-3">
          <input type="checkbox" checked={allVisibleSelected} onChange={onToggleSelectAll} />
        </th>
        <th className="px-4 py-3">
          <SortButton active={sortBy === "time"} direction={sortDir} onClick={() => onSort("time")}>
            Time
          </SortButton>
        </th>
        <th className="px-4 py-3">
          <SortButton active={sortBy === "user"} direction={sortDir} onClick={() => onSort("user")}>
            User
          </SortButton>
        </th>
        <th className="px-4 py-3">Module</th>
        <th className="px-4 py-3">Status</th>
        <th className="px-4 py-3">Severity</th>
        <th className="px-4 py-3">Actions</th>
      </tr>
    </thead>
  );

  return (
    <div className="rounded-xl border bg-white">
      {error && <div className="border-b bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="p-8 text-center text-slate-600">Loading audit logs...</div>
      ) : groupBy === "none" ? (
        <div className="overflow-auto">
          <table className="w-full border-collapse">
            {Header}
            <tbody>
              {rows.map((row) => (
                <Row
                  key={row.id}
                  row={row}
                  expandedRow={expandedRow}
                  selected={selected}
                  onToggleExpand={onToggleExpand}
                  onToggleSelect={onToggleSelect}
                  onOpenUser={onOpenUser}
                  onSeverityClick={onSeverityClick}
                />
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>No logs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="divide-y">
          {groups.map(([key, items]) => (
            <div key={key}>
              <div className="bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800">{key} ({items.length})</div>
              <div className="overflow-auto">
                <table className="w-full border-collapse">
                  {Header}
                  <tbody>
                    {items.map((row) => (
                      <Row
                        key={row.id}
                        row={row}
                        expandedRow={expandedRow}
                        selected={selected}
                        onToggleExpand={onToggleExpand}
                        onToggleSelect={onToggleSelect}
                        onOpenUser={onOpenUser}
                        onSeverityClick={onSeverityClick}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {groups.length === 0 && <div className="p-8 text-center text-slate-500">No logs found.</div>}
        </div>
      )}
    </div>
  );
}
