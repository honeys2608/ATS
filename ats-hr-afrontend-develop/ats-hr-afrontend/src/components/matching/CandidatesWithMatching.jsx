import React, { useState, useEffect } from "react";
import { apiService } from "../../api/axios";
import CandidateMatchingBadge from "./CandidateMatchingBadge";
import MatchingResultPanel from "./MatchingResultPanel";
import { TrendingUp, Loader } from "lucide-react";

/**
 * CandidatesWithMatching
 * Displays a list of candidates with their match scores for a specific job
 * Allows sorting and filtering by match quality
 *
 * Props:
 * - jobId: string - The job ID to fetch candidates for
 * - onCandidateSelect: function(candidateId) - Called when a candidate is selected
 */
const CandidatesWithMatching = ({ jobId, onCandidateSelect }) => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState("match_score");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [matchDetails, setMatchDetails] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  // Fetch candidates with match scores
  useEffect(() => {
    if (!jobId) return;

    const fetchCandidates = async () => {
      try {
        setLoading(true);
        const response = await apiService.get(
          `/api/matching/jobs/${jobId}/candidates-with-scores`,
          {
            params: {
              sort_by: sortBy,
              sort_order: sortOrder,
            },
          },
        );
        setCandidates(response.data);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch candidates with matching:", err);
        setError("Failed to load candidates with match scores");
        setCandidates([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCandidates();
  }, [jobId, sortBy, sortOrder]);

  const handleViewDetails = async (candidate) => {
    setSelectedCandidate(candidate);
    // The match details are already included in the candidate object
    setMatchDetails(candidate);
    setShowDetails(true);
  };

  const handleCloseDetails = () => {
    setShowDetails(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader className="w-6 h-6 text-blue-600 animate-spin mr-2" />
        <span>Loading candidates...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="p-6 text-center bg-gray-50 rounded-lg">
        <p className="text-gray-600">No candidates found for this job</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sorting Controls */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="match_score">Match Score</option>
            <option value="fit_label">Fit Label</option>
            <option value="name">Name</option>
          </select>

          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="desc">Highest First</option>
            <option value="asc">Lowest First</option>
          </select>
        </div>

        <div className="text-sm text-gray-600">
          <TrendingUp className="w-4 h-4 inline mr-2" />
          {candidates.length} candidates
        </div>
      </div>

      {/* Candidates List */}
      <div className="space-y-3">
        {candidates.map((candidate) => (
          <div
            key={candidate.candidate_id}
            className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {candidate.candidate_name}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {candidate.candidate_email}
                    </p>
                  </div>
                </div>

                {/* Skills Summary */}
                <div className="mt-3 space-y-2">
                  {candidate.matched_skills.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">
                        Matched Skills ({candidate.matched_skills.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {candidate.matched_skills
                          .slice(0, 3)
                          .map((skill, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800"
                            >
                              {skill}
                            </span>
                          ))}
                        {candidate.matched_skills.length > 3 && (
                          <span className="text-xs text-gray-600 px-2 py-1">
                            +{candidate.matched_skills.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {candidate.missing_skills.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">
                        Missing Skills ({candidate.missing_skills.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {candidate.missing_skills
                          .slice(0, 2)
                          .map((skill, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800"
                            >
                              {skill}
                            </span>
                          ))}
                        {candidate.missing_skills.length > 2 && (
                          <span className="text-xs text-gray-600 px-2 py-1">
                            +{candidate.missing_skills.length - 2} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-gray-600 mt-1">
                    <span className="font-medium">Experience:</span>{" "}
                    {candidate.experience_match}
                  </p>
                </div>
              </div>

              {/* Match Badge and Actions */}
              <div className="flex flex-col items-end space-y-3">
                <CandidateMatchingBadge
                  matchScore={candidate.match_score}
                  fitLabel={candidate.fit_label}
                  size="md"
                />

                <button
                  onClick={() => handleViewDetails(candidate)}
                  className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  View Details
                </button>

                {onCandidateSelect && (
                  <button
                    onClick={() => onCandidateSelect(candidate.candidate_id)}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                  >
                    Select
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Details Modal */}
      {showDetails && matchDetails && (
        <MatchingResultPanel
          matchResult={matchDetails}
          candidateName={matchDetails.candidate_name}
          onClose={handleCloseDetails}
        />
      )}
    </div>
  );
};

export default CandidatesWithMatching;
