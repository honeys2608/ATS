import { useState, useCallback } from "react";
import {
  getInterviewById,
  startChatInterview,
  getNextQuestion,
  submitAnswer,
  completeInterview,
  fetchInterviewSummary,
} from "../services/interview.service";

export default function useChatInterview(interviewId) {
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [conversation, setConversation] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionCount, setQuestionCount] = useState(0);

  /* ---------------- LOAD INTERVIEW ---------------- */
  const loadInterview = useCallback(async () => {
    if (!interviewId) return;
    try {
      setLoading(true);
      const res = await getInterviewById(interviewId);
      setInterview(res.data);
    } catch {
      setError("Failed to load interview");
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  /* ---------------- START ---------------- */
  const startInterview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await startChatInterview(interviewId);

      if (res.data?.question?.question_text) {
        setCurrentQuestion(res.data.question);
        setConversation([
          { type: "question", text: res.data.question.question_text },
        ]);
        setQuestionCount(1);
      }
    } catch {
      setError("Failed to start interview");
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  /* ---------------- NEXT QUESTION ---------------- */
  const loadNext = useCallback(async () => {
    const res = await getNextQuestion(interviewId);
    if (!res.data?.question_text) {
      setCurrentQuestion(null);
      return;
    }

    setCurrentQuestion(res.data);
    setConversation((p) => [
      ...p,
      { type: "question", text: res.data.question_text },
    ]);
    setQuestionCount((p) => p + 1);
  }, [interviewId]);

  /* ---------------- ANSWER ---------------- */
  const answerQuestion = useCallback(
    async (answerText) => {
      if (!answerText?.trim()) return;

      try {
        setLoading(true);
        setError(null);

        // show answer in chat
        setConversation((p) => [...p, { type: "answer", text: answerText }]);

        const res = await submitAnswer(interviewId, answerText);

        if (res.data?.feedback) {
          setConversation((p) => [
            ...p,
            {
              type: "feedback",
              text: Array.isArray(res.data.feedback)
                ? res.data.feedback.join(", ")
                : res.data.feedback,
            },
          ]);
        }

        /* ---------- LAST QUESTION ---------- */
        if (res.data?.is_last_question) {
          setCurrentQuestion(null);

          // 1️⃣ complete interview (backend)
          await completeInterview(interviewId);

          // 2️⃣ SHOW COMPLETION MESSAGE IN CHAT ✅
          setConversation((p) => [
            ...p,
            {
              type: "system",
              text: "✅ Your interview is completed. Thank you for your time.",
            },
          ]);

          // 3️⃣ update status locally
          setInterview((prev) => ({
            ...(prev || {}),
            status: "completed",
          }));

          // 4️⃣ fetch summary OPTIONAL (do NOT break chat)
          try {
            const summaryRes = await fetchInterviewSummary(
              interview.candidate_id,
              interview.job_id
            );

            setInterview((prev) => ({
              ...(prev || {}),
              summary: summaryRes.data,
            }));
          } catch {
            // summary failure should NOT affect chat UX
            console.warn("Summary fetch failed, interview already completed");
          }
        } else {
          await loadNext();
        }
      } catch (e) {
        console.error(e);
        setError("Failed to submit answer");
      } finally {
        setLoading(false);
      }
    },
    [interviewId, interview, loadNext]
  );

  return {
    interview,
    loading,
    error,

    conversation,
    currentQuestion,
    questionCount,

    loadInterview,
    startInterview,
    answerQuestion,
  };
}