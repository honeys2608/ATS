// src/pages/RolePermissionMatrix.jsx
import React, { useEffect, useState } from "react";
import axios from "../api/axios";

export default function RolePermissionMatrix() {
  const [matrix, setMatrix] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMatrix();
  }, []);

  const loadMatrix = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/v1/permissions-matrix");

      if (!res.data?.matrix) return;

      const backend = res.data.matrix;
      const table = {};

      /**
       * Backend format:
       * module → action → [roles]
       *
       * We convert to:
       * module → role → [actions]
       */

      Object.entries(backend).forEach(([module, actions]) => {
        if (!table[module]) table[module] = {};

        Object.entries(actions).forEach(([action, roles]) => {
          roles.forEach((role) => {
            if (!table[module][role]) table[module][role] = [];
            if (!table[module][role].includes(action)) {
              table[module][role].push(action);
            }
          });
        });
      });

      setMatrix(table);
    } catch (err) {
      console.error("Permission matrix load failed", err);
    } finally {
      setLoading(false);
    }
  };

  const allRoles = (() => {
    const set = new Set();
    Object.values(matrix).forEach((mod) => {
      Object.keys(mod).forEach((r) => set.add(r));
    });
    return Array.from(set).sort();
  })();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Role Permission Matrix</h1>
      <p className="text-gray-600 mb-6">System-wide RBAC configuration</p>

      {loading ? (
        <div>Loading permissions…</div>
      ) : (
        <div className="border rounded overflow-auto">
          <table className="min-w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-3 py-2">Module</th>
                {allRoles.map((r) => (
                  <th key={r} className="border px-3 py-2 capitalize">
                    {r.replace("_", " ")}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {Object.entries(matrix).map(([module, roleData]) => (
                <tr key={module}>
                  <td className="border px-3 py-2 font-semibold bg-gray-50">
                    {module.replace("_", " ")}
                  </td>

                  {allRoles.map((role) => (
                    <td key={role} className="border px-3 py-2 text-center">
                      {roleData[role]?.length ? roleData[role].join(", ") : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
