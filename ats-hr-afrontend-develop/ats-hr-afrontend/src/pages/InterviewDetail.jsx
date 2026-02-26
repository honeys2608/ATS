import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function InterviewDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  // SAFE AUTH  ✅
  const auth = useAuth?.();
  const user = auth?.user || null;

  const [loading, setLoading] = useState(true);
  const [interview, setInterview] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDetails();
  }, []);

  const fetchDetails = async () => {
    try {
      const res = await api.get(`/v1/interviews/${id}`);
      setInterview(res.data);
    } catch (err) {
      setError("Failed to load interview details.");
    } finally {
      setLoading(false);
    }
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
      default:
        return status || "Unknown";
    }
  };

  const statusBadgeClass = (status) => {
    const value = (status || "").toLowerCase();
    return (
      {
        scheduled: "bg-yellow-100 text-yellow-800",
        in_progress: "bg-blue-100 text-blue-800",
        completed: "bg-green-100 text-green-800",
        no_show: "bg-red-100 text-red-800",
        cancelled: "bg-gray-200 text-gray-700",
      }[value] || "bg-gray-100 text-gray-700"
    );
  };

  const formatType = (mode) =>
    mode ? mode.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Interview";

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

  if (loading) return <h2 className="p-6">Loading Interview...</h2>;
  if (!interview)
    return <h2 className="p-6 text-red-600">Interview not found</h2>;

  const candidate = interview.submission?.candidate || interview.candidate || {};
  const job = interview.submission?.job || interview.job || {};
  const recruiter = interview.submission?.recruiter || interview.recruiter || {};

  const role = (user?.role || "").toLowerCase();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold">Interview Details</h1>

        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-gray-800 text-white rounded"
        >
          Back
        </button>
      </div>

      {error && <div className="text-red-600 mb-4">{error}</div>}

      <div className="bg-white shadow rounded-lg p-6 mb-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Candidate Info
            </h2>
            <div className="space-y-2 text-sm text-gray-700">
              <p><span className="font-semibold">Name:</span> {candidate.full_name || "—"}</p>
              <p><span className="font-semibold">Email:</span> {candidate.email || "—"}</p>
              <p><span className="font-semibold">Phone:</span> {candidate.phone || "—"}</p>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Job Info
            </h2>
            <div className="space-y-2 text-sm text-gray-700">
              <p><span className="font-semibold">Job Title:</span> {job.title || "—"}</p>
              <p><span className="font-semibold">Company:</span> {job.company_name || "—"}</p>
              <p><span className="font-semibold">Location:</span> {job.location || "—"}</p>
            </div>
          </div>
        </div>

        <hr />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Interview Info
            </h2>
            <div className="space-y-2 text-sm text-gray-700">
              <p><span className="font-semibold">Type:</span> {formatType(interview.mode)}</p>
              <p><span className="font-semibold">Date & Time:</span> {formatDateTime(interview.scheduled_at)}</p>
              <p>
                <span className="font-semibold">Status:</span>{" "}
                <span className={`px-2 py-1 rounded ${statusBadgeClass(interview.status)}`}>
                  {formatStatus(interview.status)}
                </span>
              </p>
              <p><span className="font-semibold">Recruiter:</span> {recruiter.full_name || recruiter.email || "—"}</p>
            </div>
          </div>

          {(() => {
            const actions = [];

            if (role === "candidate" && interview.mode === "ai_chat") {
              actions.push(
                <button
                  key="candidate-ai-chat"
                  onClick={() => navigate(`/interviews/${id}`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  {formatStatus(interview.status) === "In Progress"
                    ? "Resume Interview"
                    : "Start Interview"}
                </button>,
              );
            }

            if (
              role === "candidate" &&
              interview.mode === "video" &&
              interview.meeting_link
            ) {
              actions.push(
                <a
                  key="candidate-video"
                  href={interview.meeting_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-indigo-600 text-white rounded"
                >
                  Join Link
                </a>,
              );
            }

            if (role === "candidate" && interview.mode === "in_person") {
              actions.push(
                <div key="candidate-in-person" className="text-sm text-gray-700">
                  <span className="font-semibold">Location:</span>{" "}
                  {interview.location || "—"}
                </div>,
              );
            }

            if (role === "recruiter") {
              actions.push(
                <button
                  key="recruiter-transcript"
                  onClick={() => navigate(`/interviews/${id}/feedback`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  View Transcript
                </button>,
              );
              actions.push(
                <button
                  key="recruiter-score"
                  onClick={() => navigate(`/interviews/${id}/feedback`)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded"
                >
                  View AI Score
                </button>,
              );
              actions.push(
                <button
                  key="recruiter-answers"
                  onClick={() => navigate(`/interviews/${id}/feedback`)}
                  className="px-4 py-2 bg-gray-800 text-white rounded"
                >
                  View Answers
                </button>,
              );
            }

            if (role === "account_manager") {
              actions.push(
                <button
                  key="am-results"
                  onClick={() => navigate(`/interviews/${id}/feedback`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  View Results
                </button>,
              );
              actions.push(
                <button
                  key="am-compare"
                  onClick={() => navigate(`/recruiter/candidates`)}
                  className="px-4 py-2 bg-gray-800 text-white rounded"
                >
                  Compare Candidates
                </button>,
              );
            }

            if (actions.length === 0) {
              return null;
            }

            return (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  Actions
                </h2>
                <div className="flex flex-wrap gap-3">{actions}</div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Legacy action area removed in favor of new Actions section */}
    </div>
  );
}
