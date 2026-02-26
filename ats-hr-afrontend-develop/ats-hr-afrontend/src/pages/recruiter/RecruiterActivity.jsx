import React, { useEffect, useState } from "react";
import ActivityFeed from "../../components/activity/ActivityFeed";
import ActivityFilters from "../../components/activity/ActivityFilters";
import activityService from "../../services/activityService";

export default function RecruiterActivity() {
  const [filters, setFilters] = useState({
    period: "week",
    action: "",
    search: "",
  });
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await activityService.getFeed({
          action: filters.action || undefined,
          search: filters.search || undefined,
          limit: 100,
        });
        if (!mounted) return;
        setItems(res?.items || []);
      } catch (err) {
        if (!mounted) return;
        setError(err?.response?.data?.detail || "Failed to load recruiter activity");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [filters]);

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold text-gray-800">My Activity</h2>
      <ActivityFilters
        value={filters}
        onChange={setFilters}
        showResourceFilter={false}
      />
      {error ? <div className="mb-3 text-sm text-red-600">{error}</div> : null}
      <ActivityFeed items={items} loading={loading} />
    </div>
  );
}
