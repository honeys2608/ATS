import api from "../api/axios";

const unwrap = (res) => res.data?.data || res.data;

// Account Manager endpoints
export const getAmRequirements = (params = {}) =>
  api.get("/v1/workflow/am/requirements", { params }).then(unwrap);

export const createRequirement = (payload) =>
  api.post("/v1/workflow/am/requirements", payload).then(unwrap);

export const parseRequirementEmail = (rawEmail) =>
  api
    .post("/v1/workflow/am/requirements/parse-email", { raw_email: rawEmail })
    .then(unwrap);

export const assignRecruiters = (requirementId, payload) =>
  api
    .post(`/v1/workflow/am/requirements/${requirementId}/assign`, payload)
    .then(unwrap);

export const getAmRequirementDetail = (requirementId) =>
  api.get(`/v1/workflow/am/requirements/${requirementId}`).then(unwrap);

export const updateSubmissionStage = (submissionId, payload) =>
  api.post(`/v1/workflow/am/submissions/${submissionId}/stage`, payload).then(unwrap);

export const markClientInformed = (interviewId) =>
  api.post(`/v1/workflow/am/interviews/${interviewId}/client-informed`).then(unwrap);

// Recruiter endpoints
export const getRecruiterRequirements = (scope = "assigned") =>
  api.get("/v1/workflow/recruiter/requirements", { params: { scope } }).then(unwrap);

export const getRecruiterRequirementDetail = (requirementId) =>
  api.get(`/v1/workflow/recruiter/requirements/${requirementId}`).then(unwrap);

export const runMatch = (requirementId, minScore = 0) =>
  api
    .post(`/v1/workflow/recruiter/requirements/${requirementId}/match`, {
      min_score: minScore,
    })
    .then(unwrap);

export const addCallNote = (requirementId, candidateId, payload) =>
  api
    .post(
      `/v1/workflow/recruiter/requirements/${requirementId}/candidates/${candidateId}/call-note`,
      payload,
    )
    .then(unwrap);

export const submitCandidates = (requirementId, payload) =>
  api
    .post(`/v1/workflow/recruiter/requirements/${requirementId}/submit`, payload)
    .then(unwrap);

export const getRecruiterSubmissions = (requirementId) =>
  api.get(`/v1/workflow/recruiter/requirements/${requirementId}/submissions`).then(unwrap);

export const scheduleInterview = (submissionId, payload) =>
  api
    .post(`/v1/workflow/recruiter/submissions/${submissionId}/schedule-interview`, payload)
    .then(unwrap);

export const addInterviewNotes = (submissionId, payload) =>
  api
    .post(`/v1/workflow/recruiter/submissions/${submissionId}/interview-notes`, payload)
    .then(unwrap);

export default {
  getAmRequirements,
  createRequirement,
  parseRequirementEmail,
  assignRecruiters,
  getAmRequirementDetail,
  updateSubmissionStage,
  markClientInformed,
  getRecruiterRequirements,
  getRecruiterRequirementDetail,
  runMatch,
  addCallNote,
  submitCandidates,
  getRecruiterSubmissions,
  scheduleInterview,
  addInterviewNotes,
};
