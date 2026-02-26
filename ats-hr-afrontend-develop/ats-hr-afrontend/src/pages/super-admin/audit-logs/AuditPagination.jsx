import React from "react";

export default function AuditPagination({
  page,
  totalPages,
  limit,
  pageSizes,
  totalCount,
  onPageChange,
  onLimitChange,
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-white p-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2 text-sm">
        <span>Page Size</span>
        <select value={limit} onChange={(e) => onLimitChange(Number(e.target.value))} className="rounded border px-2 py-1">
          {pageSizes.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span>Total: {totalCount}</span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} className="rounded border px-3 py-1 text-sm disabled:opacity-40">Prev</button>
        <span className="text-sm">Page {page} / {totalPages}</span>
        <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="rounded border px-3 py-1 text-sm disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}
