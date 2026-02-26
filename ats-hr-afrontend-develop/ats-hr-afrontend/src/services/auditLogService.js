import api from "../api/axios";

const unwrapItems = (payload) => {
  if (Array.isArray(payload)) return { items: payload, total: payload.length };
  if (Array.isArray(payload?.items)) {
    return { items: payload.items, total: Number(payload.total ?? payload.items.length) };
  }
  return { items: [], total: 0 };
};

export const listAuditLogs = async (params = {}) => {
  const res = await api.get("/v1/super-admin/audit-logs", { params });
  return unwrapItems(res?.data);
};

export const exportAuditLogs = async (params = {}) => {
  return api.get("/audit-logs/export", {
    params,
    responseType: "blob",
  });
};

export const logAuditExportEvent = async (payload = {}) => {
  try {
    await api.post("/v1/super-admin/audit-logs", {
      action_type: "DATA_EXPORT",
      module: "audit_logs",
      entity_type: "audit_log_export",
      status: "success",
      severity: "warning",
      ...payload,
    });
  } catch {
    // best-effort only; export should not fail if this logging endpoint is unavailable
  }
};
