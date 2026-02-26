import React, { useEffect, useState } from "react";
import axios from "../../api/axios";
import { useNavigate } from "react-router-dom";
import { useRequirements } from "../../hooks/useRequirements";
import { FileText } from "lucide-react";
import AlarmIcon from "../../components/notifications/AlarmIcon";
import RequirementSummaryCards from "../../components/dashboard/RequirementSummaryCards";
import { getAssignedJobs } from "../../services/jobService";

/* -------------------- UI COMPONENTS -------------------- */

function StatCard({ title, value, trend, color = "blue" }) {
  const colors = {
    blue: "bg-gradient-to-br from-purple-50 to-purple-100 border-purple-300",
    green: "bg-gradient-to-br from-emerald-50 to-emerald-50 border-emerald-200",
    red: "bg-gradient-to-br from-red-50 to-red-100 border-red-300",
    yellow: "bg-gradient-to-br from-amber-50 to-amber-100 border-amber-300",
  };

  return (
    <div
      className={`border-2 p-4 rounded-lg shadow-md ${colors[color]} hover:shadow-lg transition`}
    >
      <p className="text-xs font-semibold text-gray-700 uppercase">{title}</p>
      <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent mt-2">
        {value}
      </p>
      {trend && (
        <p
          className={`text-xs mt-1 font-semibold ${trend > 0 ? "text-emerald-400" : "text-red-600"}`}
        >
          {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}% from last week
        </p>
      )}
    </div>
  );
}

function PipelineChart({ data, onStageClick = null }) {
  // NEW Pipeline order with SUBMITTED stage
  const stages = [
    { key: "applied", label: "Applied", color: "from-blue-500 to-blue-600" },
    {
      key: "screened",
      label: "Screened",
      color: "from-green-500 to-green-600",
    },
    {
      key: "submitted",
      label: "Submitted",
      color: "from-purple-500 to-purple-600",
    }, // NEW
    {
      key: "interview",
      label: "Interview",
      color: "from-orange-500 to-orange-600",
    },
    { key: "offer", label: "Offer", color: "from-pink-500 to-pink-600" },
    { key: "hired", label: "Hired", color: "from-emerald-500 to-emerald-600" },
  ];

  const maxValue = Math.max(...Object.values(data), 10);
  const totalCandidates = Object.values(data).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border border-purple-200 hover:shadow-xl transition">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-2xl bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent">
          Recruitment Pipeline
        </h3>
        <div className="text-sm text-gray-600">
          Total:{" "}
          <span className="font-semibold text-purple-600">
            {totalCandidates}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {stages.map((stage) => {
          const count = data[stage.key] || 0;
          const percentage =
            totalCandidates > 0
              ? Math.round((count / totalCandidates) * 100)
              : 0;

          return (
            <div
              key={stage.key}
              className={`${onStageClick ? "cursor-pointer hover:bg-gray-50" : ""} p-2 rounded transition-colors`}
              onClick={() => onStageClick && onStageClick(stage.key)}
            >
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">
                  {stage.label}
                  {stage.key === "submitted" && (
                    <span className="ml-1 text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                      NEW
                    </span>
                  )}
                </span>
                <span className="text-purple-600 font-semibold">
                  {count} ({percentage}%)
                </span>
              </div>
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${stage.color} transition-all duration-300`}
                  style={{
                    width: `${(count / maxValue) * 100}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Pipeline Health Indicator */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <div className="flex justify-between text-xs text-gray-600">
          <span>Pipeline Health:</span>
          <span
            className={`font-semibold ${
              data.submitted > 0 ? "text-green-600" : "text-yellow-600"
            }`}
          >
            {data.submitted > 0
              ? "Active Submissions"
              : "No Active Submissions"}
          </span>
        </div>
      </div>
    </div>
  );
}

function TimeToFillCard({ days }) {
  const status = days <= 14 ? "On Track" : days <= 21 ? "At Risk" : "Critical";
  const statusColorClass =
    days <= 14
      ? "text-emerald-300"
      : days <= 21
        ? "text-amber-600"
        : "text-red-600";

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border border-purple-200 hover:shadow-xl transition">
      <p className="text-sm text-gray-600 font-semibold">Avg. Time-to-Fill</p>
      <p className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent mt-2">
        {days} days
      </p>
      <p className={`text-sm font-semibold mt-2 ${statusColorClass}`}>
        ● {status}
      </p>
      <p className="text-xs text-gray-500 mt-2">Target: 14 days</p>
    </div>
  );
}

function QuickActionButton({ icon, label, onClick, color = "blue" }) {
  const colors = {
    blue: {
      bg: "bg-gradient-to-br from-purple-50 to-purple-100",
      border: "border-purple-300",
      text: "text-purple-700",
    },
    green: {
      bg: "bg-gradient-to-br from-slate-50 to-gray-50",
      border: "border-slate-200",
      text: "text-slate-600",
    },
    purple: {
      bg: "bg-gradient-to-br from-purple-100 to-purple-50",
      border: "border-purple-300",
      text: "text-purple-700",
    },
  };

  const colorScheme = colors[color];

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition hover:shadow-md ${colorScheme.bg} ${colorScheme.border} ${colorScheme.text}`}
    >
      <div className="text-2xl mb-1">{icon}</div>
      <span className="text-sm font-medium text-center">{label}</span>
    </button>
  );
}

export default function RecruiterDashboard() {
  const navigate = useNavigate();
  const { requirements } = useRequirements();

  // State management
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [jobCandidates, setJobCandidates] = useState({});
  const [candidatePoolCount, setCandidatePoolCount] = useState(0);
  const [interviews, setInterviews] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // NEW: Real-time pipeline data with SUBMITTED stage
  const [pipelineData, setPipelineData] = useState({
    applied: 0,
    screened: 0,
    submitted: 0, // NEW
    interview: 0,
    offer: 0,
    hired: 0,
  });

  const [avgTimeToFill, setAvgTimeToFill] = useState(18);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Real-time pipeline data fetching
  const fetchPipelineData = async () => {
    try {
      const response = await axios.get("/v1/dashboard/recruiter/pipeline");
      setPipelineData({
        applied: response.data.applied || 0,
        screened: response.data.screened || 0,
        submitted: response.data.submitted || 0, // NEW
        interview: response.data.interview || 0,
        offer: response.data.offer || 0,
        hired: response.data.hired || 0,
      });
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to fetch pipeline data:", err);
    }
  };

  // Submit candidate to client function
  const submitCandidate = async (candidateId) => {
    try {
      setLoading(true);
      const response = await axios.post(
        `/v1/dashboard/candidates/${candidateId}/submit`,
      );

      if (response.data.success) {
        // Immediately refresh pipeline data
        await fetchPipelineData();
        alert(
          `Candidate submitted successfully! Status: ${response.data.new_status}`,
        );
      }
    } catch (err) {
      console.error("Failed to submit candidate:", err);
      alert(err.response?.data?.detail || "Failed to submit candidate");
    } finally {
      setLoading(false);
    }
  };

  // Handle pipeline stage clicks for drill-down
  const handleStageClick = (stage) => {
    navigate(`/candidates?status=${stage}`);
  };

  useEffect(() => {
    let mounted = true;

    const safeArray = (v) => (Array.isArray(v) ? v : []);

    async function loadDashboard() {
      try {
        /* 1️⃣ Assigned Jobs */
        const jobsRes = await getAssignedJobs();
        const jobsData = Array.isArray(jobsRes?.data?.jobs) ? jobsRes.data.jobs : [];
        setJobs(jobsData);

        /* 2️⃣ Real-time Pipeline Data */
        await fetchPipelineData();

        /* 3️⃣ Candidates per Job */
        const jcMap = {};
        await Promise.all(
          jobsData.map(async (job) => {
            try {
              const r = await axios.get(`/v1/jobs/${job.id}/candidates`);
              jcMap[job.id] =
                r.data?.total_candidates ??
                r.data?.total ??
                r.data?.data?.length ??
                0;
            } catch {
              jcMap[job.id] = 0;
            }
          }),
        );
        setJobCandidates(jcMap);

        /* 3️⃣ Candidate Pool */
        try {
          const poolRes = await axios.get("/workflow/candidates", { params: { limit: 500 } });
          const poolPayload = poolRes?.data;
          const poolList = Array.isArray(poolPayload)
            ? poolPayload
            : poolPayload?.candidates || poolPayload?.items || poolPayload?.data || [];
          setCandidatePoolCount(Array.isArray(poolList) ? poolList.length : 0);
        } catch {
          try {
            const poolRes = await axios.get("/v1/candidates");
            const poolPayload = poolRes?.data;
            const poolList = Array.isArray(poolPayload)
              ? poolPayload
              : poolPayload?.items || poolPayload?.data || [];
            setCandidatePoolCount(Array.isArray(poolList) ? poolList.length : 0);
          } catch {
            setCandidatePoolCount(0);
          }
        }

        /* 4️⃣ Interviews */
        try {
          const intRes = await axios.get("/v1/interviews", {
            params: { assigned_to: "me" },
          });
          setInterviews(safeArray(intRes.data));
        } catch (err) {
          console.error("Failed to fetch interviews:", err);
          setInterviews([]);
        }

        /* 5️⃣ Notifications */
        try {
          let notifRes;
          try {
            notifRes = await axios.get("/api/notifications", {
              params: { limit: 10, unread_only: false },
            });
            setNotifications(
              safeArray(
                notifRes?.data?.notifications || notifRes?.data?.data || [],
              ),
            );
          } catch (apiErr) {
            // Backward compatibility with older notification endpoint shape.
            notifRes = await axios.get("/v1/notifications");
            setNotifications(
              safeArray(
                notifRes?.data?.notifications || notifRes?.data?.data || [],
              ),
            );
          }
        } catch {
          setNotifications([]);
        }

        /* 6️⃣ Average Time-to-Fill (placeholder - could be calculated from backend) */
        setAvgTimeToFill(18);
      } catch (err) {
        console.error("Recruiter dashboard error:", err);
      } finally {
        mounted && setLoading(false);
      }
    }

    loadDashboard();
    return () => (mounted = false);
  }, []);

  // Real-time polling effect for pipeline updates
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchPipelineData();
    }, 30000); // Poll every 30 seconds

    setPollingInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin mb-4">⏳</div>
          <p className="text-gray-600">Loading Recruiter Dashboard…</p>
        </div>
      </div>
    );

  /* Derived */
  const totalJobs = jobs.length;
  const totalCandidates = Object.values(jobCandidates).reduce(
    (a, b) => a + b,
    0,
  );
  const activeJobs = jobs.filter((j) => j.status === "active").length;
  const filteredInterviews = interviews.filter((i) => {
    const candidateName = (i?.candidate?.full_name || "").trim();
    const jobTitle = (i?.job?.title || "").trim();
    const scheduledAt = i?.scheduled_at;
    if (!candidateName || !jobTitle || !scheduledAt) return false;
    if (candidateName.toLowerCase() === "unknown") return false;
    if (jobTitle.toLowerCase() === "position tbd") return false;
    return true;
  });
  const interviewCount = filteredInterviews.length;
  const interviewsToday = filteredInterviews.filter((i) => {
    const today = new Date().toDateString();
    return new Date(i.scheduled_at).toDateString() === today;
  }).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-gradient-to-br from-purple-50 via-purple-25 to-purple-50 rounded-lg">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-purple-600 to-emerald-500 rounded-lg p-8 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold">Recruiter Dashboard</h1>
            <p className="text-purple-100 mt-2 text-lg">
              Manage your recruitment pipeline and candidates
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <AlarmIcon />
          </div>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Assigned Jobs"
          value={totalJobs}
          color="blue"
          trend={5}
        />
        <StatCard
          title="Total Candidates"
          value={totalCandidates}
          color="green"
          trend={12}
        />
        <StatCard
          title="Interviews Today"
          value={interviewsToday}
          color="purple"
        />
        <StatCard
          title="Requirements Assigned"
          value={requirements.length}
          color="yellow"
          trend={requirements.length > 0 ? 10 : 0}
        />
      </div>

      {/* REQUIREMENT SUMMARY CARDS (ACTIVE/PASSIVE) */}
      <RequirementSummaryCards />

      {/* ASSIGNED REQUIREMENTS SECTION */}
      {requirements.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900 text-lg">
              Assigned Requirements ({requirements.length})
            </h3>
            <button
              onClick={() => navigate("/recruiter/requirements")}
              className="text-blue-600 hover:text-blue-700 text-sm font-semibold"
            >
              View All →
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {requirements.slice(0, 3).map((req) => (
              <div
                key={req.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer"
                onClick={() => navigate(`/recruiter/requirements/${req.id}`)}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-gray-900">{req.title}</h4>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    {req.positions_count || 1} open
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  {req.title || "Position"}
                </p>
                {req.skills_mandatory && req.skills_mandatory.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-3">
                    {req.skills_mandatory.slice(0, 3).map((skill, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                      >
                        {skill}
                      </span>
                    ))}
                    {req.skills_mandatory.length > 3 && (
                      <span className="text-xs text-gray-500">
                        +{req.skills_mandatory.length - 3} more
                      </span>
                    )}
                  </div>
                )}
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>Client: {req.client_name || "Client"}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/recruiter/requirements/${req.id}`);
                    }}
                    className="text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Enhanced Pipeline Chart with Real-time Updates */}
        <div className="lg:col-span-2 space-y-4">
          {/* Real-time Status Bar */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    lastUpdated && Date.now() - lastUpdated < 60000
                      ? "bg-green-500"
                      : "bg-yellow-500"
                  } animate-pulse`}
                ></div>
                <span className="text-sm text-gray-600">
                  {lastUpdated
                    ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
                    : "Loading..."}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`text-xs px-2 py-1 rounded ${
                    autoRefresh
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  Auto-refresh {autoRefresh ? "ON" : "OFF"}
                </button>

                <button
                  onClick={fetchPipelineData}
                  className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  🔄 Refresh Now
                </button>
              </div>
            </div>
          </div>

          {/* Enhanced Pipeline Chart */}
          <PipelineChart data={pipelineData} onStageClick={handleStageClick} />
        </div>

        {/* RIGHT: Time-to-Fill + Pipeline Actions */}
        <div className="space-y-6">
          <TimeToFillCard days={avgTimeToFill} />

          {/* Quick Submit Actions */}
          <div className="bg-white rounded-lg shadow-lg p-6 border border-purple-200">
            <h4 className="font-bold text-lg text-gray-800 mb-4">
              Pipeline Actions
            </h4>
            <div className="space-y-3">
              <button
                onClick={() => navigate("/candidates?status=screened")}
                className="w-full px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition"
              >
                📤 Review Screened Candidates ({pipelineData.screened})
              </button>

              <button
                onClick={() => navigate("/candidates?status=submitted")}
                className="w-full px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition"
              >
                📋 Track Submitted Candidates ({pipelineData.submitted})
              </button>

              <button
                onClick={() => navigate("/candidates?status=interview")}
                className="w-full px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition"
              >
                🎯 Manage Interviews ({pipelineData.interview})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="bg-white rounded-lg shadow-lg p-6 border border-purple-200">
        <h3 className="font-bold text-2xl bg-gradient-to-r from-purple-600 to-emerald-500 bg-clip-text text-transparent mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {/* <QuickActionButton
            icon="📋"
            label="View Requirements"
            onClick={() => navigate("/recruiter/requirements")}
            color="blue"
          /> */}
          <QuickActionButton
            icon="💼"
            label="Assigned Jobs"
            onClick={() => navigate("/recruiter/assigned-jobs")}
            color="green"
          />
          <QuickActionButton
            icon="📞"
            label="Schedule Interview"
            onClick={() => navigate("/recruiter/interviews")}
            color="purple"
          />
          {/* <QuickActionButton
            icon="✉️"
            label="Send Offer"
            onClick={() => navigate("/offers")}
            color="blue"
          /> */}
          <QuickActionButton
            icon="📊"
            label="View Reports"
            onClick={() => navigate("/reports")}
            color="purple"
          />
          <QuickActionButton
            icon={<FileText size={22} />}
            label="Trackers"
            onClick={() => navigate("/recruiter/trackers")}
            color="blue"
          />
        </div>
      </div>

      {/* INTERVIEWS TODAY */}
      <div className="bg-white rounded-lg shadow-lg p-6 border border-purple-200">
        <h3 className="font-bold text-2xl bg-gradient-to-r from-purple-600 to-emerald-500 bg-clip-text text-transparent mb-4">
          Today's Interviews ({interviewsToday})
        </h3>
        {interviewCount > 0 ? (
          <div className="space-y-3">
            {filteredInterviews.slice(0, 5).map((interview) => (
              <div
                key={interview.id}
                className="flex items-start justify-between p-3 border rounded hover:bg-gray-50"
              >
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">
                    {interview.candidate.full_name}
                  </p>
                  <p className="text-sm text-gray-600">
                    {interview.job.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(interview.scheduled_at).toLocaleTimeString()}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 text-xs rounded font-medium ${
                    interview.status === "completed"
                      ? "bg-green-100 text-green-700"
                      : interview.status === "scheduled"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {interview.status || "pending"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-center py-4">
            No interviews scheduled for today
          </p>
        )}
      </div>

      {/* NOTIFICATIONS */}
      {notifications.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-bold text-gray-900 mb-4">Recent Notifications</h3>
          <div className="space-y-2">
            {notifications.slice(0, 5).map((n, idx) => (
              <div
                key={idx}
                className="p-3 bg-blue-50 border-l-4 border-blue-500 rounded"
              >
                <p className="font-medium text-blue-900">
                  {n.title || n.message}
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TRACKERS SECTION */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
            <FileText size={20} className="text-purple-600" />
            Trackers
          </h3>
          <button
            onClick={() => navigate("/recruiter/trackers")}
            className="text-blue-600 hover:text-blue-700 text-sm font-semibold"
          >
            Go to Trackers →
          </button>
        </div>
        <p className="text-gray-600 text-sm mb-2">
          Manage and export your daily recruitment tracker in spreadsheet
          format.
        </p>
        <button
          onClick={() => navigate("/recruiter/trackers")}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition text-sm font-semibold"
        >
          <FileText size={16} />
          Open Trackers
        </button>
      </div>
    </div>
  );
}
