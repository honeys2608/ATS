import React, { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

const CARD_STYLES = {
  purple: "from-purple-50 to-purple-100 border-purple-200 text-purple-700",
  blue: "from-blue-50 to-blue-100 border-blue-200 text-blue-700",
  emerald: "from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-700",
  amber: "from-amber-50 to-amber-100 border-amber-200 text-amber-700",
};

const MetricCard = ({ label, value, tone = "purple" }) => {
  const toneClass = CARD_STYLES[tone] || CARD_STYLES.purple;
  return (
    <div
      className={`rounded-xl border bg-gradient-to-br p-5 shadow-sm ${toneClass}`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </div>
      <div className="mt-2 text-4xl font-extrabold leading-none">{value}</div>
    </div>
  );
};

const chartBase = [
  { name: "Mon", value: 2 },
  { name: "Tue", value: 3 },
  { name: "Wed", value: 2 },
  { name: "Thu", value: 4 },
  { name: "Fri", value: 3 },
  { name: "Sat", value: 2 },
  { name: "Sun", value: 1 },
];

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

export default function SuperAdminDashboard() {
  const [data, setData] = useState(null);
  const [workflowLogs, setWorkflowLogs] = useState([]);
  const [workflowLogsError, setWorkflowLogsError] = useState("");

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([
      api.get("/v1/super-admin/dashboard"),
      api.get("/v1/recruiter/workflow-logs", { params: { limit: 20 } }),
    ]).then((results) => {
      if (!mounted) return;
      const dashboardResult = results[0];
      const workflowResult = results[1];

      if (dashboardResult.status === "fulfilled") {
        setData(dashboardResult.value.data || {});
      } else {
        setData({});
      }

      if (workflowResult.status === "fulfilled") {
        const logsPayload = workflowResult.value?.data?.logs;
        setWorkflowLogs(Array.isArray(logsPayload) ? logsPayload : []);
        setWorkflowLogsError("");
      } else {
        setWorkflowLogs([]);
        setWorkflowLogsError("Workflow activity unavailable");
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const revenue = useMemo(() => {
    const value = Number(data?.revenue_mtd || 0);
    if (!Number.isFinite(value)) return "--";
    return `Rs ${value.toLocaleString("en-IN")}`;
  }, [data?.revenue_mtd]);

  const hiringChartData = useMemo(() => {
    const activeJobs = Number(data?.active_jobs || 0);
    const recruiterProductivity = Number(data?.recruiter_productivity || 0);
    return chartBase.map((item, index) => ({
      ...item,
      value: Math.max(
        0,
        item.value + Math.round(activeJobs / 2) - (index % 2) + recruiterProductivity,
      ),
    }));
  }, [data?.active_jobs, data?.recruiter_productivity]);

  const tthTrendData = useMemo(() => {
    const activeClients = Number(data?.active_clients || 0);
    return chartBase.map((item, index) => ({
      ...item,
      value: Math.max(1, item.value + (index % 3) + activeClients),
    }));
  }, [data?.active_clients]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-purple-700 via-indigo-600 to-emerald-500 px-6 py-8 text-white shadow-lg">
        <h2 className="text-4xl font-extrabold">Super Admin Dashboard</h2>
        <p className="mt-2 text-white/90">Governance, controls, and platform health</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active Clients" value={data?.active_clients ?? "--"} tone="purple" />
        <MetricCard label="Active Jobs" value={data?.active_jobs ?? "--"} tone="blue" />
        <MetricCard
          label="Recruiter Productivity"
          value={data?.recruiter_productivity ?? "--"}
          tone="emerald"
        />
        <MetricCard label="Revenue (MTD)" value={revenue} tone="amber" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-3xl font-semibold text-slate-900">Hiring Funnel Health</h3>
          <p className="mb-3 text-sm text-slate-500">
            Weekly movement across top-of-funnel activity.
          </p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hiringChartData}>
                <defs>
                  <linearGradient id="hiringFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  fill="url(#hiringFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-3xl font-semibold text-slate-900">Time-to-Hire Trend</h3>
          <p className="mb-3 text-sm text-slate-500">
            Monitoring turnaround consistency by day.
          </p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tthTrendData}>
                <defs>
                  <linearGradient id="tthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f766e" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#0f766e" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#0f766e"
                  strokeWidth={2}
                  fill="url(#tthFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <h3 className="text-2xl font-semibold text-red-800">SLA Breach Alerts</h3>
            <p className="mt-2 text-4xl font-extrabold text-red-700">
              {Number(data?.sla_breaches ?? 0)}
            </p>
            <p className="mt-1 text-sm text-red-700/80">active alerts</p>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <h3 className="text-xl font-semibold text-emerald-800">Activity Tracking</h3>
            <div className="mt-3 flex items-center justify-between rounded-lg border border-emerald-200 bg-white px-3 py-2">
              <p className="text-sm font-medium text-slate-700">Recruiter workflow events</p>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                {workflowLogs.length}
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {workflowLogsError ? (
                <p className="text-sm text-emerald-700/80">{workflowLogsError}</p>
              ) : workflowLogs.length === 0 ? (
                <p className="text-sm text-emerald-700/80">No recruiter activity yet</p>
              ) : (
                workflowLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="rounded-lg border border-emerald-100 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {formatWorkflowActionLabel(log.action)}
                      </p>
                      <span className="whitespace-nowrap text-xs text-slate-500">
                        {formatRelativeTime(log.timestamp)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Recruiter: {log.recruiter_name || "--"}
                    </p>
                    <p className="text-xs text-slate-600">
                      Candidate: {log.candidate_id || "--"} | Job: {log.job_id || "--"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h3 className="text-2xl font-semibold text-amber-800">System Warnings</h3>
          <p className="mt-2 text-4xl font-extrabold text-amber-700">
            {Number(data?.system_warnings ?? 0)}
          </p>
          <p className="mt-1 text-sm text-amber-700/80">warnings</p>
          <div className="mt-4 rounded-lg border border-amber-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Governance Snapshot
            </p>
            <div className="mt-2 space-y-2 text-sm text-slate-700">
              <div className="flex justify-between">
                <span>Active Clients</span>
                <span className="font-semibold">{data?.active_clients ?? "--"}</span>
              </div>
              <div className="flex justify-between">
                <span>Active Jobs</span>
                <span className="font-semibold">{data?.active_jobs ?? "--"}</span>
              </div>
              <div className="flex justify-between">
                <span>Productivity</span>
                <span className="font-semibold">{data?.recruiter_productivity ?? "--"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
