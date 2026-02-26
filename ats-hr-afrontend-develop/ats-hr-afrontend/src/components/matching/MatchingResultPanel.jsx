import React, { useState } from "react";
import { ChevronDown, CheckCircle2, X, Zap } from "lucide-react";
import CandidateMatchingBadge from "./CandidateMatchingBadge";

/**
 * MatchingResultPanel
 * Displays detailed matching results for a candidate-job pair
 * Shows matched/missing skills, experience comparison, and scoring breakdown
 *
 * Props:
 * - matchResult: object with matching details
 * - candidateName: string
 * - onClose: function called when closing the panel
 */
const MatchingResultPanel = ({ matchResult, candidateName, onClose }) => {
  const [expandedSections, setExpandedSections] = useState({
    skills: true,
    experience: false,
    scoring: false,
  });

  if (!matchResult) {
    return null;
  }

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getSectionHeader = (title, icon, isExpanded) => (
    <div
      onClick={() => toggleSection(title.toLowerCase())}
      className="cursor-pointer flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
    >
      <div className="flex items-center space-x-2">
        {icon}
        <h4 className="font-medium text-gray-900">{title}</h4>
      </div>
      <ChevronDown
        className={`w-5 h-5 text-gray-600 transition-transform ${
          isExpanded ? "rotate-180" : ""
        }`}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {candidateName}
            </h3>
            <p className="text-sm text-gray-600 mt-1">Matching Analysis</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Overall Score */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-900">
                Overall Match Score
              </h4>
              <CandidateMatchingBadge
                matchScore={matchResult.match_score}
                fitLabel={matchResult.fit_label}
                size="md"
              />
            </div>

            {/* Score Breakdown */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-white p-3 rounded border border-gray-200">
                <p className="text-xs text-gray-600 mb-1">Rule-Based Score</p>
                <div className="flex items-end space-x-2">
                  <span className="text-2xl font-bold text-blue-600">
                    {matchResult.rule_based_score}%
                  </span>
                  <span className="text-xs text-gray-500 mb-1">
                    (70% weight)
                  </span>
                </div>
              </div>
              <div className="bg-white p-3 rounded border border-gray-200">
                <p className="text-xs text-gray-600 mb-1">Semantic Score</p>
                <div className="flex items-end space-x-2">
                  <span className="text-2xl font-bold text-indigo-600">
                    {matchResult.semantic_score}%
                  </span>
                  <span className="text-xs text-gray-500 mb-1">
                    (30% weight)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Skills Section */}
          <div>
            {getSectionHeader(
              "Skills Match",
              <CheckCircle2 className="w-5 h-5 text-green-600" />,
              expandedSections.skills,
            )}

            {expandedSections.skills && (
              <div className="mt-3 space-y-3 pl-3">
                {/* Skill Match Percentage */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">
                      Skill Match
                    </span>
                    <span className="text-sm font-bold text-green-600">
                      {matchResult.skill_match}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${matchResult.skill_match}%` }}
                    ></div>
                  </div>
                </div>

                {/* Matched Skills */}
                {matchResult.matched_skills.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-2 flex items-center">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mr-1" />
                      Matched Skills ({matchResult.matched_skills.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {matchResult.matched_skills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                        >
                          ✓ {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing Skills */}
                {matchResult.missing_skills.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-2 flex items-center">
                      <X className="w-4 h-4 text-red-600 mr-1" />
                      Missing Skills ({matchResult.missing_skills.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {matchResult.missing_skills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"
                        >
                          ✗ {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Experience Section */}
          <div>
            {getSectionHeader(
              "Experience",
              <Zap className="w-5 h-5 text-blue-600" />,
              expandedSections.experience,
            )}

            {expandedSections.experience && (
              <div className="mt-3 pl-3 space-y-3">
                <div className="bg-blue-50 p-3 rounded border border-blue-200">
                  <p className="text-sm text-gray-700 mb-2">
                    <span className="font-medium">Comparison:</span>{" "}
                    {matchResult.experience_match}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">
                      Experience Score
                    </span>
                    <span className="text-lg font-bold text-blue-600">
                      {matchResult.experience_score}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Scoring Details */}
          <div>
            {getSectionHeader(
              "Scoring Details",
              <Zap className="w-5 h-5 text-gray-600" />,
              expandedSections.scoring,
            )}

            {expandedSections.scoring && (
              <div className="mt-3 pl-3 space-y-2 text-sm text-gray-700">
                <p>
                  <span className="font-medium">Fit Label:</span>{" "}
                  {matchResult.fit_label}
                </p>
                <p className="text-xs text-gray-600">
                  The matching score combines rule-based evaluation (70%) with
                  semantic similarity analysis (30%) using Sentence-BERT to
                  provide a comprehensive candidate-job fit assessment.
                </p>
                <div className="mt-3 p-2 bg-gray-50 rounded text-xs">
                  <p className="font-mono text-gray-600">
                    Final Score = (Rule-Based × 0.7) + (Semantic × 0.3)
                    <br />
                    {matchResult.match_score} = ({matchResult.rule_based_score}{" "}
                    × 0.7) + ({matchResult.semantic_score} × 0.3)
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-gray-200 bg-gray-50 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchingResultPanel;
