import React, { useEffect, useState } from "react";
import { getResource, updateResource } from "../../../services/businessSetupService";
import useBusinessScope from "./useBusinessScope";
import ScopeControls from "./ScopeControls";

export default function BusinessSetupCompanyProfile() {
  const { scope, tenantId, tenants, setScope, setTenantId } = useBusinessScope();
  const [tab, setTab] = useState("branding");
  const [branding, setBranding] = useState({ company_name: "", primary_color: "#6C2BD9", secondary_color: "#0EA5E9", privacy_policy_url: "" });
  const [portal, setPortal] = useState({ candidate_portal_enabled: true, resume_required: true, allowed_file_types: "pdf,doc,docx", max_file_size_mb: 5 });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const params = { scope, tenant_id: scope === "tenant" ? tenantId : undefined };

  const load = async () => {
    if (scope === "tenant" && !tenantId) return;
    setError("");
    try {
      const [brandingRes, portalRes] = await Promise.all([
        getResource("/v1/super-admin/branding", params),
        getResource("/v1/super-admin/portal-preferences", params),
      ]);
      if (brandingRes?.item?.config_json) setBranding((prev) => ({ ...prev, ...brandingRes.item.config_json }));
      if (portalRes?.item?.config_json) setPortal((prev) => ({ ...prev, ...portalRes.item.config_json }));
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to load profile settings");
    }
  };

  useEffect(() => {
    load();
  }, [scope, tenantId]);

  const saveBranding = async (e) => {
    e.preventDefault();
    try {
      await updateResource("/v1/super-admin/branding", {
        scope,
        tenant_id: scope === "tenant" ? tenantId : undefined,
        config_json: branding,
      });
      setMessage("Branding saved");
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to save branding");
    }
  };

  const savePortal = async (e) => {
    e.preventDefault();
    try {
      await updateResource("/v1/super-admin/portal-preferences", {
        scope,
        tenant_id: scope === "tenant" ? tenantId : undefined,
        config_json: portal,
      });
      setMessage("Portal preferences saved");
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to save portal preferences");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Company Profile</h2>
        <p className="text-sm text-slate-600">Branding and portal preferences for global templates or tenant override.</p>
      </div>

      <ScopeControls scope={scope} tenantId={tenantId} tenants={tenants} onScopeChange={setScope} onTenantChange={setTenantId} />

      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button className={`rounded-md px-3 py-1.5 text-sm font-semibold ${tab === "branding" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => setTab("branding")}>Branding</button>
        <button className={`rounded-md px-3 py-1.5 text-sm font-semibold ${tab === "portal" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => setTab("portal")}>Portal Preferences</button>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}

      {tab === "branding" ? (
        <form className="grid gap-3 rounded-lg border border-slate-200 p-4 lg:grid-cols-2" onSubmit={saveBranding}>
          <input value={branding.company_name || ""} onChange={(e) => setBranding((p) => ({ ...p, company_name: e.target.value }))} placeholder="Company name" className="rounded border border-slate-300 px-3 py-2 text-sm" />
          <input value={branding.logo_url || ""} onChange={(e) => setBranding((p) => ({ ...p, logo_url: e.target.value }))} placeholder="Logo URL" className="rounded border border-slate-300 px-3 py-2 text-sm" />
          <input value={branding.primary_color || ""} onChange={(e) => setBranding((p) => ({ ...p, primary_color: e.target.value }))} placeholder="Primary color" className="rounded border border-slate-300 px-3 py-2 text-sm" />
          <input value={branding.secondary_color || ""} onChange={(e) => setBranding((p) => ({ ...p, secondary_color: e.target.value }))} placeholder="Secondary color" className="rounded border border-slate-300 px-3 py-2 text-sm" />
          <input value={branding.favicon_url || ""} onChange={(e) => setBranding((p) => ({ ...p, favicon_url: e.target.value }))} placeholder="Favicon URL" className="rounded border border-slate-300 px-3 py-2 text-sm" />
          <input value={branding.email_header || ""} onChange={(e) => setBranding((p) => ({ ...p, email_header: e.target.value }))} placeholder="Email header text" className="rounded border border-slate-300 px-3 py-2 text-sm" />
          <button className="col-span-full w-fit rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white" type="submit">Save Branding</button>
        </form>
      ) : (
        <form className="grid gap-3 rounded-lg border border-slate-200 p-4 lg:grid-cols-2" onSubmit={savePortal}>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(portal.candidate_portal_enabled)} onChange={(e) => setPortal((p) => ({ ...p, candidate_portal_enabled: e.target.checked }))} /> Candidate portal enabled</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(portal.resume_required)} onChange={(e) => setPortal((p) => ({ ...p, resume_required: e.target.checked }))} /> Resume required</label>
          <input value={portal.allowed_file_types || ""} onChange={(e) => setPortal((p) => ({ ...p, allowed_file_types: e.target.value }))} placeholder="Allowed file types" className="rounded border border-slate-300 px-3 py-2 text-sm" />
          <input value={portal.max_file_size_mb || ""} onChange={(e) => setPortal((p) => ({ ...p, max_file_size_mb: Number(e.target.value) || 0 }))} placeholder="Max file size (MB)" className="rounded border border-slate-300 px-3 py-2 text-sm" />
          <input value={portal.privacy_policy_url || ""} onChange={(e) => setPortal((p) => ({ ...p, privacy_policy_url: e.target.value }))} placeholder="Privacy policy URL" className="rounded border border-slate-300 px-3 py-2 text-sm" />
          <input value={portal.footer_links || ""} onChange={(e) => setPortal((p) => ({ ...p, footer_links: e.target.value }))} placeholder="Footer links" className="rounded border border-slate-300 px-3 py-2 text-sm" />
          <button className="col-span-full w-fit rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white" type="submit">Save Preferences</button>
        </form>
      )}
    </div>
  );
}
