import React, { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";

const EMPTY_VALUES = new Set(["", null, undefined]);

const pickValue = (...values) => {
  for (const value of values) {
    if (!EMPTY_VALUES.has(value)) return value;
  }
  return "";
};

const normalizeStatus = (status) =>
  String(status || "").toLowerCase().replace(/\s+/g, "_");

const formatStatus = (status) => {
  switch (normalizeStatus(status)) {
    case "scheduled":
      return "Scheduled";
    case "in_progress":
      return "In Progress";
    case "completed":
      return "Completed";
    case "no_show":
      return "No Show";
    case "cancelled":
      return "Cancelled";
    default:
      return status || "Unknown";
  }
};

const statusBadgeClass = (status) => {
  const value = normalizeStatus(status);
  if (value === "completed") return "bg-green-100 text-green-800";
  if (value === "scheduled") return "bg-yellow-100 text-yellow-800";
  if (value === "no_show") return "bg-red-100 text-red-800";
  if (value === "in_progress") return "bg-blue-100 text-blue-800";
  if (value === "cancelled") return "bg-gray-200 text-gray-700";
  return "bg-gray-100 text-gray-700";
};

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatDuration = (start, end) => {
  if (!start || !end) return "--";
  const startedAt = new Date(start);
  const endedAt = new Date(end);
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    return "--";
  }

  const diffMs = Math.max(0, endedAt.getTime() - startedAt.getTime());
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs > 0) return `${hrs}h ${remMins}m`;
  return `${remMins}m`;
};

const extractInterviewList = (payload) => {
  if (Array.isArray(payload)) return payload;

  const candidates = [
    payload?.interview_logs,
    payload?.results,
    payload?.interviews,
    payload?.items,
    payload?.data?.interview_logs,
    payload?.data?.results,
    payload?.data?.interviews,
    payload?.data?.items,
    payload?.data,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
};

const normalizeInterviewRecord = (item = {}) => {
  const interviewId = pickValue(item.interview_id, item.id, item.uuid);

  const candidate = item.candidate || item.submission?.candidate || {};
  const job = item.job || item.submission?.job || {};
  const recruiter = item.recruiter || item.submission?.recruiter || {};

  return {
    id: interviewId,
    interview_id: interviewId,
    mode: pickValue(
      item.interview_mode,
      item.mode,
      item.interview_type,
      item.type,
      "interview",
    ),
    status: pickValue(item.status, item.stage, item.interview_status, "scheduled"),
    scheduled_at: pickValue(
      item.scheduled_at,
      item.scheduledAt,
      item.start_at,
      item.start_time,
      item.interview_datetime,
      item.interview_date,
    ),
    started_at: pickValue(item.started_at, item.start_at, item.startedAt),
    completed_at: pickValue(item.completed_at, item.end_at, item.completedAt),
    overall_ai_score: pickValue(item.overall_ai_score, item.overall_score, null),
    candidate: {
      id: pickValue(item.candidate_id, candidate.id, item.candidate?.candidate_id),
      full_name: pickValue(
        item.candidate_name,
        candidate.full_name,
        candidate.name,
        item.submission?.candidate?.full_name,
      ),
      email: pickValue(
        item.candidate_email,
        candidate.email,
        item.submission?.candidate?.email,
      ),
    },
    job: {
      id: pickValue(item.job_id, job.id, item.submission?.job_id),
      title: pickValue(
        item.job_title,
        job.title,
        item.submission?.job?.title,
        item.requirement_title,
      ),
      company_name: pickValue(item.company_name, job.company_name),
      location: pickValue(item.job_location, job.location),
    },
    recruiter: {
      id: pickValue(item.recruiter_id, recruiter.id, item.submission?.recruiter_id),
      full_name: pickValue(
        item.recruiter_name,
        recruiter.full_name,
        recruiter.name,
        item.scheduled_by_name,
      ),
      email: pickValue(
        item.recruiter_email,
        recruiter.email,
        item.scheduled_by_email,
      ),
    },
  };
};

const endpointConfigs = [
  { endpoint: "/v1/am/interview-logs" },
];

export default function InterviewLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");
  const [jobFilter, setJobFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError("");

      const merged = new Map();
      let reachableSourceCount = 0;

      for (const { endpoint, params } of endpointConfigs) {
        try {
          const requestConfig =
            params && Object.keys(params).length > 0 ? { params } : undefined;
          const res = await api.get(endpoint, requestConfig);
          reachableSourceCount += 1;

          extractInterviewList(res?.data)
            .map((entry) => normalizeInterviewRecord(entry))
            .forEach((entry) => {
              if (!entry.id) return;
              const key = String(entry.id);
              const existing = merged.get(key);
              merged.set(key, existing ? { ...existing, ...entry } : entry);
            });
        } catch (requestError) {
          const statusCode = requestError?.response?.status;
          if ([401, 403, 404, 405, 422].includes(statusCode)) continue;
          console.warn(
            `Failed to load AM interview data from ${endpoint}:`,
            requestError,
          );
        }
      }

      if (reachableSourceCount === 0) {
        throw new Error("No interview endpoints reachable");
      }

      const interviews = Array.from(merged.values()).sort((a, b) => {
        const aTs = new Date(a.scheduled_at || 0).getTime();
        const bTs = new Date(b.scheduled_at || 0).getTime();
        return bTs - aTs;
      });

      const logEntries = await Promise.all(
        interviews.map(async (interview) => {
          try {
            const logRes = await api.get(`/v1/interviews/${interview.id}/logs`);
            const actions = Array.isArray(logRes?.data) ? logRes.data : [];
            return { interview, actions };
          } catch {
            return { interview, actions: [] };
          }
        }),
      );

      setLogs(logEntries);
    } catch (requestError) {
      console.error("Failed to load interview logs", requestError);
      setError("Failed to load interview logs.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const jobOptions = useMemo(() => {
    const titles = new Set();
    logs.forEach((entry) => {
      if (entry.interview?.job?.title) {
        titles.add(entry.interview.job.title);
      }
    });
    return Array.from(titles);
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((entry) => {
      const interview = entry.interview || {};
      const status = normalizeStatus(interview.status || "scheduled");

      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (jobFilter !== "all" && interview.job?.title !== jobFilter) return false;

      if (fromDate) {
        const from = new Date(`${fromDate}T00:00:00`);
        if (new Date(interview.scheduled_at) < from) return false;
      }

      if (toDate) {
        const to = new Date(`${toDate}T23:59:59`);
        if (new Date(interview.scheduled_at) > to) return false;
      }

      return true;
    });
  }, [logs, statusFilter, jobFilter, fromDate, toDate]);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded shadow text-center">
        Loading interview logs...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Interview Logs</h1>
          <p className="text-sm text-gray-600">
            Track scheduled, completed, and no-show interview activity.
          </p>
        </div>
        <button
          onClick={loadLogs}
          className="px-4 py-2 rounded-lg border text-sm font-semibold text-gray-700 bg-white"
        >
          Refresh
        </button>
      </div>

      {error && <div className="text-red-600 mb-4">{error}</div>}

      <div className="bg-white p-4 rounded-xl shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="all">All statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="no_show">No Show</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Job Role
            </label>
            <select
              value={jobFilter}
              onChange={(event) => setJobFilter(event.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="all">All roles</option>
              {jobOptions.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              From
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              To
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="bg-white p-6 rounded shadow text-center">
          No interview activity yet.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLogs.map((entry) => {
            const interview = entry.interview || {};
            const candidate = interview.candidate || {};
            const job = interview.job || {};
            const recruiter = interview.recruiter || {};
            const actions = entry.actions || [];

            const startAction = actions.find((action) => action.action === "joined");
            const completedAction = actions.find(
              (action) => action.action === "completed",
            );
            const actualStart = startAction?.timestamp || interview.started_at;
            const completedAt = interview.completed_at || completedAction?.timestamp;

            return (
              <div
                key={interview.id}
                className="bg-white p-6 rounded-xl shadow flex flex-col gap-4"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {candidate.full_name || "Candidate"}
                    </h3>
                    <p className="text-gray-600">{job.title || "Job Role"}</p>
                    <p className="text-sm text-gray-500">
                      {(interview.mode || "interview")
                        .split("_")
                        .map((part) =>
                          part ? part[0].toUpperCase() + part.slice(1) : "",
                        )
                        .join(" ")}
                    </p>
                    <p className="text-xs text-gray-500">
                      Recruiter: {recruiter.full_name || recruiter.email || "--"}
                    </p>
                  </div>

                  <div className="text-left md:text-right">
                    <span
                      className={`inline-block mb-2 px-3 py-1 rounded text-sm ${statusBadgeClass(
                        interview.status || "scheduled",
                      )}`}
                    >
                      {formatStatus(interview.status || "scheduled")}
                    </span>
                    <p className="font-semibold text-gray-800">
                      Score: {interview.overall_ai_score ?? "--"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-700 border-t pt-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Scheduled</p>
                    <p className="font-semibold">
                      {formatDateTime(interview.scheduled_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Started</p>
                    <p className="font-semibold">{formatDateTime(actualStart)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Completed</p>
                    <p className="font-semibold">{formatDateTime(completedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Duration</p>
                    <p className="font-semibold">
                      {formatDuration(actualStart, completedAt)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
