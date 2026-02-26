// src/components/candidates/ResumeVersionActions.jsx
import React, { useState } from "react";
import candidateService from "../../services/candidateService";

export default function ResumeVersionActions({
  candidateId,
  versionId,
  onRestored,
}) {
  const [loading, setLoading] = useState(false);

  const handleRestore = async () => {
    if (!window.confirm("Restore this resume version?")) return;

    setLoading(true);
    try {
      await candidateService.restoreResumeVersion(
        candidateId,
        versionId
      );
      alert("Resume restored successfully");
      onRestored && onRestored();
    } catch (err) {
      console.error(err);
      alert("Failed to restore resume version");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleRestore}
      disabled={loading}
      className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
    >
      {loading ? "Restoring..." : "Restore"}
    </button>
  );
}
