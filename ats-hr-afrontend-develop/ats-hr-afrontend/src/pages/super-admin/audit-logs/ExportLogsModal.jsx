import React, { useState } from "react";
import { X } from "lucide-react";

export default function ExportLogsModal({ open, counts, onClose, onExport }) {
  const [scope, setScope] = useState("current");
  const [format, setFormat] = useState("csv");

  if (!open) return null;
  const count = scope === "selected" ? counts.selected : scope === "all" ? counts.all : counts.current;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Export Logs</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <p className="text-sm text-slate-600">Records: {count}</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button onClick={() => setScope("current")} className={`rounded border px-2 py-2 text-sm ${scope === "current" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : ""}`}>Current</button>
          <button onClick={() => setScope("all")} className={`rounded border px-2 py-2 text-sm ${scope === "all" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : ""}`}>All</button>
          <button onClick={() => setScope("selected")} className={`rounded border px-2 py-2 text-sm ${scope === "selected" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : ""}`}>Selected</button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => setFormat("csv")} className={`rounded border px-2 py-2 text-sm ${format === "csv" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : ""}`}>CSV</button>
          <button onClick={() => setFormat("xlsx")} className={`rounded border px-2 py-2 text-sm ${format === "xlsx" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : ""}`}>Excel</button>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border px-3 py-2 text-sm">Cancel</button>
          <button onClick={() => onExport(scope, format)} className="rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">Export</button>
        </div>
      </div>
    </div>
  );
}
