import axios from "../api/axios";

/**
 * ======================================
 * LIVE INTERVIEW – API SERVICE
 * Backend: /v1/live-interviews
 * ======================================
 */

/* --------------------------------
   CREATE LIVE INTERVIEW
-------------------------------- */
export const createLiveInterview = async (payload) => {
  /**
   * payload:
   * {
   *   candidate_id: string,
   *   job_id: string,
   *   recording_enabled?: boolean
   * }
   */
  return axios.post("/v1/live-interviews", payload);
};

/* --------------------------------
   JOIN LIVE INTERVIEW
-------------------------------- */
export const joinLiveInterview = async (interviewId) => {
  return axios.post(`/v1/live-interviews/${interviewId}/join`);
};

/* --------------------------------
   START LIVE INTERVIEW
-------------------------------- */
export const startLiveInterview = async (interviewId) => {
  return axios.post(`/v1/live-interviews/${interviewId}/start`);
};

/* --------------------------------
   END LIVE INTERVIEW
-------------------------------- */
export const endLiveInterview = async (interviewId) => {
  return axios.post(`/v1/live-interviews/${interviewId}/end`);
};

/* --------------------------------
   UPDATE RECORDING URL
-------------------------------- */
export const updateLiveInterviewRecording = async (
  interviewId,
  recordingUrl
) => {
  return axios.post(`/v1/live-interviews/${interviewId}/recording`, {
    recording_url: recordingUrl,
  });
};

/* --------------------------------
   FETCH LIVE INTERVIEW LOGS
-------------------------------- */
export const fetchLiveInterviewLogs = async () => {
  return axios.get("/v1/live-interviews/logs");
};