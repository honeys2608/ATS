// src/pages/PermissionsList.jsx
import React, { useEffect } from "react";
import usePermissions from "../hooks/usePermissions";
import eventBus from "../utils/eventBus";

export default function PermissionsList() {
  const { permissions, loading, fetch } = usePermissions();

  useEffect(() => {
    const unsub = eventBus.on("permissions:updated", () => fetch());
    return () => unsub();
  }, []);

  if (loading) return <div className="p-4">Loading permissions...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4">Permissions</h1>
      <div className="bg-white border rounded p-4">
        <table className="w-full table-auto border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Permission Name</th>
              <th className="p-2 text-left">Key</th>
              <th className="p-2 text-left">Description</th>
            </tr>
          </thead>
          <tbody>
            {permissions.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-2">{p.role_name}</td>
                <td className="p-2">{p.module_name + "." + p.action_name}</td>
                <td className="p-2">{p.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
