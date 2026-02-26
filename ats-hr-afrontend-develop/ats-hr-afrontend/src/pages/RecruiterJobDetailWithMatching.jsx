import React, { useState } from "react";
import CandidatesWithMatching from "@/components/matching/CandidatesWithMatching";
import CandidateMatchingBadge from "@/components/matching/CandidateMatchingBadge";
import MatchingResultPanel from "@/components/matching/MatchingResultPanel";
import { apiService } from "@/api/axios";
import { AlertCircle, CheckCircle2, Briefcase } from "lucide-react";

/**
 * INTEGRATION EXAMPLE: RecruiterJobDetailWithMatching
 *
 * This example shows how to integrate the candidate matching system
 * into an existing job detail component.
 *
 * Key Features:
 * - Display job details
 * - Show candidates with match scores
 * - Add candidates with automatic matching
 * - View detailed matching results
 */

export default function RecruiterJobDetailWithMatching({ jobId }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addingCandidate, setAddingCandidate] = useState(false);
  const [selectedCandidateMatch, setSelectedCandidateMatch] = useState(null);
  const [showMatchDetails, setShowMatchDetails] = useState(false);
  const [notification, setNotification] = useState(null);

  // Load job details on mount
  React.useEffect(() => {
    const loadJob = async () => {
      try {
        const response = await apiService.get(`/api/jobs/${jobId}`);
        setJob(response.data);
        setLoading(false);
      } catch (error) {
        console.error("Failed to load job:", error);
        setNotification({
          type: "error",
          message: "Failed to load job details",
        });
        setLoading(false);
      }
    };

    loadJob();
  }, [jobId]);

  const handleCandidateSelect = async (candidateId) => {
    try {
      setAddingCandidate(true);

      // Step 1: Add candidate to job
      await apiService.post(`/api/jobs/${jobId}/candidates`, {
        candidate_id: candidateId,
      });

      // Step 2: Get matching result
      const matchResult = await apiService.post("/api/matching/evaluate", {
        job_id: jobId,
        candidate_id: candidateId,
      });

      // Step 3: Show success notification with match score
      setNotification({
        type: "success",
        message: `Candidate added! Match Score: ${matchResult.data.match_score}% - ${matchResult.data.fit_label}`,
      });

      // Optional: Show detailed results
      setSelectedCandidateMatch(matchResult.data);
      setShowMatchDetails(true);

      // Clear notification after 5 seconds
      setTimeout(() => setNotification(null), 5000);
    } catch (error) {
      console.error("Error adding candidate:", error);
      setNotification({
        type: "error",
        message: error.response?.data?.detail || "Failed to add candidate",
      });
    } finally {
      setAddingCandidate(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading job details...</div>;
  }

  if (!job) {
    return <div className="p-8 text-center text-red-600">Job not found</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-4 rounded-lg flex items-center space-x-3 ${
            notification.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Job Header */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {job.title}
            </h1>
            <div className="flex items-center space-x-4 text-gray-600">
              <span className="flex items-center">
                <Briefcase className="w-4 h-4 mr-2" />
                {job.job_id}
              </span>
              <span>{job.department || "N/A"}</span>
              <span>{job.location || "Remote"}</span>
            </div>
          </div>
          <div
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              job.status === "active"
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            {job.status}
          </div>
        </div>

        {/* Job Description */}
        {job.description && (
          <div className="mt-4">
            <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
            <p className="text-gray-700 whitespace-pre-line max-h-40 overflow-y-auto">
              {job.description}
            </p>
          </div>
        )}

        {/* Job Requirements */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200">
          {job.skills && job.skills.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">
                Required Skills
              </h4>
              <div className="flex flex-wrap gap-2">
                {job.skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {job.min_experience !== undefined && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Experience</h4>
              <p className="text-gray-700">
                {job.min_experience} - {job.max_experience || "No Max"} years
              </p>
            </div>
          )}

          {job.salary_range && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Salary Range</h4>
              <p className="text-gray-700">{job.salary_range}</p>
            </div>
          )}
        </div>
      </div>

      {/* Candidates Section with Matching */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            Candidates for this Job
          </h2>
          <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
            AI-Powered Matching
          </span>
        </div>

        {/* Info Box */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">💡 Tip:</span> Candidates are ranked
            by AI-powered matching using skills, experience, and semantic
            analysis. Click "View Details" to see the matching breakdown.
          </p>
        </div>

        {/* Candidates List Component */}
        <CandidatesWithMatching
          jobId={jobId}
          onCandidateSelect={handleCandidateSelect}
        />
      </div>

      {/* Match Details Modal */}
      {showMatchDetails && selectedCandidateMatch && (
        <MatchingResultPanel
          matchResult={selectedCandidateMatch}
          candidateName={selectedCandidateMatch.candidate_name}
          onClose={() => setShowMatchDetails(false)}
        />
      )}

      {/* Footer Info */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-gray-900 mb-2">
          How Does AI Matching Work?
        </h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start">
            <span className="text-blue-600 font-bold mr-3">1.</span>
            <span>
              <strong>Skills Analysis:</strong> Compares candidate skills with
              job requirements (70% weight)
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 font-bold mr-3">2.</span>
            <span>
              <strong>Experience Scoring:</strong> Evaluates years of experience
              and relevance
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 font-bold mr-3">3.</span>
            <span>
              <strong>Semantic Analysis:</strong> Uses AI (Sentence-BERT) to
              understand contextual fit between job description and resume (30%
              weight)
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 font-bold mr-3">4.</span>
            <span>
              <strong>Final Score:</strong> Combines rule-based and AI insights
              for comprehensive matching
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

/**
 * USAGE IN ROUTER:
 *
 * import RecruiterJobDetailWithMatching from '@/pages/RecruiterJobDetailWithMatching';
 *
 * // In your route configuration
 * {
 *   path: '/recruiter/jobs/:jobId',
 *   element: <RecruiterJobDetailWithMatching jobId={jobId} />
 * }
 *
 * OR if using URL params:
 *
 * import { useParams } from 'react-router-dom';
 *
 * export default function JobDetailPage() {
 *   const { jobId } = useParams();
 *   return <RecruiterJobDetailWithMatching jobId={jobId} />;
 * }
 */
