import React, { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";

const TABS = [
  { key: "list", label: "Workflow List" },
  { key: "editor", label: "Workflow Editor" },
  { key: "rules", label: "Automation Rules" },
  { key: "sla", label: "SLA & Notifications" },
  { key: "publish", label: "Publish / Versions" },
];

const RULE_TRIGGERS = [
  "candidate_entered_stage",
  "candidate_left_stage",
  "interview_scheduled",
  "offer_created",
  "candidate_rejected",
  "candidate_idle_in_stage",
  "new_application_received",
];

function WorkflowBadge({ value }) {
  const map = {
    draft: "bg-amber-100 text-amber-800",
    published: "bg-emerald-100 text-emerald-800",
    archived: "bg-slate-200 text-slate-700",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${map[value] || "bg-slate-100 text-slate-700"}`}>{value || "draft"}</span>;
}

export default function WorkflowBuilder() {
  const [tab, setTab] = useState("list");
  const [tenantId, setTenantId] = useState("");
  const [workflows, setWorkflows] = useState([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState("");
  const [activeVersionId, setActiveVersionId] = useState("");
  const [versions, setVersions] = useState([]);
  const [stages, setStages] = useState([]);
  const [rules, setRules] = useState([]);
  const [message, setMessage] = useState("");

  const [newWorkflow, setNewWorkflow] = useState({ name: "", description: "", department: "", job_type: "" });
  const [newStage, setNewStage] = useState({ stage_name: "", stage_type: "CUSTOM", is_terminal: false, is_rejection: false });
  const [newRule, setNewRule] = useState({ name: "", trigger: RULE_TRIGGERS[0], condition_json: "{}", action_json: "{}" });

  const activeWorkflow = useMemo(() => workflows.find((w) => w.id === activeWorkflowId) || null, [workflows, activeWorkflowId]);

  const loadWorkflows = async () => {
    try {
      const res = await api.get("/v1/super-admin/workflows", { params: { tenant_id: tenantId || undefined } });
      const items = res?.data?.items || [];
      setWorkflows(items);
      if (!activeWorkflowId && items.length) setActiveWorkflowId(items[0].id);
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to load workflows");
    }
  };

  const loadVersions = async (workflowId) => {
    if (!workflowId) return;
    try {
      const res = await api.get(`/v1/super-admin/workflows/${workflowId}/versions`);
      const items = res?.data?.items || [];
      setVersions(items);
      if (items.length) {
        const draft = items.find((v) => v.status === "draft");
        setActiveVersionId((draft || items[0]).id);
      } else {
        setActiveVersionId("");
      }
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to load versions");
    }
  };

  const loadStages = async (versionId) => {
    if (!versionId) {
      setStages([]);
      return;
    }
    try {
      const res = await api.get(`/v1/super-admin/workflows/workflow-versions/${versionId}/stages`);
      setStages(res?.data?.items || []);
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to load stages");
    }
  };

  const loadRules = async (versionId) => {
    if (!versionId) {
      setRules([]);
      return;
    }
    try {
      const res = await api.get(`/v1/super-admin/workflows/workflow-versions/${versionId}/rules`);
      setRules(res?.data?.items || []);
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to load rules");
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, [tenantId]);

  useEffect(() => {
    if (activeWorkflowId) loadVersions(activeWorkflowId);
  }, [activeWorkflowId]);

  useEffect(() => {
    if (activeVersionId) {
      loadStages(activeVersionId);
      loadRules(activeVersionId);
    }
  }, [activeVersionId]);

  const createWorkflow = async () => {
    if (!newWorkflow.name.trim()) return;
    try {
      await api.post("/v1/super-admin/workflows", {
        ...newWorkflow,
        tenant_id: tenantId || null,
      });
      setMessage("Workflow created");
      setNewWorkflow({ name: "", description: "", department: "", job_type: "" });
      loadWorkflows();
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to create workflow");
    }
  };

  const setDefaultWorkflow = async (workflowId) => {
    try {
      await api.put(`/v1/super-admin/workflows/${workflowId}`, { set_default: true });
      setMessage("Default workflow updated");
      loadWorkflows();
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to set default workflow");
    }
  };

  const duplicateWorkflow = async (workflowId) => {
    try {
      await api.post(`/v1/super-admin/workflows/${workflowId}/duplicate`, {});
      setMessage("Workflow duplicated");
      loadWorkflows();
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to duplicate workflow");
    }
  };

  const archiveWorkflow = async (workflowId) => {
    try {
      await api.patch(`/v1/super-admin/workflows/${workflowId}/archive`);
      setMessage("Workflow archived");
      loadWorkflows();
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to archive workflow");
    }
  };

  const createDraftVersion = async () => {
    if (!activeWorkflowId) return;
    try {
      await api.post(`/v1/super-admin/workflows/${activeWorkflowId}/versions`);
      setMessage("Draft version created");
      loadVersions(activeWorkflowId);
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to create version");
    }
  };

  const publishVersion = async (versionId) => {
    try {
      await api.post(`/v1/super-admin/workflows/workflow-versions/${versionId}/publish`);
      setMessage("Version published");
      loadVersions(activeWorkflowId);
      loadWorkflows();
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to publish version");
    }
  };

  const rollbackVersion = async (fromVersionId, toVersionNo) => {
    try {
      await api.post(`/v1/super-admin/workflows/workflow-versions/${fromVersionId}/rollback`, null, { params: { to: toVersionNo } });
      setMessage("Rollback completed");
      loadVersions(activeWorkflowId);
      loadWorkflows();
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to rollback");
    }
  };

  const addStage = async () => {
    if (!activeVersionId || !newStage.stage_name.trim()) return;
    try {
      await api.post(`/v1/super-admin/workflows/workflow-versions/${activeVersionId}/stages`, {
        stage_name: newStage.stage_name,
        stage_key: newStage.stage_name,
        is_terminal: newStage.is_terminal,
        is_rejection: newStage.is_rejection,
        settings_json: { stage_type: newStage.stage_type, required_fields: [], checklist: [], auto_assign_owner: null },
      });
      setNewStage({ stage_name: "", stage_type: "CUSTOM", is_terminal: false, is_rejection: false });
      setMessage("Stage added");
      loadStages(activeVersionId);
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to add stage");
    }
  };

  const moveStage = async (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= stages.length) return;
    const next = [...stages];
    [next[idx], next[target]] = [next[target], next[idx]];
    try {
      await api.put(`/v1/super-admin/workflows/workflow-versions/${activeVersionId}/stages/reorder`, {
        stage_ids: next.map((s) => s.id),
      });
      loadStages(activeVersionId);
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to reorder stages");
    }
  };

  const saveStageSettings = async (stage) => {
    try {
      await api.put(`/v1/super-admin/workflows/workflow-stages/${stage.id}`, {
        stage_name: stage.stage_name,
        is_terminal: stage.is_terminal,
        is_rejection: stage.is_rejection,
        settings_json: stage.settings_json || {},
      });
      setMessage("Stage settings saved");
      loadStages(activeVersionId);
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to save stage settings");
    }
  };

  const addRule = async () => {
    if (!activeVersionId || !newRule.name.trim()) return;
    try {
      await api.post(`/v1/super-admin/workflows/workflow-versions/${activeVersionId}/rules`, {
        name: newRule.name,
        trigger: newRule.trigger,
        condition_json: JSON.parse(newRule.condition_json || "{}"),
        action_json: JSON.parse(newRule.action_json || "{}"),
      });
      setNewRule({ name: "", trigger: RULE_TRIGGERS[0], condition_json: "{}", action_json: "{}" });
      setMessage("Rule added");
      loadRules(activeVersionId);
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Invalid rule JSON or create failed");
    }
  };

  const toggleRule = async (ruleId) => {
    try {
      await api.patch(`/v1/super-admin/workflows/workflow-rules/${ruleId}/toggle`);
      loadRules(activeVersionId);
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to toggle rule");
    }
  };

  const createSlaRule = async () => {
    if (!activeVersionId) return;
    try {
      await api.post(`/v1/super-admin/workflows/workflow-versions/${activeVersionId}/rules`, {
        name: "SLA Escalation",
        trigger: "candidate_idle_in_stage",
        condition_json: { max_hours: 48, reminder_after_hours: 24, escalate_after_hours: 48 },
        action_json: { type: "notify_manager", channels: ["in_app", "email"] },
      });
      setMessage("SLA rule created");
      setTab("rules");
      loadRules(activeVersionId);
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to create SLA rule");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Workflow Builder</h2>
          <p className="text-sm text-slate-600">Design stages, automations, SLA policies and publish versioned workflows.</p>
        </div>
        <input
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          placeholder="Tenant ID (optional)"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${tab === entry.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {message && <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="mb-2 text-sm font-semibold text-slate-700">Workflows</p>
          <div className="space-y-2">
            {workflows.map((wf) => (
              <button
                key={wf.id}
                type="button"
                onClick={() => setActiveWorkflowId(wf.id)}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm ${activeWorkflowId === wf.id ? "border-violet-500 bg-violet-50" : "border-slate-200 bg-white"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800">{wf.name}</span>
                  <WorkflowBadge value={wf.status} />
                </div>
                <div className="mt-1 text-xs text-slate-500">{wf.department || "--"} | {wf.job_type || "--"} | v{wf.latest_version_no || 1}</div>
                <div className="mt-2 flex gap-1">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${wf.is_default ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{wf.is_default ? "Default" : "Standard"}</span>
                </div>
              </button>
            ))}
            {!workflows.length && <p className="text-xs text-slate-500">No workflows.</p>}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 lg:col-span-2">
          {tab === "list" && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">Create Workflow</p>
              <div className="grid gap-2 md:grid-cols-2">
                <input value={newWorkflow.name} onChange={(e) => setNewWorkflow((p) => ({ ...p, name: e.target.value }))} placeholder="Workflow name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
                <input value={newWorkflow.department} onChange={(e) => setNewWorkflow((p) => ({ ...p, department: e.target.value }))} placeholder="Department" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
                <input value={newWorkflow.job_type} onChange={(e) => setNewWorkflow((p) => ({ ...p, job_type: e.target.value }))} placeholder="Job Type" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
                <input value={newWorkflow.description} onChange={(e) => setNewWorkflow((p) => ({ ...p, description: e.target.value }))} placeholder="Description" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <button type="button" onClick={createWorkflow} className="rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white">Create Workflow</button>

              {activeWorkflow && (
                <div className="mt-4 rounded-md border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-700">Selected: {activeWorkflow.name}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => duplicateWorkflow(activeWorkflow.id)}>Duplicate</button>
                    <button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => setDefaultWorkflow(activeWorkflow.id)}>Set Default</button>
                    <button className="rounded border border-red-300 px-2 py-1 text-xs text-red-700" onClick={() => archiveWorkflow(activeWorkflow.id)}>Archive</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "editor" && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">Stage Designer {activeWorkflow ? `- ${activeWorkflow.name}` : ""}</p>
              <div className="grid gap-2 md:grid-cols-2">
                <input value={newStage.stage_name} onChange={(e) => setNewStage((p) => ({ ...p, stage_name: e.target.value }))} placeholder="Stage name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
                <select value={newStage.stage_type} onChange={(e) => setNewStage((p) => ({ ...p, stage_type: e.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                  <option>APPLIED</option><option>SCREENING</option><option>INTERVIEW</option><option>OFFER</option><option>HIRED</option><option>REJECTED</option><option>CUSTOM</option>
                </select>
                <label className="text-sm"><input type="checkbox" checked={newStage.is_terminal} onChange={(e) => setNewStage((p) => ({ ...p, is_terminal: e.target.checked }))} /> Terminal</label>
                <label className="text-sm"><input type="checkbox" checked={newStage.is_rejection} onChange={(e) => setNewStage((p) => ({ ...p, is_rejection: e.target.checked }))} /> Rejection Stage</label>
              </div>
              <button onClick={addStage} className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Add Stage</button>

              <div className="space-y-2">
                {stages.map((stage, idx) => (
                  <div key={stage.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <input value={stage.stage_name} onChange={(e) => {
                        const next = [...stages];
                        next[idx] = { ...stage, stage_name: e.target.value };
                        setStages(next);
                      }} className="rounded border border-slate-300 px-2 py-1 text-sm" />
                      <div className="flex gap-1">
                        <button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => moveStage(idx, -1)}>Up</button>
                        <button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => moveStage(idx, 1)}>Down</button>
                        <button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => saveStageSettings(stage)}>Save</button>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Type: {stage.stage_type} | Order: {stage.order_index}</p>
                  </div>
                ))}
                {!stages.length && <p className="text-sm text-slate-500">No stages in selected version.</p>}
              </div>
            </div>
          )}

          {tab === "rules" && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">Automation Rules</p>
              <div className="grid gap-2">
                <input value={newRule.name} onChange={(e) => setNewRule((p) => ({ ...p, name: e.target.value }))} placeholder="Rule name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
                <select value={newRule.trigger} onChange={(e) => setNewRule((p) => ({ ...p, trigger: e.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                  {RULE_TRIGGERS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <textarea value={newRule.condition_json} onChange={(e) => setNewRule((p) => ({ ...p, condition_json: e.target.value }))} className="min-h-[80px] rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder='{"department":"IT"}' />
                <textarea value={newRule.action_json} onChange={(e) => setNewRule((p) => ({ ...p, action_json: e.target.value }))} className="min-h-[80px] rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder='{"type":"send_email"}' />
              </div>
              <button onClick={addRule} className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Add Rule</button>

              <div className="space-y-2">
                {rules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <div>
                      <p className="font-semibold text-slate-800">{rule.name}</p>
                      <p className="text-xs text-slate-500">Trigger: {rule.trigger}</p>
                    </div>
                    <button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => toggleRule(rule.id)}>{rule.is_active ? "Disable" : "Enable"}</button>
                  </div>
                ))}
                {!rules.length && <p className="text-sm text-slate-500">No automation rules yet.</p>}
              </div>
            </div>
          )}

          {tab === "sla" && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">SLA & Notification Policy</p>
              <p className="text-sm text-slate-600">This creates an SLA rule: reminder at 24h and escalation at 48h for idle candidates.</p>
              <button onClick={createSlaRule} className="rounded-md bg-cyan-700 px-3 py-2 text-sm font-semibold text-white">Create Default SLA Rule</button>
            </div>
          )}

          {tab === "publish" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Versioning</p>
                <button onClick={createDraftVersion} className="rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white">New Draft Version</button>
              </div>
              <div className="space-y-2">
                {versions.map((v) => (
                  <div key={v.id} className={`rounded-md border px-3 py-2 ${activeVersionId === v.id ? "border-violet-400 bg-violet-50" : "border-slate-200 bg-white"}`}>
                    <div className="flex items-center justify-between">
                      <button className="text-sm font-semibold text-slate-800" onClick={() => setActiveVersionId(v.id)}>v{v.version_no}</button>
                      <WorkflowBadge value={v.status} />
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => publishVersion(v.id)}>Publish</button>
                      {versions[0] && <button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => rollbackVersion(v.id, v.version_no)}>Rollback To This</button>}
                    </div>
                  </div>
                ))}
                {!versions.length && <p className="text-sm text-slate-500">No versions yet.</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
