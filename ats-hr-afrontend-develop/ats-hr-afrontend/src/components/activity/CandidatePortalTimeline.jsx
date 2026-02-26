import React, { useEffect, useMemo, useState } from "react";
import activityService from "../../services/activityService";
import ActivityFeed from "./ActivityFeed";

export default function CandidatePortalTimeline({ candidateId }) {
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
        const res = await activityService.getCandidatePortalActivity(candidateId);
        if (!mounted) return;
        setItems(res?.items || []);
      } catch (err) {
        if (!mounted) return;
        setError(err?.response?.data?.detail || "Unable to load application updates");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [candidateId]);

  const grouped = useMemo(() => {
    return (items || []).reduce((acc, item) => {
      const key = item?.metadata?.job_title || item?.job_id || "General";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [items]);

  return (
    <div>
      {error ? <div className="mb-3 text-sm text-red-600">{error}</div> : null}
      {Object.keys(grouped).length === 0 ? (
        <ActivityFeed items={[]} loading={loading} emptyText="No application updates yet." />
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([group, list]) => (
            <div key={group} className="rounded-lg border border-gray-200 p-3">
              <h3 className="mb-2 text-sm font-semibold text-gray-800">{group}</h3>
              <ActivityFeed items={list} loading={loading} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
