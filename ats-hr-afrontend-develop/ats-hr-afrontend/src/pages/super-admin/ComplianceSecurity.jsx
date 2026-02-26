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

export default function ComplianceSecurity() {
  const [summary, setSummary] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [workflowLogs, setWorkflowLogs] = useState([]);

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([
      api.get("/v1/super-admin/compliance/summary"),
      api.get("/v1/super-admin/audit-logs", { params: { limit: 150 } }),
      api.get("/v1/recruiter/workflow-logs", { params: { limit: 20 } }),
    ]).then((results) => {
      if (!mounted) return;
      const summaryResult = results[0];
      const auditResult = results[1];
      const workflowResult = results[2];

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value?.data || {});
      } else {
        setSummary({});
      }

      if (auditResult.status === "fulfilled") {
        const payload = auditResult.value?.data;
        const items = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.items)
            ? payload.items
            : [];
        setAuditLogs(items);
      } else {
        setAuditLogs([]);
      }

      if (workflowResult.status === "fulfilled") {
        const logs = workflowResult.value?.data?.logs;
        setWorkflowLogs(Array.isArray(logs) ? logs : []);
      } else {
        setWorkflowLogs([]);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const securityFlagCount = useMemo(() => {
    return auditLogs.filter((log) => {
      const action = String(log?.action || "").toUpperCase();
      return (
        action.includes("LOGIN") ||
        action.includes("PASSWORD") ||
        action.includes("PERMISSION") ||
        action.includes("ROLE") ||
        action.includes("LOCK")
      );
    }).length;
  }, [auditLogs]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-purple-700 via-indigo-600 to-emerald-500 px-6 py-6 text-white shadow-lg">
        <h2 className="text-3xl font-extrabold">Compliance & Security</h2>
        <p className="mt-1 text-white/90">Security posture, access governance, and recruiter activity</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-600">Failed Logins</div>
          <div className="mt-1 text-3xl font-extrabold text-red-700">{summary?.failed_logins ?? "--"}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-600">Security Flags</div>
          <div className="mt-1 text-3xl font-extrabold text-amber-700">{securityFlagCount}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-600">Recruiter Activity Events</div>
          <div className="mt-1 text-3xl font-extrabold text-emerald-700">{workflowLogs.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900">Security Timeline</h3>
          <p className="mt-1 text-sm text-slate-500">
            Recent authentication, permission, and system control events.
          </p>
          <div className="mt-4 space-y-2">
            {auditLogs.length === 0 ? (
              <p className="text-sm text-slate-500">No compliance events available.</p>
            ) : (
              auditLogs.slice(0, 12).map((log) => (
                <div key={log.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatWorkflowActionLabel(log.action)}
                    </p>
                    <span className="whitespace-nowrap text-xs text-slate-500">
                      {formatRelativeTime(log.timestamp)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">Actor: {log.user_id || "--"}</p>
                  <p className="text-xs text-slate-600">
                    Entity: {log.entity_type || "--"}:{log.entity_id || "--"}
                  </p>
                </div>
              ))
            )}
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
