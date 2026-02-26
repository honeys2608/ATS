import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Loader,
  AlertCircle,
  TrendingUp,
} from "lucide-react";

/**
 * MatchingCriteriaPanelFull Component
 *
 * Displays detailed matching criteria with:
 * - Overall match percentage
 * - Expandable sections (Skills, Experience, Semantic)
 * - Matched and missing skills
 * - Manual adjustment options
 * - Confirmation button
 *
 * Props:
 * - matchData (required) - Result from /api/matching/evaluate
 * - onConfirm(matchData) - Called when recruiter confirms match
 * - isLoading - Show loading state
 * - error - Error message if any
 */

export default function MatchingCriteriaPanelFull({
  matchData,
  onConfirm,
  isLoading = false,
  error = null,
}) {
  const [expandedSections, setExpandedSections] = useState({
    overall: true,
    skills: true,
    experience: false,
    semantic: false,
  });

  const [adjustedScore, setAdjustedScore] = useState(
    matchData?.match_score || 0,
  );

  // Update adjusted score when match data changes
  useEffect(() => {
    if (matchData?.match_score) {
      setAdjustedScore(matchData.match_score);
    }
  }, [matchData]);

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getColorClasses = (score) => {
    if (score >= 80) return "text-green-600 bg-green-50";
    if (score >= 60) return "text-blue-600 bg-blue-50";
    if (score >= 40) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  const getFitLabel = (score) => {
    if (score >= 80) return "Excellent Fit";
    if (score >= 60) return "Good Fit";
    if (score >= 40) return "Partial Fit";
    return "Poor Fit";
  };

  const getProgressColor = (score) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-blue-500";
    if (score >= 40) return "bg-yellow-500";
    return "bg-red-500";
  };

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
        <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
        <div>
          <p className="font-semibold text-red-800">Matching Error</p>
          <p className="text-sm text-red-700 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin text-blue-500" size={32} />
        <span className="ml-3 text-gray-600">Calculating match...</span>
      </div>
    );
  }

  if (!matchData) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p className="font-medium">No matching data available</p>
        <p className="text-sm">Select a candidate to view matching criteria</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-white rounded-lg border border-gray-200 p-6">
      {/* Overall Score Section - Always Visible */}
      <div
        className={`p-4 rounded-lg border-2 ${getColorClasses(adjustedScore)}`}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold">Overall Match</h3>
          <div className="text-right">
            <div className="text-3xl font-bold">
              {Math.round(adjustedScore)}%
            </div>
            <div className="text-sm opacity-75">
              {getFitLabel(adjustedScore)}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full ${getProgressColor(adjustedScore)} transition-all`}
            style={{ width: `${adjustedScore}%` }}
          ></div>
        </div>

        {/* Score Adjustment Slider */}
        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Manual Adjustment (if needed):
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="100"
              value={adjustedScore}
              onChange={(e) => setAdjustedScore(Number(e.target.value))}
              className="flex-1 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm font-semibold min-w-[45px]">
              {Math.round(adjustedScore)}%
            </span>
          </div>
          <p className="text-xs text-gray-600">
            Adjust if you have additional context about this candidate
          </p>
        </div>
      </div>

      {/* Skills Section */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection("skills")}
          className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
        >
          <span className="font-semibold text-gray-900">
            Skills Match ({matchData.skill_match?.toFixed(0)}%)
          </span>
          {expandedSections.skills ? (
            <ChevronUp size={20} />
          ) : (
            <ChevronDown size={20} />
          )}
        </button>

        {expandedSections.skills && (
          <div className="p-4 space-y-4">
            {/* Matched Skills */}
            {matchData.matched_skills &&
              matchData.matched_skills.length > 0 && (
                <div>
                  <h4 className="font-medium text-green-700 mb-2 flex items-center gap-2">
                    <Check size={16} /> Matched Skills
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {matchData.matched_skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium"
                      >
                        ✓ {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            {/* Missing Skills */}
            {matchData.missing_skills &&
              matchData.missing_skills.length > 0 && (
                <div>
                  <h4 className="font-medium text-red-700 mb-2 flex items-center gap-2">
                    <X size={16} /> Missing Skills
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {matchData.missing_skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium"
                      >
                        ✗ {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            {/* No missing skills message */}
            {(!matchData.missing_skills ||
              matchData.missing_skills.length === 0) && (
              <p className="text-sm text-green-600 font-medium">
                ✓ All required skills are present!
              </p>
            )}
          </div>
        )}
      </div>

      {/* Experience Section */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection("experience")}
          className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
        >
          <span className="font-semibold text-gray-900">
            Experience Match ({matchData.experience_score?.toFixed(0)}%)
          </span>
          {expandedSections.experience ? (
            <ChevronUp size={20} />
          ) : (
            <ChevronDown size={20} />
          )}
        </button>

        {expandedSections.experience && (
          <div className="p-4">
            <p className="text-gray-700 mb-3">
              <span className="font-medium">Requirement:</span>{" "}
              {matchData.experience_match || "Data not available"}
            </p>

            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">Score Breakdown:</h4>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600 flex-1">
                  Experience Match
                </span>
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${matchData.experience_score || 0}%` }}
                  ></div>
                </div>
                <span className="text-sm font-semibold min-w-[40px] text-right">
                  {matchData.experience_score?.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Semantic Similarity Section */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection("semantic")}
          className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
        >
          <span className="font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp size={18} />
            Semantic Fit ({matchData.semantic_score?.toFixed(0)}%)
          </span>
          {expandedSections.semantic ? (
            <ChevronUp size={20} />
          ) : (
            <ChevronDown size={20} />
          )}
        </button>

        {expandedSections.semantic && (
          <div className="p-4 space-y-3">
            <p className="text-sm text-gray-700">
              This score measures how well the candidate's background (resume,
              experience summary) aligns with the job description, beyond just
              matching keywords.
            </p>

            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 flex-1">
                Content Similarity
              </span>
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{ width: `${matchData.semantic_score || 0}%` }}
                ></div>
              </div>
              <span className="text-sm font-semibold min-w-[40px] text-right">
                {matchData.semantic_score?.toFixed(0)}%
              </span>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded p-3 text-sm text-purple-800">
              <p className="font-medium mb-1">How it works:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Compares job description to candidate resume</li>
                <li>Uses AI (Sentence-BERT) for contextual understanding</li>
                <li>Finds implicit matches beyond exact keywords</li>
                <li>Useful for assessing soft skills and cultural fit</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Scoring Formula */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-2">Scoring Formula</h4>
        <div className="text-sm text-gray-700 space-y-1">
          <p>
            <span className="font-medium">Final Score = </span>
            (Skills + Experience) × 70% + Semantic × 30%
          </p>
          <p className="text-xs text-gray-600">
            70% weight on hard requirements, 30% on contextual fit
          </p>
        </div>
      </div>

      {/* Confirm Button */}
      <button
        onClick={() =>
          onConfirm({ ...matchData, adjusted_score: adjustedScore })
        }
        className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
      >
        Confirm & Link Candidate
      </button>
    </div>
  );
}
