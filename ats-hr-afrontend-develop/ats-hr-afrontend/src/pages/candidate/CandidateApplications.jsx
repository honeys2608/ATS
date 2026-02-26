// src/pages/CandidateApplications.jsx
import React, { useEffect, useState } from "react";
import axios from "../api/axios";

export default function CandidateApplications() {
  const [apps, setApps] = useState([]);

  useEffect(() => {
    let m = true;
    axios.get("/v1/candidate/me/applications").then(r => { if (m) setApps(r.data?.data || r.data || []); }).catch(console.error);
    return () => m = false;
  }, []);

  if (!apps.length) return <div className="p-6">No applications yet</div>;

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">My Applications</h2>
      <div className="space-y-3">
        {apps.map(a => (
          <div key={a.id} className="bg-white p-3 rounded shadow flex justify-between">
            <div>
              <div className="font-semibold">{a.job_title || a.job?.title}</div>
                <div className="text-sm text-gray-500">Applied on: {formatDate(a.applied_at)}</div>
            </div>
            <div><div className="text-sm">{a.status}</div></div>
          </div>
        ))}
      </div>
    </div>
  import { formatDate } from "../../utils/dateFormatter";
  );
}