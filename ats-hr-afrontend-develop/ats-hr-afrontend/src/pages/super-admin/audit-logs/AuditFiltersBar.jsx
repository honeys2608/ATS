import React from "react";
import { Filter } from "lucide-react";
import { label } from "./utils";

export default function AuditFiltersBar({
  draft,
  setDraft,
  options,
  groupBy,
  groupOptions,
  onGroupChange,
  onApply,
  onClear,
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Filter size={15} />
        Filters
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-4 xl:grid-cols-8">
        <input type="date" value={draft.date_from} onChange={(e) => setDraft((p) => ({ ...p, date_from: e.target.value }))} className="rounded border px-2 py-2 text-sm" />
        <input type="date" value={draft.date_to} onChange={(e) => setDraft((p) => ({ ...p, date_to: e.target.value }))} className="rounded border px-2 py-2 text-sm" />
        <select value={draft.role} onChange={(e) => setDraft((p) => ({ ...p, role: e.target.value }))} className="rounded border px-2 py-2 text-sm">
          <option value="">All Roles</option>
          {options.roles.map((v) => <option key={v} value={v}>{label(v)}</option>)}
        </select>
        <input list="audit-users" value={draft.user_id} onChange={(e) => setDraft((p) => ({ ...p, user_id: e.target.value }))} className="rounded border px-2 py-2 text-sm" placeholder="User" />
        <datalist id="audit-users">{options.users.map((v) => <option key={v} value={v} />)}</datalist>
        <select value={draft.module} onChange={(e) => setDraft((p) => ({ ...p, module: e.target.value }))} className="rounded border px-2 py-2 text-sm">
          <option value="">All Modules</option>
          {options.modules.map((v) => <option key={v} value={v}>{label(v)}</option>)}
        </select>
        <select value={draft.action_type} onChange={(e) => setDraft((p) => ({ ...p, action_type: e.target.value }))} className="rounded border px-2 py-2 text-sm">
          <option value="">All Actions</option>
          {options.actions.map((v) => <option key={v} value={v}>{label(v)}</option>)}
        </select>
        <select value={draft.severity} onChange={(e) => setDraft((p) => ({ ...p, severity: e.target.value }))} className="rounded border px-2 py-2 text-sm">
          <option value="">All Severity</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
        <select value={draft.status} onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value }))} className="rounded border px-2 py-2 text-sm">
          <option value="">All Status</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">Group By</span>
          <select value={groupBy} onChange={(e) => onGroupChange(e.target.value)} className="rounded border px-2 py-1.5 text-sm">
            {groupOptions.map((v) => <option key={v} value={v}>{label(v)}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={onClear} className="rounded border px-3 py-1.5 text-sm">Clear</button>
          <button onClick={onApply} className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white">Apply</button>
        </div>
      </div>
    </div>
  );
}
