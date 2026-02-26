/**
 * AI Recruiter Prompts Hook
 * Manages state and logic for all 12 AI workflows
 */

import { useState, useCallback } from "react";
import * as aiPromptsService from "../services/aiPromptsService";
import * as aiValidators from "../utils/aiValidators";

export const useAIPrompts = () => {
  // State for each prompt type
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState({});

  // Generic handler for API calls with validation
  const executePrompt = useCallback(
    async (promptType, validatorFn, apiCall, payload = {}) => {
      setLoading(true);
      setError(null);

      try {
        // Validate input
        if (validatorFn) {
          const validationError = validatorFn(payload);
          if (validationError) {
            setError(validationError);
            setLoading(false);
            return null;
          }
        }

        // Call API
        const result = await apiCall();

        // Store result
        setResults((prev) => ({
          ...prev,
          [promptType]: result,
        }));

        return result;
      } catch (err) {
        const errorMessage = err.response?.data?.detail || err.message;
        setError(errorMessage);
        console.error(`Error in ${promptType}:`, errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // ============================================================
  // 1️⃣ JOB REQUIREMENT UNDERSTANDING
  // ============================================================
  const analyzeJobRequirement = useCallback(
    (requirementText) =>
      executePrompt(
        "analyzeJobRequirement",
        aiValidators.validateJobRequirement,
        () => aiPromptsService.analyzeJobRequirement(requirementText),
        { requirementText },
      ),
    [executePrompt],
  );

  // ============================================================
  // 2️⃣ CANDIDATE SOURCING
  // ============================================================
  const sourceCandidates = useCallback(
    (jobDetails, filters = {}, limit = 10) =>
      executePrompt(
        "sourceCandidates",
        () => aiValidators.validateCandidateSourcing(jobDetails),
        () => aiPromptsService.sourceCandidates(jobDetails, filters, limit),
        { jobDetails },
      ),
    [executePrompt],
  );

  // ============================================================
  // 3️⃣ RESUME SCREENING & SCORING
  // ============================================================
  const screenResume = useCallback(
    (jobDescription, resumeText, candidateId = null) =>
      executePrompt(
        "screenResume",
        () => aiValidators.validateResumeScreening(jobDescription, resumeText),
        () =>
          aiPromptsService.screenResume(
            jobDescription,
            resumeText,
            candidateId,
          ),
        { jobDescription, resumeText },
      ),
    [executePrompt],
  );

  // ============================================================
  // 4️⃣ RECRUITER SCREENING NOTES
  // ============================================================
  const generateScreeningNotes = useCallback(
    (conversationSummary, candidateName, jobTitle) =>
      executePrompt(
        "generateScreeningNotes",
        () =>
          aiValidators.validateScreeningNotes(
            conversationSummary,
            candidateName,
            jobTitle,
          ),
        () =>
          aiPromptsService.generateScreeningNotes(
            conversationSummary,
            candidateName,
            jobTitle,
          ),
        { conversationSummary, candidateName, jobTitle },
      ),
    [executePrompt],
  );

  // ============================================================
  // 5️⃣ CANDIDATE INTEREST CONFIRMATION
  // ============================================================
  const generateInterestChecklist = useCallback(
    (candidateId, candidateName, jobTitle, jobDescription) =>
      executePrompt(
        "generateInterestChecklist",
        () =>
          aiValidators.validateInterestChecklist(
            candidateId,
            candidateName,
            jobTitle,
            jobDescription,
          ),
        () =>
          aiPromptsService.generateInterestChecklist(
            candidateId,
            candidateName,
            jobTitle,
            jobDescription,
          ),
        { candidateId, candidateName, jobTitle, jobDescription },
      ),
    [executePrompt],
  );

  // ============================================================
  // 6️⃣ CLIENT SUBMISSION SUMMARY
  // ============================================================
  const generateClientSubmission = useCallback(
    (candidateId, jobId, includeSalary = true, includeNoticePeriod = true) =>
      executePrompt(
        "generateClientSubmission",
        () => aiValidators.validateClientSubmission(candidateId, jobId),
        () =>
          aiPromptsService.generateClientSubmission(
            candidateId,
            jobId,
            includeSalary,
            includeNoticePeriod,
          ),
        { candidateId, jobId },
      ),
    [executePrompt],
  );

  // ============================================================
  // 7️⃣ INTERVIEW QUESTION GENERATOR
  // ============================================================
  const generateInterviewQuestions = useCallback(
    (
      jobTitle,
      requiredSkills,
      experienceLevel = "mid",
      interviewType = "technical",
    ) =>
      executePrompt(
        "generateInterviewQuestions",
        () => aiValidators.validateInterviewQuestions(jobTitle, requiredSkills),
        () =>
          aiPromptsService.generateInterviewQuestions(
            jobTitle,
            requiredSkills,
            experienceLevel,
            interviewType,
          ),
        { jobTitle, requiredSkills },
      ),
    [executePrompt],
  );

  // ============================================================
  // 8️⃣ INTERVIEW FEEDBACK ANALYSIS
  // ============================================================
  const analyzeInterviewFeedback = useCallback(
    (interviewFeedback, candidateName, jobTitle) =>
      executePrompt(
        "analyzeInterviewFeedback",
        () =>
          aiValidators.validateInterviewFeedback(
            interviewFeedback,
            candidateName,
            jobTitle,
          ),
        () =>
          aiPromptsService.analyzeInterviewFeedback(
            interviewFeedback,
            candidateName,
            jobTitle,
          ),
        { interviewFeedback, candidateName, jobTitle },
      ),
    [executePrompt],
  );

  // ============================================================
  // 9️⃣ OFFER FIT & SALARY ALIGNMENT
  // ============================================================
  const analyzeOfferFit = useCallback(
    (candidateExpectations, offerDetails, candidateId = null) =>
      executePrompt(
        "analyzeOfferFit",
        () =>
          aiValidators.validateOfferFit(candidateExpectations, offerDetails),
        () =>
          aiPromptsService.analyzeOfferFit(
            candidateExpectations,
            offerDetails,
            candidateId,
          ),
        { candidateExpectations, offerDetails },
      ),
    [executePrompt],
  );

  // ============================================================
  // 🔟 DROPOUT RISK PREDICTION
  // ============================================================
  const predictDropoutRisk = useCallback(
    (candidateTimeline, candidateName, currentStage) =>
      executePrompt(
        "predictDropoutRisk",
        () =>
          aiValidators.validateDropoutRisk(
            candidateTimeline,
            candidateName,
            currentStage,
          ),
        () =>
          aiPromptsService.predictDropoutRisk(
            candidateTimeline,
            candidateName,
            currentStage,
          ),
        { candidateTimeline, candidateName, currentStage },
      ),
    [executePrompt],
  );

  // ============================================================
  // 1️⃣1️⃣ DAILY RECRUITER REPORT
  // ============================================================
  const generateDailyReport = useCallback(
    (recruiterId, reportDate = null, includeMetrics = true) =>
      executePrompt(
        "generateDailyReport",
        () => aiValidators.validateDailyReport(recruiterId, reportDate),
        () =>
          aiPromptsService.generateDailyReport(
            recruiterId,
            reportDate,
            includeMetrics,
          ),
        { recruiterId, reportDate },
      ),
    [executePrompt],
  );

  // ============================================================
  // 1️⃣2️⃣ RECRUITER PERFORMANCE INSIGHTS
  // ============================================================
  const getPerformanceInsights = useCallback(
    (recruiterId, period = "month") =>
      executePrompt(
        "getPerformanceInsights",
        () => aiValidators.validatePerformanceInsights(recruiterId, period),
        () => aiPromptsService.getPerformanceInsights(recruiterId, period),
        { recruiterId, period },
      ),
    [executePrompt],
  );

  // Clear errors
  const clearError = useCallback(() => setError(null), []);

  // Clear specific result
  const clearResult = useCallback(
    (promptType) =>
      setResults((prev) => {
        const newResults = { ...prev };
        delete newResults[promptType];
        return newResults;
      }),
    [],
  );

  // Clear all results
  const clearAllResults = useCallback(() => setResults({}), []);

  return {
    // State
    loading,
    error,
    results,

    // 12 Prompt Functions
    analyzeJobRequirement,
    sourceCandidates,
    screenResume,
    generateScreeningNotes,
    generateInterestChecklist,
    generateClientSubmission,
    generateInterviewQuestions,
    analyzeInterviewFeedback,
    analyzeOfferFit,
    predictDropoutRisk,
    generateDailyReport,
    getPerformanceInsights,

    // Utilities
    clearError,
    clearResult,
    clearAllResults,
  };
};
