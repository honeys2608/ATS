// src/pages/RBACDashboard.jsx
import React, { useEffect, useState } from 'react';
import useRoles from '../hooks/useRoles';
import usePermissions from '../hooks/usePermissions';
import PermissionMatrix from '../components/users/PermissionMatrix';

/**
 * RBAC Dashboard shows:
 *  - roles list
 *  - permissions list
 *  - editable matrix (permissions rows × role columns)
 *
 * PermissionMatrix component must support array shape for permissions (id,key,name,description)
 * and array shape for roles (id,name,...). The editable PermissionMatrix we created earlier does that.
 */
export default function RBACDashboard() {
  const { roles, loading: rolesLoading, fetch: fetchRoles } = useRoles();
  const { permissions, loading: permsLoading, fetch: fetchPermissions } = usePermissions();
  const [loadingMatrix, setLoadingMatrix] = useState(true);

  useEffect(() => {
    // ensure latest data if needed
    const load = async () => {
      setLoadingMatrix(true);
      try {
        await Promise.allSettled([fetchRoles(), fetchPermissions()]);
      } finally {
        setLoadingMatrix(false);
      }
    };
    load();
  }, []);

  if (rolesLoading || permsLoading || loadingMatrix) return <div className="p-4">Loading RBAC dashboard...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4">RBAC Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Roles list */}
        <div className="bg-white border rounded p-4">
          <h2 className="font-medium mb-3">Roles ({roles.length})</h2>
          {roles.length === 0 ? (
            <div className="text-sm text-gray-600">No roles found.</div>
          ) : (
            <ul className="space-y-2">
              {roles.map(r => (
                <li key={r.id} className="p-2 border rounded">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-gray-500">{r.description}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Permissions list */}
        <div className="bg-white border rounded p-4">
          <h2 className="font-medium mb-3">Permissions ({permissions.length})</h2>
          {permissions.length === 0 ? (
            <div className="text-sm text-gray-600">No permissions found.</div>
          ) : (
            <ul className="space-y-2 max-h-96 overflow-auto">
              {permissions.map(p => (
                <li key={p.id} className="p-2 border rounded">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-gray-500">{p.key}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-white border rounded p-4">
          <h2 className="font-medium mb-3">Quick Actions</h2>
          <div className="flex flex-col gap-2">
            <button onClick={() => { fetchRoles(); fetchPermissions(); }} className="px-3 py-2 border rounded text-sm">Refresh</button>
            <div className="text-sm text-gray-600">Tip: Click a role in the Roles page to open its permission editor, or use the matrix below to toggle and save per-role.</div>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded p-4">
        <h2 className="font-medium mb-3">Permissions × Roles Matrix</h2>
        <div className="text-sm text-gray-600 mb-3">Toggle a checkbox to add/remove a permission for the role. Use the role-specific save buttons below the matrix.</div>

        <PermissionMatrix permissions={permissions} roles={roles} />
      </div>
    </div>
  );
}
