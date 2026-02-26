import React, { useState } from "react";
import { X, ChevronRight, Loader } from "lucide-react";
import CandidatePoolSelector from "./CandidatePoolSelector";
import MatchingCriteriaPanelFull from "./MatchingCriteriaPanelFull";
import { apiService } from "@/api/axios";

/**
 * AddCandidateFromPoolModal Component
 *
 * Full workflow for adding a candidate from the pool to a job:
 * 1. Show candidate pool with search/filter
 * 2. On selection, calculate matching criteria
 * 3. Display detailed matching breakdown
 * 4. Allow recruiter to confirm or adjust
 * 5. Link candidate to job
 *
 * Props:
 * - jobId (required) - The job to link candidate to
 * - jobDetails (required) - Job object with skills, experience, description
 * - isOpen - Modal visibility
 * - onClose() - Called when modal closes
 * - onCandidateLinked(candidate, matchData) - Called after successful link
 * - excludeCandidateIds - Array of candidate IDs already linked to this job
 */

export default function AddCandidateFromPoolModal({
  jobId,
  jobDetails,
  isOpen,
  onClose,
  onCandidateLinked,
  excludeCandidateIds = [],
}) {
  // Step 1: Select candidate from pool
  // Step 2: View matching criteria
  const [step, setStep] = useState(1);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [matchData, setMatchData] = useState(null);
  const [isLoadingMatch, setIsLoadingMatch] = useState(false);
  const [matchError, setMatchError] = useState(null);
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState(null);

  if (!isOpen) return null;

  // Handle candidate selection from pool
  const handleCandidateSelect = async (candidate) => {
    setSelectedCandidate(candidate);
    setIsLoadingMatch(true);
    setMatchError(null);
    setMatchData(null);

    try {
      // Call matching API
      const response = await apiService.post("/api/matching/evaluate", {
        candidate_id: candidate.id,
        job_id: jobId,
      });

      setMatchData(response.data);
      setStep(2); // Move to matching criteria step
    } catch (error) {
      console.error("Failed to calculate match:", error);
      setMatchError(
        error.response?.data?.detail ||
          "Failed to calculate matching criteria. Please try again.",
      );
    } finally {
      setIsLoadingMatch(false);
    }
  };

  // Handle confirmation of match and linking candidate
  const handleConfirmMatch = async (finalMatchData) => {
    if (!selectedCandidate || !jobId) return;

    setIsLinking(true);
    setLinkError(null);

    try {
      // Link candidate to job
      // This would call an endpoint like POST /api/jobs/{jobId}/candidates
      // with the candidate and match data
      const response = await apiService.post(`/api/jobs/${jobId}/candidates`, {
        candidate_id: selectedCandidate.id,
        match_score:
          finalMatchData.adjusted_score || finalMatchData.match_score,
        matched_skills: finalMatchData.matched_skills,
        missing_skills: finalMatchData.missing_skills,
      });

      // Success - notify parent and close modal
      if (onCandidateLinked) {
        onCandidateLinked(selectedCandidate, finalMatchData);
      }

      // Reset and close
      resetModal();
      onClose();
    } catch (error) {
      console.error("Failed to link candidate:", error);
      setLinkError(
        error.response?.data?.detail ||
          "Failed to link candidate to job. Please try again.",
      );
    } finally {
      setIsLinking(false);
    }
  };

  const resetModal = () => {
    setStep(1);
    setSelectedCandidate(null);
    setMatchData(null);
    setMatchError(null);
    setLinkError(null);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {step === 1 ? "Add Candidate from Pool" : "Review Match Criteria"}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {step === 1
                ? "Select a candidate to see how they match with the job requirements"
                : "Review and confirm the match before linking the candidate"}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex items-center gap-4">
            {/* Step 1: Select Candidate */}
            <div className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= 1
                    ? "bg-blue-600 text-white"
                    : "bg-gray-300 text-gray-600"
                }`}
              >
                1
              </div>
              <span className="ml-2 text-sm font-medium text-gray-700">
                Select
              </span>
            </div>

            {/* Connector */}
            <div
              className={`flex-1 h-1 ${
                step >= 2 ? "bg-blue-600" : "bg-gray-300"
              }`}
            ></div>

            {/* Step 2: Review Match */}
            <div className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= 2
                    ? "bg-blue-600 text-white"
                    : "bg-gray-300 text-gray-600"
                }`}
              >
                2
              </div>
              <span className="ml-2 text-sm font-medium text-gray-700">
                Review
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Candidate Pool Selection */}
          {step === 1 && (
            <div>
              <CandidatePoolSelector
                onSelectCandidate={handleCandidateSelect}
                excludeCandidateIds={excludeCandidateIds}
                limit={50}
              />

              {/* Loading State */}
              {isLoadingMatch && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
                  <Loader className="animate-spin text-blue-600" size={20} />
                  <span className="text-blue-700">
                    Calculating match criteria...
                  </span>
                </div>
              )}

              {/* Error State */}
              {matchError && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 font-medium">Error</p>
                  <p className="text-sm text-red-600 mt-1">{matchError}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Match Criteria Review */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Selected Candidate Info */}
              {selectedCandidate && (
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-gray-900 text-lg">
                    {selectedCandidate.full_name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedCandidate.email}
                  </p>
                  <p className="text-sm text-gray-600">
                    {selectedCandidate.experience_years} years experience
                  </p>
                  {selectedCandidate.skills &&
                    selectedCandidate.skills.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedCandidate.skills
                          .slice(0, 4)
                          .map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-white text-blue-700 rounded text-xs font-medium"
                            >
                              {skill}
                            </span>
                          ))}
                        {selectedCandidate.skills.length > 4 && (
                          <span className="px-2 py-1 bg-white text-gray-600 rounded text-xs font-medium">
                            +{selectedCandidate.skills.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                </div>
              )}

              {/* Matching Criteria Panel */}
              <MatchingCriteriaPanelFull
                matchData={matchData}
                isLoading={isLoadingMatch}
                error={matchError}
                onConfirm={handleConfirmMatch}
              />

              {/* Linking Error */}
              {linkError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 font-medium">
                    Failed to Link Candidate
                  </p>
                  <p className="text-sm text-red-600 mt-1">{linkError}</p>
                </div>
              )}

              {/* Loading indicator during linking */}
              {isLinking && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
                  <Loader className="animate-spin text-blue-600" size={20} />
                  <span className="text-blue-700">Linking candidate...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with Navigation */}
        {step === 2 && (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex gap-3 justify-end">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← Back to Pool
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
