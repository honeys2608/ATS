// src/pages/ConsultantDeployments.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listDeployments } from "../services/consultantDeploymentService";

export default function ConsultantDeployments() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const consultantId = searchParams.get("consultant_id");

  useEffect(() => {
    loadDeployments();
    // eslint-disable-next-line
  }, [status, fromDate, toDate, consultantId]);

  async function loadDeployments() {
    setLoading(true);
    try {
      const params = {
        consultant_id: consultantId || undefined,
        status: status || undefined,
        start_date_from: fromDate || undefined,
        start_date_to: toDate || undefined,
      };

      const res = await listDeployments(params);
      const data = res.data?.data ?? res.data ?? [];

      // newest first
      data.sort(
        (a, b) => new Date(b.start_date) - new Date(a.start_date)
      );

      setDeployments(data);
    } catch (err) {
      console.error(err);
      setDeployments([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-7xl space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Consultant Deployments</h1>
          <p className="text-sm text-gray-500">
            Track active and past consultant assignments
          </p>
        </div>

        <button
          onClick={() => navigate(-1)}
          className="px-3 py-1 border rounded text-sm"
        >
          Back
        </button>
      </div>

      {/* FILTERS */}
      <div className="bg-white border rounded-lg p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="ended">Ended</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">
            From Date
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">
            To Date
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>

        <button
          onClick={loadDeployments}
          className="px-3 py-1 bg-indigo-600 text-white rounded text-sm"
        >
          Apply Filters
        </button>
      </div>

      {/* TABLE */}
      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-4 py-2 text-left">Consultant</th>
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
                <td colSpan={6} className="p-6 text-center">
                  Loading deployments...
                </td>
              </tr>
            ) : deployments.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center">
                  No deployments found
                </td>
              </tr>
            ) : (
              deployments.map((d) => (
                <tr
                  key={d.id}
                  onClick={() =>
                    navigate(`/consultant-deployments/${d.id}`)
                  }
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="border px-4 py-2">
                    {d.consultant_name || d.consultant_id}
                  </td>
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
                  <td className="border px-4 py-2 capitalize">
                    <StatusBadge status={d.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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
      className={`px-2 py-1 rounded-full text-xs font-medium ${
        map[status] || "bg-gray-100 text-gray-600"
      }`}
    >
      {status}
    </span>
  );
}
