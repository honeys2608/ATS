import React, { useEffect, useState } from "react";
import { getClientTimesheets } from "../../services/timesheetService";

const statusStyle = {
  client_approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function ClientTimesheetHistory() {
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const res = await getClientTimesheets();

    const history = (res?.timesheets || []).filter(
      (t) => t.status !== "am_approved"
    );

    setTimesheets(history);
    setLoading(false);
  };

  if (loading) return <p className="text-gray-500">Loading history...</p>;

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div>
        <h2 className="text-xl font-semibold">Timesheet History</h2>
        <p className="text-sm text-gray-500">
          Approved and rejected timesheets
        </p>
      </div>

      {/* EMPTY STATE */}
      {timesheets.length === 0 && (
        <div className="bg-white border rounded-lg p-6 text-gray-500">
          No history available
        </div>
      )}

      {/* TABLE */}
      {timesheets.length > 0 && (
        <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3">Consultant</th>
                <th className="text-left px-4 py-3">Period</th>
                <th className="text-left px-4 py-3">Total Hours</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>

            <tbody>
              {timesheets.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{t.consultant_name}</td>

                  <td className="px-4 py-3 text-gray-600">
                    {t.period_start} → {t.period_end}
                  </td>

                  <td className="px-4 py-3">{t.total_hours}</td>

                  <td className="px-4 py-3">
                    <span
                      className={`px-3 py-1 text-xs rounded-full font-medium ${
                        statusStyle[t.status]
                      }`}
                    >
                      {t.status.replace("_", " ").toUpperCase()}
                    </span>
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
