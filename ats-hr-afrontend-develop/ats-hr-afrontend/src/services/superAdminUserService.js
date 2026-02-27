import api from "../api/axios";

export async function listUsers(params = {}) {
  const res = await api.get("/v1/super-admin/users", { params });
  return res?.data || { items: [], total: 0, summary: {} };
}

export async function getUserById(id) {
  const res = await api.get(`/v1/super-admin/users/${id}`);
  return res?.data;
}

export async function createUser(payload) {
  const res = await api.post("/v1/super-admin/users", payload);
  return res?.data;
}

export async function updateUser(id, payload) {
  const res = await api.put(`/v1/super-admin/users/${id}`, payload);
  return res?.data;
}

export async function updateUserStatus(id, status) {
  const res = await api.patch(`/v1/super-admin/users/${id}/status`, { status });
  return res?.data;
}

export async function resetUserPassword(id, payload) {
  const res = await api.post(`/v1/super-admin/users/${id}/reset-password`, payload);
  return res?.data;
}

export async function forceLogoutUser(id) {
  const res = await api.post(`/v1/super-admin/users/${id}/force-logout`);
  return res?.data;
}

export async function listRoles() {
  const res = await api.get("/v1/roles");
  const data = res?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.roles)) return data.roles;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export async function listTenants() {
  const res = await api.get("/v1/super-admin/tenants");
  return Array.isArray(res?.data) ? res.data : [];
}
