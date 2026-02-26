import React, { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";

export default function WorkflowBuilder() {
  const [workflows, setWorkflows] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [stages, setStages] = useState([]);
  const [newWorkflow, setNewWorkflow] = useState("");
  const [newStage, setNewStage] = useState("");
  const [message, setMessage] = useState("");

  const activeWorkflow = useMemo(
    () => workflows.find((w) => w.id === activeId) || null,
    [workflows, activeId],
  );

  const loadWorkflows = async () => {
    try {
      const res = await api.get("/v1/super-admin/workflows");
      const items = res?.data?.items || [];
      setWorkflows(items);
      if (!activeId && items.length) setActiveId(items[0].id);
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to load workflows");
    }
  };

  const loadStages = async (workflowId) => {
    if (!workflowId) return;
    try {
      const res = await api.get(`/v1/super-admin/workflows/${workflowId}/stages`);
      setStages(res?.data?.items || []);
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to load stages");
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, []);

  useEffect(() => {
    loadStages(activeId);
  }, [activeId]);

  const createWorkflow = async () => {
    if (!newWorkflow.trim()) return;
    try {
      await api.post("/v1/super-admin/workflows", { name: newWorkflow.trim() });
      setNewWorkflow("");
      setMessage("Workflow created");
      await loadWorkflows();
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to create workflow");
    }
  };

  const createStage = async () => {
    if (!activeId || !newStage.trim()) return;
    try {
      await api.post(`/v1/super-admin/workflows/${activeId}/stages`, {
        stage_name: newStage.trim(),
      });
      setNewStage("");
      setMessage("Stage created");
      await loadStages(activeId);
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to create stage");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Workflow Builder</h2>
        <div className="flex gap-2">
          <input
            value={newWorkflow}
            onChange={(e) => setNewWorkflow(e.target.value)}
            placeholder="New workflow name"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={createWorkflow}
            className="rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white"
          >
            Create
          </button>
        </div>
      </div>

      {message && <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="mb-2 text-sm font-semibold text-slate-700">Workflows</p>
          <div className="space-y-2">
            {workflows.map((wf) => (
              <button
                key={wf.id}
                type="button"
                onClick={() => setActiveId(wf.id)}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm ${activeId === wf.id ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-700"}`}
              >
                {wf.name}
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-2 rounded-lg border border-slate-200 bg-white p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">
              Stages {activeWorkflow ? `- ${activeWorkflow.name}` : ""}
            </p>
            <div className="flex gap-2">
              <input
                value={newStage}
                onChange={(e) => setNewStage(e.target.value)}
                placeholder="New stage name"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={createStage}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
              >
                Add Stage
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {stages.map((s) => (
              <div key={s.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {s.order_index}. {s.stage_name} ({s.stage_key})
              </div>
            ))}
            {!stages.length && <p className="text-sm text-slate-500">No stages yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

