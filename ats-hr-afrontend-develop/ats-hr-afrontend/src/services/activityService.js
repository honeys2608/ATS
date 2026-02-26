// src/services/activityService.js

import api from "../api/axios";

const activityService = {
  async getFeed(params = {}) {
    const response = await api.get("/v1/activity/feed", { params });
    return response.data;
  },

  async getMyActivity(params = {}) {
    const response = await api.get("/v1/activity/me", { params });
    return response.data;
  },

  async getCandidateActivity(candidateId, params = {}) {
    const response = await api.get(`/v1/activity/candidate/${candidateId}`, {
      params,
    });
    return response.data;
  },

  async getCandidatePortalActivity(candidateId, params = {}) {
    const response = await api.get(
      `/v1/activity/candidate/${candidateId}/portal`,
      { params },
    );
    return response.data;
  },

  async getJobActivity(jobId, params = {}) {
    const response = await api.get(`/v1/activity/job/${jobId}`, { params });
    return response.data;
  },

  async getRecruiterActivity(recruiterId, params = {}) {
    const response = await api.get(`/v1/activity/recruiter/${recruiterId}`, {
      params,
    });
    return response.data;
  },

  async getStats(params = {}) {
    const response = await api.get("/v1/activity/stats", { params });
    return response.data;
  },

  /**
   * Create a new activity record
   * @param {Object} activity - Activity data
   * @returns {Promise} API response
   */
  async createActivity(activity) {
    try {
      const response = await api.post("/v1/activities", activity);
      return response.data;
    } catch (error) {
      console.error("Error creating activity:", error);
      throw error;
    }
  },

  /**
   * Get activities for a specific entity
   * @param {string} entityType - 'job', 'candidate', or 'application'
   * @param {string} entityId - Entity ID
   * @param {number} limit - Number of activities to fetch
   * @returns {Promise} API response with activity summary
   */
  async getEntityActivities(entityType, entityId, limit = 20) {
    try {
      const response = await api.get(
        `/v1/activities/${entityType}/${entityId}`,
        {
          params: { limit },
        },
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching entity activities:", error);
      throw error;
    }
  },

  /**
   * Get stale entities (with no recent activity)
   * @param {string} entityType - 'job', 'candidate', or 'application'
   * @param {number} days - Number of days to consider as stale
   * @param {number} limit - Number of results to fetch
   * @returns {Promise} API response with stale entities
   */
  async getStaleEntities(entityType, days = 14, limit = 50) {
    try {
      const response = await api.get(`/v1/activities/stale/${entityType}`, {
        params: { days, limit },
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching stale entities:", error);
      throw error;
    }
  },

  /**
   * Get activity dashboard summary
   * @returns {Promise} API response with dashboard data
   */
  async getDashboardSummary() {
    try {
      const response = await api.get("/v1/activities/dashboard/summary");
      return response.data;
    } catch (error) {
      console.error("Error fetching activity dashboard summary:", error);
      throw error;
    }
  },

  // Convenience methods for common activity types

  /**
   * Track job creation activity
   * @param {string} jobId - Job ID
   * @returns {Promise} API response
   */
  async trackJobCreated(jobId) {
    return this.createActivity({
      entity_type: "job",
      entity_id: jobId,
      activity_type: "Job Created",
      description: "Job created",
    });
  },

  /**
   * Track job update activity
   * @param {string} jobId - Job ID
   * @param {Object} changes - Changes made to the job
   * @returns {Promise} API response
   */
  async trackJobUpdated(jobId, changes = {}) {
    return this.createActivity({
      entity_type: "job",
      entity_id: jobId,
      activity_type: "Job Updated",
      description: "Job details updated",
      metadata: { changes },
    });
  },

  /**
   * Track candidate application activity
   * @param {string} candidateId - Candidate ID
   * @param {string} jobId - Job ID
   * @param {string} applicationId - Application ID
   * @returns {Promise} API response
   */
  async trackCandidateApplied(candidateId, jobId, applicationId) {
    return this.createActivity({
      entity_type: "candidate",
      entity_id: candidateId,
      activity_type: "Candidate Applied",
      description: "Applied to job",
      metadata: { job_id: jobId, application_id: applicationId },
    });
  },

  /**
   * Track candidate creation activity
   * @param {string} candidateId - Candidate ID
   * @returns {Promise} API response
   */
  async trackCandidateCreated(candidateId) {
    return this.createActivity({
      entity_type: "candidate",
      entity_id: candidateId,
      activity_type: "Candidate Added",
      description: "Candidate added to system",
    });
  },

  /**
   * Track resume upload activity
   * @param {string} candidateId - Candidate ID
   * @returns {Promise} API response
   */
  async trackResumeUploaded(candidateId) {
    return this.createActivity({
      entity_type: "candidate",
      entity_id: candidateId,
      activity_type: "Resume Uploaded",
      description: "Resume uploaded/updated",
    });
  },

  /**
   * Track application status change
   * @param {string} applicationId - Application ID
   * @param {string} oldStatus - Previous status
   * @param {string} newStatus - New status
   * @returns {Promise} API response
   */
  async trackApplicationStatusChanged(applicationId, oldStatus, newStatus) {
    return this.createActivity({
      entity_type: "application",
      entity_id: applicationId,
      activity_type: "Application Status Changed",
      description: `Status changed from ${oldStatus} to ${newStatus}`,
      metadata: { old_status: oldStatus, new_status: newStatus },
    });
  },

  /**
   * Track interview scheduling
   * @param {string} applicationId - Application ID
   * @param {Date|string} interviewDate - Interview date
   * @returns {Promise} API response
   */
  async trackInterviewScheduled(applicationId, interviewDate) {
    return this.createActivity({
      entity_type: "application",
      entity_id: applicationId,
      activity_type: "Interview Scheduled",
      description: `Interview scheduled for ${new Date(interviewDate).toLocaleDateString()}`,
      metadata: { interview_date: interviewDate },
    });
  },
};

export default activityService;
