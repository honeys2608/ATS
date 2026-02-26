import React, { useEffect, useState } from "react";
import axios from "../api/axios";
import { Link } from "react-router-dom";

export default function InterviewCalendar() {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadInterviews();
  }, []);

  const loadInterviews = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/v1/interviews/recruiter/list");
      setInterviews(res.data?.results || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load interviews.");
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (status) => {
    const value = (status || "").toLowerCase();
    return (
      {
        scheduled: "bg-yellow-100 text-yellow-800",
        in_progress: "bg-blue-100 text-blue-800",
        completed: "bg-green-100 text-green-800",
        no_show: "bg-red-100 text-red-800",
        cancelled: "bg-gray-200 text-gray-700",
        rescheduled: "bg-orange-100 text-orange-800",
        pending: "bg-purple-100 text-purple-800",
        confirmed: "bg-emerald-100 text-emerald-800",
        rejected: "bg-rose-100 text-rose-800",
        on_hold: "bg-amber-100 text-amber-800",
      }[value] || "bg-gray-100 text-gray-800"
    );
  };

  const formatStatus = (status) => {
    const value = (status || "").toLowerCase();
    switch (value) {
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
      case "rescheduled":
        return "Rescheduled";
      case "pending":
        return "Pending";
      case "confirmed":
        return "Confirmed";
      case "rejected":
        return "Rejected";
      case "on_hold":
        return "On Hold";
      default:
        return status
          ? status
              .split("_")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ")
          : "Unknown";
    }
  };

  const formatType = (mode) =>
    mode
      ? mode.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "Interview";

  const formatTime = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Group interviews by date
  const grouped = interviews.reduce((acc, interview) => {
    const date = new Date(interview.scheduled_at).toDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(interview);
    return acc;
  }, {});

  if (loading) return <div className="p-6 text-center">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Interview Calendar</h1>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {Object.keys(grouped).length === 0 && (
        <p className="text-gray-600">No interviews scheduled.</p>
      )}

      {Object.entries(grouped).map(([date, list]) => (
        <div key={date} className="mb-8">
          <h2 className="text-xl font-semibold mb-3">{date}</h2>

          <div className="space-y-3">
            {list.map((i) => (
              <div
                key={i.id}
                className="bg-white p-4 rounded shadow flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div>
                  <p className="font-bold text-gray-900">
                    {i.candidate?.full_name || "Candidate"}
                  </p>
                  <p className="text-gray-600">{i.job?.title || "Job Title"}</p>
                  <p className="text-xs text-gray-500">{formatType(i.mode)}</p>
                  <p className="text-sm text-gray-500">
                    {formatTime(i.scheduled_at)}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded text-xs font-medium ${statusColor(i.status)}`}
                  >
                    {formatStatus(i.status)}
                  </span>

                  {i.meeting_link ? (
                    <a
                      href={i.meeting_link}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-emerald-600 text-white px-4 py-2 rounded"
                    >
                      Join Meet
                    </a>
                  ) : null}

                  <Link
                    to={`/recruiter/interviews/${i.id}`}
                    className="bg-indigo-600 text-white px-4 py-2 rounded"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
