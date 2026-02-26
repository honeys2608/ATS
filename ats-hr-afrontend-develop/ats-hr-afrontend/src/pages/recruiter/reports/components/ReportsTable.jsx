import React from "react";
export default function ReportsTable({
  columns,
  data,
  loading,
  pagination,
  sortable,
  filterable,
  exportExcel,
}) {
  // Basic table with loading, export, and pagination
  if (loading)
    return <div className="p-8 text-center text-gray-400">Loading...</div>;
  if (!data || data.length === 0)
    return (
      <div className="p-8 text-center text-gray-400">No data available.</div>
    );

  return (
    <div className="bg-white rounded shadow p-4">
      {exportExcel && (
        <button className="mb-2 bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700 transition">
          Export to Excel
        </button>
      )}
      <table className="min-w-full text-xs">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="px-2 py-2 border-b font-semibold text-gray-700 whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx}>
              {columns.map((col) => (
                <td key={col} className="px-2 py-2 border-b whitespace-nowrap">
                  {row[col.toLowerCase().replace(/ /g, "_")] || row[col] || ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {/* Pagination, sorting, filtering can be added here */}
    </div>
  );
}
