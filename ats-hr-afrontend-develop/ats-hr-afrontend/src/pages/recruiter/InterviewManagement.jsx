import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "../../api/axios";
import "./InterviewManagement.css";

export default function InterviewManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [interviews, setInterviews] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("scheduled");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [formData, setFormData] = useState({
    candidate_id: "",
    job_id: "",
    interview_type: "ai_chat",
    scheduled_at: "",
    meeting_link: "",
    location: "",
    instructions: "",
  });
  const prefillCandidateId = String(searchParams.get("candidate_id") || "").trim();
  const prefillJobId = String(searchParams.get("job_id") || "").trim();
  const prefillCandidateName = String(searchParams.get("candidate_name") || "").trim();
  const prefillJobTitle = String(searchParams.get("job_title") || "").trim();
  const prefillClientName = String(searchParams.get("client_name") || "").trim();
  const prefillRecruiterName = String(searchParams.get("recruiter_name") || "").trim();
  const prefillRequirementCode = String(searchParams.get("requirement_code") || "").trim();

  const clearPrefillParams = () => {
    const nextParams = new URLSearchParams(searchParams);
    [
      "candidate_id",
      "job_id",
      "candidate_name",
      "job_title",
      "client_name",
      "recruiter_name",
      "requirement_code",
    ].forEach((key) => nextParams.delete(key));
    setSearchParams(nextParams, { replace: true });
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadInterviews();
  }, [filter]);

  useEffect(() => {
    if (!prefillCandidateId) return;
    setShowScheduleModal(true);
    setFormData((prev) => ({
      ...prev,
      candidate_id: prefillCandidateId,
      job_id: prefillJobId || prev.job_id,
    }));
  }, [prefillCandidateId, prefillJobId]);

  async function loadInitialData() {
    try {
      const [jobsRes, candidatesRes] = await Promise.all([
        axios.get("/v1/jobs"),
        axios.get("/workflow/candidates", {
          params: { status: "interview_scheduled", limit: 500 },
        }),
      ]);
      setJobs(jobsRes.data?.data || jobsRes.data || []);
      const candidateList =
        candidatesRes.data?.candidates ||
        candidatesRes.data?.data ||
        candidatesRes.data ||
        [];
      const normalizedCandidates = (Array.isArray(candidateList)
        ? candidateList
        : []
      ).filter(
        (candidate) =>
          String(candidate?.status || "").toLowerCase() === "interview_scheduled",
      );
      setCandidates(normalizedCandidates);
    } catch (err) {
      console.error("Failed to load initial data", err);
      setCandidates([]);
    }
  }

  async function loadInterviews() {
    try {
      setLoading(true);
      const res = await axios.get(
        `/v1/interviews/recruiter/dashboard/interviews?status=${filter}`,
      );
      setInterviews(res.data || []);
    } catch (err) {
      console.error("Failed to load interviews", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleScheduleInterview(e) {
    e.preventDefault();
    try {
      let isReadyForScheduling = candidates.some(
        (candidate) =>
          String(candidate?.id || "") === String(formData.candidate_id || "") &&
          String(candidate?.status || "").toLowerCase() === "interview_scheduled",
      );

      if (!isReadyForScheduling && formData.candidate_id) {
        const workflowPayload = {
          job_id: formData.job_id || prefillJobId || undefined,
        };

        try {
          await axios.post(
            `/workflow/candidates/${formData.candidate_id}/schedule-interview`,
            workflowPayload,
          );
        } catch (primaryError) {
          if (primaryError?.response?.status === 404) {
            await axios.post(
              `/v1/workflow/candidates/${formData.candidate_id}/schedule-interview`,
              workflowPayload,
            );
          } else {
            throw primaryError;
          }
        }

        await loadInitialData();
        isReadyForScheduling = true;
      }

      if (!isReadyForScheduling) {
        alert("Candidate is not ready for interview scheduling.");
        return;
      }

      const res = await axios.post("/v1/interviews/schedule", formData);
      alert("Interview scheduled successfully!");
      setShowScheduleModal(false);
      setFormData({
        candidate_id: "",
        job_id: "",
        interview_type: "ai_chat",
        scheduled_at: "",
        meeting_link: "",
        location: "",
        instructions: "",
      });
      clearPrefillParams();
      loadInitialData();
      loadInterviews();
    } catch (err) {
      alert("Failed to schedule interview: " + err.response?.data?.detail);
    }
  }

  async function markCompleted(interviewId) {
    try {
      await axios.post(`/v1/interviews/${interviewId}/mark-completed`);
      alert("Interview marked as completed!");
      loadInterviews();
    } catch (err) {
      alert("Failed to mark interview as completed");
    }
  }

  async function cancelInterview(interviewId) {
    if (window.confirm("Are you sure you want to cancel this interview?")) {
      try {
        await axios.post(`/v1/interviews/${interviewId}/cancel`);
        alert("Interview cancelled!");
        loadInterviews();
      } catch (err) {
        alert("Failed to cancel interview");
      }
    }
  }

  const getStatusBadge = (status) => {
    const statusStyles = {
      scheduled: "bg-yellow-100 text-yellow-800",
      in_progress: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
      rescheduled: "bg-orange-100 text-orange-800",
    };
    return statusStyles[status] || "bg-gray-100 text-gray-800";
  };

  const getTypeIcon = (type) => {
    const icons = {
      ai_chat: "💬",
      video: "📹",
      in_person: "👤",
    };
    return icons[type] || "📋";
  };

  return (
    <div className="interview-management p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Interview Management
            </h1>
            <p className="text-gray-600 mt-1">
              Schedule, track, and manage candidate interviews
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Only candidates moved to "Schedule Interview" by AM are shown for scheduling.
            </p>
          </div>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition shadow-md"
          >
            + Schedule Interview
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex gap-3">
          {["scheduled", "in_progress", "completed", "cancelled"].map(
            (status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filter === status
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {status.replace(/_/g, " ").toUpperCase()}
              </button>
            ),
          )}
        </div>

        {/* Interviews Table */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading interviews...</p>
          </div>
        ) : interviews.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-600 mb-4">No interviews found</p>
            <button
              onClick={() => setShowScheduleModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Schedule First Interview
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Candidate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Job
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Scheduled Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {interviews.map((interview) => (
                  <tr
                    key={interview.id}
                    className="hover:bg-gray-50 transition"
                  >
                    <td className="px-6 py-4">
                      <span className="text-2xl">
                        {getTypeIcon(interview.mode)}
                      </span>
                      <span className="text-sm text-gray-600 ml-2">
                        {interview.mode?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {interview.submission?.candidate?.full_name ||
                            "Unknown"}
                        </p>
                        <p className="text-sm text-gray-600">
                          {interview.submission?.candidate?.email}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900">
                        {interview.submission?.job?.title || "Unknown"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-900">
                        {new Date(interview.scheduled_at).toLocaleDateString()}{" "}
                        {new Date(interview.scheduled_at).toLocaleTimeString(
                          [],
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(
                          interview.status,
                        )}`}
                      >
                        {interview.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex gap-2 justify-end">
                        {interview.status === "scheduled" && (
                          <>
                            <button
                              onClick={() => markCompleted(interview.id)}
                              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              Mark Complete
                            </button>
                            <button
                              onClick={() => cancelInterview(interview.id)}
                              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {interview.status === "completed" && (
                          <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                            View Feedback
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Schedule Interview Modal */}
        {showScheduleModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white flex justify-between items-center">
                <h2 className="text-xl font-bold">Schedule Interview</h2>
                <button
                  onClick={() => {
                    setShowScheduleModal(false);
                    clearPrefillParams();
                  }}
                  className="text-2xl hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={handleScheduleInterview}
                className="p-6 space-y-4"
              >
                {(prefillCandidateName ||
                  prefillJobTitle ||
                  prefillClientName ||
                  prefillRecruiterName ||
                  prefillRequirementCode) && (
                  <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                    {prefillCandidateName && (
                      <div>
                        <span className="font-semibold">Candidate:</span>{" "}
                        {prefillCandidateName}
                      </div>
                    )}
                    {prefillClientName && (
                      <div>
                        <span className="font-semibold">Client:</span>{" "}
                        {prefillClientName}
                      </div>
                    )}
                    {prefillJobTitle && (
                      <div>
                        <span className="font-semibold">Job Role:</span>{" "}
                        {prefillJobTitle}
                      </div>
                    )}
                    {prefillRecruiterName && (
                      <div>
                        <span className="font-semibold">Recruiter:</span>{" "}
                        {prefillRecruiterName}
                      </div>
                    )}
                    {prefillRequirementCode && (
                      <div>
                        <span className="font-semibold">Requirement:</span>{" "}
                        {prefillRequirementCode}
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Candidate
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Candidates listed below are ready for recruiter scheduling.
                  </p>
                  <select
                    required
                    value={formData.candidate_id}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        candidate_id: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select Candidate</option>
                    {candidates.length === 0 && (
                      <option value="" disabled>
                        No candidates ready. Ask AM to update status.
                      </option>
                    )}
                    {candidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.full_name} - {candidate.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Job
                  </label>
                  <select
                    required
                    value={formData.job_id}
                    onChange={(e) =>
                      setFormData({ ...formData, job_id: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select Job</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title} - {job.location}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Interview Type
                  </label>
                  <select
                    value={formData.interview_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        interview_type: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="ai_chat">AI Chat Interview</option>
                    <option value="video">Video Interview</option>
                    <option value="in_person">In-Person Interview</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Scheduled Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.scheduled_at}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        scheduled_at: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {formData.interview_type === "video" && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Meeting Link
                    </label>
                    <input
                      type="url"
                      value={formData.meeting_link}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          meeting_link: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="https://meet.google.com/..."
                    />
                  </div>
                )}

                {formData.interview_type === "in_person" && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          location: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Meeting location"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Instructions/Notes
                  </label>
                  <textarea
                    value={formData.instructions}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        instructions: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Any special instructions for the candidate..."
                    rows="3"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
                  >
                    Schedule
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowScheduleModal(false);
                      clearPrefillParams();
                    }}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
