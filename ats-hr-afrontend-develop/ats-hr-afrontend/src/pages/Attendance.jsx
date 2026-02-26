import React, { useEffect, useState } from "react";
import { formatDate } from "../utils/dateFormatter";
import api from "../api/axios";

export default function Attendance() {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/v1/attendance/me");
      setHistory(res.data?.data ?? res.data ?? []);
    } catch (err) {
      // Endpoint may not exist yet; that's fine
      setError("Attendance API not available");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const mark = async () => {
    try {
      await api.post("/v1/attendance/mark");
      await load();
      alert("Attendance marked (if backend supports it)");
    } catch (err) {
      alert("Failed to mark attendance: endpoint may not be implemented");
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Attendance</h1>
        <p className="text-gray-600">
          Mark daily attendance and view your recent history.
        </p>
      </div>

      <div className="mb-4">
        <button
          onClick={mark}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Mark Attendance
        </button>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : (
        <div className="space-y-2">
          {history.length ? (
            history.map((h) => (
              <div key={h.id ?? h.timestamp} className="p-2 border rounded">
                <div>{formatDate(h.timestamp || h.created_at)}</div>
                <div className="text-sm text-gray-600">
                  {h.status ?? h.type ?? "present"}
                </div>
              </div>
            ))
          ) : (
            <div className="text-gray-600">No attendance records yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
