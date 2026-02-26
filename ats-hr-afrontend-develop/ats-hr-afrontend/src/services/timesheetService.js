import api from "../api/axios";

const normalize = (res) => {
  if (!res) return null;
  return res?.data?.data ?? res?.data ?? null;
};

// ===============================
// CONSULTANT
// ===============================

// Create / Update timesheet
export const saveTimesheet = async (deploymentId, payload) => {
  const res = await api.post(
    `/v1/timesheets/deployments/${deploymentId}`,
    payload
  );
  return normalize(res);
};

// Submit timesheet
export const submitTimesheet = async (timesheetId) => {
  const res = await api.post(`/v1/timesheets/${timesheetId}/submit`);
  return normalize(res);
};

// Get consultant timesheets
export const getConsultantTimesheets = async () => {
  const res = await api.get(`/v1/timesheets/consultant`);
  return res.data; // ❗ normalize nahi
};

// ===============================
// ACCOUNT MANAGER
// ===============================

// AM list pending
export const getAMTimesheets = async () => {
  const res = await api.get(`/v1/timesheets/am/timesheets`);
  return normalize(res);
};

export const getAMTimesheetHistory = async () => {
  const res = await api.get("/v1/timesheets/am/history");
  return res.data;
};

// AM approve
export const approveTimesheetByAM = async (timesheetId) => {
  const res = await api.post(`/v1/timesheets/${timesheetId}/am-approve`);
  return normalize(res);
};

// Reject (AM / Client)
export const rejectTimesheet = async (timesheetId, reason) => {
  const res = await api.post(`/v1/timesheets/${timesheetId}/reject`, {
    reason,
  });
  return normalize(res);
};

// ===============================
// CLIENT
// ===============================

// Client list pending
export const getClientTimesheets = async () => {
  const res = await api.get(`/v1/timesheets/client`);
  return normalize(res);
};

// Client approve
export const approveTimesheetByClient = async (timesheetId) => {
  const res = await api.post(`/v1/timesheets/${timesheetId}/client-approve`);
  return normalize(res);
};
