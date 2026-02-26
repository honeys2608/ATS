import { useState, useCallback } from "react";
import axios from "../api/axios";

export default function useInterview(interviewId) {
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionCount, setQuestionCount] = useState(0);

  /* =========================
     LOAD INTERVIEW
  ========================= */
  const loadInterview = useCallback(async () => {
    if (!interviewId) return;
    try {
      setLoading(true);
      setError(null);

      const res = await axios.get(`/v1/interviews/${interviewId}`);
      setInterview(res.data);

      // resume interview if already started
      if (res.data?.status === "in_progress") {
        await loadNextQuestion();
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load interview details.");
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  /* =========================
     START INTERVIEW
  ========================= */
  const startInterview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await axios.post(`/v1/interviews/${interviewId}/start`);

      // 🔥 FIX: backend response direct ya nested ho sakta hai
      const interviewData = res.data.interview || res.data;
      setInterview(interviewData);

      // first question
      if (res.data.question) {
        setCurrentQuestion(res.data.question);
        setConversation((prev) => [
          ...prev,
          { type: "question", text: res.data.question.question_text },
        ]);
        setQuestionCount(1);
      }
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to start interview";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  /* =========================
     LOAD NEXT QUESTION
  ========================= */
  const loadNextQuestion = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await axios.get(`/v1/interviews/${interviewId}/question`);

      if (!res.data?.question_text) {
        setCurrentQuestion(null);
        return;
      }

      setCurrentQuestion(res.data);
      setConversation((prev) => [
        ...prev,
        { type: "question", text: res.data.question_text },
      ]);
      setQuestionCount((prev) => prev + 1);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to load next question.");
      setCurrentQuestion(null);
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  /* =========================
     SUBMIT ANSWER
  ========================= */
  const submitAnswer = useCallback(
    async (answerText) => {
      if (!answerText?.trim()) return;

      try {
        setLoading(true);
        setError(null);

        setConversation((prev) => [
          ...prev,
          { type: "answer", text: answerText },
        ]);

        const res = await axios.post(`/v1/interviews/${interviewId}/answer`, {
          answer: answerText,
        });

        if (res.data?.feedback) {
          setConversation((prev) => [
            ...prev,
            {
              type: "feedback",
              text: Array.isArray(res.data.feedback)
                ? res.data.feedback.join(", ")
                : res.data.feedback,
            },
          ]);
        }

        if (res.data?.is_last_question) {
          setCurrentQuestion(null);
          await fetchSummary();
        } else {
          await loadNextQuestion();
        }
      } catch (err) {
        setError(err?.response?.data?.detail || "Failed to submit answer.");
      } finally {
        setLoading(false);
      }
    },
    [interviewId, loadNextQuestion]
  );

  /* =========================
     COMPLETE INTERVIEW
  ========================= */
  const completeInterview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await axios.post(`/v1/interviews/${interviewId}/complete`);

      if (res.data) {
        setInterview((prev) => ({
          ...(prev || {}),
          ...res.data,
          status: "completed",
        }));
      }

      setCurrentQuestion(null);
      await fetchSummary();
    } catch (err) {
      setError("Failed to complete interview.");
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  /* =========================
     FETCH SUMMARY
  ========================= */
  const fetchSummary = useCallback(async () => {
    try {
      const res = await axios.get(`/v1/interviews/${interviewId}/summary`);
      setInterview((prev) => ({
        ...(prev || {}),
        ai_summary: res.data,
      }));
    } catch (err) {
      // summary optional
    }
  }, [interviewId]);

  return {
    interview,
    loading,
    error,
    conversation,
    currentQuestion,
    questionCount,

    loadInterview,
    startInterview,
    loadNextQuestion,
    submitAnswer,
    completeInterview,
    fetchSummary,

    setError,
    setConversation,
  };
}