// /mnt/data/src/components/users/UserTable.jsx
import React, { useMemo, useState } from "react";

function RoleBadge({ role }) {
  const map = {
    admin: "bg-purple-100 text-purple-800",
    recruiter: "bg-blue-100 text-blue-800",
    account_manager: "bg-indigo-100 text-indigo-800",
    internal_hr: "bg-yellow-100 text-yellow-800",
    consultant: "bg-pink-100 text-pink-800",
    employee: "bg-green-100 text-green-800",
    accounts: "bg-teal-100 text-teal-800",
    consultant_support: "bg-gray-100 text-gray-800",
    candidate: "bg-gray-50 text-gray-700",
    vendor: "bg-gray-50 text-gray-700",
    partner: "bg-gray-50 text-gray-700",
  };
  return (
    <span
      className={`px-2 py-1 rounded text-xs ${
        map[role] || "bg-gray-100 text-gray-800"
      }`}
    >
      {role}
    </span>
  );
}

export default function UserTable({
  users = [],
  roles = {},
  loading = false,
  onEdit,
  onDelete,
  onRoleChange,
  onStatusChange, // 👈 ADD THIS LINE
  onRefresh,
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const roleOptions = useMemo(() => {
    // show backend roles keys or fallback
    const keys = Object.keys(roles || {});
    if (keys.length) return keys;
    return [
      "admin",
      "recruiter",
      "account_manager",
      "internal_hr",
      "consultant",
      "employee",
      "accounts",
      "consultant_support",
      "candidate",
      "vendor",
      "partner",
    ];
  }, [roles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        (u.username || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.full_name || "").toLowerCase().includes(q)
      );
    });
  }, [users, query, roleFilter]);

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            placeholder="Search by name, email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="px-3 py-2 border rounded w-full sm:w-72"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 border rounded"
          >
            <option value="">All roles</option>
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {roles[r]?.name || r}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onRefresh} className="px-3 py-2 border rounded">
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-3">Username</th>
              <th className="p-3">Full name</th>
              <th className="p-3">Email</th>
              <th className="p-3 text-center">Role</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-6 text-center">
                  Loading...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-600">
                  No users found
                </td>
              </tr>
            ) : (
              filtered.map((user) => (
                <tr key={user.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{user.username}</td>
                  <td className="p-3">{user.full_name}</td>
                  <td className="p-3 break-all">{user.email}</td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <RoleBadge role={user.role} />
                      <select
                        value={user.role}
                        onChange={(e) => onRoleChange(user.id, e.target.value)}
                        className="px-2 py-1 border rounded text-sm"
                        aria-label={`Change role for ${user.username}`}
                      >
                        {roleOptions.map((r) => (
                          <option key={r} value={r}>
                            {roles[r]?.name || r}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => onEdit(user)}
                        className="px-3 py-1 bg-yellow-50 rounded"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => onStatusChange(user.id, !user.is_active)}
                        className={`px-3 py-1 rounded ${
                          user.is_active
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {user.is_active ? "Lock" : "Unlock"}
                      </button>

                      <button
                        onClick={() => onDelete(user.id, user.username)}
                        className="px-3 py-1 bg-red-50 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
