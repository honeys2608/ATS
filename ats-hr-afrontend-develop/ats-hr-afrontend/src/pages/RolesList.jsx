// src/pages/RolesList.jsx
import React, { useEffect } from 'react';
import useRoles from '../hooks/useRoles';
import eventBus from '../utils/eventBus';

export default function RolesList() {
  const { roles, loading, fetch } = useRoles();

  useEffect(() => {
    const unsub1 = eventBus.on('roles:updated', () => fetch());
    const unsub2 = eventBus.on('role-permissions:updated', () => fetch());
    return () => { unsub1(); unsub2(); };
  }, []);

  if (loading) return <div className="p-4">Loading roles...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4">Roles</h1>
      <div className="bg-white border rounded p-4">
        <table className="w-full table-auto border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Role Name</th>
              <th className="p-2 text-left">Description</th>
              <th className="p-2 text-left">Role ID</th>
            </tr>
          </thead>
          <tbody>
            {roles.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.name}</td>
                <td className="p-2">{r.description}</td>
                <td className="p-2">{r.id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
