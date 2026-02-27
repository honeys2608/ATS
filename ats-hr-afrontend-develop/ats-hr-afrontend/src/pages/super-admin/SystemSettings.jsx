import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../api/axios";

const TABS = [
  { key: "general", label: "General", route: "/super-admin/system-settings/general" },
  { key: "security", label: "Security", route: "/super-admin/system-settings/security" },
  { key: "email", label: "Email", route: "/super-admin/system-settings/email" },
  { key: "uploads", label: "Uploads", route: "/super-admin/system-settings/uploads" },
  { key: "feature-flags", label: "Feature Flags", route: "/super-admin/system-settings/feature-flags" },
  { key: "maintenance", label: "Maintenance", route: "/super-admin/system-settings/maintenance" },
  { key: "audit-logs", label: "Audit Logs", route: "/super-admin/system-settings/audit-logs" },
];

const CATEGORY_MAP = {
  general: "general",
  security: "security",
  email: "email",
  uploads: "uploads",
  maintenance: "maintenance",
};

function parseTab(pathname) {
  const found = TABS.find((t) => pathname.startsWith(t.route));
  if (found) return found.key;
  return "general";
}

function renderInput(item, value, onChange) {
  const vType = (item.value_type || "string").toLowerCase();
  const disabled = item.is_editable === false;

  if (vType === "boolean") {
    return (
      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={Boolean(value)} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span>{Boolean(value) ? "Enabled" : "Disabled"}</span>
      </label>
    );
  }

  if (vType === "number") {
    return (
      <input
        type="number"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value || 0))}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
      />
    );
  }

  if (vType === "json") {
    return (
      <textarea
        value={typeof value === "string" ? value : JSON.stringify(value ?? {}, null, 2)}
        disabled={disabled}
        onChange={(e) => {
          try {
            onChange(JSON.parse(e.target.value));
          } catch {
            onChange(e.target.value);
          }
        }}
        className="min-h-[120px] w-full rounded border border-slate-300 px-3 py-2 text-xs font-mono"
      />
    );
  }

  if (item.is_secret) {
    return (
      <input
        type="password"
        placeholder="Set new secret"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
      />
    );
  }

  return (
    <input
      type="text"
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
    />
  );
}

export default function SystemSettings() {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = useMemo(() => parseTab(location.pathname), [location.pathname]);

  const [settings, setSettings] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [flags, setFlags] = useState([]);
  const [audit, setAudit] = useState([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (location.pathname === "/super-admin/system-settings") {
      navigate("/super-admin/system-settings/general", { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    setMessage("");
    if (tab === "feature-flags") {
      api.get("/v1/super-admin/feature-flags").then((res) => setFlags(res.data?.items || [])).catch(() => setFlags([]));
      return;
    }
    if (tab === "audit-logs") {
      api.get("/v1/super-admin/system-settings/audit").then((res) => setAudit(res.data?.items || [])).catch(() => setAudit([]));
      return;
    }

    const category = CATEGORY_MAP[tab] || "general";
    api
      .get("/v1/super-admin/system-settings", { params: { category } })
      .then((res) => {
        const rows = res.data?.items || [];
        setSettings(rows);
        const next = {};
        rows.forEach((r) => {
          next[r.key] = r.value;
        });
        setDrafts(next);
      })
      .catch(() => {
        setSettings([]);
        setDrafts({});
      });
  }, [tab]);

  const saveCategorySettings = async () => {
    setSaving(true);
    setMessage("");
    try {
      const updates = settings.map((item) => ({ key: item.key, value: drafts[item.key], value_type: item.value_type, category: item.category, is_secret: item.is_secret }));
      await api.put("/v1/super-admin/system-settings", { updates });
      setMessage("Settings saved");
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const saveMaintenance = async () => {
    setSaving(true);
    setMessage("");
    try {
      await api.put("/v1/super-admin/maintenance", {
        enabled: Boolean(drafts["maintenance.enabled"]),
        message: drafts["maintenance.message"],
        api_rpm: Number(drafts["rate_limit.api_rpm"] || 0),
      });
      setMessage("Maintenance settings saved");
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to save maintenance settings");
    } finally {
      setSaving(false);
    }
  };

  const saveFlag = async (flagKey, payload) => {
    setSaving(true);
    setMessage("");
    try {
      await api.put(`/v1/super-admin/feature-flags/${encodeURIComponent(flagKey)}`, payload);
      const res = await api.get("/v1/super-admin/feature-flags");
      setFlags(res.data?.items || []);
      setMessage(`Feature flag saved: ${flagKey}`);
    } catch (e) {
      setMessage(e?.response?.data?.detail || `Failed to save ${flagKey}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => navigate(item.route)}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${tab === item.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {message && <div className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{message}</div>}

      {tab === "feature-flags" && (
        <div className="space-y-3">
          {flags.map((flag) => (
            <div key={flag.key} className="rounded-lg border border-slate-200 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-semibold text-slate-900">{flag.key}</div>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(flag.enabled)}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setFlags((prev) => prev.map((f) => (f.key === flag.key ? { ...f, enabled } : f)));
                    }}
                  />
                  {flag.enabled ? "Enabled" : "Disabled"}
                </label>
              </div>
              <textarea
                value={flag.description || ""}
                onChange={(e) => {
                  const description = e.target.value;
                  setFlags((prev) => prev.map((f) => (f.key === flag.key ? { ...f, description } : f)));
                }}
                className="mb-2 min-h-[72px] w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Description"
              />
              <button type="button" onClick={() => saveFlag(flag.key, flag)} className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white" disabled={saving}>
                Save Flag
              </button>
            </div>
          ))}
          {flags.length === 0 && <p className="text-sm text-slate-500">No feature flags found.</p>}
        </div>
      )}

      {tab === "audit-logs" && (
        <div className="overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left">When</th>
                <th className="px-3 py-2 text-left">Actor</th>
                <th className="px-3 py-2 text-left">Action</th>
                <th className="px-3 py-2 text-left">Before</th>
                <th className="px-3 py-2 text-left">After</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{row.created_at || "-"}</td>
                  <td className="px-3 py-2">{row.actor_name || row.actor_id || "-"}</td>
                  <td className="px-3 py-2">{row.action || "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.before_json ? JSON.stringify(row.before_json) : "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.after_json ? JSON.stringify(row.after_json) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {audit.length === 0 && <p className="p-3 text-sm text-slate-500">No audit logs found.</p>}
        </div>
      )}

      {!["feature-flags", "audit-logs"].includes(tab) && (
        <div className="space-y-3">
          {settings.map((item) => (
            <div key={item.key} className="rounded-lg border border-slate-200 p-4">
              <div className="mb-1 text-sm font-semibold text-slate-900">{item.key}</div>
              <div className="mb-2 text-xs text-slate-500">{item.description || "-"}</div>
              {renderInput(item, drafts[item.key], (value) => setDrafts((prev) => ({ ...prev, [item.key]: value })))}
            </div>
          ))}
          {settings.length === 0 && <p className="text-sm text-slate-500">No settings found in this category.</p>}

          <button
            type="button"
            onClick={tab === "maintenance" ? saveMaintenance : saveCategorySettings}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      )}
    </div>
  );
}
