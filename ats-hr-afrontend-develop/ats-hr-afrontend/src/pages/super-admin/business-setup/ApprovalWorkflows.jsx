import React, { useEffect, useState } from "react";
import { createResource, getResource, updateResource } from "../../../services/businessSetupService";
import useBusinessScope from "./useBusinessScope";
import ScopeControls from "./ScopeControls";

export default function BusinessSetupApprovalWorkflows() {
  const { scope, tenantId, tenants, setScope, setTenantId } = useBusinessScope();
  const [workflowType, setWorkflowType] = useState("job");
  const [workflows, setWorkflows] = useState([]);
  const [name, setName] = useState("");
  const [stepsText, setStepsText] = useState("role:account_manager\nrole:client_admin");
  const [error, setError] = useState("");

  const load = async () => {
    if (scope === "tenant" && !tenantId) {
      setWorkflows([]);
      return;
    }
    try {
      const res = await getResource("/v1/super-admin/approval-workflows", {
        scope,
        tenant_id: scope === "tenant" ? tenantId : undefined,
        workflow_type: workflowType,
      });
      setWorkflows(res?.items || []);
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to load workflows");
      setWorkflows([]);
    }
  };

  useEffect(() => {
    load();
  }, [scope, tenantId, workflowType]);

  const createWorkflow = async (e) => {
    e.preventDefault();
    try {
      const steps = stepsText
        .split("\n")
        .map((line, index) => line.trim())
        .filter(Boolean)
        .map((line, index) => {
          const [approverType, approverRef] = line.split(":");
          return {
            step_order: index + 1,
            approver_type: approverType || "role",
            approver_ref: approverRef || line,
          };
        });

      await createResource("/v1/super-admin/approval-workflows", {
        scope,
        tenant_id: scope === "tenant" ? tenantId : undefined,
        type: workflowType,
        name,
        steps,
      });
      setName("");
      load();
    } catch {
      setError("Failed to create workflow");
    }
  };

  const toggleActive = async (row) => {
    try {
      await updateResource(`/v1/super-admin/approval-workflows/${row.id}`, {
        is_active: !row.is_active,
      });
      load();
    } catch {
      setError("Failed to update workflow");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Approval Workflows</h2>
        <p className="text-sm text-slate-600">Configure multi-step job and offer approvals.</p>
      </div>

      <ScopeControls scope={scope} tenantId={tenantId} tenants={tenants} onScopeChange={setScope} onTenantChange={setTenantId} />

      <div className="flex items-center gap-2">
        <button className={`rounded-md px-3 py-1.5 text-sm font-semibold ${workflowType === "job" ? "bg-slate-900 text-white" : "bg-slate-100"}`} onClick={() => setWorkflowType("job")}>Job Approval</button>
        <button className={`rounded-md px-3 py-1.5 text-sm font-semibold ${workflowType === "offer" ? "bg-slate-900 text-white" : "bg-slate-100"}`} onClick={() => setWorkflowType("offer")}>Offer Approval</button>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <form className="space-y-3 rounded-lg border border-slate-200 p-4" onSubmit={createWorkflow}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Create Workflow</h3>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Workflow name" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          <textarea value={stepsText} onChange={(e) => setStepsText(e.target.value)} className="min-h-[140px] w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="role:account_manager" />
          <button className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white" type="submit">Create</button>
        </form>

        <div className="rounded-lg border border-slate-200 p-4 lg:col-span-2">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Steps</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {workflows.length === 0 ? (
                <tr><td className="px-2 py-3 text-slate-500" colSpan={4}>No workflows</td></tr>
              ) : workflows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-2 py-2">{row.name}</td>
                  <td className="px-2 py-2">{(row.steps || []).length}</td>
                  <td className="px-2 py-2">{row.is_active ? "Active" : "Inactive"}</td>
                  <td className="px-2 py-2"><button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => toggleActive(row)}>{row.is_active ? "Disable" : "Enable"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
