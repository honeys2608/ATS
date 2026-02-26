import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function LiveInterviewDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [interview, setInterview] = useState(null);

  useEffect(() => {
    loadDetail();
  }, []);

  const loadDetail = async () => {
    try {
      const res = await api.get(`/v1/live-interviews/${id}`);
      setInterview(res.data);
    } catch (err) {
      console.error(err);
      alert("Failed to load live interview");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <h2 className="p-6">Loading...</h2>;
  if (!interview)
    return <h2 className="p-6 text-red-600">Interview not found</h2>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold">Live Interview Detail</h1>

        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-gray-800 text-white rounded"
        >
          Back
        </button>
      </div>

      <div className="bg-white shadow rounded p-4 mb-4">
        <p>
          <b>Candidate:</b> {interview?.candidate?.full_name || "N/A"}
        </p>
        <p>
          <b>Job:</b> {interview?.job?.title || "N/A"}
        </p>

        <p>
          <b>Status:</b>{" "}
          <span className="px-2 py-1 bg-yellow-200 rounded">
            {interview.status}
          </span>
        </p>

        <p>
          <b>Scheduled At:</b>{" "}
          {interview.scheduled_at
            ? new Date(interview.scheduled_at).toLocaleString()
            : "Not Scheduled"}
        </p>

        {interview.meeting_url && (
          <p className="mt-2 text-blue-600 underline">
            Meeting Link: {interview.meeting_url}
          </p>
        )}
      </div>
    </div>
  );
}
