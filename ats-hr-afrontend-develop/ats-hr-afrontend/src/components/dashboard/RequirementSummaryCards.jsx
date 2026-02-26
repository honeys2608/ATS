import React, { useState, useEffect } from "react";
import { AlertTriangle, Activity, Clock, RefreshCw } from "lucide-react";
import { apiService } from "../../api/axios";

const RequirementSummaryCards = () => {
  const [summary, setSummary] = useState({
    active_requirements: 0,
    passive_requirements: 0,
    total_requirements: 0,
    passive_details: [],
  });

  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [summaryForbidden, setSummaryForbidden] = useState(false);

  const getSummaryFromAssignedRequirements = async () => {
    const response = await apiService.get("/v1/workflow/recruiter/requirements", {
      params: { scope: "assigned" },
    });
    const payload = response?.data?.data || response?.data || {};
    const requirements = Array.isArray(payload?.requirements) ? payload.requirements : [];
    return {
      active_requirements: requirements.length,
      passive_requirements: 0,
      total_requirements: requirements.length,
      passive_details: [],
    };
  };

  const getRequirementSummary = async () => {
    try {
      const response = await apiService.get("/v1/recruiter/requirements/summary");
      return response?.data || {};
    } catch (err) {
      if (err?.response?.status === 404) {
        const response = await apiService.get("/api/recruiter/requirements/summary");
        return response?.data || {};
      }
      throw err;
    }
  };

  const fetchSummary = async () => {
    try {
      const nextSummary = await getRequirementSummary();
      setSummary((prev) => ({ ...prev, ...nextSummary }));
      setSummaryForbidden(false);
      setLastUpdated(new Date());
    } catch (error) {
      if (error?.response?.status === 403) {
        setSummaryForbidden(true);
        try {
          const fallbackSummary = await getSummaryFromAssignedRequirements();
          setSummary(fallbackSummary);
          setLastUpdated(new Date());
        } catch {
          // Keep default summary values when fallback is unavailable.
        }
        return;
      }
      console.error("Failed to fetch requirements summary:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await fetchSummary();
  };

  useEffect(() => {
    if (summaryForbidden) return undefined;
    fetchSummary();
    const interval = setInterval(fetchSummary, 120000);
    return () => clearInterval(interval);
  }, [summaryForbidden]);

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now - date) / (1000 * 60));
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  if (loading && !lastUpdated) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white p-6 rounded-lg shadow border animate-pulse"
          >
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-3 bg-gray-200 rounded w-full"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Activity className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-sm text-gray-600">Active Requirements</h3>
              <p className="text-2xl font-bold">
                {summary.active_requirements}
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Requirements with recent activity
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-amber-500">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm text-gray-600">Passive Requirements</h3>
              <p className="text-2xl font-bold">
                {summary.passive_requirements}
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">Inactive for 48+ hours</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm text-gray-600">Total Requirements</h3>
                <p className="text-2xl font-bold">
                  {summary.total_requirements}
                </p>
              </div>
            </div>

            <button onClick={handleRefresh}>
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          {lastUpdated && (
            <p className="text-xs text-gray-400 mt-2">
              Updated {formatTimeAgo(lastUpdated.toISOString())}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequirementSummaryCards;
