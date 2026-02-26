// src/components/roles/RolePermissionsModal.jsx
import React, { useEffect, useState } from 'react';
import useRoles from '../../hooks/useRoles';

/**
 * RolePermissionsModal
 * Props:
 *  - role: { id, name, description } (required)
 *  - permissions: [{ id, key, name, description }] (list of all permissions)
 *  - onClose: () => void
 *
 * This component:
 *  - loads role's current permission keys via useRoles.fetchRolePermissions(role.id)
 *  - allows toggling permission keys
 *  - saves via useRoles.setRolePermissions(role.id, permissionKeys)
 */
export default function RolePermissionsModal({ role, permissions = [], onClose }) {
  const { fetchRolePermissions, setRolePermissions } = useRoles();
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchRolePermissions(role.id)
      .then(keys => { if (!mounted) return; setSelectedKeys(new Set(keys || [])); })
      .catch(() => { if (!mounted) return; setSelectedKeys(new Set()); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [role?.id]);

  const toggle = (key) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelectedKeys(new Set(permissions.map(p => p.key)));
  const clearAll = () => setSelectedKeys(new Set());

  const save = async () => {
    setSaving(true);
    try {
      await setRolePermissions(role.id, Array.from(selectedKeys));
      alert('Permissions saved.');
      onClose();
    } catch (err) {
      console.error('Failed saving role perms', err);
      alert('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded p-4 w-full max-w-3xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Permissions for {role.name}</h3>
          <div>
            <button className="px-3 py-1 border rounded mr-2" onClick={selectAll}>Select All</button>
            <button className="px-3 py-1 border rounded" onClick={clearAll}>Clear</button>
          </div>
        </div>

        {loading ? <div>Loading...</div> : (
          <div className="max-h-96 overflow-auto border rounded">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="p-2 text-left">Permission</th>
                  <th className="p-2 text-left">Key</th>
                  <th className="p-2 text-center">Has</th>
                </tr>
              </thead>
              <tbody>
                {permissions.map(p => (
                  <tr key={p.key || p.id} className="border-t">
                    <td className="p-2">{p.name}</td>
                    <td className="p-2 text-sm text-gray-600">{p.key}</td>
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedKeys.has(p.key)}
                        onChange={() => toggle(p.key)}
                        aria-label={`${role.name} has ${p.key}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 border rounded">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
