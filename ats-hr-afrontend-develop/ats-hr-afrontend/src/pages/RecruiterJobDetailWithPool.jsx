import React, { useState, useEffect } from "react";
import {
  Plus,
  AlertCircle,
  CheckCircle2,
  Briefcase,
  Users,
} from "lucide-react";
import AddCandidateFromPoolModal from "@/components/matching/AddCandidateFromPoolModal";
import CandidateMatchingBadge from "@/components/matching/CandidateMatchingBadge";
import MatchingResultPanel from "@/components/matching/MatchingResultPanel";
import { apiService } from "@/api/axios";

/**
 * RecruiterJobDetailWithPool
 *
 * Integration example showing:
 * - Job details display
 * - "Add from Pool" button that opens modal
 * - Modal with candidate selection + automatic matching
 * - List of linked candidates with match scores
 *
 * This replaces or extends existing job detail pages.
 */

export default function RecruiterJobDetailWithPool({ jobId }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [linkedCandidates, setLinkedCandidates] = useState([]);
  const [showPoolModal, setShowPoolModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [notification, setNotification] = useState(null);

  // Load job details
  useEffect(() => {
    const loadJob = async () => {
      try {
        const response = await apiService.get(`/api/jobs/${jobId}`);
        setJob(response.data);

        // Load linked candidates
        const candidatesResponse = await apiService.get(
          `/api/jobs/${jobId}/candidates`,
        );
        setLinkedCandidates(candidatesResponse.data || []);
      } catch (error) {
        console.error("Failed to load job:", error);
        setNotification({
          type: "error",
          message: "Failed to load job details",
        });
      } finally {
        setLoading(false);
      }
    };

    loadJob();
  }, [jobId]);

  // Handle successful candidate linking
  const handleCandidateLinked = (candidate, matchData) => {
    // Add to list of linked candidates
    const newLinkedCandidate = {
      ...candidate,
      match_score: matchData.adjusted_score || matchData.match_score,
      matched_skills: matchData.matched_skills,
      missing_skills: matchData.missing_skills,
      fit_label: matchData.fit_label,
    };

    setLinkedCandidates((prev) => [newLinkedCandidate, ...prev]);

    // Show success notification
    setNotification({
      type: "success",
      message: `${candidate.full_name} has been linked to the job with a ${Math.round(
        matchData.match_score,
      )}% match!`,
    });

    // Auto-hide notification after 4 seconds
    setTimeout(() => setNotification(null), 4000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading job details...</span>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700 font-medium">Job not found</p>
      </div>
    );
  }

  // Get IDs of already linked candidates to exclude from pool
  const linkedCandidateIds = linkedCandidates.map((c) => c.id);

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      {/* Notification */}
      {notification && (
        <div
          className={`p-4 rounded-lg border flex items-start gap-3 ${
            notification.type === "success"
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <p
            className={
              notification.type === "success"
                ? "text-green-800"
                : "text-red-800"
            }
          >
            {notification.message}
          </p>
        </div>
      )}

      {/* Job Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{job.title}</h1>
            <p className="text-gray-600 mt-2">{job.company_name}</p>
          </div>
          <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full font-medium">
            {job.status || "Open"}
          </span>
        </div>

        {/* Job Details Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200">
          <div>
            <p className="text-sm text-gray-600">Location</p>
            <p className="font-semibold text-gray-900">{job.location}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Experience</p>
            <p className="font-semibold text-gray-900">
              {job.min_experience}-{job.max_experience}y
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Department</p>
            <p className="font-semibold text-gray-900">{job.department}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Posted</p>
            <p className="font-semibold text-gray-900">
              {new Date(job.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Job Description */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h2 className="font-semibold text-gray-900 mb-3">Description</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{job.description}</p>
        </div>

        {/* Required Skills */}
        {job.skills && job.skills.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h2 className="font-semibold text-gray-900 mb-3">
              Required Skills
            </h2>
            <div className="flex flex-wrap gap-2">
              {job.skills.map((skill, idx) => (
                <span
                  key={idx}
                  className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Candidates Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={28} />
            Linked Candidates ({linkedCandidates.length})
          </h2>
          <button
            onClick={() => setShowPoolModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            <Plus size={20} />
            Add from Pool
          </button>
        </div>

        {/* Candidates List */}
        {linkedCandidates.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Users className="mx-auto text-gray-400 mb-3" size={40} />
            <p className="text-gray-600 font-medium">
              No candidates linked yet
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Click "Add from Pool" to start adding candidates
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {linkedCandidates.map((candidate) => (
              <div
                key={candidate.id}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-baseline gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {candidate.full_name}
                      </h3>
                      {candidate.match_score && (
                        <CandidateMatchingBadge
                          matchScore={candidate.match_score}
                          fitLabel={candidate.fit_label}
                          size="sm"
                        />
                      )}
                    </div>

                    <p className="text-sm text-gray-600 mt-1">
                      {candidate.email}
                      {candidate.phone_number && (
                        <> • {candidate.phone_number}</>
                      )}
                    </p>

                    <p className="text-sm text-gray-700 mt-2">
                      <span className="font-medium">Experience:</span>{" "}
                      {candidate.experience_years} years
                    </p>

                    {/* Matched Skills */}
                    {candidate.matched_skills && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-green-700 mb-1">
                          Matched Skills:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {candidate.matched_skills.map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs"
                            >
                              ✓ {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Missing Skills */}
                    {candidate.missing_skills &&
                      candidate.missing_skills.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-red-700 mb-1">
                            Missing Skills:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {candidate.missing_skills.map((skill, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs"
                              >
                                ✗ {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>

                  {/* Actions */}
                  <div className="ml-4 flex gap-2">
                    {candidate.match_score && (
                      <button
                        onClick={() => setSelectedMatch(candidate)}
                        className="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        View Details
                      </button>
                    )}
                    <button className="px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
                      Proceed
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Match Details Modal */}
      {selectedMatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-900">
                Match Details - {selectedMatch.full_name}
              </h2>
              <button
                onClick={() => setSelectedMatch(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <MatchingResultPanel
                candidate={selectedMatch}
                job={job}
                matchData={{
                  match_score: selectedMatch.match_score,
                  fit_label: selectedMatch.fit_label,
                  matched_skills: selectedMatch.matched_skills,
                  missing_skills: selectedMatch.missing_skills,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Add from Pool Modal */}
      <AddCandidateFromPoolModal
        jobId={jobId}
        jobDetails={job}
        isOpen={showPoolModal}
        onClose={() => setShowPoolModal(false)}
        onCandidateLinked={handleCandidateLinked}
        excludeCandidateIds={linkedCandidateIds}
      />
    </div>
  );
}
