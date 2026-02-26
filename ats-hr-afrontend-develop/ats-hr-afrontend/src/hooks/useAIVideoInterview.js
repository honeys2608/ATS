import { useState, useCallback } from "react";
import {
  createAIVideoInterview,
  startAIVideoInterview,
  submitVideoAnswer,
  completeAIVideoInterview,
} from "../services/aiVideoInterview.service";

/**
 * ======================================
 * AI VIDEO INTERVIEW HOOK
 * Backend: /v1/ai-video-interviews
 * ======================================
 */

export default function useAIVideoInterview() {
  const [interviewId, setInterviewId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* --------------------------------
     CREATE VIDEO INTERVIEW
  -------------------------------- */
  const createInterview = useCallback(async (candidateId, jobId) => {
    try {
      setLoading(true);
      setError(null);

      const res = await createAIVideoInterview({
        candidate_id: candidateId,
        job_id: jobId,
        recording_enabled: true,
      });

      setInterviewId(res.data.interview_id);
      setQuestions(res.data.questions || []);
      setCurrentIndex(0);
    } catch (err) {
      setError("Failed to create AI video interview");
    } finally {
      setLoading(false);
    }
  }, []);

  /* --------------------------------
     START VIDEO INTERVIEW
  -------------------------------- */
  const startInterview = useCallback(async () => {
    if (!interviewId) return;

    try {
      setLoading(true);
      setError(null);

      await startAIVideoInterview(interviewId);
    } catch (err) {
      setError("Failed to start AI video interview");
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  /* --------------------------------
     SUBMIT VIDEO ANSWER
  -------------------------------- */
  const submitAnswer = useCallback(
    async (videoUrl, duration) => {
      if (!interviewId) return;

      try {
        setLoading(true);
        setError(null);

        await submitVideoAnswer(interviewId, currentIndex, videoUrl, duration);

        setCurrentIndex((prev) => prev + 1);
      } catch (err) {
        setError("Failed to submit video answer");
      } finally {
        setLoading(false);
      }
    },
    [interviewId, currentIndex]
  );

  /* --------------------------------
     COMPLETE VIDEO INTERVIEW
  -------------------------------- */
  const completeInterview = useCallback(async () => {
    if (!interviewId) return;

    try {
      setLoading(true);
      setError(null);

      const res = await completeAIVideoInterview(interviewId);
      return res.data;
    } catch (err) {
      setError("Failed to complete AI video interview");
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  return {
    interviewId,
    questions,
    currentIndex,

    loading,
    error,

    createInterview,
    startInterview,
    submitAnswer,
    completeInterview,
  };
}