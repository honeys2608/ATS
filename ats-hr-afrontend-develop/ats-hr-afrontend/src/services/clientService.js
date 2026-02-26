import api from "../api/axios";

const clientService = {
  // ================= CLIENT PORTAL (normal client login) =================
  getRequirements: async () => {
    const res = await api.get("/v1/client/requirements");
    return res.data;
  },

  createRequirement: async (payload) => {
    return api.post("/v1/client/requirements", payload);
  },
  parseJD: async (description) => {
    return api.post("/v1/client/parse-jd", { description });
  },

  uploadRequirementsExcel: async (formData) => {
    const res = await api.post("/v1/client/requirements/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  },

  getSubmissions: async (jobId) => {
    const res = await api.get(`/v1/client/jobs/${jobId}/submissions`);
    return res.data;
  },

  getAllSubmissions: async () => {
    const res = await api.get("/v1/client/submissions/all");
    return res.data;
  },

  submitInterviewFeedback: async (payload) => {
    return api.post("/v1/client/interview-feedback", payload);
  },

  submitFinalDecision(data) {
    return api.post(`/v1/client/final-decision`, data);
  },

  getDeployments: async () => {
    const res = await api.get("/v1/client/deployments");
    return res.data;
  },

  getInvoices: async () => {
    const res = await api.get("/v1/client/invoices");
    return res.data;
  },

  getDashboard: async () => {
    const res = await api.get("/v1/client/dashboard");
    return res.data;
  },

  // ================= ADMIN SIDE CLIENT MANAGEMENT =================
  getClientRequirements: async (clientId) => {
    const res = await api.get(`/v1/client/${clientId}/requirements`);
    return res.data;
  },

  createClientRequirement: async (clientId, payload) => {
    return api.post(`/v1/client/${clientId}/requirements`, payload);
  },
};

export default clientService;
