import React, { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";

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

export default function OperationsAnalytics() {
  const [metrics, setMetrics] = useState(null);
  const [workflowLogs, setWorkflowLogs] = useState([]);

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([
      api.get("/v1/super-admin/operations-analytics"),
      api.get("/v1/recruiter/workflow-logs", { params: { limit: 20 } }),
    ]).then((results) => {
      if (!mounted) return;
      const analyticsResult = results[0];
      const workflowResult = results[1];

      if (analyticsResult.status === "fulfilled") {
        setMetrics(analyticsResult.value?.data || {});
      } else {
        setMetrics({});
      }

      if (workflowResult.status === "fulfilled") {
        const feed = workflowResult.value?.data?.logs;
        setWorkflowLogs(Array.isArray(feed) ? feed : []);
      } else {
        setWorkflowLogs([]);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const recruiterActionsToday = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startTs = start.getTime();
    return workflowLogs.filter((log) => {
      const ts = new Date(log?.timestamp || "").getTime();
      return Number.isFinite(ts) && ts >= startTs;
    }).length;
  }, [workflowLogs]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-purple-700 via-indigo-600 to-emerald-500 px-6 py-6 text-white shadow-lg">
        <h2 className="text-3xl font-extrabold">Operations Analytics</h2>
        <p className="mt-1 text-white/90">Cross-team throughput and recruiter activity</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-600">Total Jobs</div>
          <div className="mt-1 text-3xl font-extrabold text-purple-700">{metrics?.total_jobs ?? "--"}</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-600">Total Applications</div>
          <div className="mt-1 text-3xl font-extrabold text-blue-700">{metrics?.total_applications ?? "--"}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-600">Total Interviews</div>
          <div className="mt-1 text-3xl font-extrabold text-emerald-700">{metrics?.total_interviews ?? "--"}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-600">Recruiter Actions Today</div>
          <div className="mt-1 text-3xl font-extrabold text-amber-700">{recruiterActionsToday}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900">Pipeline Throughput</h3>
          <p className="mt-1 text-sm text-slate-500">Current aggregate counts from operations services.</p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-sm text-slate-600">Applications per Job</span>
              <span className="text-sm font-semibold text-slate-900">
                {Number(metrics?.total_jobs || 0) > 0
                  ? (Number(metrics?.total_applications || 0) / Number(metrics?.total_jobs || 1)).toFixed(2)
                  : "0.00"}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-sm text-slate-600">Interviews per Application</span>
              <span className="text-sm font-semibold text-slate-900">
                {Number(metrics?.total_applications || 0) > 0
                  ? (Number(metrics?.total_interviews || 0) / Number(metrics?.total_applications || 1)).toFixed(2)
                  : "0.00"}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-emerald-800">Activity Tracking</h3>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              {workflowLogs.length}
            </span>
          </div>
          <div className="space-y-2">
            {workflowLogs.length === 0 ? (
              <p className="text-sm text-emerald-700/80">No recruiter workflow activity yet</p>
            ) : (
              workflowLogs.slice(0, 8).map((log) => (
                <div key={log.id} className="rounded-lg border border-emerald-100 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatWorkflowActionLabel(log.action)}
                    </p>
                    <span className="whitespace-nowrap text-xs text-slate-500">
                      {formatRelativeTime(log.timestamp)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">Recruiter: {log.recruiter_name || "--"}</p>
                  <p className="text-xs text-slate-600">
                    Candidate: {log.candidate_id || "--"} | Job: {log.job_id || "--"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
