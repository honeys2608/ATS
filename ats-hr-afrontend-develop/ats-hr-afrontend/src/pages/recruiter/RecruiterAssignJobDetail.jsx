// src/pages/recruiter/RecruiterAssignJobDetail.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getRecruiterJobDetail,
  getJobCandidatePool,
  sendJobCandidatesToAM,
} from "../../services/jobService";
import {
  FiArrowLeft,
  FiAward,
  FiBriefcase,
  FiMapPin,
  FiDollarSign,
  FiCheck,
  FiX,
  FiLoader,
} from "react-icons/fi";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function RecruiterAssignJobDetail() {
  const { id: jobId } = useParams();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidates, setSelectedCandidates] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCandidatePool, setShowCandidatePool] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load job details
  useEffect(() => {
    loadJobDetails();
  }, [jobId]);

  async function loadJobDetails() {
    try {
      setError("");
      setLoading(true);
      const res = await getRecruiterJobDetail(jobId);
      const jobData = res.data || res.data?.data;
      console.log("✅ Job loaded:", jobData);
      if (!jobData) {
        throw new Error("No job data in response");
      }
      setJob(jobData);
    } catch (err) {
      console.error("❌ Job load error:", err);
      const errorMsg =
        err.response?.data?.detail ||
        err.message ||
        "Failed to load job details";
      setError(errorMsg);
      setJob(null);
    } finally {
      setLoading(false);
    }
  }

  // Load candidates for job
  async function loadCandidatePool() {
    if (showCandidatePool) {
      setShowCandidatePool(false);
      return;
    }

    try {
      setError("");
      setLoadingCandidates(true);
      const res = await getJobCandidatePool(jobId);
      const poolData = res.data || res.data?.data;
      setCandidates(poolData.candidates || []);
      setShowCandidatePool(true);
    } catch (err) {
      console.error("Candidate pool error:", err);
      setError("Failed to fetch candidate pool");
    } finally {
      setLoadingCandidates(false);
    }
  }

  // Handle candidate selection
  function toggleCandidate(candidateId) {
    const newSelected = new Set(selectedCandidates);
    if (newSelected.has(candidateId)) {
      newSelected.delete(candidateId);
    } else {
      newSelected.add(candidateId);
    }
    setSelectedCandidates(newSelected);
  }

  // Handle send to AM
  async function handleSendToAM() {
    if (selectedCandidates.size === 0) {
      setError("Please select at least one candidate");
      return;
    }

    try {
      setError("");
      setSuccess("");
      setSubmitting(true);
      const res = await sendJobCandidatesToAM(
        jobId,
        Array.from(selectedCandidates),
      );
      const resData = res.data || res.data?.data;
      setSuccess(
        `Successfully sent ${resData.total_submitted} candidates to Account Manager`,
      );
      setSelectedCandidates(new Set());
      // Reload candidates to refresh list
      setTimeout(() => {
        loadCandidatePool();
      }, 1000);
    } catch (err) {
      console.error("Send to AM error:", err);
      setError(err.response?.data?.detail || "Failed to send candidates");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <FiLoader className="animate-spin text-4xl text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Loading job details...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
        >
          <FiArrowLeft /> Back
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="font-bold text-lg mb-2 text-red-600">
            ⚠️ Error Loading Job
          </h2>
          <p className="text-red-700 mb-4">{error || "Job not found"}</p>
          <button
            onClick={loadJobDetails}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
        >
          <FiArrowLeft /> Back to Jobs
        </button>
      </div>

      {/* Error and Success Messages */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 text-green-600 flex items-center gap-2">
          <FiCheck className="text-lg" /> {success}
        </div>
      )}

      {/* Job Details Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Title and Basic Info */}
          <div className="lg:col-span-2">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {job.title}
            </h1>
            <div className="flex flex-wrap gap-4 text-sm">
              {job.location && (
                <div className="flex items-center gap-2 text-gray-600">
                  <FiMapPin /> {job.location}
                </div>
              )}
              {job.job_type && (
                <div className="flex items-center gap-2 text-gray-600">
                  <FiBriefcase /> {job.job_type}
                </div>
              )}
              {job.department && (
                <div className="text-gray-600">📋 {job.department}</div>
              )}
            </div>
          </div>

          {/* Account Manager Info */}
          <div className="lg:col-span-1 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">
              Account Manager
            </h3>
            <p className="font-bold text-gray-900">
              {job.account_manager?.am_name || "Unassigned"}
            </p>
            {job.account_manager?.am_email && (
              <p className="text-sm text-gray-600">
                {job.account_manager.am_email}
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        {job.description && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
            <p className="text-gray-700 whitespace-pre-line line-clamp-3">
              {job.description}
            </p>
          </div>
        )}

        {/* Skills Required */}
        {job.skills && job.skills.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FiAward /> Required Skills
            </h3>
            <div className="flex flex-wrap gap-2">
              {(Array.isArray(job.skills) ? job.skills : []).map(
                (skill, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                  >
                    {skill}
                  </span>
                ),
              )}
            </div>
          </div>
        )}

        {/* Job Meta */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {job.min_experience !== undefined && (
            <div>
              <p className="text-xs text-gray-600 font-semibold">
                MIN EXPERIENCE
              </p>
              <p className="text-lg font-bold text-gray-900">
                {job.min_experience} years
              </p>
            </div>
          )}
          {job.max_experience && (
            <div>
              <p className="text-xs text-gray-600 font-semibold">
                MAX EXPERIENCE
              </p>
              <p className="text-lg font-bold text-gray-900">
                {job.max_experience} years
              </p>
            </div>
          )}
          {job.salary_range && (
            <div>
              <p className="text-xs text-gray-600 font-semibold">
                SALARY RANGE
              </p>
              <p className="text-lg font-bold text-gray-900">
                {job.salary_range}
              </p>
            </div>
          )}
          {job.status && (
            <div>
              <p className="text-xs text-gray-600 font-semibold">STATUS</p>
              <span className="inline-block px-2 py-1 bg-green-100 text-green-700 rounded text-sm font-bold">
                {job.status.toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Candidate Pool Section */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Header */}
        <div
          onClick={loadCandidatePool}
          className="p-6 cursor-pointer hover:bg-gray-50 transition flex items-center justify-between border-b"
        >
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              📋 Candidate Pool & Assignment
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Select candidates to send to{" "}
              {job.account_manager?.am_name || "Account Manager"}
            </p>
          </div>
          <div className="text-gray-600">
            {showCandidatePool ? (
              <ChevronUp className="h-6 w-6" />
            ) : (
              <ChevronDown className="h-6 w-6" />
            )}
          </div>
        </div>

        {/* Content */}
        {showCandidatePool && (
          <div className="p-6">
            {loadingCandidates ? (
              <div className="flex items-center justify-center py-8">
                <FiLoader className="animate-spin text-2xl text-blue-600 mr-3" />
                <span className="text-gray-600">
                  Matching candidates with job...
                </span>
              </div>
            ) : candidates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No candidates available in the pool</p>
              </div>
            ) : (
              <>
                {/* Candidates List */}
                <div className="space-y-3 mb-6">
                  {candidates.map((candidate) => {
                    const rawMatch =
                      candidate.match_score ?? candidate.match_percentage ?? 0;
                    const matchValue = Number(rawMatch);
                    const matchScore = Number.isFinite(matchValue)
                      ? Math.round(matchValue)
                      : 0;
                    const fitLabel = candidate.fit_label;
                    const matchTone =
                      matchScore >= 80
                        ? "bg-green-100 text-green-700"
                        : matchScore >= 50
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-700";
                    const matchBar =
                      matchScore >= 80
                        ? "bg-green-500"
                        : matchScore >= 50
                          ? "bg-yellow-500"
                          : "bg-gray-400";

                    return (
                    <div
                      key={candidate.candidate_id}
                      className={`border rounded-lg p-4 transition ${
                        selectedCandidates.has(candidate.candidate_id)
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={selectedCandidates.has(
                            candidate.candidate_id,
                          )}
                          onChange={() =>
                            toggleCandidate(candidate.candidate_id)
                          }
                          className="w-5 h-5 mt-1 rounded cursor-pointer"
                        />

                        {/* Candidate Info */}
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-bold text-gray-900">
                                {candidate.full_name}
                              </h4>
                              <p className="text-xs text-gray-500">
                                ID: {candidate.public_id}
                              </p>
                            </div>

                            {/* Match Badge */}
                            <div
                              className={`px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 ${matchTone}`}
                            >
                              <FiCheck className="h-4 w-4" />
                              {matchScore}% Match
                            </div>
                          </div>

                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${matchBar}`}
                                style={{ width: `${Math.min(100, Math.max(0, matchScore))}%` }}
                              />
                            </div>
                            {fitLabel && (
                              <span className="text-xs font-semibold text-gray-600">
                                {fitLabel}
                              </span>
                            )}
                          </div>

                          {/* Contact & Details */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                            <div>
                              <p className="text-xs text-gray-500">Email</p>
                              <p className="text-gray-700">{candidate.email}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Phone</p>
                              <p className="text-gray-700">{candidate.phone}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">
                                Experience
                              </p>
                              <p className="text-gray-700">
                                {candidate.experience_years} years
                                {candidate.experience_match && (
                                  <span className="ml-1 text-green-600">✓</span>
                                )}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Location</p>
                              <p className="text-gray-700">
                                {candidate.current_location || "—"}
                              </p>
                            </div>
                          </div>

                          {/* Skills */}
                          <div className="mb-2">
                            <p className="text-xs text-gray-500 mb-1 font-semibold">
                              Skills
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {/* Matched Skills */}
                              {candidate.matched_skills?.map((skill, idx) => (
                                <span
                                  key={`matched-${idx}`}
                                  className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium flex items-center gap-1"
                                >
                                  <FiCheck className="h-3 w-3" /> {skill}
                                </span>
                              ))}
                              {/* Unmatched Skills */}
                              {candidate.unmatched_skills?.map((skill, idx) => (
                                <span
                                  key={`unmatched-${idx}`}
                                  className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium text-opacity-70"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )})}
                </div>

                {/* Action Buttons */}
                {selectedCandidates.size > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="text-blue-900 font-semibold">
                        {selectedCandidates.size} candidate
                        {selectedCandidates.size > 1 ? "s" : ""} selected
                      </p>
                      <p className="text-sm text-blue-700">
                        Ready to send to{" "}
                        {job.account_manager?.am_name || "Account Manager"}
                      </p>
                    </div>
                    <button
                      onClick={handleSendToAM}
                      disabled={submitting}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <FiLoader className="animate-spin" /> Sending...
                        </>
                      ) : (
                        <>
                          <FiCheck /> Send to Account Manager
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
