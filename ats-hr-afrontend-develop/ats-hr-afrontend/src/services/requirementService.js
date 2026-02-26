import api from "../api/axios";

function unwrap(res) {
  return res.data?.data || res.data;
}

// Get all available active requirements for recruiter
export const getAvailableRequirements = () =>
  api.get("/v1/recruiter/available-requirements").then(unwrap);

// Get requirement details
export const getRequirementDetail = (requirementId) =>
  api.get(`/v1/recruiter/requirements/${requirementId}/detail`).then(unwrap);

// Get candidates from pool for a specific requirement
export const getRequirementCandidatePool = (requirementId) =>
  api
    .get(`/v1/recruiter/requirements/${requirementId}/candidate-pool`)
    .then(unwrap);

// Send selected candidates to Account Manager
export const sendCandidatesToAM = (requirementId, candidateIds) =>
  api
    .post(`/v1/recruiter/requirements/${requirementId}/send-candidates-to-am`, {
      candidate_ids: candidateIds,
    })
    .then(unwrap);

export default {
  getAvailableRequirements,
  getRequirementDetail,
  getRequirementCandidatePool,
  sendCandidatesToAM,
};
