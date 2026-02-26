import React from "react";
import { Download, RefreshCw, Search } from "lucide-react";

export default function AuditHeader({ search, onSearchChange, onExport, onRefresh }) {
  return (
    <>
      <div className="rounded-2xl bg-gradient-to-r from-purple-700 via-indigo-600 to-emerald-500 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-extrabold">Audit Logs</h2>
            <p className="text-white/90">Super Admin Governance</p>
          </div>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">Production</span>
        </div>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="w-full md:max-w-xl">
            <div className="flex h-11 items-center rounded border bg-white px-3 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
              <Search size={16} className="shrink-0 text-slate-400" />
              <input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="ml-2 w-full border-0 bg-transparent p-0 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                placeholder="Search actor/email/entity/action/ip"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onExport} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm">
              <Download size={16} />
              Export
            </button>
            <button onClick={onRefresh} className="inline-flex items-center gap-2 rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
