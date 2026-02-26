import React, { useEffect, useState } from "react";
import api from "../../api/axios";
import { formatStatus } from "../../utils/formatStatus";

export default function AMTimesheetHistory() {
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const res = await api.get("/v1/timesheets/am/history");
      setTimesheets(res.data?.timesheets || []);
    } catch (err) {
      alert("Failed to load history");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <p>Loading history...</p>;

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Timesheet History</h2>

      {timesheets.length === 0 ? (
        <p className="text-gray-500">No history found</p>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="w-full border-collapse">
            <thead className="bg-gray-100 text-sm">
              <tr>
                <th className="px-4 py-3 text-left">Consultant</th>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Hours</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>

            <tbody>
              {timesheets.map((t) => (
                <tr key={t.id} className="border-t hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium">
                    {t.consultant_name || "—"}
                  </td>

                  <td className="px-4 py-3">{t.client_name || "—"}</td>

                  <td className="px-4 py-3 text-center">
                    {formatDate(t.period_start)} – {formatDate(t.period_end)}
                  </td>

                  <td className="px-4 py-3 text-center font-semibold">
                    {t.total_hours}
                  </td>

                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- Helpers ---------------- */

const formatDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

function StatusBadge({ status }) {
  const map = {
    am_approved: "bg-blue-100 text-blue-700",
    client_approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold ${
        map[status] || "bg-gray-100 text-gray-600"
      }`}
    >
      {formatStatus(status) === "—" ? "Submitted" : formatStatus(status)}
    </span>
  );
}
