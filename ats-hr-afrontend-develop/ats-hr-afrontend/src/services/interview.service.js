import axios from "../api/axios";

/**
 * ================================
 * CHAT AI INTERVIEW – API SERVICE
 * ================================
 */

/* --------------------------------
   CREATE CHAT INTERVIEW
-------------------------------- */
export const createInterview = async (payload) => {
  return axios.post("/v1/interviews", payload);
};

/* --------------------------------
   LIST ALL CHAT INTERVIEWS
-------------------------------- */
export const listInterviews = async () => {
  return axios.get("/v1/interviews");
};

/* --------------------------------
   GET INTERVIEW BY ID
-------------------------------- */
export const getInterviewById = async (interviewId) => {
  return axios.get(`/v1/interviews/${interviewId}`);
};

/* --------------------------------
   UPDATE INTERVIEW
-------------------------------- */
export const updateInterview = async (interviewId, payload) => {
  return axios.put(`/v1/interviews/${interviewId}`, payload);
};

/* --------------------------------
   START CHAT INTERVIEW
-------------------------------- */
export const startChatInterview = async (interviewId) => {
  return axios.post(`/v1/interviews/${interviewId}/start`);
};

/* --------------------------------
   GET NEXT QUESTION
-------------------------------- */
export const getNextQuestion = async (interviewId) => {
  return axios.get(`/v1/interviews/${interviewId}/question`);
};

/* --------------------------------
   SUBMIT ANSWER
-------------------------------- */
export const submitAnswer = async (interviewId, answer) => {
  return axios.post(`/v1/interviews/${interviewId}/answer`, { answer });
};

/* --------------------------------
   COMPLETE INTERVIEW
-------------------------------- */
export const completeInterview = async (interviewId) => {
  return axios.post(`/v1/interviews/${interviewId}/complete`);
};

/* --------------------------------
   ✅ FETCH FINAL SUMMARY (FIXED)
   Backend:
   GET /v1/interview-summary/{candidate_id}/{job_id}
-------------------------------- */
export const fetchInterviewSummary = async (candidateId, jobId) => {
  return axios.get(`/v1/interview-summary/${candidateId}/${jobId}`);
};

/* --------------------------------
   SUBMIT HUMAN FEEDBACK
-------------------------------- */
export const submitInterviewFeedback = async (interviewId, payload) => {
  return axios.post(`/v1/interviews/${interviewId}/submit-feedback`, payload);
};