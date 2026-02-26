import React, { useEffect, useMemo, useState } from "react";
import axios from "../api/axios";

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
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "--";
  const diffMs = Math.max(0, e.getTime() - s.getTime());
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs > 0) return `${hrs}h ${remMins}m`;
  return `${remMins}m`;
};

export default function InterviewLogs() {
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
      const res = await axios.get("/v1/interviews/recruiter/list");
      const interviews = res.data?.results || [];
      const logEntries = await Promise.all(
        interviews.map(async (interview) => {
          try {
            const logRes = await axios.get(
              `/v1/interviews/${interview.id}/logs`,
            );
            return { interview, actions: logRes.data || [] };
          } catch (err) {
            return { interview, actions: [] };
          }
        }),
      );
      setLogs(logEntries);
    } catch (e) {
      console.error("Failed to load interview logs", e);
      setError("Failed to load interview logs.");
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
      if (statusFilter !== "all" && status !== statusFilter) {
        return false;
      }
      if (jobFilter !== "all" && interview.job?.title !== jobFilter) {
        return false;
      }
      if (fromDate) {
        const from = new Date(`${fromDate}T00:00:00`);
        if (new Date(interview.scheduled_at) < from) {
          return false;
        }
      }
      if (toDate) {
        const to = new Date(`${toDate}T23:59:59`);
        if (new Date(interview.scheduled_at) > to) {
          return false;
        }
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
            <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
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
            <label className="block text-xs font-semibold text-gray-500 mb-1">Job Role</label>
            <select
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
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
            <label className="block text-xs font-semibold text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
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
            const startAction = actions.find((a) => a.action === "joined");
            const completedAction = actions.find((a) => a.action === "completed");
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
                      {(interview.mode || "interview").split('_').map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ')}
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
                    <p className="font-semibold">
                      {formatDateTime(actualStart)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Completed</p>
                    <p className="font-semibold">
                      {formatDateTime(completedAt)}
                    </p>
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
