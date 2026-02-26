// src/services/candidateService.js
import api from "../api/axios";

/**
 * Helper to normalize Axios response
 */
function unwrap(res) {
  return res?.data?.data ?? res?.data;
}

/* =========================
   Auth / misc
   ========================= */

/**
 * registerUser - register new portal user (returns user + candidateId if created)
 * payload: { name, email, password, phone, ... }
 * Note: adapt endpoint to your backend auth register URL
 */
export async function registerUser(payload) {
  if (!payload) throw new Error("payload is required");
  const res = await api.post("/v1/auth/register", payload);
  return unwrap(res);
}

/* =========================
   Candidate CRUD & resume
   ========================= */

/**
 * createDirectCandidate - quick JSON create (no file). Use for quick-add / initial candidate record
 * payload should include source: "direct", is_direct: true (if your backend expects that)
 */
export async function createDirectCandidate(payload) {
  if (!payload) throw new Error("payload is required");
  const res = await api.post("/v1/candidates", payload);
  return unwrap(res);
}

/**
 * getCandidateById
 */
export async function getCandidateById(id) {
  if (!id) throw new Error("candidate id is required");
  const res = await api.get(`/v1/candidates/${id}`);
  return unwrap(res);
}

/* =========================
   Resume upload helpers
   ========================= */

/**
 * uploadResumeForCandidate
 * Convenience function that accepts a File and builds FormData with key "resume".
 * If your backend expects another key change "resume" to that key.
 *
 * onUploadProgress (optional) -> function(progressEvent) { ... }
 */
export async function uploadResumeForCandidate(
  candidateId,
  file,
  { onUploadProgress } = {},
) {
  if (!candidateId) throw new Error("candidateId is required");
  if (!file) throw new Error("file is required");

  const form = new FormData();
  // use key "resume" per your comment — change if backend expects "file"
  form.append("file", file);

  const res = await api.post(
    `/v1/candidates/${candidateId}/resume/upload`,
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
    },
  );
  return unwrap(res);
}

/**
 * uploadResumeFormData
 * If you already create FormData in the UI, use this and pass it directly.
 * Note: make sure you call with correct keys matching backend.
 */
export async function uploadResumeFormData(
  candidateId,
  formData,
  { onUploadProgress } = {},
) {
  if (!candidateId) throw new Error("candidateId is required");
  if (!formData) throw new Error("formData is required");
  const res = await api.post(
    `/v1/candidates/{candidate_id}/resume/upload`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
    },
  );
  return unwrap(res);
}

/* =========================
   Resume versions
   ========================= */

/**
 * getResumeVersions
 * GET /v1/candidates/{candidate_id}/resume/versions
 */
export async function getResumeVersions(candidateId) {
  if (!candidateId) throw new Error("candidateId is required");
  const res = await api.get(`/v1/candidates/${candidateId}/resume/versions`);
  return unwrap(res);
}

/**
 * restoreResumeVersion
 * POST /v1/candidates/{candidate_id}/resume/restore/{version_id}
 */
export async function restoreResumeVersion(candidateId, versionId) {
  if (!candidateId) throw new Error("candidateId is required");
  if (!versionId) throw new Error("versionId is required");
  const res = await api.post(
    `/v1/candidates/${candidateId}/resume/restore/${versionId}`,
  );
  return unwrap(res);
}

/* =========================
   Profile actions
   ========================= */

/**
 * forwardProfile
 * POST /v1/candidates/{candidate_id}/forward
 * payload example: { to_user_id: 123, message: "please review" }
 */
export async function forwardProfile(candidateId, payload = {}) {
  if (!candidateId) throw new Error("candidateId is required");
  const res = await api.post(`/v1/candidates/${candidateId}/forward`, payload);
  return unwrap(res);
}

/**
 * updateStatus
 * PUT /v1/candidates/{candidate_id}/status
 * payload example: { status: "shortlisted" }
 */
export async function updateStatus(candidateId, payload = {}) {
  if (!candidateId) throw new Error("candidateId is required");
  const res = await api.put(`/v1/candidates/${candidateId}/status`, payload);
  return unwrap(res);
}

/**
 * getTimeline
 * GET /v1/candidates/{candidate_id}/timeline
 */
export async function getTimeline(candidateId) {
  if (!candidateId) throw new Error("candidateId is required");
  const res = await api.get(`/v1/candidates/${candidateId}/timeline`);
  return unwrap(res);
}

/**
 * addCandidateNote
 * POST /v1/candidates/{candidate_id}/notes
 * payload: { text, author_id, pinned? }
 */
export async function addCandidateNote(candidateId, payload = {}) {
  if (!candidateId) throw new Error("candidateId is required");
  const note = payload?.note || payload?.text || "";
  if (!note) throw new Error("note payload is required");
  const res = await api.post(`/v1/candidates/${candidateId}/notes`, { note });
  return unwrap(res);
}

/* =========================
   Pool / merge / screening / classification
   ========================= */

/**
 * mergeCandidates
 * POST /v1/candidates/merge
 * payload: { candidate_ids: [...], keep_candidate_id? }
 * Backend should implement merging logic and return the merged record or success message.
 */

/**
 * initiateScreening
 * POST /v1/candidates/{candidate_id}/screening
 * payload: { mode: 'ai'|'f2f'|'online', meta? }
 */
export async function initiateScreening(candidateId, payload = {}) {
  if (!candidateId) throw new Error("candidateId is required");
  if (!payload || !payload.mode)
    throw new Error("payload.mode is required (ai|f2f|online)");
  const res = await api.post(
    `/v1/candidates/${candidateId}/screening`,
    payload,
  );
  return unwrap(res);
}

/**
 * classifyCandidate
 * PUT /v1/candidates/{candidate_id}/classification
 * payload: { classification: 'payroll'|'sourcing' }
 */
export async function classifyCandidate(candidateId, payload = {}) {
  if (!candidateId) throw new Error("candidateId is required");
  if (!payload || !payload.classification)
    throw new Error("payload.classification is required");
  const res = await api.put(
    `/v1/candidates/${candidateId}/classification`,
    payload,
  );
  return unwrap(res);
}

/* =========================
   Bulk actions
   =========================
   (existing sendBulkEmail kept below)
   ========================= */

/**
 * sendBulkEmail
 * POST /v1/candidates/email/send
 * payload: { candidate_ids: [...], subject, body, template_id? }
 */
export async function sendBulkEmail(payload = {}) {
  if (!payload) throw new Error("payload is required");
  const res = await api.post(`/v1/candidates/email/send`, payload);
  return unwrap(res);
}

/* =========================
   Convert -> employee
   ========================= */

/**
 * convertToEmployee
 * Calls POST /v1/employees/from-candidate/{candidate_id}
 * Backend should create an employee record and return it.
 */
export async function convertToEmployee(candidateId, payload = {}) {
  if (!candidateId) throw new Error("candidateId is required");
  const res = await api.post(
    `/v1/employees/from-candidate/${candidateId}`,
    payload,
  );
  return unwrap(res);
}

/* =========================
   Background verification (stubs)
   =========================
   NOTE: Your list earlier did not include BGV endpoints.
   I included stubs for the typical endpoints you will need.
   Confirm with backend or add/rename endpoints as required.
   ========================= */

/**
 * initiateBgvCheck
 * POST /v1/candidates/{candidate_id}/bgv/initiate
 * payload: { checks: ['identity','education'], vendor_id }
 */
export async function initiateBgvCheck(candidateId, payload = {}) {
  if (!candidateId) throw new Error("candidateId is required");
  const res = await api.post(`/v1/bgv/${candidateId}/initiate`, payload);
  return unwrap(res);
}

/**
 * assignBgvVendor
 * POST /v1/candidates/{candidate_id}/bgv/assign-vendor
 * payload: { vendor_id }
 */
export async function assignBgvVendor(candidateId, payload = {}) {
  if (!candidateId) throw new Error("candidateId is required");
  const res = await api.post(`/v1/bgv/${candidateId}/assign-vendor`, payload);
  return unwrap(res);
}

/**
 * getBgvReports
 * GET /v1/candidates/{candidate_id}/bgv/reports
 */
export async function getBgvReports(candidateId) {
  if (!candidateId) throw new Error("candidateId is required");
  const res = await api.get(`/v1/bgv/${candidateId}/reports`);
  return unwrap(res);
}

// src/services/candidateService.js
export async function listCandidates(params = {}) {
  const normalizedParams = { ...(params || {}) };
  const limitValue = Number(normalizedParams.limit);
  if (Number.isFinite(limitValue) && limitValue > 200) {
    normalizedParams.limit = 200;
  }

  try {
    const res = await api.get("/v1/candidates", { params: normalizedParams });
    return res.data?.data ?? res.data;
  } catch (error) {
    if (
      error?.response?.status === 422 &&
      normalizedParams.limit !== 200
    ) {
      const retryRes = await api.get("/v1/candidates", {
        params: { ...normalizedParams, limit: 200 },
      });
      return retryRes.data?.data ?? retryRes.data;
    }

    if (error?.response?.status !== 403) throw error;

    const attempts = [
      () => api.get("/workflow/candidates", { params: normalizedParams }),
      () => api.get("/v1/workflow/candidates", { params: normalizedParams }),
    ];

    for (const request of attempts) {
      try {
        const res = await request();
        const payload = res?.data?.data ?? res?.data ?? {};
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.candidates)) return payload.candidates;
        if (Array.isArray(payload?.items)) return payload.items;
        return [];
      } catch (fallbackError) {
        if (![403, 404].includes(fallbackError?.response?.status)) {
          throw fallbackError;
        }
      }
    }

    return [];
  }
}

/**
 * searchCandidates - Simple search with basic filters
 * @param {Object} params - Search parameters
 *   - keyword: string to search
 *   - logic: "AND" or "OR"
 *   - min_exp: minimum experience
 *   - max_exp: maximum experience
 *   - location: location filter
 *   - limit: results per page
 *   - offset: pagination offset
 * @returns {Object} { total, count, limit, offset, results }
 */
export async function searchCandidates(params = {}) {
  // Clean up empty parameters
  const cleanParams = Object.entries(params).reduce((acc, [key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      acc[key] = value;
    }
    return acc;
  }, {});

  try {
    const res = await api.get("/v1/candidates/search", { params: cleanParams });
    return unwrap(res);
  } catch (error) {
    console.error("Search API error:", error);
    throw error;
  }
}

/* =========================
   Candidate Bulk Upload
   ========================= */

export async function bulkUploadCandidates(file, { onUploadProgress } = {}) {
  if (!file) throw new Error("file is required");
  const form = new FormData();
  form.append("file", file);
  const res = await api.post("/v1/candidates/bulk-upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress,
  });
  return unwrap(res);
}

export async function bulkResumeUploadCandidates(
  files = [],
  { duplicateOption = "skip", onUploadProgress } = {},
) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("files are required");
  }
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  form.append("duplicate_option", duplicateOption);
  const res = await api.post("/v1/candidates/bulk-resume-upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress,
  });
  return unwrap(res);
}

export async function getCandidateBulkUploadHistory() {
  const res = await api.get("/v1/candidates/bulk-upload/history");
  return unwrap(res);
}

export async function bulkResumeUploadCandidatesAsync(
  files = [],
  { duplicateOption = "skip" } = {},
) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("files are required");
  }
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  form.append("duplicate_option", duplicateOption);
  const res = await api.post("/v1/candidates/bulk-resume-upload-async", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return unwrap(res);
}

export async function getBulkUploadStatus(taskId) {
  if (!taskId) throw new Error("taskId is required");
  const res = await api.get(`/v1/candidates/bulk-upload-status/${taskId}`);
  return unwrap(res);
}

export async function verifyCandidatesBulk(ids = []) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error("ids are required");
  }
  const res = await api.post("/v1/candidates/verify-bulk", { ids });
  return unwrap(res);
}

export async function mergeCandidates(payload = {}) {
  if (!payload.candidate_ids || payload.candidate_ids.length < 2) {
    throw new Error("At least two candidate_ids are required");
  }
  const res = await api.post("/v1/candidates/merge", payload);
  return unwrap(res);
}

export default {
  registerUser,
  createDirectCandidate,
  listCandidates,
  searchCandidates,
  getCandidateById,
  uploadResumeForCandidate,
  uploadResumeFormData,
  getResumeVersions,
  restoreResumeVersion,
  forwardProfile,
  updateStatus,
  getTimeline,
  addCandidateNote,
  mergeCandidates, // added
  initiateScreening, // added
  classifyCandidate, // added
  sendBulkEmail,
  convertToEmployee,
  // bgv stubs
  initiateBgvCheck,
  assignBgvVendor,
  getBgvReports,
  bulkUploadCandidates,
  bulkResumeUploadCandidates,
  bulkResumeUploadCandidatesAsync,
  getBulkUploadStatus,
  getCandidateBulkUploadHistory,
  verifyCandidatesBulk,
};
