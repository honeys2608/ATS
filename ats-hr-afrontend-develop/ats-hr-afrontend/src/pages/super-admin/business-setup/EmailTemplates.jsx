import React, { useEffect, useMemo, useState } from "react";
import { createResource, getResource, postResource, updateResource } from "../../../services/businessSetupService";
import useBusinessScope from "./useBusinessScope";
import ScopeControls from "./ScopeControls";

const DEFAULT_KEYS = {
  candidate: ["application_received", "interview_scheduled", "rejected", "offer"],
  notification: ["admin_alert", "approval_alert", "system_alert"],
};

export default function BusinessSetupEmailTemplates() {
  const { scope, tenantId, tenants, setScope, setTenantId } = useBusinessScope();
  const [category, setCategory] = useState("candidate");
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const params = useMemo(() => ({
    category,
    scope,
    tenant_id: scope === "tenant" ? tenantId : undefined,
  }), [category, scope, tenantId]);

  const load = async () => {
    if (scope === "tenant" && !tenantId) {
      setTemplates([]);
      return;
    }
    setError("");
    try {
      const res = await getResource("/v1/super-admin/email-templates", params);
      const rows = res?.items || [];
      setTemplates(rows);
      if (!selectedId && rows.length) {
        setSelectedId(rows[0].id);
      }
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to load templates");
      setTemplates([]);
    }
  };

  useEffect(() => {
    setSelectedId("");
    load();
  }, [category, scope, tenantId]);

  useEffect(() => {
    const selected = templates.find((item) => item.id === selectedId);
    if (selected) {
      setSubject(selected.subject || "");
      setBodyHtml(selected.body_html || "");
    } else {
      setSubject("");
      setBodyHtml("");
    }
  }, [selectedId, templates]);

  const createMissingTemplate = async (key) => {
    try {
      await createResource("/v1/super-admin/email-templates", {
        scope,
        tenant_id: scope === "tenant" ? tenantId : undefined,
        category,
        key,
        subject: `${category} - ${key}`,
        body_html: `<p>Hello {{candidate_name}},</p><p>${key}</p>`,
      });
      load();
    } catch {
      setError("Failed to create template");
    }
  };

  const saveTemplate = async () => {
    if (!selectedId) return;
    try {
      await updateResource(`/v1/super-admin/email-templates/${selectedId}`, { subject, body_html: bodyHtml });
      setMessage("Template updated");
      load();
    } catch {
      setError("Failed to update template");
    }
  };

  const sendTest = async () => {
    try {
      await postResource("/v1/super-admin/email-templates/test-send", { to_email: "test@example.com" });
      setMessage("Test email request sent");
    } catch {
      setError("Test send failed");
    }
  };

  const templateByKey = new Map((templates || []).map((item) => [item.key, item]));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Email Templates</h2>
        <p className="text-sm text-slate-600">Manage candidate and notification email templates with variables.</p>
      </div>

      <ScopeControls scope={scope} tenantId={tenantId} tenants={tenants} onScopeChange={setScope} onTenantChange={setTenantId} />

      <div className="flex items-center gap-2">
        <button className={`rounded-md px-3 py-1.5 text-sm font-semibold ${category === "candidate" ? "bg-slate-900 text-white" : "bg-slate-100"}`} onClick={() => setCategory("candidate")}>Candidate Emails</button>
        <button className={`rounded-md px-3 py-1.5 text-sm font-semibold ${category === "notification" ? "bg-slate-900 text-white" : "bg-slate-100"}`} onClick={() => setCategory("notification")}>Notification Emails</button>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 p-3">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">Templates</h3>
          <div className="space-y-2">
            {DEFAULT_KEYS[category].map((key) => {
              const row = templateByKey.get(key);
              return row ? (
                <button key={key} className={`block w-full rounded px-2 py-2 text-left text-sm ${selectedId === row.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"}`} onClick={() => setSelectedId(row.id)}>{key}</button>
              ) : (
                <button key={key} className="block w-full rounded border border-dashed border-slate-300 px-2 py-2 text-left text-sm text-slate-600" onClick={() => createMissingTemplate(key)}>Create {key}</button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-4 lg:col-span-3">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mb-3 w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Subject" />
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Body HTML</label>
          <textarea value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} className="min-h-[240px] w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Use variables like {{candidate_name}}, {{job_title}}, {{company_name}}" />
          <div className="mt-3 flex gap-2">
            <button type="button" className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white" onClick={saveTemplate} disabled={!selectedId}>Save</button>
            <button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={sendTest}>Send Test Email</button>
          </div>
        </div>
      </div>
    </div>
  );
}
