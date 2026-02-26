// src/components/candidates/SubmitCandidateButton.jsx
import React, { useState } from "react";
import axios from "../../api/axios";
import useActivityLogger from "../../hooks/useActivityLogger";

const SubmitCandidateButton = ({
  candidate,
  requirementId, // NEW: Pass requirement ID to log activity
  onSubmitSuccess = () => {},
  className = "",
}) => {
  const [submitting, setSubmitting] = useState(false);
  const { logCandidateSubmission } = useActivityLogger();

  const handleSubmit = async () => {
    if (!candidate?.id) {
      alert("Invalid candidate");
      return;
    }

    // Confirm action
    const confirmed = window.confirm(
      `Submit ${candidate.full_name || candidate.email || "this candidate"} to client?`,
    );

    if (!confirmed) return;

    try {
      setSubmitting(true);

      const response = await axios.post(
        `/v1/dashboard/candidates/${candidate.id}/submit`,
      );

      if (response.data?.success) {
        // Log the activity for passive requirement tracking
        if (requirementId) {
          await logCandidateSubmission(
            requirementId,
            candidate.id,
            candidate.full_name || candidate.email || "Unknown candidate",
          );
        }

        // Success notification
        alert(response.data.message || "Candidate submitted successfully!");

        // Trigger callback for parent component to refresh data
        onSubmitSuccess(candidate.id, response.data);
      }
    } catch (error) {
      console.error("Submit candidate error:", error);

      const errorMsg =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        "Failed to submit candidate";

      alert(`Error: ${errorMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Only show button for candidates in valid states for submission
  const validStates = ["screened", "screening", "shortlisted"];
  const canSubmit = validStates.includes(candidate?.status?.toLowerCase());

  if (!canSubmit) {
    return null; // Don't show button for invalid states
  }

  return (
    <button
      onClick={handleSubmit}
      disabled={submitting}
      className={`
        inline-flex items-center px-3 py-1 rounded-md text-sm font-medium
        transition-colors duration-200
        ${
          submitting
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : "bg-purple-100 text-purple-700 hover:bg-purple-200"
        }
        ${className}
      `}
      title="Submit candidate to client"
    >
      {submitting ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          Submitting...
        </>
      ) : (
        <>📤 Submit to Client</>
      )}
    </button>
  );
};

export default SubmitCandidateButton;
