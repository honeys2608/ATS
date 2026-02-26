import React from "react";

function toCSV(rows = []) {
  if (!rows || rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [
    headers.join(","),
    ...rows.map(r => headers.map(h => escape(r[h])).join(","))
  ];
  return lines.join("\n");
}

export default function ExportCSVButton({ data = [], filename = "employees.csv", fields = null }) {
  const handleExport = (e) => {
    e.stopPropagation();
    if (!data || data.length === 0) {
      alert("No data to export");
      return;
    }
    const rows = data.map(item => {
      if (!fields) return item;
      const obj = {};
      fields.forEach(f => { obj[f] = item[f]; });
      return obj;
    });
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200 text-sm"
      title="Export visible employees to CSV"
    >
      Export CSV
    </button>
  );
}
