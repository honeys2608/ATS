import api from "../api/axios";

export async function fetchBusinessSetupSummary(scope, tenantId) {
  const res = await api.get("/v1/super-admin/business-setup/summary", {
    params: {
      scope,
      tenant_id: scope === "tenant" ? tenantId : undefined,
    },
  });
  return res.data || {};
}

export async function fetchTenants() {
  const res = await api.get("/v1/super-admin/tenants");
  return res.data?.items || [];
}

export async function fetchMyPermissions() {
  const res = await api.get("/v1/permissions/me");
  return res.data?.modules || {};
}

export async function listResource(path, { scope, tenantId, page = 1, limit = 20, search = "" } = {}) {
  const res = await api.get(path, {
    params: {
      scope,
      tenant_id: scope === "tenant" ? tenantId : undefined,
      page,
      limit,
      search,
    },
  });
  return res.data || { items: [] };
}

export async function createResource(path, payload) {
  const res = await api.post(path, payload);
  return res.data;
}

export async function updateResource(path, payload) {
  const res = await api.put(path, payload);
  return res.data;
}

export async function patchResource(path, payload) {
  const res = await api.patch(path, payload);
  return res.data;
}

export async function postResource(path, payload) {
  const res = await api.post(path, payload);
  return res.data;
}

export async function getResource(path, params) {
  const res = await api.get(path, { params });
  return res.data;
}
