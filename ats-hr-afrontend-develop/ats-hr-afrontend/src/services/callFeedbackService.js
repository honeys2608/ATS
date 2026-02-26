import api from "../api/axios";

const BASE_URL = "/v1/recruiter";

/**
 * Create a new call feedback entry
 */
export const createCallFeedback = async (feedbackData) => {
  const response = await api.post(`${BASE_URL}/call-feedback`, feedbackData);
  return response.data;
};

/**
 * Get all call feedback for a candidate
 */
export const getCandidateCallFeedback = async (candidateId) => {
  const response = await api.get(
    `${BASE_URL}/candidates/${candidateId}/call-feedback`,
  );
  return response.data;
};

/**
 * Get a single call feedback entry
 */
export const getCallFeedback = async (feedbackId) => {
  const response = await api.get(`${BASE_URL}/call-feedback/${feedbackId}`);
  return response.data;
};

/**
 * Update a call feedback entry
 */
export const updateCallFeedback = async (feedbackId, feedbackData) => {
  const response = await api.put(
    `${BASE_URL}/call-feedback/${feedbackId}`,
    feedbackData,
  );
  return response.data;
};

/**
 * Delete a call feedback entry
 */
export const deleteCallFeedback = async (feedbackId) => {
  const response = await api.delete(`${BASE_URL}/call-feedback/${feedbackId}`);
  return response.data;
};
