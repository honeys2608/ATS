// src/pages/Permissions.jsx
import React, { useState } from "react";
import usePermissions from "../hooks/usePermissions";

export default function PermissionsPage() {
  const { permissions, loading, createPermission, deletePermission } =
    usePermissions();

  const [form, setForm] = useState({
    role_name: "",
    module_name: "",
    action_name: "",
  });

  const submitNew = async (e) => {
    e.preventDefault();

    if (!form.role_name || !form.module_name || !form.action_name)
      return alert("All fields are required");

    try {
      await createPermission({
        role_name: form.role_name.trim(),
        module_name: form.module_name.trim(),
        action_name: form.action_name.trim(),
      });

      setForm({ role_name: "", module_name: "", action_name: "" });
    } catch (err) {
      alert(err?.response?.data?.detail || "Failed to create permission");
    }
  };

  if (loading) return <div className="p-4">Loading permissions…</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4">Permissions</h1>

      {/* ---------- CREATE FORM ---------- */}
      <div className="bg-white border rounded p-4 mb-6">
        <h2 className="font-medium mb-3">Create permission</h2>

        <form
          onSubmit={submitNew}
          className="grid grid-cols-1 sm:grid-cols-4 gap-3"
        >
          <input
            placeholder="role_name (e.g. recruiter)"
            value={form.role_name}
            onChange={(e) =>
              setForm((f) => ({ ...f, role_name: e.target.value }))
            }
            className="border p-2 rounded w-full"
            required
          />

          <input
            placeholder="module_name (e.g. candidates)"
            value={form.module_name}
            onChange={(e) =>
              setForm((f) => ({ ...f, module_name: e.target.value }))
            }
            className="border p-2 rounded w-full"
            required
          />

          <input
            placeholder="action_name (e.g. view)"
            value={form.action_name}
            onChange={(e) =>
              setForm((f) => ({ ...f, action_name: e.target.value }))
            }
            className="border p-2 rounded w-full"
            required
          />

          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Create
          </button>
        </form>
      </div>

      {/* ---------- LIST ---------- */}
      <div className="bg-white border rounded p-4">
        <h2 className="font-medium mb-3">All permissions</h2>

        {permissions.length === 0 ? (
          <div className="text-sm text-gray-600">No permissions found.</div>
        ) : (
          <div className="space-y-2">
            {permissions.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between border rounded p-3"
              >
                <div>
                  <div className="font-medium">
                    {p.role_name} → {p.module_name}.
                    <span className="text-blue-600">{p.action_name}</span>
                  </div>

                  <div className="text-sm text-gray-500">
                    {new Date(p.created_at).toLocaleString()}
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (confirm("Delete permission?")) deletePermission(p.id);
                  }}
                  className="px-3 py-1 border rounded text-sm text-red-600"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
