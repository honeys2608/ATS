import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import UserProfileDrawer from "../components/profile/UserProfileDrawer";
import ThemeToggle from "../components/ui/ThemeToggle";

// ============================================================
// PipelineBar Component
// ============================================================
function PipelineBar({ label, value, maxValue }) {
  // Calculate progress percentage safely
  const progress = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-semibold text-purple-600">
          {value || 0}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className="bg-purple-600 h-3 rounded-full transition-all duration-300 ease-in-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================
// Main RecruiterDashboard Component
// ============================================================
export default function RecruiterDashboard() {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pipeline, setPipeline] = useState({
    applied: 0, // NEW: Combined from sourced/new
    screened: 0, // NEW: Combined from screening/screened
    submitted: 0, // NEW: The key addition
    interview: 0,
    offer: 0,
    hired: 0, // NEW: Combined from joined/hired
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  // Fetch pipeline data on component mount
  useEffect(() => {
    const fetchPipelineData = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setError("No authentication token found");
          setLoading(false);
          return;
        }

        const response = await fetch(
          "http://localhost:8000/v1/dashboard/recruiter/pipeline",
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setPipeline({
          applied: data.applied ?? 0, // NEW
          screened: data.screened ?? 0, // NEW
          submitted: data.submitted ?? 0, // NEW - Key addition
          interview: data.interview ?? 0,
          offer: data.offer ?? 0,
          hired: data.hired ?? 0, // NEW (was joined)
        });
        setLoading(false);
      } catch (err) {
        console.error("Error fetching pipeline data:", err);
        setError(err.message || "Failed to fetch pipeline data");
        setLoading(false);
      }
    };

    fetchPipelineData();
  }, []);

  // Calculate max value for progress bar scaling (updated for new pipeline)
  const maxValue = Math.max(
    pipeline.applied || 1,
    pipeline.screened || 1,
    pipeline.submitted || 1, // NEW
    pipeline.interview || 1,
    pipeline.offer || 1,
    pipeline.hired || 1, // Updated from joined
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      <header className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 shadow dark:shadow-slate-900/50">
        <div className="text-xl font-bold dark:text-gray-50">
          Recruiter Dashboard
        </div>
        <div className="flex items-center gap-3 flex-1 justify-end pr-4">
          <input
            type="text"
            placeholder="Search candidates..."
            className="px-4 py-2 w-64 bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 rounded-lg border border-gray-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 transition-colors"
          />
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 shadow-sm transition-all duration-200 font-medium"
            title="Logout"
          >
            <LogOut size={16} />
            Logout
          </button>
          <ThemeToggle />
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
          >
            <span role="img" aria-label="avatar" className="text-2xl">
              👤
            </span>
          </button>
        </div>
      </header>

      <main className="p-8">
        {/* Pipeline Section with Real-time Indicator */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Recruitment Pipeline
            </h2>

            {/* Real-time Status Indicator */}
            <div className="flex items-center space-x-2 text-sm">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-gray-600 dark:text-gray-400">
                  {lastUpdated
                    ? `Updated ${lastUpdated.toLocaleTimeString()}`
                    : "Loading..."}
                </span>
              </div>
              <button
                onClick={fetchPipelineData}
                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : error ? (
            <div className="text-red-500 dark:text-red-400 text-center py-4">
              {error}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Applied - NEW ORDER */}
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                <PipelineBar
                  label="Applied"
                  value={pipeline.applied}
                  maxValue={maxValue}
                />
              </div>

              {/* Screened - NEW ORDER */}
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                <PipelineBar
                  label="Screened"
                  value={pipeline.screened}
                  maxValue={maxValue}
                />
              </div>

              {/* Submitted - THE KEY NEW STAGE */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:bg-slate-700/50 rounded-lg p-4 border-2 border-purple-200">
                <PipelineBar
                  label="Submitted ⭐"
                  value={pipeline.submitted}
                  maxValue={maxValue}
                />
                <div className="text-xs text-purple-600 mt-1 font-medium">
                  NEW STAGE
                </div>
              </div>

              {/* Interview */}
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                <PipelineBar
                  label="Interview"
                  value={pipeline.interview}
                  maxValue={maxValue}
                />
              </div>

              {/* Offer */}
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                <PipelineBar
                  label="Offer"
                  value={pipeline.offer}
                  maxValue={maxValue}
                />
              </div>

              {/* Hired - NEW ORDER (was Joined) */}
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                <PipelineBar
                  label="Hired"
                  value={pipeline.hired}
                  maxValue={maxValue}
                />
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Summary Stats with NEW pipeline */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
            Pipeline Summary
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {pipeline.applied + pipeline.screened}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                In Process
              </div>
            </div>

            {/* NEW: Submitted Stage Highlight */}
            <div className="text-center p-4 bg-gradient-to-br from-purple-100 to-purple-200 dark:bg-purple-900/30 rounded-lg border-2 border-purple-300">
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                {pipeline.submitted}
              </div>
              <div className="text-sm text-purple-700 dark:text-gray-400 font-semibold">
                ⭐ Submitted to Clients
              </div>
            </div>

            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {pipeline.interview + pipeline.offer}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                In Final Stages
              </div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {pipeline.hired}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Successfully Hired
              </div>
            </div>
          </div>

          {/* Pipeline Health Indicator */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Submission Rate:</span>
              <span
                className={`font-semibold ${
                  pipeline.submitted > 0 ? "text-green-600" : "text-yellow-600"
                }`}
              >
                {pipeline.applied > 0
                  ? `${Math.round((pipeline.submitted / pipeline.applied) * 100)}%`
                  : "0%"}{" "}
                candidates submitted
              </span>
            </div>
          </div>
        </div>

        {/* Welcome Message */}
        <div className="mt-6 text-gray-600 dark:text-gray-400">
          Welcome to your dashboard. Click your avatar to open profile &
          settings.
        </div>
      </main>

      <UserProfileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
