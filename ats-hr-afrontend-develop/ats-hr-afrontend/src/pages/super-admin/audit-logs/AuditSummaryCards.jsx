import React from "react";

export default function AuditSummaryCards({ summary, onCardClick }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
      <button onClick={() => onCardClick("total")} className="rounded-xl border bg-white p-4 text-left">
        <p className="text-xs uppercase text-slate-500">Total</p>
        <p className="text-2xl font-extrabold">{summary.total}</p>
      </button>
      <button onClick={() => onCardClick("critical")} className="rounded-xl border border-red-200 bg-red-50 p-4 text-left">
        <p className="text-xs uppercase text-red-700">Critical</p>
        <p className="text-2xl font-extrabold text-red-700">{summary.critical}</p>
      </button>
      <button onClick={() => onCardClick("failed_login")} className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-left">
        <p className="text-xs uppercase text-amber-700">Failed Login</p>
        <p className="text-2xl font-extrabold text-amber-700">{summary.failedLogin}</p>
      </button>
      <button onClick={() => onCardClick("active_users")} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left">
        <p className="text-xs uppercase text-emerald-700">Active Users Today</p>
        <p className="text-2xl font-extrabold text-emerald-700">{summary.activeUsers}</p>
      </button>
      <button onClick={() => onCardClick("exports")} className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-left">
        <p className="text-xs uppercase text-blue-700">Exports</p>
        <p className="text-2xl font-extrabold text-blue-700">{summary.exports}</p>
      </button>
    </div>
  );
}
