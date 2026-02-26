import React, { useState, useEffect, useRef, useCallback } from "react";
import RatingInput from "./RatingInput";
import DecisionSelector from "./DecisionSelector";
import api from "../../api/axios";
import {
  createCallFeedback,
  updateCallFeedback,
} from "../../services/callFeedbackService";

const CallFeedbackForm = ({
  candidateId,
  candidateName,
  initialData = null,
  onSuccess = () => {},
  onCancel = () => {},
}) => {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [saveStatus, setSaveStatus] = useState(""); // "saving", "saved", "error"
  const autosaveIntervalRef = useRef(null);
  const [jobs, setJobs] = useState([]);
  const formRef = useRef(null);

  // Fetch jobs on mount
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        // Prefer recruiter's assigned jobs so feedback/submission remains job-specific.
        const assignedRes = await api.get("/v1/recruiter/assigned-jobs");
        const assignedJobs = assignedRes.data?.jobs || [];
        if (Array.isArray(assignedJobs) && assignedJobs.length > 0) {
          setJobs(assignedJobs);
          return;
        }

        // Fallback for environments where assigned-jobs endpoint is unavailable.
        const res = await api.get("/v1/job-management/requirements");
        const jobsData =
          res.data?.jobs || res.data?.requirements || res.data || [];
        setJobs(Array.isArray(jobsData) ? jobsData : []);
      } catch (err) {
        console.error("Failed to load jobs", err);
      }
    };
    fetchJobs();
  }, []);

  // Form state - Call Type and Call Mode are always fixed
  const [formData, setFormData] = useState({
    call_type: "Initial Screening",
    call_date: initialData?.call_date
      ? new Date(initialData.call_date).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16),
    call_duration: initialData?.call_duration || 30,
    call_mode: "Phone",
    job_id: initialData?.job_id || "",
    ratings: initialData?.ratings || {
      communication: 0,
      technical_fit: 0,
      experience_relevance: 0,
      culture_fit: 0,
    },
    salary_alignment: initialData?.salary_alignment || "Negotiable",
    strengths: initialData?.strengths || "",
    concerns: initialData?.concerns || "",
    additional_notes: initialData?.additional_notes || "",
    candidate_intent: initialData?.candidate_intent || "Actively looking",
    decision: initialData?.decision || "",
    rejection_reason:
      typeof initialData?.rejection_reason === "string"
        ? initialData.rejection_reason
        : "",
    next_actions: initialData?.next_actions || [],
    is_draft: initialData?.is_draft !== false,
  });

  const getOverallRating = useCallback((ratings) => {
    const values = Object.values(ratings || {})
      .map((value) => Number(value))
      .filter((value) => value > 0);
    if (!values.length) return 0;
    return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
  }, []);

  const buildFeedbackSummaryText = useCallback((data) => {
    const parts = [];
    const strengths = String(data?.strengths || "").trim();
    const concerns = String(data?.concerns || "").trim();
    const additional = String(data?.additional_notes || "").trim();

    if (strengths) parts.push(`Strengths: ${strengths}`);
    if (concerns) parts.push(`Concerns: ${concerns}`);
    if (additional) parts.push(`Notes: ${additional}`);

    return parts.join(" | ");
  }, []);

  // Validate form
  const validateForm = useCallback(() => {
    const newErrors = {};

    // Call type and call mode are fixed, only validate call date
    if (!formData.call_date) newErrors.call_date = "Call date is required";

    // Validate job selection
    if (!formData.job_id) newErrors.job_id = "Job is required";

    // Validate ratings
    const requiredRatings = [
      "communication",
      "technical_fit",
      "experience_relevance",
      "culture_fit",
    ];
    requiredRatings.forEach((rating) => {
      if (!formData.ratings[rating] || formData.ratings[rating] === 0) {
        newErrors[`ratings_${rating}`] =
          `${rating.replace(/_/g, " ")} rating is required`;
      }
    });

    if (!formData.decision) newErrors.decision = "Decision is required";
    if (formData.decision === "Reject" && !formData.rejection_reason) {
      newErrors.rejectionReason =
        "Rejection reason is required when decision is Reject";
    }
    if (!formData.salary_alignment)
      newErrors.salary_alignment = "Salary alignment is required";

    return newErrors;
  }, [formData]);

  // Handle field changes
  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
    if (saveStatus === "error") {
      setSaveStatus("");
    }
  };

  const handleRatingChange = (ratingKey, value) => {
    setFormData((prev) => ({
      ...prev,
      ratings: {
        ...prev.ratings,
        [ratingKey]: value,
      },
    }));
    if (errors[`ratings_${ratingKey}`]) {
      setErrors((prev) => ({
        ...prev,
        [`ratings_${ratingKey}`]: "",
      }));
    }
  };

  const handleNextActionToggle = (action) => {
    setFormData((prev) => ({
      ...prev,
      next_actions: prev.next_actions.includes(action)
        ? prev.next_actions.filter((a) => a !== action)
        : [...prev.next_actions, action],
    }));
  };

  // Autosave function
  const handleAutosave = useCallback(async () => {
    if (initialData?.id) {
      try {
        setSaveStatus("saving");
        await updateCallFeedback(initialData.id, {
          ...formData,
          call_date: new Date(formData.call_date).toISOString(),
          is_draft: true,
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(""), 2000);
      } catch (error) {
        console.error("Autosave error:", error);
        setSaveStatus("error");
      }
    }
  }, [formData, initialData?.id]);

  // Setup autosave interval
  useEffect(() => {
    autosaveIntervalRef.current = setInterval(() => {
      handleAutosave();
    }, 10000); // 10 seconds

    return () => {
      if (autosaveIntervalRef.current) {
        clearInterval(autosaveIntervalRef.current);
      }
    };
  }, [handleAutosave]);

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSaveStatus("error");
      setTimeout(() => {
        const firstError = formRef.current?.querySelector(".text-red-500");
        firstError?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 0);
      return;
    }
    setLoading(true);
    try {
      const submitData = {
        candidate_id: candidateId,
        call_type: formData.call_type,
        call_date: new Date(formData.call_date).toISOString(),
        call_duration: parseInt(formData.call_duration) || 0,
        call_mode: formData.call_mode,
        job_id: formData.job_id,
        ratings: formData.ratings,
        salary_alignment: formData.salary_alignment,
        strengths: formData.strengths || "",
        concerns: formData.concerns || "",
        additional_notes: formData.additional_notes || "",
        candidate_intent: formData.candidate_intent,
        decision: formData.decision,
        rejection_reason:
          formData.decision === "Reject" ? formData.rejection_reason || "" : "",
        next_actions: formData.next_actions,
        // Compatibility fields for AM submission/call-note pipelines.
        rating: getOverallRating(formData.ratings),
        free_text: buildFeedbackSummaryText(formData),
        is_draft: false,
      };
      if (initialData?.id) {
        await updateCallFeedback(initialData.id, submitData);
      } else {
        await createCallFeedback(submitData);
      }
      setSaveStatus("saved");
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (error) {
      let errorMsg =
        error.response?.data?.detail ||
        error.message ||
        "Error saving feedback";
      // If errorMsg is a stringified array, parse it
      if (typeof errorMsg === "string" && errorMsg.startsWith("[")) {
        try {
          errorMsg = JSON.parse(errorMsg);
        } catch {}
      }
      setSaveStatus("error");
      setErrors({
        submit: errorMsg,
      });
    } finally {
      setLoading(false);
    }
  };

  const nextActionOptions = [
    "Schedule technical interview",
    "Set follow-up reminder",
    "Assign interviewer",
  ];

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-800">Add Call Feedback</h2>
        <p className="text-sm text-gray-600 mt-1">
          Recording feedback for: <strong>{candidateName}</strong>
        </p>
      </div>

      {/* Error Alert */}
      {errors.submit && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">
            {Array.isArray(errors.submit)
              ? errors.submit.map((err, idx) => (
                  <span key={idx}>
                    {err.msg || JSON.stringify(err)}
                    <br />
                  </span>
                ))
              : typeof errors.submit === "string"
                ? errors.submit
                : JSON.stringify(errors.submit)}
          </p>
        </div>
      )}

      {/* Call Metadata Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Call Metadata
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Call Type - Fixed as Initial Screening */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Call Type
            </label>
            <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium">
              Initial Screening
            </div>
          </div>

          {/* Call Mode - Fixed as Phone */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Call Mode
            </label>
            <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium">
              Phone
            </div>
          </div>

          {/* Call Date & Time */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Call Date & Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={formData.call_date}
              onChange={(e) => handleFieldChange("call_date", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.call_date && (
              <p className="text-red-500 text-xs mt-1">{errors.call_date}</p>
            )}
          </div>

          {/* Call Duration */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Duration (minutes)
            </label>
            <input
              type="number"
              min="0"
              value={formData.call_duration}
              onChange={(e) =>
                handleFieldChange(
                  "call_duration",
                  parseInt(e.target.value) || 0,
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Ratings Section */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Structured Evaluation
        </h3>

        <RatingInput
          label="Communication"
          value={formData.ratings.communication}
          onChange={(val) => handleRatingChange("communication", val)}
          required
        />
        {errors.ratings_communication && (
          <p className="text-red-500 text-xs -mt-2 mb-2">
            {errors.ratings_communication}
          </p>
        )}

        <RatingInput
          label="Technical Fit"
          value={formData.ratings.technical_fit}
          onChange={(val) => handleRatingChange("technical_fit", val)}
          required
        />
        {errors.ratings_technical_fit && (
          <p className="text-red-500 text-xs -mt-2 mb-2">
            {errors.ratings_technical_fit}
          </p>
        )}

        <RatingInput
          label="Experience Relevance"
          value={formData.ratings.experience_relevance}
          onChange={(val) => handleRatingChange("experience_relevance", val)}
          required
        />
        {errors.ratings_experience_relevance && (
          <p className="text-red-500 text-xs -mt-2 mb-2">
            {errors.ratings_experience_relevance}
          </p>
        )}

        <RatingInput
          label="Culture Fit"
          value={formData.ratings.culture_fit}
          onChange={(val) => handleRatingChange("culture_fit", val)}
          required
        />
        {errors.ratings_culture_fit && (
          <p className="text-red-500 text-xs -mt-2 mb-2">
            {errors.ratings_culture_fit}
          </p>
        )}

        {/* Salary Alignment */}
        <div className="mt-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Salary Alignment <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-4">
            {["Yes", "No", "Negotiable"].map((option) => (
              <label
                key={option}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="radio"
                  name="salary_alignment"
                  value={option}
                  checked={formData.salary_alignment === option}
                  onChange={(e) =>
                    handleFieldChange("salary_alignment", e.target.value)
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">{option}</span>
              </label>
            ))}
          </div>
          {errors.salary_alignment && (
            <p className="text-red-500 text-xs mt-1">
              {errors.salary_alignment}
            </p>
          )}
        </div>
      </div>

      {/* Recruiter Notes Section */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Recruiter Notes
        </h3>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Strengths
          </label>
          <textarea
            value={formData.strengths}
            onChange={(e) => handleFieldChange("strengths", e.target.value)}
            placeholder="Key strengths observed during the call"
            rows="3"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Concerns
          </label>
          <textarea
            value={formData.concerns}
            onChange={(e) => handleFieldChange("concerns", e.target.value)}
            placeholder="Any concerns or red flags"
            rows="3"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Additional Notes
          </label>
          <textarea
            value={formData.additional_notes}
            onChange={(e) =>
              handleFieldChange("additional_notes", e.target.value)
            }
            placeholder="Any other relevant information"
            rows="3"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Candidate Intent Section */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Candidate Intent
        </h3>

        <select
          value={formData.candidate_intent}
          onChange={(e) =>
            handleFieldChange("candidate_intent", e.target.value)
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="Actively looking">Actively looking</option>
          <option value="Passive">Passive</option>
          <option value="Offer in hand">Offer in hand</option>
          <option value="Just exploring">Just exploring</option>
        </select>
      </div>

      {/* Job Selection Section */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Select Job (Assigned by Account Manager)
        </h3>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Job/Requirement <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.job_id}
            onChange={(e) => handleFieldChange("job_id", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Job</option>
            {Array.isArray(jobs) &&
              jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title || job.job_title || "Untitled"} -{" "}
                  {job.client_name || job.company_name || "N/A"}
                </option>
              ))}
          </select>
          {errors.job_id && (
            <p className="text-red-500 text-xs mt-1">{errors.job_id}</p>
          )}
        </div>
      </div>

      {/* Decision Section */}
      <DecisionSelector
        decision={formData.decision}
        rejectionReason={formData.rejection_reason}
        onDecisionChange={(val) => handleFieldChange("decision", val)}
        onRejectionReasonChange={(val) =>
          handleFieldChange("rejection_reason", val)
        }
        errors={errors}
      />

      {/* Status and Actions */}
      <div className="border-t pt-6 sticky bottom-0 bg-white z-10">
        <div className="flex items-center justify-between">
          <div>
            {saveStatus === "saving" && (
              <span className="text-sm text-blue-600">💾 Autosaving...</span>
            )}
            {saveStatus === "saved" && (
              <span className="text-sm text-green-600">✓ Draft saved</span>
            )}
            {saveStatus === "error" && (
              <span className="text-sm text-red-600">
                Please complete required fields and try again
              </span>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:bg-blue-400"
            >
              {loading ? "Saving..." : "Save Feedback"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default CallFeedbackForm;

