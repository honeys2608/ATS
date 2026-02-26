// src/services/onboardingService.js
import api from "../api/axios";

const normalize = (res) => res?.data?.data ?? res?.data ?? null;

const onboardingService = {
  // Start onboarding (POST /v1/onboarding/{employee_id}/start)
  startOnboarding: async (employeeId, payload = {}) => {
    const res = await api.post(`/v1/onboarding/${employeeId}/start`, payload);
    return normalize(res);
  },

  // Get onboarding tasks (GET /v1/onboarding/{employee_id})
  getTasks: async (employeeId) => {
    const res = await api.get(`/v1/onboarding/${employeeId}`);
    return normalize(res);
  },

  // Complete a task (PUT /v1/onboarding/{task_id}/complete)
  completeTask: async (taskId, payload = {}) => {
    const res = await api.put(`/v1/onboarding/${taskId}/complete`, payload);
    return normalize(res);
  },

  // Get onboarding progress (GET /v1/onboarding/{employee_id}/progress)
  getProgress: async (employeeId) => {
    const res = await api.get(`/v1/onboarding/${employeeId}/progress`);
    return normalize(res);
  },
};

export default onboardingService;
