
import api from "../api/axios";

export const createConsultant = (payload) =>
  api.post("/v1/consultants", payload);

export const listConsultants = (params) =>
  api.get("/v1/consultants", { params });

export const getConsultant = (id) =>
  api.get(`/v1/consultants/${id}`);

export const classifyConsultant = (id, payload) =>
  api.put(`/v1/consultants/${id}/classify`, payload);

export const setSourcingConfig = (id, payload) =>
  api.put(`/v1/consultants/${id}/sourcing-config`, payload);

export const setPayrollSetup = (id, payload) =>
  api.put(`/v1/consultants/${id}/payroll-setup`, payload);

export const checkDeploymentEligibility = (id) =>
  api.get(`/v1/consultants/${id}/deployment-eligibility`);

export const validateDeploymentEligibility = (id) =>
  api.post(`/v1/consultants/${id}/validate-eligibility`);

export const getConsultantSummary = (id) =>
  api.get(`/v1/consultants/${id}/summary`);
// ===============================
// CONSULTANT SELF DASHBOARD
// ===============================
export const getConsultantDashboard = () =>
  api.get("/v1/consultant/dashboard");

// ===============================
// CONSULTANT SELF PROFILE
// ===============================
export const getMyConsultantProfile = () =>
  api.get("/v1/consultant/me");
