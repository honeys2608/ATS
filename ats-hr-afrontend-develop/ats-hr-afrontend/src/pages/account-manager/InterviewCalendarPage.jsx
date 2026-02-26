import React, { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import {
  Calendar,
  CheckCircle,
  ChevronDown,
  User,
  Users2,
  Video,
} from "lucide-react";

const PICK_EMPTY_VALUES = new Set(["", null, undefined]);

const pickValue = (...values) => {
  for (const value of values) {
    if (!PICK_EMPTY_VALUES.has(value)) return value;
  }
  return "";
};

const normalizeStatus = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

const formatMode = (value) =>
  String(value || "interview")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const extractInterviewList = (payload) => {
  if (Array.isArray(payload)) return payload;

  const candidates = [
    payload?.interview_logs,
    payload?.interviews,
    payload?.results,
    payload?.items,
    payload?.data?.interview_logs,
    payload?.data?.interviews,
    payload?.data?.results,
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
  const candidateName = pickValue(
    item.candidate_name,
    item.candidate?.full_name,
    item.candidate?.name,
    item.submission?.candidate?.full_name,
    item.submission?.candidate?.name,
    item.candidate_full_name,
  );
  const jobTitle = pickValue(
    item.job_title,
    item.job?.title,
    item.submission?.job?.title,
    item.requirement_title,
    item.role,
  );
  const interviewMode = pickValue(
    item.interview_mode,
    item.mode,
    item.interview_type,
    item.type,
  );
  const scheduledAt = pickValue(
    item.scheduled_at,
    item.scheduledAt,
    item.start_at,
    item.start_time,
    item.interview_datetime,
    item.interview_date,
  );
  const status = pickValue(item.status, item.stage, item.interview_status);
  const clientDecision = pickValue(
    item.client_decision,
    item.client_status,
    item.decision,
  );
  const meetingLink = pickValue(
    item.meeting_link,
    item.meet_link,
    item.video_link,
    item.join_url,
    item.link,
  );
  const recruiterName = pickValue(
    item.recruiter_name,
    item.scheduled_by_name,
    item.created_by_name,
    item.submitted_by_name,
    item.recruiter?.full_name,
    item.recruiter?.name,
    item.scheduled_by?.full_name,
    item.scheduled_by?.name,
    item.created_by?.full_name,
    item.created_by?.name,
    item.submission?.recruiter_name,
    item.submission?.submitted_by_name,
    item.submission?.recruiter?.full_name,
    item.submission?.recruiter?.name,
  );
  const recruiterEmail = pickValue(
    item.recruiter_email,
    item.scheduled_by_email,
    item.created_by_email,
    item.recruiter?.email,
    item.scheduled_by?.email,
    item.created_by?.email,
    item.submission?.recruiter_email,
    item.submission?.recruiter?.email,
  );

  return {
    ...item,
    interview_id:
      interviewId ||
      `${candidateName || "candidate"}::${jobTitle || "job"}::${scheduledAt || "time"}`,
    candidate_name: candidateName,
    job_title: jobTitle,
    interview_mode: interviewMode,
    scheduled_at: scheduledAt,
    status,
    client_decision: clientDecision,
    meeting_link: meetingLink,
    recruiter_name: recruiterName,
    recruiter_email: recruiterEmail,
  };
};

const endpointConfigs = [
  { endpoint: "/v1/am/interview-logs" },
];

const formatTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const statusStyle = (status) => {
  const normalized = normalizeStatus(status);
  if (normalized === "completed") return "bg-emerald-100 text-emerald-800";
  if (normalized === "in_progress") return "bg-cyan-100 text-cyan-800";
  if (normalized === "scheduled") return "bg-amber-100 text-amber-800";
  if (normalized === "cancelled") return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-800";
};

const statusLabel = (status) => {
  const normalized = normalizeStatus(status);
  if (normalized === "in_progress") return "In Progress";
  if (normalized === "no_show") return "No Show";
  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export default function InterviewCalendarPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [markingId, setMarkingId] = useState("");
  const [recruiterFilter, setRecruiterFilter] = useState("all");

  const loadRows = async () => {
    try {
      setError("");
      setLoading(true);

      const merged = new Map();
      let reachableSourceCount = 0;

      for (const { endpoint, params } of endpointConfigs) {
        try {
          const requestConfig =
            params && Object.keys(params).length > 0 ? { params } : undefined;
          const res = await api.get(endpoint, requestConfig);
          reachableSourceCount += 1;
          const list = extractInterviewList(res?.data);
          list
            .map((entry) => normalizeInterviewRecord(entry))
            .forEach((entry) => {
              const key = String(entry.interview_id || "");
              if (!key) return;
              const existing = merged.get(key);
              const existingTs = new Date(
                existing?.scheduled_at || existing?.updated_at || existing?.created_at || 0,
              ).getTime();
              const incomingTs = new Date(
                entry?.scheduled_at || entry?.updated_at || entry?.created_at || 0,
              ).getTime();
              if (!existing || incomingTs >= existingTs) {
                merged.set(key, entry);
              }
            });
        } catch (requestError) {
          const statusCode = requestError?.response?.status;
          if ([401, 403, 404, 405, 422].includes(statusCode)) {
            continue;
          }
          console.warn(`Failed to load AM interview data from ${endpoint}:`, requestError);
        }
      }

      if (reachableSourceCount === 0) {
        throw new Error("No interview endpoints reachable");
      }

      setRows(Array.from(merged.values()));
    } catch (err) {
      console.error("Failed to load AM interview calendar:", err);
      setError("Failed to load interview calendar.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  const recruiterOptions = useMemo(() => {
    const counts = new Map();

    rows.forEach((item) => {
      const recruiterName = pickValue(item.recruiter_name, item.recruiter_email);
      const recruiterKey = recruiterName || "unknown";
      const current = counts.get(recruiterKey) || 0;
      counts.set(recruiterKey, current + 1);
    });

    return Array.from(counts.entries())
      .map(([value, count]) => ({
        value,
        label: value === "unknown" ? "Unknown recruiter" : value,
        count,
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (recruiterFilter === "all") return rows;

    return rows.filter((item) => {
      const recruiterName = pickValue(item.recruiter_name, item.recruiter_email);
      const recruiterKey = recruiterName || "unknown";
      return recruiterKey === recruiterFilter;
    });
  }, [rows, recruiterFilter]);

  const selectedRecruiter = useMemo(() => {
    if (recruiterFilter === "all") return null;
    return recruiterOptions.find((option) => option.value === recruiterFilter) || null;
  }, [recruiterFilter, recruiterOptions]);

  const grouped = useMemo(() => {
    const acc = {};

    filteredRows.forEach((item) => {
      const dateKeySource = item.scheduled_at || item.created_at;
      const parsed = dateKeySource ? new Date(dateKeySource) : null;
      const key =
        parsed && !Number.isNaN(parsed.getTime())
          ? parsed.toDateString()
          : "Unscheduled";

      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
    });

    return Object.entries(acc).sort((left, right) => {
      if (left[0] === "Unscheduled") return 1;
      if (right[0] === "Unscheduled") return -1;
      return new Date(left[0]).getTime() - new Date(right[0]).getTime();
    });
  }, [filteredRows]);

  const canMarkCompleted = (status) => {
    const normalized = normalizeStatus(status);
    return normalized === "scheduled" || normalized === "in_progress";
  };

  const markCompleted = async (interviewId) => {
    if (!interviewId) return;
    if (!window.confirm("Mark this interview as completed?")) return;

    try {
      setMarkingId(interviewId);
      await api.post(`/v1/interviews/${interviewId}/mark-completed`);
      await loadRows();
      alert("Interview marked as completed.");
    } catch (err) {
      console.error("Failed to mark interview as completed:", err);
      alert(
        err?.response?.data?.detail || "Failed to mark interview as completed.",
      );
    } finally {
      setMarkingId("");
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading interviews...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Interview Calendar</h1>
        <p className="mt-1 text-sm text-gray-500">
          Interviews scheduled by recruiters for your managed requirements.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="bg-gradient-to-r from-white to-slate-50 rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div className="w-full md:max-w-md">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide uppercase">
              Recruiter
            </label>
            <div className="relative">
              <Users2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-500" />
              <select
                value={recruiterFilter}
                onChange={(event) => setRecruiterFilter(event.target.value)}
                className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-10 text-sm text-gray-900 shadow-sm transition hover:border-indigo-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="all">All Recruiters ({rows.length})</option>
                {recruiterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                Recruiters: {recruiterOptions.length}
              </span>
              {selectedRecruiter ? (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  {selectedRecruiter.label}: {selectedRecruiter.count}
                </span>
              ) : null}
            </div>
          </div>
          <p className="text-sm text-gray-600 md:text-right">
            Showing <span className="font-semibold text-gray-900">{filteredRows.length}</span>{" "}
            interview{filteredRows.length === 1 ? "" : "s"}
            {selectedRecruiter ? (
              <>
                {" "}
                for <span className="font-semibold text-gray-900">{selectedRecruiter.label}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          No interviews scheduled.
        </div>
      ) : (
        grouped.map(([dateKey, entries]) => (
          <section key={dateKey} className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">{dateKey}</h2>
            <div className="space-y-3">
              {entries.map((item) => (
                <div
                  key={item.interview_id}
                  className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      {item.candidate_name || "Candidate"}
                    </p>
                    <p className="text-sm text-gray-600">{item.job_title || "--"}</p>
                    <div className="mt-1 text-xs text-gray-500 flex items-center gap-2">
                      <Video className="h-3.5 w-3.5" />
                      <span>{formatMode(item.interview_mode)}</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{formatTime(item.scheduled_at)}</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 flex items-center gap-2">
                      <User className="h-3.5 w-3.5" />
                      <span className="text-sm text-gray-700">
                        Recruiter:{" "}
                        <span className="font-semibold text-gray-900">
                          {item.recruiter_name ||
                            item.recruiter_email ||
                            "Unknown recruiter"}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${statusStyle(item.status)}`}
                    >
                      {statusLabel(item.status) || "Pending"}
                    </span>

                    {item.meeting_link ? (
                      <a
                        href={item.meeting_link}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        Join Meet
                      </a>
                    ) : null}

                    {canMarkCompleted(item.status) ? (
                      <button
                        type="button"
                        onClick={() => markCompleted(item.interview_id)}
                        disabled={markingId === item.interview_id}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        <CheckCircle className="h-4 w-4" />
                        {markingId === item.interview_id
                          ? "Marking..."
                          : "Mark Completed"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
