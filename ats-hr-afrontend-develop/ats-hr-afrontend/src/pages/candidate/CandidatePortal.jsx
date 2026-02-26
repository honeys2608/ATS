import React, { useMemo } from "react";
import CandidatePortalTimeline from "../../components/activity/CandidatePortalTimeline";

export default function CandidatePortal() {
  const candidateId = useMemo(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      return user?.id || null;
    } catch {
      return null;
    }
  }, []);

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold text-gray-800">My Applications</h2>
      <p className="mb-4 text-sm text-gray-600">
        Track updates for your applications and interview stages.
      </p>
      <CandidatePortalTimeline candidateId={candidateId} />
    </div>
  );
}
