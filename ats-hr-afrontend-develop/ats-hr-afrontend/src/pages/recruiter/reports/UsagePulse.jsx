import React from "react";
import FilterBar from "./components/FilterBar";
import KPIGrid from "./components/KPIGrid";
import LineChart from "./components/LineChart";
import LoadingSkeleton from "./components/LoadingSkeleton";
import EmptyState from "./components/EmptyState";
import ErrorState from "./components/ErrorState";

export default function UsagePulse() {
  // Placeholder for state, loading, error, data
  // Replace with real API integration
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [data, setData] = React.useState(null);

  React.useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setData({
        cvs_viewed: 1200,
        cvs_downloaded: 300,
        searches: 500,
        invites: 200,
        total_actions: 2200,
        timeline_data: [
          { date: "2026-01-01", count: 100 },
          { date: "2026-01-02", count: 120 },
          { date: "2026-01-03", count: 90 },
          { date: "2026-01-04", count: 150 },
        ],
      });
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} />;
  if (!data) return <EmptyState />;

  return (
    <div>
      <FilterBar />
      <KPIGrid data={data} />
      <div className="mt-8">
        <LineChart data={data.timeline_data} />
      </div>
    </div>
  );
}
