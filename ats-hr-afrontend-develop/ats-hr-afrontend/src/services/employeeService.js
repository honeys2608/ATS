// src/services/employeeService.js
import api from "../api/axios";

/**
 * normalize: prefer res.data.data -> res.data -> raw res
 * Returns null for falsy responses.
 */
const normalize = (res) => {
  if (!res) return null;
  // axios response shape: { data: ... , status: ... , headers: ... }
  // some backends nest payload in data.data
  return res?.data?.data ?? res?.data ?? res ?? null;
};

const employeeService = {
  // GET /v1/employees
  list: async (params = {}) => {
    const res = await api.get("/v1/employees", { params });
    return normalize(res);
  },

  // GET /v1/employees/directory (fallback to list)
  directory: async (params = {}) => {
    try {
      const res = await api.get("/v1/employees/directory", { params });
      return normalize(res);
    } catch (err) {
      // If directory endpoint doesn't exist, fallback to /v1/employees
      console.warn(
        "employeeService.directory: falling back to /v1/employees",
        err?.message
      );
      return employeeService.list(params);
    }
  },

  // GET /v1/employees/{id}
  get: async (id) => {
    if (!id) throw new Error("employeeService.get: id is required");
    const res = await api.get(`/v1/employees/${id}`);
    return normalize(res);
  },

  // POST /v1/employees
  create: async (payload) => {
    const res = await api.post("/v1/employees", payload);
    return normalize(res);
  },

  // PUT /v1/employees/{id}
  update: async (id, payload) => {
    if (!id) throw new Error("employeeService.update: id is required");
    const res = await api.put(`/v1/employees/${id}`, payload);
    return normalize(res);
  },

  // DELETE /v1/employees/{id}
  remove: async (id) => {
    if (!id) throw new Error("employeeService.remove: id is required");
    const res = await api.delete(`/v1/employees/${id}`);
    return normalize(res);
  },

  // POST /v1/employees/from-candidate/{candidate_id}
  fromCandidate: async (candidateId, payload = {}) => {
    if (!candidateId)
      throw new Error("employeeService.fromCandidate: candidateId is required");
    const res = await api.post(
      `/v1/employees/from-candidate/${candidateId}`,
      payload
    );
    return normalize(res);
  },

  // alias for convenience
  convert: async (candidateId, payload = {}) => {
    return employeeService.fromCandidate(candidateId, payload);
  },

  // POST /v1/employees/{id}/exit
  exit: async (id, payload = {}) => {
    if (!id) throw new Error("employeeService.exit: id is required");
    const res = await api.post(`/v1/employees/${id}/exit`, payload);
    return normalize(res);
  },

  // POST /v1/employees/{id}/performance
  addPerformance: async (id, payload = {}) => {
    if (!id) throw new Error("employeeService.addPerformance: id is required");
    const res = await api.post(`/v1/employees/${id}/performance`, payload);
    return normalize(res);
  },
  // GET logged-in employee (self profile)
  // GET logged-in employee (self profile)
  // GET logged-in employee (self profile)
  getMyEmployee: async () => {
    const res = await api.get("/v1/employees/me");
    return normalize(res);
  },

  // 🔐 RESET EMPLOYEE PASSWORD (HR / ADMIN)
  resetPassword: async (employeeId, payload) => {
    if (!employeeId)
      throw new Error("employeeService.resetPassword: employeeId is required");

    const res = await api.post(
      `/v1/employees/${employeeId}/reset-password`,
      payload
    );
    return normalize(res);
  },
};

export default employeeService;
