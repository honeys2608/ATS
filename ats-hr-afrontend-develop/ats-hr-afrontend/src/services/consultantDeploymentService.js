import api from "../api/axios";

export const deployConsultant = (payload) =>
  api.post("/v1/consultant-deployments", payload);

export const listDeployments = (params) =>
  api.get("/v1/consultant-deployments", { params });

export const getDeployment = (id) =>
  api.get(`/v1/consultant-deployments/${id}`);

export const endDeployment = (id) =>
  api.put(`/v1/consultant-deployments/${id}/end`);
