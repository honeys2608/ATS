// src/components/consultants/DeploymentList.jsx
import React, { useMemo } from "react";

export default function DeploymentList({
  deployments = [],
  loading = false,
  onRowClick,
  showConsultant = false, // show consultant column when used globally
}) {
  // newest first
  const sorted = useMemo(() => {
    return [...deployments].sort(
      (a, b) => new Date(b.start_date) - new Date(a.start_date)
    );
  }, [deployments]);

  return (
    <div className="bg-white border rounded-lg overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="bg-gray-100">
          <tr>
            {showConsultant && (
              <th className="border px-4 py-2 text-left">
                Consultant
              </th>
            )}
            <th className="border px-4 py-2 text-left">Client</th>
            <th className="border px-4 py-2 text-left">Project</th>
            <th className="border px-4 py-2 text-left">Start Date</th>
            <th className="border px-4 py-2 text-left">End Date</th>
            <th className="border px-4 py-2 text-left">Status</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={showConsultant ? 6 : 5}
                className="p-6 text-center"
              >
                Loading deployments...
              </td>
            </tr>
          ) : sorted.length === 0 ? (
            <tr>
              <td
                colSpan={showConsultant ? 6 : 5}
                className="p-6 text-center"
              >
                No deployments found
              </td>
            </tr>
          ) : (
            sorted.map((d) => (
              <tr
                key={d.id}
                onClick={() => onRowClick?.(d)}
                className="hover:bg-gray-50 cursor-pointer"
              >
                {showConsultant && (
                  <td className="border px-4 py-2">
                    {d.consultant_name || d.consultant_id}
                  </td>
                )}
                <td className="border px-4 py-2">{d.client}</td>
                <td className="border px-4 py-2">
                  {d.project || "—"}
                </td>
                <td className="border px-4 py-2">
                  {d.start_date}
                </td>
                <td className="border px-4 py-2">
                  {d.end_date || "—"}
                </td>
                <td className="border px-4 py-2">
                  <StatusBadge status={d.status} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* STATUS BADGE */
function StatusBadge({ status }) {
  const map = {
    active: "bg-green-100 text-green-700",
    ended: "bg-gray-100 text-gray-600",
  };

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
        map[status] || "bg-gray-100 text-gray-600"
      }`}
    >
      {status}
    </span>
  );
}
