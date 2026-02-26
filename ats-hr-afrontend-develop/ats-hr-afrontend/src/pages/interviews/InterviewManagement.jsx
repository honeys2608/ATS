/**
 * Interview Management Page - Client-Request Driven Workflow
 *
 * Workflow:
 * 1. Recruiter submits matching candidates to AM
 * 2. AM forwards to Client
 * 3. Client approves/rejects
 * 4. If approved: Interview scheduling available
 */

import React, { useState, useEffect } from "react";
import axios from "../../api/axios";

/* ============ CANDIDATE SUBMISSION MODAL ============ */
function SubmitCandidatesModal({ jobs, candidates, onSubmit, onClose }) {
  const [selectedJob, setSelectedJob] = useState("");
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleToggleCandidate = (candidateId) => {
    setSelectedCandidates((prev) =>
      prev.includes(candidateId)
        ? prev.filter((id) => id !== candidateId)
        : [...prev, candidateId],
    );
  };

  const handleSubmit = async () => {
    if (!selectedJob || selectedCandidates.length === 0) {
      alert("Please select job and candidates");
      return;
    }
    try {
      setSubmitting(true);
      await onSubmit({
        job_id: selectedJob,
        candidate_ids: selectedCandidates,
        notes,
      });
      alert("Candidates submitted to Account Manager!");
      onClose();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCandidates =
    selectedJob && candidates[selectedJob] ? candidates[selectedJob] : [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">Submit Candidates to AM</h2>

        <div className="space-y-6">
          {/* JOB SELECTION */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select Job
            </label>
            <select
              value={selectedJob}
              onChange={(e) => {
                setSelectedJob(e.target.value);
                setSelectedCandidates([]);
              }}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a job...</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} ({job.status})
                </option>
              ))}
            </select>
          </div>

          {/* CANDIDATES */}
          {selectedJob && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Matching Candidates ({filteredCandidates.length})
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded p-3">
                {filteredCandidates.length > 0 ? (
                  filteredCandidates.map((candidate) => (
                    <label
                      key={candidate.id}
                      className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCandidates.includes(candidate.id)}
                        onChange={() => handleToggleCandidate(candidate.id)}
                        className="mr-3"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {candidate.name}
                        </p>
                        <p className="text-xs text-gray-600">
                          Match: {candidate.fit_score || 0}% • Skills:{" "}
                          {candidate.skills?.join(", ") || "N/A"}
                        </p>
                      </div>
                    </label>
                  ))
                ) : (
                  <p className="text-gray-600 text-sm">
                    No matching candidates for this job
                  </p>
                )}
              </div>
            </div>
          )}

          {/* NOTES */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Notes for AM
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about these candidates..."
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              submitting || !selectedJob || selectedCandidates.length === 0
            }
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit to AM"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ INTERVIEW CARD ============ */
function InterviewCard({ interview, onReschedule, onFeedback, onCancel }) {
  const getStatusColor = (status) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-100 text-blue-700";
      case "completed":
        return "bg-green-100 text-green-700";
      case "cancelled":
        return "bg-red-100 text-red-700";
      case "rescheduled":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getTypeLabel = (type) => {
    const types = {
      phone: "📱 Phone",
      video: "🎥 Video",
      in_person: "👥 In-Person",
      group: "👫 Group",
      panel: "👨‍💼 Panel",
    };
    return types[type] || type;
  };

  const isUpcoming = new Date(interview.scheduled_date) > new Date();
  const isPast =
    new Date(interview.scheduled_date) < new Date() &&
    interview.status !== "cancelled";

  return (
    <div className="bg-white border rounded-lg p-4 hover:shadow-lg transition">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="font-bold text-gray-900">
            {interview.candidate_name}
          </h3>
          <p className="text-sm text-gray-600">{interview.job_title}</p>
        </div>
        <span
          className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(interview.status)}`}
        >
          {interview.status}
        </span>
      </div>

      <div className="text-sm text-gray-600 space-y-1 mb-3">
        <p>
          📅{" "}
          {new Date(interview.scheduled_date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
        <p>
          ⏰{" "}
          {new Date(interview.scheduled_date).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        <p>{getTypeLabel(interview.type)}</p>
        {interview.interviewer_name && <p>👤 {interview.interviewer_name}</p>}
      </div>

      {interview.feedback_score && (
        <div className="mb-3 p-2 bg-blue-50 rounded text-sm">
          <p className="font-semibold text-blue-900">
            Score: {interview.feedback_score}/10
          </p>
          <p className="text-blue-700 text-xs mt-1">
            {interview.feedback_comments?.substring(0, 100)}
          </p>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {isUpcoming && (
          <>
            <button
              onClick={() => onReschedule(interview.id)}
              className="flex-1 px-3 py-2 bg-yellow-100 text-yellow-700 rounded text-sm hover:bg-yellow-200 font-medium"
            >
              Reschedule
            </button>
            <button
              onClick={() => onCancel(interview.id)}
              className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 font-medium"
            >
              Cancel
            </button>
          </>
        )}

        {isPast && !interview.feedback_score && (
          <button
            onClick={() => onFeedback(interview.id)}
            className="flex-1 px-3 py-2 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200 font-medium"
          >
            Add Feedback
          </button>
        )}

        {interview.status === "completed" && (
          <button
            onClick={() => onFeedback(interview.id)}
            className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 font-medium"
          >
            View/Edit Feedback
          </button>
        )}
      </div>
    </div>
  );
}

function FeedbackModal({ interview, onSave, onClose }) {
  const [score, setScore] = useState(interview?.feedback_score || 5);
  const [comments, setComments] = useState(interview?.feedback_comments || "");
  const [rating1, setRating1] = useState(interview?.rating_technical || 0);
  const [rating2, setRating2] = useState(interview?.rating_communication || 0);
  const [rating3, setRating3] = useState(interview?.rating_cultural_fit || 0);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave(interview.id, {
        feedback_score: score,
        feedback_comments: comments,
        rating_technical: rating1,
        rating_communication: rating2,
        rating_cultural_fit: rating3,
        status: "completed",
      });
      alert("Feedback saved successfully!");
      onClose();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const RatingStars = ({ value, onChange, label }) => (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((num) => (
          <button
            key={num}
            onClick={() => onChange(num)}
            className={`text-2xl ${num <= value ? "text-yellow-400" : "text-gray-300"} hover:text-yellow-300`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">
          Interview Feedback - {interview?.candidate_name}
        </h2>

        <div className="space-y-6">
          {/* OVERALL SCORE */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-3">
              Overall Score
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="10"
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-3xl font-bold text-blue-600 min-w-fit">
                {score}/10
              </span>
            </div>
          </div>

          {/* CATEGORY RATINGS */}
          <div className="grid grid-cols-3 gap-4">
            <RatingStars
              value={rating1}
              onChange={setRating1}
              label="Technical"
            />
            <RatingStars
              value={rating2}
              onChange={setRating2}
              label="Communication"
            />
            <RatingStars
              value={rating3}
              onChange={setRating3}
              label="Cultural Fit"
            />
          </div>

          {/* COMMENTS */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">
              Interview Comments
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Share your detailed feedback on the candidate's performance, strengths, areas for improvement..."
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 h-32"
            />
          </div>

          {/* RECOMMENDATION */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm font-semibold text-blue-900 mb-2">
              Recommendation
            </p>
            <p className="text-sm text-blue-700">
              {score >= 8 && "🟢 Strong recommendation - Proceed to next round"}
              {score >= 6 &&
                score < 8 &&
                "🟡 Moderate - Consider additional interviews"}
              {score >= 4 &&
                score < 6 &&
                "🟠 Borderline - Need more assessment"}
              {score < 4 && "🔴 Not recommended - Consider other candidates"}
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Feedback"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RescheduleModal({ interview, onSave, onClose }) {
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!newDate || !newTime) {
      alert("Please select date and time");
      return;
    }
    try {
      setSaving(true);
      await onSave(interview.id, {
        scheduled_date: `${newDate}T${newTime}`,
        reschedule_reason: reason,
        status: "rescheduled",
      });
      alert("Interview rescheduled!");
      onClose();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-4">Reschedule Interview</h2>
        <p className="text-gray-600 mb-4">
          {interview?.candidate_name} • {interview?.job_title}
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              New Date
            </label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              New Time
            </label>
            <input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Reason for Reschedule
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are we rescheduling this interview?"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 h-20"
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Reschedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InterviewManagement() {
  const [interviews, setInterviews] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState({});
  const [clientRequests, setClientRequests] = useState([]); // Client-approved requests
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [feedbackModal, setFeedbackModal] = useState(null);
  const [rescheduleModal, setRescheduleModal] = useState(null);
  const [submitModal, setSubmitModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // Load interviews
      const intRes = await axios.get("/v1/interviews");
      setInterviews(
        Array.isArray(intRes.data) ? intRes.data : intRes.data?.data || [],
      );

      // Load jobs (AM-assigned + public portal)
      const jobRes = await axios.get("/v1/jobs");
      const jobsData = Array.isArray(jobRes.data)
        ? jobRes.data
        : jobRes.data?.data || [];
      setJobs(jobsData);

      // Load candidates for each job
      const candidatesMap = {};
      await Promise.all(
        jobsData.map(async (job) => {
          try {
            const candRes = await axios.get(`/v1/jobs/${job.id}/candidates`);
            candidatesMap[job.id] = Array.isArray(candRes.data)
              ? candRes.data
              : candRes.data?.data || [];
          } catch {
            candidatesMap[job.id] = [];
          }
        }),
      );
      setCandidates(candidatesMap);

      // Load client-approved requests
      try {
        const clientRes = await axios.get("/v1/interviews/client-requests");
        setClientRequests(
          Array.isArray(clientRes.data)
            ? clientRes.data
            : clientRes.data?.data || [],
        );
      } catch {
        setClientRequests([]);
      }
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCandidates = async (data) => {
    try {
      await axios.post("/v1/candidate-submissions/submit-to-am", data);
      setSubmitModal(false);
      await loadData();
    } catch (err) {
      throw err;
    }
  };

  const handleSaveFeedback = async (interviewId, data) => {
    try {
      await axios.put(`/v1/interviews/${interviewId}`, data);
      setInterviews(
        interviews.map((i) => (i.id === interviewId ? { ...i, ...data } : i)),
      );
      setFeedbackModal(null);
    } catch (err) {
      throw err;
    }
  };

  const handleReschedule = async (interviewId, data) => {
    try {
      await axios.put(`/v1/interviews/${interviewId}`, data);
      setInterviews(
        interviews.map((i) => (i.id === interviewId ? { ...i, ...data } : i)),
      );
      setRescheduleModal(null);
    } catch (err) {
      throw err;
    }
  };

  const handleCancel = async (interviewId) => {
    if (!window.confirm("Cancel this interview?")) return;
    try {
      await axios.put(`/v1/interviews/${interviewId}`, { status: "cancelled" });
      setInterviews(
        interviews.map((i) =>
          i.id === interviewId ? { ...i, status: "cancelled" } : i,
        ),
      );
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const filteredInterviews = interviews.filter((interview) => {
    const matchStatus =
      statusFilter === "all" || interview.status === statusFilter;
    const matchType = typeFilter === "all" || interview.type === typeFilter;
    return matchStatus && matchType;
  });

  const stats = {
    total: interviews.length,
    completed: interviews.filter((i) => i.status === "completed").length,
    scheduled: interviews.filter((i) => i.status === "scheduled").length,
    cancelled: interviews.filter((i) => i.status === "cancelled").length,
    pending_approval: clientRequests.filter((r) => r.status === "pending")
      .length,
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Interview Management
          </h1>
          <p className="text-gray-600 mt-1">
            Submit candidates → AM → Client Approval → Interview
          </p>
        </div>
        <button
          onClick={() => setSubmitModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
        >
          + Submit Candidates
        </button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: "Total Interviews", value: stats.total, color: "blue" },
          { label: "Scheduled", value: stats.scheduled, color: "yellow" },
          { label: "Completed", value: stats.completed, color: "green" },
          { label: "Cancelled", value: stats.cancelled, color: "red" },
          {
            label: "Pending Approval",
            value: stats.pending_approval,
            color: "purple",
          },
        ].map((stat, idx) => (
          <div
            key={idx}
            className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500"
          >
            <p className="text-gray-600 text-xs font-semibold">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* CLIENT APPROVAL REQUESTS SECTION */}
      {clientRequests.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-amber-900 mb-3">
            ⏳ Pending Client Approvals ({clientRequests.length})
          </h3>
          <div className="space-y-2">
            {clientRequests
              .filter((r) => r.status === "pending")
              .slice(0, 3)
              .map((request) => (
                <div
                  key={request.id}
                  className="bg-white p-3 rounded flex justify-between items-center"
                >
                  <div className="text-sm">
                    <p className="font-medium text-gray-900">
                      {request.job_title}
                    </p>
                    <p className="text-gray-600">
                      {request.candidate_count} candidate(s) submitted on{" "}
                      {new Date(request.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs rounded font-medium">
                    Awaiting Client
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* FILTERS */}
      <div className="bg-white p-4 rounded-lg shadow mb-6 flex gap-4 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Types</option>
          <option value="phone">Phone</option>
          <option value="video">Video</option>
          <option value="in_person">In-Person</option>
          <option value="group">Group</option>
          <option value="panel">Panel</option>
        </select>

        <button
          onClick={() => {
            setStatusFilter("all");
            setTypeFilter("all");
          }}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
        >
          Clear
        </button>
      </div>

      {/* INTERVIEWS GRID */}
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Scheduled Interviews
      </h2>
      {filteredInterviews.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInterviews.map((interview) => (
            <InterviewCard
              key={interview.id}
              interview={interview}
              onReschedule={() => setRescheduleModal(interview)}
              onFeedback={() => setFeedbackModal(interview)}
              onCancel={handleCancel}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white p-12 rounded-lg text-center">
          <p className="text-gray-600 text-lg">
            No interviews scheduled yet. Submit candidates first!
          </p>
        </div>
      )}

      {/* MODALS */}
      {submitModal && (
        <SubmitCandidatesModal
          jobs={jobs}
          candidates={candidates}
          onSubmit={handleSubmitCandidates}
          onClose={() => setSubmitModal(false)}
        />
      )}

      {feedbackModal && (
        <FeedbackModal
          interview={feedbackModal}
          onSave={handleSaveFeedback}
          onClose={() => setFeedbackModal(null)}
        />
      )}

      {rescheduleModal && (
        <RescheduleModal
          interview={rescheduleModal}
          onSave={handleReschedule}
          onClose={() => setRescheduleModal(null)}
        />
      )}
    </div>
  );
}
