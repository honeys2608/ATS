import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";

const STATUS_LABELS = {
  interview_scheduled: "Scheduled",
  scheduled: "Scheduled",
  rescheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  selected: "Selected",
  rejected: "Not Selected",
};

const STATUS_STYLES = {
  Scheduled: "bg-amber-100 text-amber-800",
  "In Progress": "bg-blue-100 text-blue-800",
  Completed: "bg-green-100 text-green-800",
  Cancelled: "bg-red-100 text-red-800",
  Selected: "bg-emerald-100 text-emerald-800",
  "Not Selected": "bg-rose-100 text-rose-800",
};

const TYPE_LABELS = {
  ai_chat: "AI Chat",
  video: "Online Meeting",
  live: "Online Meeting",
  in_person: "In-Person",
};

const normalizeStatus = (status) => {
  const raw = String(status || "")
    .toLowerCase()
    .replace(/\s+/g, "_");
  return STATUS_LABELS[raw] ? raw : raw;
};

const formatStatus = (status) => {
  const key = normalizeStatus(status);
  return STATUS_LABELS[key] || "Scheduled";
};

const formatType = (type) => TYPE_LABELS[type] || "Interview";

const formatDateTime = (value) => {
  if (!value) return "Not Scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not Scheduled";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getWindowInfo = (scheduledAt, durationSeconds) => {
  if (!scheduledAt) {
    return { isBefore: true, isAfter: false, start: null, end: null };
  }
  const start = new Date(scheduledAt);
  if (Number.isNaN(start.getTime())) {
    return { isBefore: true, isAfter: false, start: null, end: null };
  }
  const durationMs =
    durationSeconds != null ? durationSeconds * 1000 : 60 * 60 * 1000;
  const end = new Date(start.getTime() + durationMs);
  const now = new Date();
  return {
    isBefore: now.getTime() < start.getTime(),
    isAfter: now.getTime() > end.getTime(),
    start,
    end,
  };
};

export default function MyInterviewDetail() {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [startLoading, setStartLoading] = useState(false);
  const [error, setError] = useState("");
  const [interview, setInterview] = useState(null);

  useEffect(() => {
    const loadInterview = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get(`/v1/interviews/${interviewId}`);
        setInterview(res.data);
      } catch (err) {
        setError(
          err?.response?.data?.detail ||
            "Failed to load interview details. Please try again.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadInterview();
  }, [interviewId]);

  const timeline = useMemo(() => {
    const status = normalizeStatus(interview?.status);
    const isResult = status === "selected" || status === "rejected";
    return [
      { label: "Applied", done: true },
      { label: "Shortlisted", done: !!interview },
      { label: "Interview", done: !!interview },
      { label: "Result", done: isResult },
    ];
  }, [interview]);

  const handleStart = async () => {
    if (!interview) return;
    setStartLoading(true);
    setError("");
    try {
      await api.post(`/v1/interviews/${interview.id}/start`);
      navigate(`/interviews/${interview.id}`);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Interview is not available yet. Please try again later.",
      );
    } finally {
      setStartLoading(false);
    }
  };

  if (loading) {
    return <div className="text-gray-600">Loading interview...</div>;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded">
          {error}
        </div>
        <button
          type="button"
          onClick={() => navigate("/candidate/my-interviews")}
          className="text-sm text-purple-600 font-semibold"
        >
          Back to My Interviews
        </button>
      </div>
    );
  }

  if (!interview) {
    return null;
  }

  const statusLabel = formatStatus(interview.status);
  const windowInfo = getWindowInfo(
    interview.scheduled_at,
    interview.duration_seconds,
  );
  const isEarly = windowInfo.isBefore;
  const isLate = windowInfo.isAfter;
  const isDone =
    statusLabel === "Completed" ||
    statusLabel === "Cancelled" ||
    statusLabel === "Selected" ||
    statusLabel === "Not Selected";

  const canJoin =
    !isEarly &&
    !isLate &&
    !isDone &&
    interview.mode !== "in_person" &&
    (normalizeStatus(interview.status) === "scheduled" ||
      normalizeStatus(interview.status) === "in_progress");

  const actionLabel = isDone
    ? statusLabel
    : isEarly
    ? `Available at ${formatDateTime(interview.scheduled_at)}`
    : isLate
    ? "Interview Window Closed"
    : normalizeStatus(interview.status) === "in_progress"
    ? "Resume Interview"
    : interview.mode === "ai_chat"
    ? "Start Interview"
    : interview.mode === "in_person"
    ? "In Person"
    : "Join Meet";

  const jobTitle = interview?.submission?.job?.title || "Interview";
  const company =
    interview?.submission?.job?.company_name || "Company";
  const recruiter =
    interview?.submission?.recruiter?.full_name ||
    interview?.submission?.recruiter?.email ||
    "--";
  const jobDescription = interview?.submission?.job?.description;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{jobTitle}</h2>
          <p className="text-sm text-gray-500">{company}</p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full font-semibold ${
            STATUS_STYLES[statusLabel] || "bg-gray-100 text-gray-700"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-gray-500">Recruiter</p>
          <p className="font-semibold text-gray-900">{recruiter}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-gray-500">Interview Mode</p>
          <p className="font-semibold text-gray-900">
            {formatType(interview.mode)}
          </p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-gray-500">Scheduled At</p>
          <p className="font-semibold text-gray-900">
            {formatDateTime(interview.scheduled_at)}
          </p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-gray-500">Status</p>
          <p className="font-semibold text-gray-900">{statusLabel}</p>
        </div>
      </div>

      {(interview.meeting_link || interview.location || interview.notes) && (
        <div className="bg-white border rounded-lg p-4 space-y-3 text-sm">
          {interview.meeting_link && (
            <div>
              <p className="text-gray-500">Meeting Link</p>
              <a
                href={interview.meeting_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 font-semibold break-all"
              >
                {interview.meeting_link}
              </a>
            </div>
          )}
          {interview.location && (
            <div>
              <p className="text-gray-500">Location</p>
              <p className="font-semibold text-gray-900">
                {interview.location}
              </p>
            </div>
          )}
          {interview.notes && (
            <div>
              <p className="text-gray-500">Instructions</p>
              <p className="text-gray-700">{interview.notes}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/candidate/my-interviews")}
          className="px-4 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to My Interviews
        </button>

        {interview.mode === "ai_chat" && (
          <button
            type="button"
            onClick={() => (canJoin ? handleStart() : null)}
            disabled={!canJoin || startLoading}
            className={`px-4 py-2 rounded text-sm font-semibold ${
              canJoin
                ? "bg-purple-600 text-white hover:bg-purple-700"
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
            }`}
          >
            {startLoading ? "Starting..." : actionLabel}
          </button>
        )}

        {interview.mode !== "ai_chat" && (
          <button
            type="button"
            onClick={() => {
              if (!canJoin) return;
              if (interview.meeting_link) {
                window.open(interview.meeting_link, "_blank", "noopener");
              }
            }}
            disabled={!canJoin}
            className={`px-4 py-2 rounded text-sm font-semibold ${
              canJoin
                ? "bg-purple-600 text-white hover:bg-purple-700"
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
            }`}
          >
            {actionLabel}
          </button>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">
          Status Timeline
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {timeline.map((step) => (
            <div
              key={step.label}
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                step.done
                  ? "bg-purple-100 text-purple-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {step.label}
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">
          Job Description
        </p>
        <div className="text-sm text-gray-700 whitespace-pre-line border rounded-lg p-4 bg-gray-50">
          {jobDescription || "Description not available."}
        </div>
      </div>
    </div>
  );
}
