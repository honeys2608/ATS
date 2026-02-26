import React, { useState, useEffect } from "react";
import { getCandidateCallFeedback } from "../../services/callFeedbackService";

const CallFeedbackHistory = ({
  candidateId,
  onFeedbackSelect = () => {},
  onAddNew = () => {},
}) => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const fetchFeedbacks = async () => {
      try {
        setLoading(true);
        const data = await getCandidateCallFeedback(candidateId);
        setFeedbacks(data.feedbacks || []);
        setError(null);
      } catch (err) {
        console.error("Error fetching feedback history:", err);
        setError("Failed to load feedback history");
      } finally {
        setLoading(false);
      }
    };

    if (candidateId) {
      fetchFeedbacks();
    }
  }, [candidateId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700 text-sm">{error}</p>
      </div>
    );
  }

  if (!feedbacks || feedbacks.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No call feedback recorded yet</p>
      </div>
    );
  }

  const getDecisionBadgeColor = (decision) => {
    switch (decision) {
      case "Send to AM":
      case "Proceed to Next Round":
        return "bg-green-100 text-green-800";
      case "Hold / Revisit Later":
        return "bg-yellow-100 text-yellow-800";
      case "Reject":
        return "bg-red-100 text-red-800";
      case "Needs Another Call":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getOverallRating = (ratings) => {
    if (!ratings) return 0;
    const values = Object.values(ratings).filter((v) => v > 0);
    return values.length > 0
      ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
      : 0;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800">
          Call Feedback History
        </h3>
        <button
          onClick={onAddNew}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
        >
          ➕ Add New Feedback
        </button>
      </div>

      <div className="space-y-3">
        {feedbacks.map((feedback) => (
          <div
            key={feedback.id}
            className="border border-gray-200 rounded-lg overflow-hidden"
          >
            {/* Summary */}
            <button
              onClick={() =>
                setExpandedId(expandedId === feedback.id ? null : feedback.id)
              }
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1 text-left">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">
                      {feedback.call_type}
                    </p>
                    <p className="text-sm text-gray-600">
                      {formatDate(feedback.call_date)}
                    </p>
                  </div>

                  {/* Overall Rating */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">
                      {getOverallRating(feedback.ratings)}/5.0
                    </span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          className={`w-4 h-4 ${
                            star <=
                            Math.round(getOverallRating(feedback.ratings))
                              ? "text-yellow-400 fill-current"
                              : "text-gray-300 fill-current"
                          }`}
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      ))}
                    </div>
                  </div>

                  {/* Decision Badge */}
                  <div className="ml-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${getDecisionBadgeColor(
                        feedback.decision,
                      )}`}
                    >
                      {feedback.decision}
                    </span>
                  </div>
                </div>
              </div>

              {/* Expand/Collapse Icon */}
              <svg
                className={`w-5 h-5 text-gray-500 ml-4 transition-transform ${
                  expandedId === feedback.id ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
            </button>

            {/* Expanded Details */}
            {expandedId === feedback.id && (
              <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
                {/* Call Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase">
                      Mode
                    </p>
                    <p className="text-sm text-gray-800">
                      {feedback.call_mode}
                    </p>
                  </div>
                  {feedback.call_duration && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">
                        Duration
                      </p>
                      <p className="text-sm text-gray-800">
                        {feedback.call_duration} minutes
                      </p>
                    </div>
                  )}
                </div>

                {/* Ratings */}
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase mb-2">
                    Ratings
                  </p>
                  <div className="space-y-1">
                    {Object.entries(feedback.ratings || {}).map(
                      ([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between"
                        >
                          <span className="text-sm text-gray-700 capitalize">
                            {key.replace(/_/g, " ")}
                          </span>
                          <span className="text-sm font-semibold text-gray-800">
                            {value}/5
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                {/* Salary Alignment */}
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase">
                    Salary Alignment
                  </p>
                  <p className="text-sm text-gray-800">
                    {feedback.salary_alignment}
                  </p>
                </div>

                {/* Candidate Intent */}
                {feedback.candidate_intent && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase">
                      Candidate Intent
                    </p>
                    <p className="text-sm text-gray-800">
                      {feedback.candidate_intent}
                    </p>
                  </div>
                )}

                {/* Notes */}
                {(feedback.strengths ||
                  feedback.concerns ||
                  feedback.additional_notes) && (
                  <div className="border-t border-gray-200 pt-3">
                    {feedback.strengths && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-green-700 uppercase mb-1">
                          Strengths
                        </p>
                        <p className="text-sm text-gray-700">
                          {feedback.strengths}
                        </p>
                      </div>
                    )}
                    {feedback.concerns && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-red-700 uppercase mb-1">
                          Concerns
                        </p>
                        <p className="text-sm text-gray-700">
                          {feedback.concerns}
                        </p>
                      </div>
                    )}
                    {feedback.additional_notes && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600 uppercase mb-1">
                          Notes
                        </p>
                        <p className="text-sm text-gray-700">
                          {feedback.additional_notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Rejection Reason */}
                {feedback.rejection_reason && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-xs font-semibold text-red-700 uppercase mb-1">
                      Rejection Reason
                    </p>
                    <p className="text-sm text-red-700">
                      {feedback.rejection_reason}
                    </p>
                  </div>
                )}

                {/* Next Actions */}
                {feedback.next_actions && feedback.next_actions.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase mb-2">
                      Next Actions
                    </p>
                    <ul className="space-y-1">
                      {feedback.next_actions.map((action, idx) => (
                        <li
                          key={idx}
                          className="text-sm text-gray-700 flex items-center gap-2"
                        >
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Button */}
                <button
                  onClick={() => onFeedbackSelect(feedback)}
                  className="w-full mt-3 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-sm font-medium transition-colors"
                >
                  Edit Feedback
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CallFeedbackHistory;
