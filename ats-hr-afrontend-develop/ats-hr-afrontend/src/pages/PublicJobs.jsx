// src/pages/PublicJobs.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../api/axios";

export default function PublicJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    axios.get("/v1/jobs").then(r => {
      if (!mounted) return;
     const allJobs = r.data?.data || r.data || [];
setJobs(allJobs.filter(j => j.status === "active"));

    }).catch(console.error).finally(()=>mounted && setLoading(false));
    return () => (mounted = false);
  }, []);

  if (loading) return <div className="p-6">Loading jobs...</div>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-2">Open Positions</h1>
      <div className="space-y-4">
       {jobs.map((job) => {
  const isExpired =
    job.apply_by && new Date(job.apply_by) < new Date();

  return (
    <div
      key={job.id}
      className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition p-8"
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            {job.title}
          </h3>

          <div className="flex flex-wrap items-center gap-4 text-gray-600 mb-4">
            <span className="font-semibold">{job.department}</span>
            <span>{job.location}</span>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              {job.job_type}
            </span>
          </div>

          <p className="text-gray-700 mb-4 line-clamp-3">
            {job.description}
          </p>

          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
            <span>
              Posted on:{" "}
              <strong>{formatDate(job.created_at)}</strong>
            </span>

            <span>
              Apply by:{" "}
              <strong className="text-red-600">
                {formatDate(job.apply_by)}
              </strong>
            </span>
          </div>
        </div>

        <div className="flex-shrink-0">
          <button
            disabled={isExpired}
            onClick={() => handleApply(job)}
            className={`px-6 py-3 rounded-lg font-semibold transition whitespace-nowrap
              ${
                isExpired
                  ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
          >
            {isExpired ? "Applications Closed" : "Apply Now"}
          </button>
        </div>
      </div>
    </div>
  );
})}

      </div>
    </div>
  );
}
