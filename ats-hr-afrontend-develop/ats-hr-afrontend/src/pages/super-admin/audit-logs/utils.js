export const text = (v) => String(v ?? "").trim();

export const label = (v) =>
  text(v)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const asDate = (v) => {
  const raw = text(v);
  if (!raw) return null;
  const d = new Date(/(?:[zZ]|[+-]\d{2}(?::?\d{2})?)$/.test(raw) ? raw : `${raw}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const rel = (v) => {
  const d = asDate(v);
  if (!d) return "--";
  const mins = Math.max(1, Math.floor((Date.now() - d.getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export const exact = (v) => (asDate(v) ? asDate(v).toLocaleString() : "--");

export const normalizeAuditLog = (row, idx) => {
  const action = text(row?.action_type || row?.action || row?.event || "unknown_action").toLowerCase();
  const status = text(row?.status || (row?.success === false ? "failed" : "success")).toLowerCase();
  const severity =
    text(row?.severity).toLowerCase() ||
    (action.includes("delete") || action.includes("export") || action.includes("override")
      ? "critical"
      : status === "failed"
        ? "warning"
        : "info");
  return {
    id: text(row?.id || row?.log_id || `${action}-${row?.timestamp || idx}`),
    log_id: text(row?.log_id || row?.id),
    timestamp: row?.timestamp || row?.created_at || null,
    created_at: row?.created_at || row?.timestamp || null,
    actor_id: text(row?.actor_id || row?.user_id),
    actor_name: text(row?.actor_name || row?.user_name || row?.username || row?.email || "System"),
    actor_role: text(row?.actor_role || row?.role || "unknown"),
    actor_email: text(row?.actor_email || row?.email),
    action_type: action,
    action_label: text(row?.action_label || label(action)),
    module: text(row?.module || row?.entity_type || "system").toLowerCase(),
    entity_type: text(row?.entity_type || row?.resource_type || "entity").toLowerCase(),
    entity_id: text(row?.entity_id || row?.resource_id),
    entity_name: text(row?.entity_name || row?.entity_label),
    old_value: row?.old_value ?? row?.old_values ?? null,
    new_value: row?.new_value ?? row?.new_values ?? null,
    ip_address: text(row?.ip_address || row?.ip || "--"),
    user_agent: text(row?.user_agent),
    device: text(row?.device),
    browser: text(row?.browser),
    os: text(row?.os),
    location: text(row?.location || row?.geo_location || row?.country),
    endpoint: text(row?.endpoint || row?.path),
    http_method: text(row?.http_method || row?.method).toUpperCase(),
    response_code: row?.response_code ?? null,
    failure_reason: text(
      row?.failure_reason ||
        row?.error_reason ||
        row?.reason ||
        row?.error_message ||
        row?.message,
    ),
    status,
    severity,
  };
};

export const chipClass = {
  severity: (v) =>
    v === "critical"
      ? "bg-purple-100 text-purple-700"
      : v === "error"
        ? "bg-red-100 text-red-700"
        : v === "warning"
          ? "bg-yellow-100 text-yellow-800"
          : "bg-blue-100 text-blue-700",
  status: (v) => (v === "failed" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"),
  role: (v) =>
    v.includes("super")
      ? "bg-violet-100 text-violet-700"
      : v.includes("admin")
        ? "bg-blue-100 text-blue-700"
        : v.includes("recruiter")
          ? "bg-emerald-100 text-emerald-700"
          : "bg-slate-100 text-slate-700",
};

export const csvCell = (v) => {
  const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
