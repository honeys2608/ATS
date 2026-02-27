import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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

const getWindowInfo = (scheduledAt, durationMinutes, durationSeconds) => {
  if (!scheduledAt) {
    return { isBefore: true, isAfter: false, start: null, end: null };
  }
  const start = new Date(scheduledAt);
  if (Number.isNaN(start.getTime())) {
    return { isBefore: true, isAfter: false, start: null, end: null };
  }
  const durationMs =
    durationSeconds != null
      ? durationSeconds * 1000
      : durationMinutes != null
      ? durationMinutes * 60 * 1000
      : 60 * 60 * 1000;
  const end = new Date(start.getTime() + durationMs);
  const now = new Date();
  return {
    isBefore: now.getTime() < start.getTime(),
    isAfter: now.getTime() > end.getTime(),
    start,
    end,
  };
};

export default function MyInterviews() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [interviews, setInterviews] = useState([]);
  const [startLoadingId, setStartLoadingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadInterviews = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("/v1/candidate/my-interviews");
        const list = res.data?.interviews ?? res.data ?? [];
        setInterviews(Array.isArray(list) ? list : []);
      } catch (err) {
        setError(
          err?.response?.data?.detail ||
            "Failed to load interviews. Please try again.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadInterviews();
  }, []);

  const handleStart = async (interview) => {
    const interviewId = interview.id || interview.interview_id;
    setStartLoadingId(interviewId);
    try {
      await api.post(`/v1/interviews/${interviewId}/start`);
      navigate(`/interviews/${interviewId}`);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Interview is not available yet. Please try again later.",
      );
    } finally {
      setStartLoadingId(null);
    }
  };

  if (loading) {
    return <div className="text-gray-600">Loading interviews...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">My Interviews</h2>
        <p className="text-sm text-gray-500">
          Track your scheduled interviews and join at the right time.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded">
          {error}
        </div>
      )}

      {interviews.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-6 text-center text-gray-500">
          No interviews scheduled yet.
        </div>
      ) : (
        <div className="grid gap-4">
          {interviews.map((iv) => {
            const statusLabel = formatStatus(iv.status);
            const windowInfo = getWindowInfo(
              iv.scheduled_at,
              iv.duration,
              iv.duration_seconds,
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
              iv.type !== "in_person" &&
              (normalizeStatus(iv.status) === "scheduled" ||
                normalizeStatus(iv.status) === "in_progress");

            const actionLabel = isDone
              ? statusLabel
              : isEarly
              ? `Available at ${formatDateTime(iv.scheduled_at)}`
              : isLate
              ? "Interview Window Closed"
              : normalizeStatus(iv.status) === "in_progress"
              ? "Resume Interview"
              : iv.type === "ai_chat"
              ? "Start Interview"
              : iv.type === "in_person"
              ? "In Person"
              : "Join Meet";

            return (
              <div
                key={iv.id || iv.interview_id}
                className="bg-white rounded-lg shadow-sm border p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {iv.job_title || "Job Interview"}
                    </h3>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-semibold ${
                        STATUS_STYLES[statusLabel] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {iv.company || "Company"} - {formatType(iv.type)}
                  </p>
                  <p className="text-sm text-gray-600">
                    Scheduled: {formatDateTime(iv.scheduled_at)}
                  </p>
                  {iv.type === "in_person" && (iv.location || iv.instructions) && (
                    <p className="text-xs text-gray-500">
                      {iv.location ? `Location: ${iv.location}` : ""}
                      {iv.location && iv.instructions ? " • " : ""}
                      {iv.instructions ? `Instructions: ${iv.instructions}` : ""}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => navigate(`/candidate/my-interviews/${iv.id || iv.interview_id}`)}
                    className="px-4 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    View Details
                  </button>

                  {iv.type === "ai_chat" && (
                    <button
                      type="button"
                      onClick={() => (canJoin ? handleStart(iv) : null)}
                      disabled={!canJoin || startLoadingId === (iv.id || iv.interview_id)}
                      className={`px-4 py-2 rounded text-sm font-semibold ${
                        canJoin
                          ? "bg-purple-600 text-white hover:bg-purple-700"
                          : "bg-gray-200 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      {startLoadingId === (iv.id || iv.interview_id)
                        ? "Starting..."
                        : actionLabel}
                    </button>
                  )}

                  {iv.type !== "ai_chat" && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!canJoin) return;
                        if (iv.join_link && iv.type !== "in_person") {
                          window.open(iv.join_link, "_blank", "noopener");
                          return;
                        }
                        navigate(`/candidate/my-interviews/${iv.id || iv.interview_id}`);
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
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
