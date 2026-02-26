import React, { useEffect, useState } from "react";
import axios from "../../api/axios";

/**
 * AppliedJobs.jsx
 * ----------------
 * API:
 *  GET /v1/candidate/me/applications
 */

export default function AppliedJobs() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ----------------------------------------
     Load applied jobs
  ---------------------------------------- */
  const loadApps = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get("/v1/candidate/me/applications");

      const items = res.data?.applications ?? res.data?.data ?? res.data ?? [];

      setApps(items);
    } catch (err) {
      console.error("loadApps", err);
      setError("Failed to load your applications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApps();
  }, []);

  /* ----------------------------------------
     UI states
  ---------------------------------------- */
  if (loading) return <div className="p-4">Loading your applications...</div>;

  if (error) return <div className="p-4 text-red-600">{error}</div>;

  if (!apps.length)
    return (
      <div className="p-4 text-gray-600">
        You haven’t applied to any jobs yet.
      </div>
    );

  /* ----------------------------------------
     Helpers
  ---------------------------------------- */
  const statusColor = (status) => {
    switch (String(status).toLowerCase()) {
      case "submitted":
        return "bg-blue-100 text-blue-700";
      case "reviewing":
        return "bg-yellow-100 text-yellow-700";
      case "shortlisted":
        return "bg-purple-100 text-purple-700";
      case "interview":
        return "bg-indigo-100 text-indigo-700";
      case "selected":
        return "bg-green-100 text-green-700";
      case "rejected":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  /* ----------------------------------------
     Render
  ---------------------------------------- */
  return (
    <div className="p-4 space-y-3">
      {apps.map((a) => {
        const id = a.application_id ?? a.id;
        const title =
          a.job_title ?? a.job?.title ?? a.job_title_display ?? "Job";

        const location = a.job_location ?? a.job?.location ?? a.location ?? "";

        const appliedAt = a.created_at ?? a.applied_at ?? Date.now();

        const status = a.status ?? a.application_status ?? "submitted";

        return (
          <div
            key={id}
            className="bg-white p-4 rounded shadow flex justify-between items-center"
          >
            {/* Job Info */}
            <div>
              <div className="font-semibold text-base">{title}</div>
              <div className="text-sm text-gray-600">{location}</div>
              <div className="text-xs text-gray-500 mt-1">
                Applied on {new Date(appliedAt).toLocaleString()}
              </div>
            </div>

            {/* Status */}
            <div className="text-right">
              <div
                className={`px-3 py-1 rounded text-sm font-medium ${statusColor(
                  status
                )}`}
              >
                {String(status)}
              </div>

              {a.notes && (
                <div className="text-xs text-gray-500 mt-1">{a.notes}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}