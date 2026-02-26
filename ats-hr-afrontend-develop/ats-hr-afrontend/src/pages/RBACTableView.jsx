// src/pages/RBACTableView.jsx
import React, { useEffect, useState } from "react";
import useRoles from "../hooks/useRoles";
import usePermissions from "../hooks/usePermissions";
import eventBus from "../utils/eventBus";

export default function RBACTableView() {
  const {
    roles,
    fetch: fetchRoles,
    fetchRolePermissions,
    setRolePermissions,
  } = useRoles();
  const { permissions, fetch: fetchPermissions } = usePermissions();

  const [matrix, setMatrix] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(new Set());

  // Load role-permission matrix
  const loadMatrix = async () => {
    setLoading(true);
    try {
      const result = {};
      for (const r of roles) {
        const keys = await fetchRolePermissions(r.id);
        result[r.id] = new Set(keys || []);
      }
      setMatrix(result);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    const init = async () => {
      await fetchRoles();
      await fetchPermissions();
      await loadMatrix();
    };
    init();
  }, []);

  // Auto-refresh when changes happen anywhere in the app
  useEffect(() => {
    const unsubRoles = eventBus.on("roles:updated", () => {
      fetchRoles().then(loadMatrix);
    });

    const unsubPerms = eventBus.on("permissions:updated", () => {
      fetchPermissions().then(loadMatrix);
    });

    const unsubMap = eventBus.on("role-permissions:updated", () => loadMatrix());

    return () => {
      unsubRoles();
      unsubPerms();
      unsubMap();
    };
  }, [roles, permissions]);

  const toggleCell = (roleId, permKey) => {
    setMatrix((prev) => {
      const copy = { ...prev };
      const set = new Set(copy[roleId] || []);
      if (set.has(permKey)) set.delete(permKey);
      else set.add(permKey);
      copy[roleId] = set;
      return copy;
    });
  };

  const saveRole = async (roleId) => {
    setSaving((prev) => new Set(prev).add(roleId));
    try {
      const list = Array.from(matrix[roleId] || []);
      await setRolePermissions(roleId, list);
      alert(`Saved permissions for ${roleId}`);
    } catch (err) {
      alert("Failed to save");
    } finally {
      setSaving((prev) => {
        const s = new Set(prev);
        s.delete(roleId);
        return s;
      });
    }
  };

  if (loading) return <div className="p-4">Loading RBAC matrix...</div>;

  if (!roles.length || !permissions.length) {
    return (
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-2">RBAC Table View</h2>
        <p className="text-sm text-gray-600">No roles or permissions available.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4">RBAC Table View</h1>

      <div className="overflow-auto bg-white rounded border">
        <table className="min-w-[900px] w-full table-auto border">
          {/* Header */}
          <thead className="bg-gray-100 text-sm">
            <tr>
              <th className="p-2 text-left">Permission</th>
              {roles.map((r) => (
                <th key={r.id} className="p-2 text-center">
                  {r.name}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {permissions.map((p) => (
              <tr key={p.key} className="border-t">
                <td className="p-2">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-gray-400">{p.key}</div>
                </td>

                {roles.map((r) => (
                  <td key={r.id} className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={matrix[r.id]?.has(p.key) || false}
                      onChange={() => toggleCell(r.id, p.key)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Save buttons */}
      <div className="mt-4 flex gap-3 flex-wrap">
        {roles.map((r) => (
          <button
            key={r.id}
            onClick={() => saveRole(r.id)}
            className="px-4 py-1 bg-blue-600 text-white rounded"
            disabled={saving.has(r.id)}
          >
            {saving.has(r.id) ? "Saving..." : `Save ${r.name}`}
          </button>
        ))}
      </div>
    </div>
  );
}
