import React, { useEffect, useState } from "react";
import { createResource, getResource, postResource, updateResource } from "../../../services/businessSetupService";
import useBusinessScope from "./useBusinessScope";
import ScopeControls from "./ScopeControls";

export default function BusinessSetupJobSettings() {
  const { scope, tenantId, tenants, setScope, setTenantId } = useBusinessScope();
  const [tab, setTab] = useState("templates");
  const [templates, setTemplates] = useState([]);
  const [stages, setStages] = useState([]);
  const [error, setError] = useState("");
  const [templateForm, setTemplateForm] = useState({ name: "", employment_type: "FT", default_title: "" });
  const [stageForm, setStageForm] = useState({ name: "", stage_type: "screening", is_default: false });

  const scopedParams = { scope, tenant_id: scope === "tenant" ? tenantId : undefined };

  const load = async () => {
    if (scope === "tenant" && !tenantId) {
      setTemplates([]);
      setStages([]);
      return;
    }
    setError("");
    try {
      const [tplRes, stageRes] = await Promise.all([
        getResource("/v1/super-admin/job-templates", scopedParams),
        getResource("/v1/super-admin/hiring-stages", scopedParams),
      ]);
      setTemplates(tplRes?.items || []);
      setStages(stageRes?.items || []);
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to load job settings");
    }
  };

  useEffect(() => {
    load();
  }, [scope, tenantId]);

  const createTemplate = async (e) => {
    e.preventDefault();
    try {
      await createResource("/v1/super-admin/job-templates", {
        ...templateForm,
        scope,
        tenant_id: scope === "tenant" ? tenantId : undefined,
        json_config: templateForm,
      });
      setTemplateForm({ name: "", employment_type: "FT", default_title: "" });
      load();
    } catch (e2) {
      setError(e2?.response?.data?.detail || "Failed to create template");
    }
  };

  const createStage = async (e) => {
    e.preventDefault();
    try {
      await createResource("/v1/super-admin/hiring-stages", {
        ...stageForm,
        scope,
        tenant_id: scope === "tenant" ? tenantId : undefined,
      });
      setStageForm({ name: "", stage_type: "screening", is_default: false });
      load();
    } catch (e2) {
      setError(e2?.response?.data?.detail || "Failed to create stage");
    }
  };

  const moveStage = async (index, direction) => {
    const next = [...stages];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setStages(next);
    try {
      await updateResource("/v1/super-admin/hiring-stages/reorder", {
        stage_ids: next.map((item) => item.id),
      });
      load();
    } catch {
      setError("Failed to reorder stages");
      load();
    }
  };

  const duplicateTemplate = async (id) => {
    try {
      await postResource(`/v1/super-admin/job-templates/${id}/duplicate`, {});
      load();
    } catch {
      setError("Failed to duplicate template");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Job Settings</h2>
        <p className="text-sm text-slate-600">Manage job templates and hiring stages.</p>
      </div>

      <ScopeControls scope={scope} tenantId={tenantId} tenants={tenants} onScopeChange={setScope} onTenantChange={setTenantId} />

      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button className={`rounded-md px-3 py-1.5 text-sm font-semibold ${tab === "templates" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => setTab("templates")}>Job Templates</button>
        <button className={`rounded-md px-3 py-1.5 text-sm font-semibold ${tab === "stages" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => setTab("stages")}>Hiring Stages</button>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {tab === "templates" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <form className="space-y-3 rounded-lg border border-slate-200 p-4" onSubmit={createTemplate}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Create Template</h3>
            <input value={templateForm.name} onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))} placeholder="Template name" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            <input value={templateForm.default_title} onChange={(e) => setTemplateForm((p) => ({ ...p, default_title: e.target.value }))} placeholder="Default title" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            <select value={templateForm.employment_type} onChange={(e) => setTemplateForm((p) => ({ ...p, employment_type: e.target.value }))} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
              <option value="FT">Full Time</option>
              <option value="Intern">Intern</option>
              <option value="Contract">Contract</option>
            </select>
            <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Create</button>
          </form>
          <div className="rounded-lg border border-slate-200 p-4 lg:col-span-2">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.length === 0 ? <tr><td className="px-2 py-3 text-slate-500" colSpan={3}>No templates</td></tr> : templates.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-2 py-2">{row.name}</td>
                    <td className="px-2 py-2">{row.is_active ? "Active" : "Archived"}</td>
                    <td className="px-2 py-2"><button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => duplicateTemplate(row.id)}>Duplicate</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <form className="space-y-3 rounded-lg border border-slate-200 p-4" onSubmit={createStage}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Create Stage</h3>
            <input value={stageForm.name} onChange={(e) => setStageForm((p) => ({ ...p, name: e.target.value }))} placeholder="Stage name" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            <select value={stageForm.stage_type} onChange={(e) => setStageForm((p) => ({ ...p, stage_type: e.target.value }))} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
              <option value="screening">Screening</option>
              <option value="interview">Interview</option>
              <option value="offer">Offer</option>
            </select>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={stageForm.is_default} onChange={(e) => setStageForm((p) => ({ ...p, is_default: e.target.checked }))} /> Default stage</label>
            <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Create</button>
          </form>
          <div className="rounded-lg border border-slate-200 p-4 lg:col-span-2">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="px-2 py-2">Order</th>
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stages.length === 0 ? <tr><td className="px-2 py-3 text-slate-500" colSpan={4}>No stages</td></tr> : stages.map((row, index) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-2 py-2">{row.sort_order}</td>
                    <td className="px-2 py-2">{row.name}{row.is_default ? " (Default)" : ""}</td>
                    <td className="px-2 py-2">{row.stage_type}</td>
                    <td className="px-2 py-2">
                      <div className="flex gap-1">
                        <button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => moveStage(index, -1)}>Up</button>
                        <button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => moveStage(index, 1)}>Down</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
