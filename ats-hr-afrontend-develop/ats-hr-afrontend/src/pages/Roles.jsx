// src/pages/Roles.jsx
import React, { useEffect, useState } from "react";
import useRoles from "../hooks/useRoles";
import usePermissions from "../hooks/usePermissions";
import PaginatedCardGrid from "../components/common/PaginatedCardGrid";
import usePersistedPagination from "../hooks/usePersistedPagination";

import RoleForm from "../components/roles/RoleForm";
import RoleFormModal from "../components/roles/RoleFormModal";
import RolePermissionsModal from "../components/roles/RolePermissionsModal";

export default function RolesPage() {
  const {
    roles,
    loading: rolesLoading,
    error: rolesError,
    pagination,
    createRole,
    updateRole,
    deleteRole,
    fetch,
  } = useRoles();

  const { permissions, loading: permsLoading } = usePermissions();
  const [editingRole, setEditingRole] = useState(null);
  const [openPermsFor, setOpenPermsFor] = useState(null);
  const { page, setPage, limit, setLimit, pageSizeOptions } =
    usePersistedPagination("roles:listing");

  useEffect(() => {
    fetch({ page, limit });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  const handleCreateRole = async (payload) => {
    try {
      await createRole(payload);
      await fetch({ page, limit });
    } catch (err) {
      console.error("Create role failed", err);
      alert(err?.response?.data?.detail || "Failed to create role");
    }
  };

  const handleUpdateRole = async (payload, id) => {
    try {
      await updateRole(id, payload);
      await fetch({ page, limit });
    } catch (err) {
      console.error("Update role failed", err);
      alert(err?.response?.data?.detail || "Failed to update role");
    }
  };

  const handleDeleteRole = async (id) => {
    if (!confirm("Delete role? This cannot be undone.")) return;
    try {
      await deleteRole(id);
      await fetch({ page, limit });
    } catch (err) {
      console.error("Delete role failed", err);
      alert(err?.response?.data?.detail || "Failed to delete role");
    }
  };

  const totalPages =
    pagination?.totalPages || Math.max(1, Math.ceil((roles?.length || 0) / limit));
  const totalRecords = pagination?.totalRecords ?? roles?.length ?? 0;
  const currentPage = pagination?.currentPage || page;

  if (rolesLoading || permsLoading) {
    return <div className="p-4">Loading roles & permissions...</div>;
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Roles</h1>
        <div className="text-sm text-gray-600">
          Manage roles and their permissions
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border rounded p-4">
          <h2 className="font-medium mb-3">Create Role</h2>
          <RoleForm onSubmit={handleCreateRole} />
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white border rounded p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium">All roles</h2>
              <button
                onClick={() => fetch({ page, limit })}
                className="px-3 py-1 border rounded text-sm"
              >
                Refresh
              </button>
            </div>

            <PaginatedCardGrid
              items={roles}
              totalPages={totalPages}
              currentPage={currentPage}
              onPageChange={setPage}
              totalRecords={totalRecords}
              pageSize={limit}
              onPageSizeChange={(nextLimit) => {
                setLimit(nextLimit);
                setPage(1);
              }}
              pageSizeOptions={pageSizeOptions}
              error={rolesError ? "Failed to load roles. Please retry." : null}
              onRetry={() => fetch({ page, limit })}
              emptyMessage="No roles created yet."
              renderCard={(role) => (
                <div className="border rounded p-4 bg-white shadow-sm hover:shadow-md transition">
                  <div className="font-medium">{role.name}</div>
                  <div className="text-sm text-gray-600">
                    {role.description || "No description"}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    id: {role.id}
                    {role.key ? ` | key: ${role.key}` : ""}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => setOpenPermsFor(role)}
                      className="px-3 py-1 border rounded text-sm"
                    >
                      Permissions
                    </button>
                    <button
                      onClick={() => setEditingRole(role)}
                      className="px-3 py-1 border rounded text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteRole(role.id)}
                      className="px-3 py-1 border rounded text-sm text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            />
          </div>

          <div className="bg-white border rounded p-4">
            <h3 className="font-medium mb-2">Permissions (global list)</h3>
            {permissions.length === 0 ? (
              <div className="text-sm text-gray-600">
                No permissions defined yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {permissions.map((permission) => (
                  <div key={permission.id} className="border rounded p-2 text-sm">
                    <div className="font-medium">{permission.name}</div>
                    <div className="text-xs text-gray-500">{permission.key}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {editingRole && (
        <RoleFormModal
          open={Boolean(editingRole)}
          initial={editingRole}
          onClose={() => setEditingRole(null)}
          onSubmit={handleUpdateRole}
        />
      )}

      {openPermsFor && (
        <RolePermissionsModal
          role={openPermsFor}
          permissions={permissions}
          onClose={() => setOpenPermsFor(null)}
        />
      )}
    </div>
  );
}

