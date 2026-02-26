import React from "react";

const DecisionSelector = ({
  decision,
  rejectionReason,
  onDecisionChange,
  onRejectionReasonChange,
  errors,
}) => {
  const decisions = [
    { value: "Send to AM", label: "Send to AM" },
    { value: "Hold / Revisit Later", label: "Hold / Revisit Later" },
    { value: "Reject", label: "Reject" },
    { value: "Needs Another Call", label: "Needs Another Call" },
  ];

  const rejectionReasons = [
    "Skill mismatch",
    "Salary mismatch",
    "Experience mismatch",
    "Not interested",
    "No show",
  ];

  return (
    <div className="border-t pt-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        Recruiter Decision
      </h3>

      {/* Decision Selection */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Decision <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {decisions.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => onDecisionChange(d.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                decision === d.value
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        {errors?.decision && (
          <p className="text-red-500 text-xs mt-1">{errors.decision}</p>
        )}
      </div>

      {/* Rejection Reason (Conditional) */}
      {decision === "Reject" && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Rejection Reason <span className="text-red-500">*</span>
          </label>
          <select
            value={rejectionReason || ""}
            onChange={(e) => onRejectionReasonChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a reason</option>
            {rejectionReasons.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>
          {errors?.rejectionReason && (
            <p className="text-red-500 text-xs mt-1">
              {errors.rejectionReason}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default DecisionSelector;
