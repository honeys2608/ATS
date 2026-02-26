// src/pages/UserManagement.jsx
import React, { useEffect, useState, useCallback } from "react";
import axios from "../api/axios";
import UserTable from "../components/users/UserTable";
import UserFormModal from "../components/users/UserFormModal";

// normalize users API
function normalizeUsersResponse(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.users)) return data.users;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [rolesSummary, setRolesSummary] = useState({});
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // ================= LOAD USERS & ROLES =================
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, rRes, rolesRes] = await Promise.allSettled([
        axios.get("/v1/users"),
        axios.get("/v1/users/roles/summary"),
        axios.get("/v1/roles"),
      ]);

      if (uRes.status === "fulfilled") {
        setUsers(normalizeUsersResponse(uRes.value.data));
      }

      let roleMap = {};
      if (rRes.status === "fulfilled") {
        const rd = rRes.value.data;
        if (Array.isArray(rd)) {
          rd.forEach((r) => (roleMap[r.key] = r));
        } else if (rd && typeof rd === "object") {
          roleMap = rd;
        }
      }

      if (rolesRes.status === "fulfilled") {
        const rows = Array.isArray(rolesRes.value?.data)
          ? rolesRes.value.data
          : Array.isArray(rolesRes.value?.data?.roles)
            ? rolesRes.value.data.roles
            : [];
        rows.forEach((r) => {
          const key = String(r?.name || "").trim().toLowerCase();
          if (!key) return;
          roleMap[key] = {
            ...(roleMap[key] || {}),
            role: key,
            name: r?.name || key,
          };
        });
      }
      setRolesSummary(roleMap);
    } catch (err) {
      console.error("UserManagement load error", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ================= ACTIONS =================
  const createUser = async (payload) => {
    await axios.post("/v1/users", payload);
    setShowCreate(false);
    loadData();
  };

  const saveUser = async (payload, id) => {
    if (id) await axios.put(`/v1/users/${id}`, payload);
    else await axios.post("/v1/users", payload);
    setEditingUser(null);
    loadData();
  };

  const deleteUser = async (id, name) => {
    if (!window.confirm(`Delete user '${name}'?`)) return;
    await axios.delete(`/v1/users/${id}`);
    loadData();
  };

  const updateUserRole = async (id, role) => {
    if (!window.confirm(`Change role to ${role}?`)) return;
    try {
      await axios.put(`/v1/users/${id}/role`, { role });
    } catch {
      await axios.put(`/v1/users/${id}`, { role });
    }
    loadData();
  };

  const updateUserStatus = async (id, isActive) => {
    const action = isActive ? "unlock" : "lock";

    if (!window.confirm(`Are you sure you want to ${action} this user?`))
      return;

    await axios.put(`/v1/users/${id}/status`, {
      is_active: isActive,
    });

    loadData();
  };

  return (
    <div>
      <div className="mb-6 flex justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-gray-600">Manage users & assign roles</p>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded bg-blue-600 text-white"
        >
          + Create User
        </button>
      </div>

      <UserTable
        users={users}
        roles={rolesSummary}
        loading={loading}
        onEdit={setEditingUser}
        onDelete={deleteUser}
        onRoleChange={updateUserRole}
        onStatusChange={updateUserStatus} // ✅ ADD THIS LINE
        onRefresh={loadData}
      />

      <UserFormModal
        open={showCreate}
        roles={rolesSummary}
        onClose={() => setShowCreate(false)}
        onSubmit={createUser}
      />

      <UserFormModal
        open={!!editingUser}
        initialData={editingUser}
        roles={rolesSummary}
        onClose={() => setEditingUser(null)}
        onSubmit={saveUser}
      />
    </div>
  );
}
