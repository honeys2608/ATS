import React, { useEffect, useState } from "react";
import activityService from "../../services/activityService";
import ActivityFeed from "./ActivityFeed";

export default function CandidateTimeline({ candidateId, title = "Candidate Timeline" }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!candidateId) return;
    let mounted = true;

    const run = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await activityService.getCandidateActivity(candidateId);
        if (!mounted) return;
        setItems(res?.items || []);
      } catch (err) {
        if (!mounted) return;
        setError(err?.response?.data?.detail || "Failed to load timeline");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [candidateId]);

  return (
    <div>
      <h3 className="mb-3 text-base font-semibold text-gray-800">{title}</h3>
      {error ? <div className="mb-3 text-sm text-red-600">{error}</div> : null}
      <ActivityFeed items={items} loading={loading} emptyText="No timeline events." />
    </div>
  );
}
