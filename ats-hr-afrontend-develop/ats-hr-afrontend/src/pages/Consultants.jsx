// src/pages/Consultants.jsx
import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";

export default function Consultants() {
  const [consultants, setConsultants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    loadConsultants();
  }, []);

  async function loadConsultants() {
    try {
      setLoading(true);
      const res = await api.get("/v1/consultants");
      const data = res.data?.data ?? res.data ?? [];
      setConsultants(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setConsultants([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Consultants</h1>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name / email"
          className="border rounded px-3 py-1"
        />
      </div>

      <div className="bg-white border rounded shadow-sm overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Payroll Ready</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-6 text-center">
                  Loading...
                </td>
              </tr>
            ) : (
              consultants
                .filter((c) => {
                  if (!q) return true;
                  const s = q.toLowerCase();
                  return (
                    (c.full_name || "").toLowerCase().includes(s) ||
                    (c.email || "").toLowerCase().includes(s)
                  );
                })
                .map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-4 py-3">{c.full_name}</td>
                    <td className="px-4 py-3 capitalize">{c.type}</td>
                    <td className="px-4 py-3">
                      {c.status
                        ? c.status.charAt(0).toUpperCase() +
                          c.status.slice(1).toLowerCase()
                        : "—"}
                    </td>

                    <td className="px-4 py-3">
                      {c.payrollReady ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                      <button
                        onClick={() => navigate(`/consultants/${c.id}`)}
                        className="px-2 py-1 bg-blue-600 text-white rounded"
                      >
                        View
                      </button>

                      {c.type === "payroll" && (
                        <button
                          onClick={() =>
                            navigate(`/consultants/${c.id}/deploy`)
                          }
                          className="px-2 py-1 bg-green-600 text-white rounded"
                        >
                          Deploy
                        </button>
                      )}
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
