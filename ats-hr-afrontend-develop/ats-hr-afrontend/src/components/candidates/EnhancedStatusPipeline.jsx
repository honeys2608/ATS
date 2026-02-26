// src/components/candidates/EnhancedStatusPipeline.jsx
import React from "react";

/**
 * Enhanced pipeline component with new SUBMITTED stage and better styling
 * Props:
 * - candidates (array)
 * - onFilterByStatus(status)
 * - showSubmittedBadge (boolean) - whether to show NEW badge on submitted
 */
const PIPELINE_STAGES = [
  {
    key: "applied",
    label: "Applied",
    color: "bg-blue-100 text-blue-700",
    icon: "📝",
  },
  {
    key: "screening",
    label: "Screening",
    color: "bg-yellow-100 text-yellow-700",
    icon: "🔍",
  },
  {
    key: "screened",
    label: "Screened",
    color: "bg-green-100 text-green-700",
    icon: "✅",
  },
  {
    key: "submitted",
    label: "Submitted",
    color: "bg-purple-100 text-purple-700",
    icon: "📤",
    isNew: true,
  }, // NEW STAGE
  {
    key: "interview_scheduled",
    label: "Interview Scheduled",
    color: "bg-orange-100 text-orange-700",
    icon: "📅",
  },
  {
    key: "interview_completed",
    label: "Interview Completed",
    color: "bg-indigo-100 text-indigo-700",
    icon: "🎯",
  },
  {
    key: "offer_extended",
    label: "Offer Extended",
    color: "bg-pink-100 text-pink-700",
    icon: "🎁",
  },
  {
    key: "offer_accepted",
    label: "Offer Accepted",
    color: "bg-emerald-100 text-emerald-700",
    icon: "🤝",
  },
  {
    key: "hired",
    label: "Hired",
    color: "bg-green-200 text-green-800",
    icon: "🎉",
  },
  {
    key: "rejected",
    label: "Rejected",
    color: "bg-red-100 text-red-700",
    icon: "❌",
  },
];

export default function EnhancedStatusPipeline({
  candidates = [],
  onFilterByStatus,
  showSubmittedBadge = true,
}) {
  // Calculate counts for each stage
  const counts = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage.key] = (candidates || []).filter(
      (c) => c.status?.toLowerCase() === stage.key,
    ).length;
    return acc;
  }, {});

  const totalCandidates = candidates.length;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          Candidate Pipeline
        </h3>
        <span className="text-sm text-gray-600">
          Total: {totalCandidates} candidates
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {PIPELINE_STAGES.map((stage) => {
          const count = counts[stage.key] || 0;
          const percentage =
            totalCandidates > 0
              ? Math.round((count / totalCandidates) * 100)
              : 0;

          return (
            <div
              key={stage.key}
              className={`
                relative border rounded-lg p-3 transition-all duration-200
                ${
                  count > 0
                    ? "border-gray-300 hover:shadow-md cursor-pointer transform hover:-translate-y-1"
                    : "border-gray-100 opacity-75"
                }
                ${
                  stage.key === "submitted"
                    ? "ring-2 ring-purple-200 bg-purple-50"
                    : "bg-white hover:bg-gray-50"
                }
              `}
              onClick={() =>
                count > 0 && onFilterByStatus && onFilterByStatus(stage.key)
              }
            >
              {/* NEW badge for submitted stage */}
              {stage.isNew && showSubmittedBadge && (
                <div className="absolute -top-2 -right-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-full font-bold">
                  NEW
                </div>
              )}

              {/* Stage header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg">{stage.icon}</span>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${stage.color}`}
                >
                  {percentage}%
                </span>
              </div>

              {/* Count */}
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {count}
              </div>

              {/* Label */}
              <div className="text-xs text-gray-600 font-medium leading-tight">
                {stage.label}
              </div>

              {/* Progress bar */}
              <div className="mt-3 w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    stage.key === "submitted"
                      ? "bg-gradient-to-r from-purple-500 to-purple-600"
                      : stage.key === "hired"
                        ? "bg-gradient-to-r from-green-500 to-green-600"
                        : stage.key === "rejected"
                          ? "bg-gradient-to-r from-red-500 to-red-600"
                          : "bg-gradient-to-r from-blue-500 to-blue-600"
                  }`}
                  style={{
                    width: `${percentage}%`,
                  }}
                />
              </div>

              {/* Action hint */}
              {count > 0 && onFilterByStatus && (
                <div className="mt-2 text-center">
                  <span className="text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to view
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pipeline health summary */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-gray-500">Active</div>
            <div className="text-lg font-semibold text-blue-600">
              {counts.applied + counts.screening + counts.screened}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Submitted</div>
            <div className="text-lg font-semibold text-purple-600">
              {counts.submitted}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Completed</div>
            <div className="text-lg font-semibold text-green-600">
              {counts.hired}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
