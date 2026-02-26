// src/services/jobService.js
import api from "../api/axios";

const toArray = (value) => (Array.isArray(value) ? value : []);

const pick = (...values) => {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
};

const normalizeSkills = (skills) =>
  toArray(skills)
    .map((skill) => (typeof skill === "string" ? skill : skill?.name || ""))
    .filter(Boolean);

const mapRequirementToAssignedJob = (requirement = {}) => {
  const id = String(
    pick(requirement.id, requirement.job_id, requirement.requirement_id),
  ).trim();
  const minimumExperience = pick(
    requirement.min_experience,
    requirement.minimum_experience,
    requirement.experience_min,
  );
  const maximumExperience = pick(
    requirement.max_experience,
    requirement.maximum_experience,
    requirement.experience_max,
  );

  return {
    ...requirement,
    id,
    job_id: String(pick(requirement.job_id, requirement.id, requirement.requirement_id)).trim(),
    requirement_id: String(pick(requirement.requirement_id, requirement.id, requirement.job_id)).trim(),
    title: pick(requirement.title, requirement.job_title, requirement.requirement_title),
    location: pick(requirement.location, requirement.job_location, requirement.city),
    department: pick(requirement.department, requirement.practice, requirement.domain),
    skills: normalizeSkills(
      pick(
        requirement.skills,
        requirement.skills_mandatory,
        requirement.required_skills,
      ) || [],
    ),
    status: String(
      pick(requirement.status, requirement.workflow_status, requirement.stage, "active"),
    )
      .trim()
      .toLowerCase(),
    mode: String(pick(requirement.mode, requirement.work_mode, requirement.work_type)).trim().toLowerCase(),
    min_experience: minimumExperience,
    max_experience: maximumExperience,
    experience:
      minimumExperience !== "" || maximumExperience !== ""
        ? `${minimumExperience || 0} - ${maximumExperience || "Any"} yrs`
        : "",
    no_of_positions: Number(pick(requirement.no_of_positions, requirement.positions_count, requirement.openings) || 1),
    budget: pick(requirement.budget, requirement.salary_range, requirement.ctc_range),
    client_name: pick(
      requirement.client_name,
      requirement.client?.client_name,
      requirement.client?.name,
      requirement.company_name,
    ),
    account_manager: requirement.account_manager || requirement.am || null,
    created_at: pick(requirement.created_at, requirement.assigned_at, requirement.updated_at),
    updated_at: pick(requirement.updated_at, requirement.created_at),
  };
};

const extractAssignedJobsFromPayload = (payload = {}) => {
  const directJobs = toArray(
    payload?.jobs || payload?.data?.jobs || payload?.data || payload,
  );
  if (directJobs.length > 0) return directJobs;

  const workflowRequirements = toArray(
    payload?.requirements || payload?.data?.requirements,
  );
  return workflowRequirements.map(mapRequirementToAssignedJob);
};

/* =======================
   JOB CORE
======================= */

/**
 * Get job by ID
 * GET /v1/jobs/:jobId
 */
export const getJob = (jobId) => {
  return api.get(`/v1/jobs/${jobId}`);
};

/**
 * Create a new job
 * POST /v1/jobs
 */
export const createJob = (payload) => {
  return api.post("/v1/jobs", payload);
};

/**
 * Update job
 * PUT /v1/jobs/:jobId
 */
export const updateJob = (jobId, payload) => {
  return api.put(`/v1/jobs/${jobId}`, payload);
};

/**
 * Get ALL jobs
 * GET /v1/jobs
 */
export const listJobs = (params = {}) => {
  return api.get("/v1/jobs", { params });
};

/**
 * Get assigned jobs for recruiter
 * GET /v1/recruiter/assigned-jobs
 */
export const getAssignedJobs = async () => {
  const attempts = [
    () => api.get("/v1/recruiter/assigned-jobs"),
    () => api.get("/v1/workflow/recruiter/requirements", { params: { scope: "assigned" } }),
    () => api.get("/v1/workflow/recruiter/requirements"),
  ];

  let lastError = null;
  for (const request of attempts) {
    try {
      const response = await request();
      const jobs = extractAssignedJobsFromPayload(response?.data);
      return {
        ...response,
        data: {
          ...(response?.data || {}),
          jobs,
          total: Number(response?.data?.total || jobs.length),
        },
      };
    } catch (error) {
      lastError = error;
      const status = error?.response?.status;
      if (![403, 404].includes(status)) {
        throw error;
      }
    }
  }

  throw lastError || new Error("Failed to load assigned jobs");
};

/* =======================
   JOB SUBMISSIONS / APPLICATIONS
======================= */

/**
 * Get ALL job submissions (Admin / Recruiter dashboard)
 * GET /v1/jobs/submissions
 */
export const getAllJobSubmissions = () => {
  return api.get("/v1/jobs/submissions");
};

/**
 * Get candidates submitted for a specific job
 * (Account Manager review screen)
 * GET /v1/jobs/:jobId/submissions
 */
/**
 * Recruiter view – job submissions
 * GET /v1/recruiter/jobs/:jobId/submissions
 */
export const getRecruiterJobCandidates = (jobId) => {
  return api.get(`/v1/recruiter/jobs/${jobId}/submissions`);
};

/**
 * Generic / AM view – job submissions
 * GET /v1/jobs/:jobId/submissions
 */
export const getJobCandidates = (jobId) => {
  return api.get(`/v1/jobs/${jobId}/submissions`);
};

/**
 * Update application status
 * (Shortlisted / Interview / Rejected / Selected)
 *
 * Preferred endpoint
 * PATCH /v1/applications/:applicationId/status
 */
export const updateApplicationStatus = (applicationId, status) => {
  return api.patch(`/v1/applications/${applicationId}/status`, { status });
};

/**
 * Legacy / alternate endpoint (keep if used anywhere)
 * PUT /v1/jobs/job-applications/:applicationId/status
 */
export const updateApplicationStatusLegacy = (applicationId, status) => {
  return api.put(`/v1/jobs/job-applications/${applicationId}/status`, {
    status,
  });
};

/* =======================
   JOB DESCRIPTION (JD)
======================= */

/**
 * Upload Job Description
 * POST /v1/jobs/:jobId/jd
 */
export const uploadJobJD = (jobId, formData) => {
  return api.post(`/v1/jobs/${jobId}/jd`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

/* =======================
   AM → RECRUITER ASSIGNMENT
======================= */

/**
 * Assign recruiters to job
 * POST /v1/jobs/:jobId/assign
 */
export const assignRecruiters = async (jobId, recruiterIds = []) => {
  for (const recruiterId of recruiterIds) {
    await api.post("/v1/am/assign-recruiter", {
      job_id: jobId,
      recruiter_id: recruiterId,
    });
  }

  return true;
};

/* =======================
   RECRUITER → AM SUBMISSIONS
======================= */

/**
 * Submit SINGLE candidate to Account Manager
 * POST /v1/jobs/:jobId/submissions
 */
export const submitCandidateToAM = (jobId, candidateId) => {
  return api.post(`/v1/jobs/${jobId}/submissions`, {
    candidate_id: candidateId,
  });
};

/**
 * Submit MULTIPLE candidates to Account Manager (bulk)
 * POST /v1/jobs/:jobId/submissions
 */
export const submitCandidatesToAM = (jobId, candidateIds) => {
  return api.post(`/v1/jobs/${jobId}/submissions`, {
    candidate_ids: candidateIds,
  });
};

/**
 * Generic job submission creator
 * (Used by public portal / candidate apply flow)
 * POST /v1/jobs/:jobId/submissions
 */
export const createJobSubmission = (jobId, candidateId) => {
  return api.post(`/v1/jobs/${jobId}/submissions`, {
    candidate_id: candidateId,
  });
};

/* =======================
   AI MATCHING
======================= */

/**
 * Run AI matching for a job
 * POST /v1/jobs/:jobId/match
 */
export const matchCandidates = (jobId) => {
  return api.post(`/v1/jobs/${jobId}/match`);
};

/* =======================
   RECRUITER ASSIGNED JOBS
======================= */

/**
 * Get specific assigned job details for recruiter
 * GET /v1/recruiter/assigned-jobs/:jobId
 */
export const getRecruiterJobDetail = (jobId) => {
  return api.get(`/v1/recruiter/assigned-jobs/${jobId}`);
};

/**
 * Get candidate pool for a specific job
 * GET /v1/recruiter/assigned-jobs/:jobId/candidate-pool
 */
export const getJobCandidatePool = (jobId) => {
  return api.get(`/v1/recruiter/assigned-jobs/${jobId}/candidate-pool`);
};

/**
 * Send selected candidates to AM for a job
 * POST /v1/recruiter/assigned-jobs/:jobId/send-candidates-to-am
 */
export const sendJobCandidatesToAM = (jobId, candidateIds) => {
  return api.post(
    `/v1/recruiter/assigned-jobs/${jobId}/send-candidates-to-am`,
    {
      candidate_ids: candidateIds,
    },
  );
};
