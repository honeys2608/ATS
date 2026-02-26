import React, { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import { useLabels } from "../../context/LabelsContext";

export default function NomenclatureManager() {
  const { refreshLabels } = useLabels();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState({});

  const load = async () => {
    try {
      const res = await api.get("/v1/super-admin/nomenclature/labels", {
        params: { search: search || undefined },
      });
      setItems(res?.data?.items || []);
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to load labels");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const n = search.trim().toLowerCase();
    return items.filter((i) =>
      [i.key, i.default_value, i.custom_value, i.resolved_value]
        .join(" ")
        .toLowerCase()
        .includes(n),
    );
  }, [items, search]);

  const saveRow = async (row) => {
    const value = drafts[row.key] ?? row.custom_value ?? "";
    try {
      await api.put(`/v1/super-admin/nomenclature/labels/${encodeURIComponent(row.key)}`, {
        custom_value: value,
      });
      setMessage("Label updated");
      await load();
      await refreshLabels();
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to update label");
    }
  };

  const resetRow = async (row) => {
    try {
      await api.post(`/v1/super-admin/nomenclature/labels/${encodeURIComponent(row.key)}/reset`);
      setMessage("Label reset");
      await load();
      await refreshLabels();
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to reset label");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-slate-900">Nomenclature Manager</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search labels..."
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      {message && <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p>}
      <div className="overflow-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-left">Key</th>
              <th className="px-3 py-2 text-left">Default</th>
              <th className="px-3 py-2 text-left">Custom</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-xs text-slate-700">{row.key}</td>
                <td className="px-3 py-2 text-slate-700">{row.default_value}</td>
                <td className="px-3 py-2">
                  <input
                    value={drafts[row.key] ?? row.custom_value ?? ""}
                    onChange={(e) => setDrafts((p) => ({ ...p, [row.key]: e.target.value }))}
                    placeholder="Custom value"
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveRow(row)}
                      className="rounded-md bg-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => resetRow(row)}
                      className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      Reset
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-500">
                  No labels found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

