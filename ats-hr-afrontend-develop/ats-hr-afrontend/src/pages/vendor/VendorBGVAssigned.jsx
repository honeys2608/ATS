import React, { useEffect, useState } from "react";
import api from "../../api/axios";

export default function VendorBGVAssigned() {
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState([]);

  useEffect(() => {
    fetchAssigned();
  }, []);

  async function fetchAssigned() {
    try {
      const res = await api.get("/v1/vendor/bgv/assigned");
      setCandidates(res?.data?.items || []);
    } catch (err) {
      console.error("Failed to load assigned candidates", err);
      alert("Failed to load assigned candidates");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Assigned BGV Candidates</h1>

      {loading ? (
        <p>Loading...</p>
      ) : candidates.length === 0 ? (
        <div className="p-6 bg-yellow-50 border rounded">
          No candidates assigned for BGV yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {candidates.map((c) => (
            <div key={c.id} className="p-4 border rounded shadow bg-white">
              <h2 className="text-lg font-semibold">{c.full_name}</h2>
              <p className="text-sm text-gray-600">{c.email}</p>

              <p className="mt-2">
                <strong>Status:</strong>{" "}
                <span className="px-2 py-1 rounded bg-gray-100">
                  {c.bgv_status || "new"}
                </span>
              </p>

              <p className="text-sm text-gray-500 mt-1">
                Assigned: {c.bgv_assigned_at || "-"}
              </p>

              <div className="mt-3">
                {c.bgv_report_url ? (
                  <a
                    href={c.bgv_report_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 bg-green-600 text-white rounded"
                  >
                    View Report
                  </a>
                ) : (
                  <button
                    onClick={() =>
                      (window.location.href = `/vendor/bgv-submit/${c.id}`)
                    }
                    className="px-3 py-2 bg-blue-600 text-white rounded"
                  >
                    Submit Report
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
