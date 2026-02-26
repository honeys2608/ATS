import api from "../api/axios";
import { getAssignedJobs as getAssignedJobsFromJobService } from "./jobService";

/**
 * Recruiter Service
 * Handles all recruiter-related API calls
 */

// ============================================================
// Profile Management
// ============================================================

/**
 * Get recruiter's own profile
 * @returns {Promise} Recruiter profile data
 */
export const getRecruiterProfile = () => {
  return api.get("/v1/recruiter/profile").then(unwrap);
};

/**
 * Update recruiter's profile
 * @param {Object} profileData - Profile data to update
 * @param {string} profileData.full_name - Full name
 * @param {string} profileData.phone - Phone number (E.164 format)
 * @returns {Promise} Updated profile data
 */
export const updateRecruiterProfile = (profileData) => {
  return api.put("/v1/recruiter/profile", profileData).then(unwrap);
};

// ============================================================
// Jobs Management
// ============================================================

/**
 * Get all assigned jobs for recruiter
 * @returns {Promise} List of assigned jobs
 */
export const getAssignedJobs = () => {
  return getAssignedJobsFromJobService().then((res) => unwrap(res));
};

/**
 * Get job submissions for a specific job
 * @param {string} jobId - Job ID
 * @returns {Promise} List of candidates who applied for job
 */
export const getJobSubmissions = (jobId) => {
  return api.get(`/v1/recruiter/jobs/${jobId}/submissions`).then(unwrap);
};

/**
 * Get job details (Recruiter view)
 * @param {string} jobId - Job ID
 * @returns {Promise} Job details
 */
export const getJobDetail = (jobId) => {
  return api.get(`/v1/recruiter/jobs/${jobId}`).then(unwrap);
};

/**
 * Mark candidate as sent to Account Manager
 * @param {string} applicationId - Application ID
 * @returns {Promise} Updated application status
 */
export const sendCandidateToAM = (applicationId) => {
  return api
    .put(`/v1/recruiter/applications/${applicationId}/send-to-am`)
    .then(unwrap);
};

// ============================================================
// Utility Functions
// ============================================================

/**
 * Unwrap API response (handle nested data structure)
 * @param {Object} response - API response
 * @returns {Object} Unwrapped data
 */
function unwrap(response) {
  return response.data?.data || response.data;
}

// ============================================================
// Validation Helpers
// ============================================================

/**
 * Validate full name
 * @param {string} fullName - Name to validate
 * @returns {string|null} Error message or null if valid
 */
export const validateFullName = (fullName) => {
  if (!fullName || fullName.trim().length === 0) {
    return "Full name is required";
  }
  if (fullName.length < 2) {
    return "Full name must be at least 2 characters";
  }
  if (fullName.length > 100) {
    return "Full name cannot exceed 100 characters";
  }
  if (!fullName[0].match(/[A-Z]/)) {
    return "Full name must start with capital letter";
  }
  return null;
};

/**
 * Validate phone number (10 digits)
 * @param {string} phone - Phone number to validate
 * @returns {string|null} Error message or null if valid
 */
export const validatePhone = (phone) => {
  if (!phone || phone.trim().length === 0) {
    return "Phone number is required";
  }

  // Extract only digits
  const digits = phone.replace(/\D/g, "");

  if (digits.length !== 10) {
    return "Phone must be exactly 10 digits";
  }

  return null;
};

/**
 * Format phone to standard format
 * @param {string} phone - Phone to format
 * @returns {string} Formatted phone
 */
export const formatPhoneE164 = (phone) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 10) return phone; // Invalid
  return "+" + digits;
};
