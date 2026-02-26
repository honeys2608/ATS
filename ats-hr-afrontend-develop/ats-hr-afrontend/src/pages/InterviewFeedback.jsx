import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function InterviewFeedback() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [interview, setInterview] = useState(null);
  const [transcript, setTranscript] = useState([]);

  const normalizeStatus = (status) => {
    const raw = String(status || "")
      .toLowerCase()
      .replace(/\s+/g, "_");
    if (raw === "interview_scheduled" || raw === "interview") return "scheduled";
    return raw;
  };

  useEffect(() => {
    loadInterview();
  }, []);

  const loadInterview = async () => {
    try {
      const [interviewRes, transcriptRes] = await Promise.all([
        api.get(`/v1/interviews/${id}`),
        api.get(`/v1/interviews/${id}/transcript`),
      ]);
      setInterview(interviewRes.data);
      setTranscript(transcriptRes.data?.transcript || []);
    } catch (err) {
      alert("Failed to load interview details");
    } finally {
      setLoading(false);
    }
  };

  const formatStatus = (status) => {
    switch (normalizeStatus(status)) {
      case "in_progress":
        return "In Progress";
      case "completed":
        return "Completed";
      case "scheduled":
        return "Scheduled";
      case "no_show":
        return "No-show";
      default:
        return status || "Unknown";
    }
  };

  if (loading) return <h2 className="p-6">Loading details...</h2>;

  if (!interview)
    return (
      <h2 className="p-6 text-red-600">Interview not found or unauthorized</h2>
    );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold">Interview Result & Feedback</h1>

        <button
          onClick={() => navigate("/candidate")}
          className="px-4 py-2 bg-gray-800 text-white rounded"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Basic Info */}
      <div className="bg-white shadow rounded p-4 mb-4">
        <p>
          <b>Job:</b> {interview?.job?.title}
        </p>
        <p>
          <b>Status:</b> {formatStatus(interview.status)}
        </p>
        <p>
          <b>Completed At:</b>{" "}
          {interview.completed_at
            ? new Date(interview.completed_at).toLocaleString()
            : "Not Available"}
        </p>

        {interview.overall_ai_score !== null && (
          <p className="mt-2 text-lg font-semibold text-green-700">
            AI Score: {interview.overall_ai_score} / 10
          </p>
        )}
      </div>

      {/* Transcript */}
      <div className="bg-white shadow rounded p-4">
        <h2 className="text-xl font-semibold mb-2">Interview Transcript</h2>

        {normalizeStatus(interview?.status) === "in_progress" &&
        transcript.length === 0 ? (
          <div className="text-sm text-gray-600 space-y-2">
            <p>Your interview is still in progress. You can resume it now.</p>
            <button
              onClick={() => navigate(`/interviews/${id}`)}
              className="px-3 py-2 bg-blue-600 text-white rounded"
            >
              Resume Interview
            </button>
          </div>
        ) : transcript.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No conversation history available
          </p>
        ) : (
          transcript.map((item, i) => (
            <div key={i} className="space-y-2 mb-3">
              <div className="p-2 rounded bg-blue-100 text-blue-900">
                {item.question}
              </div>
              <div className="p-2 rounded bg-green-100 text-green-900 text-right">
                {item.answer}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
