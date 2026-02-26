/**
 * Client Submission Management Page
 * Submit candidates to clients and track submissions
 */

import React, { useState, useEffect } from "react";
import axios from "../../api/axios";

function SubmissionCard({ submission, onView, onResubmit, onWithdraw }) {
  const getStatusColor = (status) => {
    switch (status) {
      case "submitted":
        return "bg-blue-100 text-blue-700";
      case "reviewed":
        return "bg-yellow-100 text-yellow-700";
      case "accepted":
        return "bg-green-100 text-green-700";
      case "rejected":
        return "bg-red-100 text-red-700";
      case "withdrawn":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const isRecent =
    new Date(submission.created_at) >
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  return (
    <div className="bg-white border rounded-lg p-4 hover:shadow-lg transition">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="font-bold text-gray-900">
            {submission.candidate_name}
          </h3>
          <p className="text-sm text-gray-600">{submission.job_title}</p>
          <p className="text-xs text-gray-500 mt-1">
            📋 {submission.client_name}
          </p>
        </div>
        <div className="text-right">
          <span
            className={`px-2 py-1 text-xs rounded-full font-medium block ${getStatusColor(submission.status)}`}
          >
            {submission.status}
          </span>
          {isRecent && <span className="text-xs text-green-600 mt-1">New</span>}
        </div>
      </div>

      <div className="text-sm text-gray-600 space-y-1 mb-3">
        <p>
          📅 Submitted: {new Date(submission.created_at).toLocaleDateString()}
        </p>
        {submission.reviewed_date && (
          <p>
            👀 Reviewed:{" "}
            {new Date(submission.reviewed_date).toLocaleDateString()}
          </p>
        )}
        {submission.feedback && (
          <p className="text-gray-700 italic">
            💬 "{submission.feedback.substring(0, 60)}..."
          </p>
        )}
      </div>

      <div className="flex gap-2 flex-wrap text-xs">
        {submission.submission_skills && (
          <div className="flex flex-wrap gap-1">
            {submission.submission_skills.slice(0, 2).map((skill, idx) => (
              <span
                key={idx}
                className="bg-blue-100 text-blue-700 px-2 py-1 rounded"
              >
                {skill}
              </span>
            ))}
            {submission.submission_skills.length > 2 && (
              <span className="text-gray-600">
                +{submission.submission_skills.length - 2}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onView(submission.id)}
          className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded text-sm hover:bg-blue-100 font-medium"
        >
          View
        </button>

        {submission.status === "submitted" && (
          <>
            <button
              onClick={() => onResubmit(submission.id)}
              className="flex-1 px-3 py-2 bg-yellow-50 text-yellow-600 rounded text-sm hover:bg-yellow-100 font-medium"
              title="Resubmit with updated info"
            >
              Resubmit
            </button>
            <button
              onClick={() => onWithdraw(submission.id)}
              className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded text-sm hover:bg-red-100 font-medium"
            >
              Withdraw
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SubmissionDetailModal({ submission, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6 pb-4 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {submission.candidate_name}
            </h2>
            <p className="text-gray-600">{submission.job_title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-6">
          {/* HEADER INFO */}
          <div>
            <h3 className="text-xs text-gray-600 font-semibold mb-3">
              SUBMISSION DETAILS
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600">Client</p>
                <p className="font-medium text-gray-900">
                  {submission.client_name}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Status</p>
                <p className="font-medium text-gray-900 capitalize">
                  {submission.status}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Submitted</p>
                <p className="font-medium text-gray-900">
                  {new Date(submission.created_at).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Days Pending</p>
                <p className="font-medium text-gray-900">
                  {Math.floor(
                    (new Date() - new Date(submission.created_at)) /
                      (1000 * 60 * 60 * 24),
                  )}{" "}
                  days
                </p>
              </div>
            </div>
          </div>

          {/* CANDIDATE INFO */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-xs text-blue-600 font-semibold mb-3">
              CANDIDATE PROFILE
            </h3>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-gray-600">Email:</span>{" "}
                {submission.candidate_email}
              </p>
              <p>
                <span className="text-gray-600">Phone:</span>{" "}
                {submission.candidate_phone}
              </p>
              <p>
                <span className="text-gray-600">Current Employer:</span>{" "}
                {submission.candidate_current_employer}
              </p>
              <p>
                <span className="text-gray-600">Experience:</span>{" "}
                {submission.candidate_experience_years} years
              </p>
              <p>
                <span className="text-gray-600">Current Salary:</span>{" "}
                {submission.candidate_current_salary || "Not disclosed"}
              </p>
            </div>
          </div>

          {/* SKILLS */}
          {submission.submission_skills && (
            <div>
              <h3 className="text-xs text-gray-600 font-semibold mb-2">
                SUBMITTED SKILLS
              </h3>
              <div className="flex flex-wrap gap-2">
                {submission.submission_skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* CLIENT FEEDBACK */}
          {submission.feedback && (
            <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
              <h3 className="text-xs text-yellow-700 font-semibold mb-2">
                CLIENT FEEDBACK
              </h3>
              <p className="text-gray-700">{submission.feedback}</p>
              {submission.reviewed_date && (
                <p className="text-xs text-gray-600 mt-2">
                  Received on{" "}
                  {new Date(submission.reviewed_date).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {/* SUBMISSION NOTES */}
          {submission.submission_notes && (
            <div>
              <h3 className="text-xs text-gray-600 font-semibold mb-2">
                INTERNAL NOTES
              </h3>
              <div className="bg-gray-50 p-3 rounded text-sm text-gray-700">
                {submission.submission_notes}
              </div>
            </div>
          )}

          {/* TIMELINE */}
          <div className="border-t pt-4">
            <h3 className="text-xs text-gray-600 font-semibold mb-3">
              TIMELINE
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-gray-600 min-w-fit">📤 Submitted:</span>
                <span className="text-gray-900">
                  {new Date(submission.created_at).toLocaleDateString()} at{" "}
                  {new Date(submission.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {submission.reviewed_date && (
                <div className="flex gap-2">
                  <span className="text-gray-600 min-w-fit">👀 Reviewed:</span>
                  <span className="text-gray-900">
                    {new Date(submission.reviewed_date).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 font-medium"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function SubmissionFormModal({ candidates, jobs, clients, onSubmit, onClose }) {
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [selectedJob, setSelectedJob] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!selectedCandidate || !selectedJob || !selectedClient) {
      alert("Please select candidate, job, and client");
      return;
    }
    try {
      setSaving(true);
      await onSubmit({
        candidate_id: selectedCandidate,
        job_id: selectedJob,
        client_id: selectedClient,
        notes: notes,
      });
      alert("Submission created!");
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
        <h2 className="text-2xl font-bold mb-4">Submit Candidate to Client</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Candidate
            </label>
            <select
              value={selectedCandidate}
              onChange={(e) => setSelectedCandidate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select candidate...</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} ({c.current_location})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Job Opening
            </label>
            <select
              value={selectedJob}
              onChange={(e) => setSelectedJob(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select job...</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} ({j.location})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Client
            </label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select client...</option>
              {clients.map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Internal Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add submission notes..."
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
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClientSubmission() {
  const [submissions, setSubmissions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailModal, setDetailModal] = useState(null);
  const [submitModal, setSubmitModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [subRes, candRes, jobRes, clientRes] = await Promise.all([
        axios.get("/v1/candidate-submissions"),
        axios.get("/v1/candidates"),
        axios.get("/v1/jobs"),
        axios.get("/v1/clients"),
      ]);
      setSubmissions(
        Array.isArray(subRes.data) ? subRes.data : subRes.data?.data || [],
      );
      setCandidates(
        Array.isArray(candRes.data) ? candRes.data : candRes.data?.data || [],
      );
      setJobs(
        Array.isArray(jobRes.data) ? jobRes.data : jobRes.data?.data || [],
      );
      setClients(
        Array.isArray(clientRes.data)
          ? clientRes.data
          : clientRes.data?.data || [],
      );
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCandidate = async (data) => {
    try {
      const res = await axios.post("/v1/candidate-submissions", data);
      setSubmissions([res.data, ...submissions]);
      setSubmitModal(false);
    } catch (err) {
      throw err;
    }
  };

  const handleResubmit = async (submissionId) => {
    if (!window.confirm("Resubmit this candidate?")) return;
    try {
      const submission = submissions.find((s) => s.id === submissionId);
      await axios.post(`/v1/candidate-submissions/${submissionId}/resubmit`, {
        notes: "Resubmitted with updated information",
      });
      setSubmissions(
        submissions.map((s) =>
          s.id === submissionId ? { ...s, status: "submitted" } : s,
        ),
      );
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleWithdraw = async (submissionId) => {
    if (!window.confirm("Withdraw this submission?")) return;
    try {
      await axios.put(`/v1/candidate-submissions/${submissionId}`, {
        status: "withdrawn",
      });
      setSubmissions(
        submissions.map((s) =>
          s.id === submissionId ? { ...s, status: "withdrawn" } : s,
        ),
      );
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const filteredSubmissions = submissions.filter(
    (sub) => statusFilter === "all" || sub.status === statusFilter,
  );

  const stats = {
    total: submissions.length,
    submitted: submissions.filter((s) => s.status === "submitted").length,
    accepted: submissions.filter((s) => s.status === "accepted").length,
    rejected: submissions.filter((s) => s.status === "rejected").length,
  };

  if (loading)
    return <div className="p-6 text-center">Loading submissions...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Client Submissions
          </h1>
          <p className="text-gray-600 mt-1">
            Track candidate submissions to clients
          </p>
        </div>
        <button
          onClick={() => setSubmitModal(true)}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium"
        >
          + New Submission
        </button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total", value: stats.total, color: "blue" },
          { label: "Submitted", value: stats.submitted, color: "yellow" },
          { label: "Accepted", value: stats.accepted, color: "green" },
          { label: "Rejected", value: stats.rejected, color: "red" },
        ].map((stat, idx) => (
          <div
            key={idx}
            className={`bg-${stat.color}-50 p-4 rounded-lg border border-${stat.color}-200`}
          >
            <p className={`text-${stat.color}-600 text-xs font-semibold`}>
              {stat.label}
            </p>
            <p className={`text-${stat.color}-600 text-2xl font-bold`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* FILTERS */}
      <div className="bg-white p-4 rounded-lg shadow mb-6 flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="submitted">Submitted</option>
          <option value="reviewed">Reviewed</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="withdrawn">Withdrawn</option>
        </select>

        <button
          onClick={() => setStatusFilter("all")}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
        >
          Clear Filters
        </button>
      </div>

      {/* SUBMISSIONS GRID */}
      {filteredSubmissions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSubmissions.map((submission) => (
            <SubmissionCard
              key={submission.id}
              submission={submission}
              onView={() => setDetailModal(submission)}
              onResubmit={handleResubmit}
              onWithdraw={handleWithdraw}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white p-12 rounded-lg text-center">
          <p className="text-gray-600 text-lg">No submissions found</p>
        </div>
      )}

      {/* MODALS */}
      {detailModal && (
        <SubmissionDetailModal
          submission={detailModal}
          onClose={() => setDetailModal(null)}
        />
      )}

      {submitModal && (
        <SubmissionFormModal
          candidates={candidates}
          jobs={jobs}
          clients={clients || []}
          onSubmit={handleSubmitCandidate}
          onClose={() => setSubmitModal(false)}
        />
      )}
    </div>
  );
}
