import React from "react";
import { FileText } from "lucide-react";
import * as XLSX from "xlsx";

export default function ExportExcelButton({ rows, columns }) {
  const handleExport = () => {
    const wsData = [
      columns,
      ...rows.map((row) => columns.map((col) => row[col] ?? "")),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tracker Data");
    const date = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `Recruitment_Tracker_${date}.xlsx`);
  };

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm font-semibold"
    >
      <FileText size={16} />
      Export to Excel
    </button>
  );
}
