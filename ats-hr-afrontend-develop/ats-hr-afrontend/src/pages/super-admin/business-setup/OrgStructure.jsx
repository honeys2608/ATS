import React, { useEffect, useMemo, useState } from "react";
import { createResource, listResource, patchResource, updateResource } from "../../../services/businessSetupService";
import useBusinessScope from "./useBusinessScope";
import ScopeControls from "./ScopeControls";

const TABS = [
  { key: "departments", label: "Departments", fields: ["name", "code"] },
  { key: "locations", label: "Locations", fields: ["name", "city", "state", "country"] },
  { key: "designations", label: "Designations", fields: ["name", "level"] },
];

function emptyForm(fields) {
  const out = {};
  fields.forEach((field) => {
    out[field] = "";
  });
  return out;
}

export default function BusinessSetupOrgStructure() {
  const { scope, tenantId, tenants, setScope, setTenantId } = useBusinessScope();
  const [activeTab, setActiveTab] = useState("departments");
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({});
  const [editing, setEditing] = useState(null);

  const current = useMemo(() => TABS.find((tab) => tab.key === activeTab), [activeTab]);

  useEffect(() => {
    setForm(emptyForm(current.fields));
    setEditing(null);
  }, [current]);

  const loadItems = async () => {
    if (scope === "tenant" && !tenantId) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await listResource(`/v1/super-admin/${activeTab}`, {
        scope,
        tenantId,
        search,
        page: 1,
        limit: 100,
      });
      setItems(data.items || []);
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to load records");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [activeTab, scope, tenantId]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        scope,
        tenant_id: scope === "tenant" ? tenantId : undefined,
      };
      if (editing?.id) {
        await updateResource(`/v1/super-admin/${activeTab}/${editing.id}`, payload);
      } else {
        await createResource(`/v1/super-admin/${activeTab}`, payload);
      }
      setForm(emptyForm(current.fields));
      setEditing(null);
      loadItems();
    } catch (e2) {
      setError(e2?.response?.data?.detail || "Save failed");
    }
  };

  const toggleStatus = async (row) => {
    try {
      await patchResource(`/v1/super-admin/${activeTab}/${row.id}/status`, {
        is_active: !row.is_active,
      });
      loadItems();
    } catch (e) {
      setError(e?.response?.data?.detail || "Status update failed");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Organization Structure</h2>
        <p className="text-sm text-slate-600">Manage departments, locations and designations by scope.</p>
      </div>

      <ScopeControls scope={scope} tenantId={tenantId} tenants={tenants} onScopeChange={setScope} onTenantChange={setTenantId} />

      <div className="flex gap-2 border-b border-slate-200 pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${activeTab === tab.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">{editing ? "Edit" : "Add"} {current.label.slice(0, -1)}</h3>
          <form className="space-y-3" onSubmit={submit}>
            {current.fields.map((field) => (
              <input
                key={field}
                value={form[field] || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
                placeholder={field.replace("_", " ")}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            ))}
            <div className="flex gap-2">
              <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white">{editing ? "Update" : "Create"}</button>
              {editing && (
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  onClick={() => {
                    setEditing(null);
                    setForm(emptyForm(current.fields));
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="rounded-lg border border-slate-200 p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${current.label.toLowerCase()}`}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button type="button" onClick={loadItems} className="rounded-md border border-slate-300 px-3 py-2 text-sm">Search</button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  {current.fields.map((field) => <th key={field} className="px-2 py-2 font-semibold">{field}</th>)}
                  <th className="px-2 py-2 font-semibold">status</th>
                  <th className="px-2 py-2 font-semibold">actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="px-2 py-3 text-slate-500" colSpan={current.fields.length + 2}>Loading...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td className="px-2 py-3 text-slate-500" colSpan={current.fields.length + 2}>No records</td></tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      {current.fields.map((field) => <td key={field} className="px-2 py-2">{row[field] || "--"}</td>)}
                      <td className="px-2 py-2">{row.is_active ? "Active" : "Disabled"}</td>
                      <td className="px-2 py-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                            onClick={() => {
                              setEditing(row);
                              setForm(current.fields.reduce((acc, field) => ({ ...acc, [field]: row[field] || "" }), {}));
                            }}
                          >
                            Edit
                          </button>
                          <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => toggleStatus(row)}>
                            {row.is_active ? "Disable" : "Enable"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
