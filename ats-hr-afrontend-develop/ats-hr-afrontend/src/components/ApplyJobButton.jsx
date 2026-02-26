// src/components/ApplyJobButton.jsx
import React, { useState } from "react";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";

export default function ApplyJobButton({ jobId, children }) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onApply = async () => {
    // If candidate not logged in, server will return 401 — but better UX is to redirect
    const token = localStorage.getItem("candidate_token") || localStorage.getItem("token");
    if (!token) {
      // redirect candidate to candidate login page with redirect back to job detail or candidate portal
      navigate(`/careers/login?redirect=/careers/job/${jobId}&action=apply`);
      return;
    }

    setLoading(true);
    try {
      // POST apply as candidate using canonical jobs submissions endpoint
      await api.post(`/v1/jobs/${jobId}/submissions`);
      alert("Application submitted successfully.");
      // Optionally navigate to candidate applications
      navigate("/candidate/applications");
    } catch (err) {
      console.error("apply error", err);
      const msg = err?.response?.data?.error?.message ?? err?.response?.data?.message ?? "Apply failed";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={onApply}
      disabled={loading}
      className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
    >
      {loading ? "Applying..." : (children ?? "Apply")}
    </button>
  );
}
