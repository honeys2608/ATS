import axios from "../api/axios";

/**
 * ======================================
 * AI VIDEO INTERVIEW – API SERVICE
 * Backend: /v1/ai-video-interviews
 * ======================================
 */

/* --------------------------------
   CREATE AI VIDEO INTERVIEW
-------------------------------- */
export const createAIVideoInterview = async (payload) => {
  /**
   * payload:
   * {
   *   candidate_id: string,
   *   job_id: string,
   *   recording_enabled?: boolean
   * }
   */
  return axios.post("/v1/ai-video-interviews", payload);
};

/* --------------------------------
   START AI VIDEO INTERVIEW
-------------------------------- */
export const startAIVideoInterview = async (interviewId) => {
  return axios.post(`/v1/ai-video-interviews/${interviewId}/start`);
};

/* --------------------------------
   SUBMIT VIDEO ANSWER (PER QUESTION)
-------------------------------- */
export const submitVideoAnswer = async (
  interviewId,
  questionIndex,
  videoUrl,
  duration
) => {
  /**
   * payload:
   * {
   *   question_index: number,
   *   video_url: string,
   *   duration?: number
   * }
   */
  return axios.post(`/v1/ai-video-interviews/${interviewId}/answer`, {
    question_index: questionIndex,
    video_url: videoUrl,
    duration,
  });
};

/* --------------------------------
   COMPLETE AI VIDEO INTERVIEW
-------------------------------- */
export const completeAIVideoInterview = async (interviewId) => {
  return axios.post(`/v1/ai-video-interviews/${interviewId}/complete`);
};

/* --------------------------------
   FETCH AI VIDEO INTERVIEW LOGS
-------------------------------- */
export const fetchAIVideoInterviewLogs = async () => {
  return axios.get("/v1/ai-video-interviews/logs");
};