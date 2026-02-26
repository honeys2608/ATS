// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import axios from "../api/axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

function StatCard({
  title,
  value,
  color = "purple",
}) {
  const styles = {
    purple: {
      bg: "bg-gradient-to-br from-purple-50 to-purple-100",
      border: "border-purple-300",
      value: "from-purple-600 to-purple-500",
    },
    blue: {
      bg: "bg-gradient-to-br from-blue-50 to-blue-100",
      border: "border-blue-300",
      value: "from-blue-600 to-blue-500",
    },
    green: {
      bg: "bg-gradient-to-br from-emerald-50 to-emerald-100",
      border: "border-emerald-300",
      value: "from-emerald-600 to-emerald-500",
    },
    yellow: {
      bg: "bg-gradient-to-br from-amber-50 to-amber-100",
      border: "border-amber-300",
      value: "from-amber-600 to-amber-500",
    },
  };

  const scheme = styles[color] || styles.purple;

  return (
    <div
      className={`border-2 p-4 rounded-lg shadow-md ${scheme.bg} ${scheme.border} hover:shadow-lg transition`}
    >
      <p className="text-xs font-semibold text-gray-700 uppercase">{title}</p>
      <p
        className={`text-3xl font-bold bg-gradient-to-r ${scheme.value} bg-clip-text text-transparent mt-2`}
      >
        {value}
      </p>
    </div>
  );
}

function SmallMetric({ label, value, color = "text-gray-900" }) {
  return (
    <div>
      <p className="text-gray-600 text-sm font-medium">{label}</p>
      <p className={`text-2xl font-bold ${color} mt-2`}>{value}</p>
    </div>
  );
}

function AlertRow({ alert }) {
  const severityConfig = {
    high: { dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50" },
    medium: {
      dot: "bg-yellow-500",
      text: "text-yellow-700",
      bg: "bg-yellow-50",
    },
    low: { dot: "bg-gray-400", text: "text-gray-700", bg: "bg-gray-50" },
  };

  const config = severityConfig[alert?.severity] || severityConfig.low;

  return (
    <div
      className={`p-4 border border-gray-200 rounded-lg ${config.bg} flex items-start space-x-3`}
    >
      <div className="pt-1">
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full ${config.dot}`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm ${config.text}`}>
          {alert.title || alert.message || "Alert"}
        </p>
        {alert.message && (
          <p className="text-sm text-gray-600 mt-0.5">{alert.message}</p>
        )}
      </div>
      {alert.created_at && (
        <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
          {new Date(alert.created_at).toLocaleDateString()}
        </span>
      )}
    </div>
  );
}

function formatWorkflowActionLabel(action) {
  return String(action || "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatRelativeTime(value) {
  if (!value) return "--";
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return "--";
  const now = Date.now();
  const diffMs = now - target.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// Color mapping for funnel stages
const FUNNEL_COLORS = {
  Applied: "#9CA3AF", // Gray
  Screening: "#3B82F6", // Blue
  Interview: "#4F46E5", // Indigo
  Offer: "#FBBF24", // Yellow
  Hired: "#10B981", // Green
};

function Dashboard() {
  const [metrics, setMetrics] = useState({});
  const [invoicesMetrics, setInvoicesMetrics] = useState({});
  const [dashboardMetrics, setDashboardMetrics] = useState({});
  const [workflowLogs, setWorkflowLogs] = useState([]);
  const [workflowLogsError, setWorkflowLogsError] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    // fetch both endpoints in parallel; do not fail the whole UI if one endpoint fails
    Promise.allSettled([
      axios.get("/v1/invoices/dashboard/metrics"),
      axios.get("/v1/dashboard/metrics"),
      axios.get("/v1/recruiter/workflow-logs", { params: { limit: 20 } }),
    ])
      .then((results) => {
        if (!mounted) return;

        const invResult = results[0];
        const dashResult = results[1];
        const workflowLogsResult = results[2];

        const invData =
          invResult.status === "fulfilled" ? invResult.value.data || {} : {};
        const dashData =
          dashResult.status === "fulfilled" ? dashResult.value.data || {} : {};

        setInvoicesMetrics(invData);
        setDashboardMetrics(dashData);
        if (workflowLogsResult.status === "fulfilled") {
          const logsPayload = workflowLogsResult.value?.data?.logs;
          setWorkflowLogs(Array.isArray(logsPayload) ? logsPayload : []);
          setWorkflowLogsError("");
        } else {
          setWorkflowLogs([]);
          setWorkflowLogsError("Failed to load recruiter workflow activity.");
        }

        // merge reasonable fallbacks (dashboard primary, invoices secondary)
        const merged = {
          // recruitment
          total_jobs_open:
            dashData.total_jobs_open ?? invData.total_jobs_open ?? 0,
          total_candidates:
            dashData.total_candidates ?? invData.total_candidates ?? 0,
          interviews_scheduled:
            dashData.interviews_scheduled ?? invData.interviews_scheduled ?? 0,
          offers_pending:
            dashData.offers_pending ?? invData.offers_pending ?? 0,
          employees_onboarding:
            dashData.employees_onboarding ?? invData.employees_onboarding ?? 0,
          // revenue/utilization
          revenue_projected:
            dashData.revenue_projected ?? invData.revenue_projected ?? 0,
          revenue_realized:
            dashData.revenue_realized ?? invData.revenue_realized ?? 0,
          utilization_rate:
            dashData.utilization_rate ?? invData.utilization_rate ?? null,
          // timing
          time_to_hire_avg:
            dashData.time_to_hire_avg ?? invData.time_to_hire_avg ?? null,
          // employees
          active_employees:
            dashData.active_employees ?? invData.active_employees ?? 0,
          // alerts & compliance
          alerts: (dashData.alerts && Array.isArray(dashData.alerts)
            ? dashData.alerts
            : []
          ) // start with dash alerts
            .concat(
              invData.alerts && Array.isArray(invData.alerts)
                ? invData.alerts
                : [],
            ),
          compliance_alerts:
            dashData.compliance_alerts &&
            Array.isArray(dashData.compliance_alerts)
              ? dashData.compliance_alerts
              : invData.compliance_alerts &&
                  Array.isArray(invData.compliance_alerts)
                ? invData.compliance_alerts
                : [],

          candidate_intake: dashData.candidate_intake ?? 0,
          candidate_pool: dashData.candidate_pool ?? 0,
          candidates_hired: dashData.candidates_hired ?? 0,
          candidates_on_hold: dashData.candidates_on_hold ?? 0,
          // raw objects in case you want to inspect in console
          _raw: { dashData, invData },
        };

        setMetrics(merged);

        // if both endpoints failed, show error
        const bothFailed = results.every((r) => r.status === "rejected");
        if (bothFailed) {
          setError(new Error("Failed to load metrics from both endpoints"));
        }
      })
      .catch((err) => {
        if (!mounted) return;
        console.error("Unexpected dashboard fetch error", err);
        setError(err);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen p-6 sm:p-8">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-32 bg-gradient-to-r from-gray-100 to-gray-50 rounded-lg animate-pulse"
              />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-32 bg-gradient-to-r from-gray-100 to-gray-50 rounded-lg animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-6 sm:p-8">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-red-200 bg-red-50">
          <p className="text-red-700 font-medium">
            Failed to load metrics. Please check the backend or open console for
            details.
          </p>
        </div>
      </div>
    );
  }

  // Candidate Stats
  const candidateIntake = metrics?.candidate_intake ?? 0;
  const candidatePool = metrics?.candidate_pool ?? 0;
  const candidatesHired = metrics?.candidates_hired ?? 0;
  const candidatesOnHold = metrics?.candidates_on_hold ?? 0;

  // Pulled metrics
  const totalJobsOpen = metrics?.total_jobs_open ?? 0;
  const totalCandidates = metrics?.total_candidates ?? 0;
  const interviewsScheduled = metrics?.interviews_scheduled ?? 0;
  const activeEmployees = metrics?.active_employees ?? 0;

  const projectedRevenue = metrics?.revenue_projected ?? 0;
  const realizedRevenue = metrics?.revenue_realized ?? 0;
  const utilization = metrics?.utilization_rate ?? null;
  const avgTimeToHire = metrics?.time_to_hire_avg ?? "N/A";
  const offersPending = metrics?.offers_pending ?? 0;
  const employeesOnboarding = metrics?.employees_onboarding ?? 0;

  // Funnel data with colors
  const funnelData = [
    {
      stage: "Applied",
      count: totalCandidates,
      fill: FUNNEL_COLORS["Applied"],
    },
    {
      stage: "Screening",
      count: Math.round(totalCandidates * 0.6),
      fill: FUNNEL_COLORS["Screening"],
    },
    {
      stage: "Interview",
      count: interviewsScheduled,
      fill: FUNNEL_COLORS["Interview"],
    },
    { stage: "Offer", count: offersPending, fill: FUNNEL_COLORS["Offer"] },
    {
      stage: "Hired",
      count: employeesOnboarding,
      fill: FUNNEL_COLORS["Hired"],
    },
  ];

  const alerts = Array.isArray(metrics?.alerts) ? metrics.alerts : [];
  const complianceAlerts = Array.isArray(metrics?.compliance_alerts)
    ? metrics.compliance_alerts
    : [];

  return (
    <div className="min-h-screen p-6 sm:p-8 bg-gradient-to-br from-purple-50 via-purple-25 to-purple-50 rounded-lg max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-emerald-500 rounded-lg p-8 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-white/90 mt-2 text-lg">Admin Overview</p>
          </div>
        </div>
      </div>

      {/* Top Stat Cards - Primary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Open Jobs"
          value={totalJobsOpen}
          color="purple"
        />
        <StatCard
          title="Total Candidates"
          value={totalCandidates}
          color="blue"
        />
        <StatCard
          title="Utilization Rate"
          value={
            utilization == null ? "N/A" : `${Number(utilization).toFixed(1)}%`
          }
          color="green"
        />
        <StatCard
          title="Projected Revenue"
          value={`₹${(Number(projectedRevenue) / 1000000).toFixed(1)}M`}
          color="green"
        />
      </div>

      {/* Candidate Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Candidate Intake"
          value={candidateIntake}
          color="purple"
        />
        <StatCard
          title="Candidate Pool"
          value={candidatePool}
          color="blue"
        />
        <StatCard
          title="Hired"
          value={candidatesHired}
          color="green"
        />
        <StatCard
          title="On Hold"
          value={candidatesOnHold}
          color="yellow"
        />
      </div>

      {/* Main Grid - Funnel + Revenue + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Funnel & Revenue */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recruitment Funnel */}
          <div className="bg-white p-6 rounded-lg shadow-lg border border-purple-200 hover:shadow-xl transition">
            <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent mb-4">
              Recruitment Funnel
            </h2>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={funnelData}
                  margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis
                    dataKey="stage"
                    stroke="#6B7280"
                    style={{ fontSize: "12px" }}
                  />
                  <YAxis stroke="#6B7280" style={{ fontSize: "12px" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#F9FAFB",
                      border: "1px solid #E5E7EB",
                      borderRadius: "8px",
                    }}
                    formatter={(value) => [value, "Candidates"]}
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Revenue & KPIs */}
          <div className="bg-white p-6 rounded-lg shadow-lg border border-purple-200 hover:shadow-xl transition">
            <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-emerald-500 bg-clip-text text-transparent mb-6">
              Revenue & Recruitment KPIs
            </h2>

            {/* Revenue Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pb-6 border-b border-gray-100 mb-6">
              <div>
                <p className="text-gray-600 text-sm font-medium">
                  Projected Revenue
                </p>
                <p className="text-2xl font-bold text-emerald-600 mt-2">
                  ₹{Number(projectedRevenue).toLocaleString("en-IN")}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm font-medium">
                  Realized Revenue
                </p>
                <p className="text-2xl font-bold text-emerald-700 mt-2">
                  ₹{Number(realizedRevenue).toLocaleString("en-IN")}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm font-medium">
                  Avg. Time to Hire
                </p>
                <p className="text-2xl font-bold text-purple-600 mt-2">
                  {avgTimeToHire === "N/A" ? "N/A" : `${avgTimeToHire} days`}
                </p>
              </div>
            </div>

            {/* KPIs Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <SmallMetric
                label="Interviews Scheduled"
                value={interviewsScheduled}
                color="text-gray-900"
              />
              <SmallMetric
                label="Offers Pending"
                value={offersPending}
                color="text-amber-600"
              />
            </div>
          </div>
        </div>

        {/* Right Column - Alerts & Overview */}
        <div className="space-y-6">
          {/* Alerts */}
          <div className="bg-white p-6 rounded-lg shadow-lg border border-purple-200 hover:shadow-xl transition">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent">
                Alerts
              </h2>
              <span className="bg-gray-100 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                {alerts.length}
              </span>
            </div>

            {alerts.length === 0 ? (
              <p className="text-sm text-gray-500">No active alerts</p>
            ) : (
              <div className="space-y-3">
                {alerts.slice(0, 5).map((a, idx) => (
                  <AlertRow key={a.id ?? idx} alert={a} />
                ))}
                {alerts.length > 5 && (
                  <p className="text-xs text-gray-500 text-center pt-2">
                    +{alerts.length - 5} more
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Compliance Alerts */}
          <div className="bg-white p-6 rounded-lg shadow-lg border border-purple-200 hover:shadow-xl transition">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent">
                Compliance
              </h2>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  complianceAlerts.length > 0
                    ? "bg-red-100 text-red-700"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {complianceAlerts.length}
              </span>
            </div>

            {complianceAlerts.length === 0 ? (
              <p className="text-sm text-gray-500">No compliance issues</p>
            ) : (
              <div className="space-y-3">
                {complianceAlerts.slice(0, 5).map((c, idx) => (
                  <AlertRow key={c.id ?? idx} alert={c} />
                ))}
              </div>
            )}
          </div>

          {/* Activity Tracking */}
          <div className="bg-white p-6 rounded-lg shadow-lg border border-purple-200 hover:shadow-xl transition">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent">
                Activity Tracking
              </h2>
              <span className="bg-gray-100 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                {workflowLogs.length}
              </span>
            </div>

            {workflowLogsError ? (
              <p className="text-sm text-red-600">{workflowLogsError}</p>
            ) : workflowLogs.length === 0 ? (
              <p className="text-sm text-gray-500">No recruiter workflow activity yet</p>
            ) : (
              <div className="space-y-3">
                {workflowLogs.slice(0, 6).map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg border border-gray-200 bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatWorkflowActionLabel(log.action)}
                      </p>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {formatRelativeTime(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Recruiter: {log.recruiter_name || "--"}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Candidate: {log.candidate_id || "--"} | Job: {log.job_id || "--"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Overview */}
          <div className="bg-white p-6 rounded-lg shadow-lg border border-purple-200 hover:shadow-xl transition">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">
              Quick Overview
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600 text-sm">Active Employees</span>
                <span className="font-bold text-gray-900">
                  {activeEmployees}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600 text-sm">Open Jobs</span>
                <span className="font-bold text-gray-900">{totalJobsOpen}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600 text-sm">Candidates</span>
                <span className="font-bold text-gray-900">
                  {totalCandidates}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-600 text-sm">Offers Pending</span>
                <span className="font-bold text-amber-600">
                  {offersPending}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default Dashboard;
