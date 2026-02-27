import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, RefreshCw } from "lucide-react";
import StatusBadge from "../../components/user-management/StatusBadge";
import UserDrawer from "../../components/user-management/UserDrawer";
import {
  createUser,
  forceLogoutUser,
  listRoles,
  listUsers,
  resetUserPassword,
  updateUser,
  updateUserStatus,
} from "../../services/superAdminUserService";

const DEFAULT_FILTERS = {
  search: "",
  role: "",
  status: "",
};

function formatDate(value) {
  if (!value) return "--";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "--" : d.toLocaleString();
}

export default function SuperAdminUserManagement() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ total_users: 0, active_users: 0, suspended_locked_users: 0 });
  const [roles, setRoles] = useState([]);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [selected, setSelected] = useState(new Set());

  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [usersRes, rolesRes] = await Promise.all([
        listUsers({ page, limit, ...filters }),
        listRoles(),
      ]);
      setRows(Array.isArray(usersRes?.items) ? usersRes.items : []);
      setSummary(usersRes?.summary || {});
      setTotalPages(Number(usersRes?.total_pages || 1));
      setRoles(Array.isArray(rolesRes) ? rolesRes : []);
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Failed to load users";
      setError(typeof msg === "string" ? msg : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, limit, filters.search, filters.role, filters.status]);

  const submitDrawer = async (payload) => {
    setSaving(true);
    setError("");
    setTempPassword("");
    try {
      if (editingRow) {
        await updateUser(editingRow.id, payload);
        setSuccess("User updated successfully");
      } else {
        const res = await createUser(payload);
        setSuccess("User created successfully");
        if (res?.temp_password) setTempPassword(res.temp_password);
      }
      setDrawerOpen(false);
      setEditingRow(null);
      await load();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Unable to save user";
      setError(typeof msg === "string" ? msg : "Unable to save user");
    } finally {
      setSaving(false);
    }
  };

  const rowAction = async (action, row) => {
    try {
      if (action === "edit") {
        setEditingRow(row);
        setDrawerOpen(true);
        return;
      }
      if (action === "audit") {
        navigate(`/super-admin/audit-logs?user_id=${encodeURIComponent(row.id)}`);
        return;
      }
      if (action === "reset_password") {
        const manual = window.confirm("Set manual password? Click Cancel to generate temporary password.");
        if (manual) {
          const password = window.prompt("Enter new password (8-128 chars)");
          if (!password) return;
          const res = await resetUserPassword(row.id, { mode: "manual", password });
          if (res?.temp_password) setTempPassword(res.temp_password);
        } else {
          const res = await resetUserPassword(row.id, { mode: "generate" });
          if (res?.temp_password) setTempPassword(res.temp_password);
        }
        setSuccess("Password reset triggered");
      }
      if (action === "force_logout") {
        if (!window.confirm("Force logout this user from all sessions?")) return;
        await forceLogoutUser(row.id);
        setSuccess("User sessions invalidated");
      }
      if (action.startsWith("status:")) {
        const status = action.split(":")[1];
        if (!window.confirm(`Change status to ${status}?`)) return;
        await updateUserStatus(row.id, status);
        setSuccess("User status updated");
      }
      await load();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Action failed";
      setError(typeof msg === "string" ? msg : "Action failed");
    }
  };

  const runBulkDeactivate = async () => {
    if (selectedRows.length === 0) return;
    if (!window.confirm(`Deactivate ${selectedRows.length} selected users?`)) return;
    for (const row of selectedRows) {
      await updateUserStatus(row.id, "inactive");
    }
    setSelected(new Set());
    setSuccess("Bulk deactivate completed");
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
          <p className="text-sm text-slate-600">Users, role assignment, and account status.</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Link className="rounded border border-slate-300 px-2 py-1 text-slate-700 hover:bg-slate-50" to="/super-admin/user-management/users">
              Users
            </Link>
            <Link className="rounded border border-slate-300 px-2 py-1 text-slate-700 hover:bg-slate-50" to="/super-admin/roles-permissions">
              Roles & Permissions
            </Link>
            <Link className="rounded border border-slate-300 px-2 py-1 text-slate-700 hover:bg-slate-50" to="/super-admin/audit-logs">
              User Activity
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <RefreshCw size={15} /> Refresh
          </button>
          <button
            onClick={() => {
              setEditingRow(null);
              setDrawerOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
          >
            <Plus size={15} /> Create User
          </button>
        </div>
      </div>

      {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}
      {tempPassword ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Temporary password (show once): <span className="font-semibold">{tempPassword}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded border bg-white p-4"><p className="text-sm text-slate-500">Total Users</p><p className="text-2xl font-bold">{summary?.total_users ?? 0}</p></div>
        <div className="rounded border bg-white p-4"><p className="text-sm text-slate-500">Active</p><p className="text-2xl font-bold text-emerald-700">{summary?.active_users ?? 0}</p></div>
        <div className="rounded border bg-white p-4"><p className="text-sm text-slate-500">Suspended / Locked</p><p className="text-2xl font-bold text-amber-700">{summary?.suspended_locked_users ?? 0}</p></div>
      </div>

      <div className="grid grid-cols-1 gap-2 rounded border bg-white p-3 md:grid-cols-4">
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Search name/email"
          value={filters.search}
          onChange={(e) => {
            setPage(1);
            setFilters((p) => ({ ...p, search: e.target.value }));
          }}
        />
        <select className="rounded border border-slate-300 px-3 py-2 text-sm" value={filters.role} onChange={(e) => { setPage(1); setFilters((p) => ({ ...p, role: e.target.value })); }}>
          <option value="">All roles</option>
          {roles.map((r) => <option key={r.id || r.name} value={String(r.name || "").toLowerCase()}>{r.name}</option>)}
        </select>
        <select className="rounded border border-slate-300 px-3 py-2 text-sm" value={filters.status} onChange={(e) => { setPage(1); setFilters((p) => ({ ...p, status: e.target.value })); }}>
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
          <option value="locked">Locked</option>
          <option value="pending">Pending</option>
        </select>
        <button className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => { setFilters(DEFAULT_FILTERS); setPage(1); }}>
          Clear Filters
        </button>
      </div>

      <div className="rounded border bg-white p-3">
        <div className="mb-2 flex justify-between">
          <p className="text-sm text-slate-500">{selectedRows.length} selected</p>
          <button
            disabled={selectedRows.length === 0}
            onClick={runBulkDeactivate}
            className="rounded border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 disabled:opacity-50"
          >
            Bulk Deactivate
          </button>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selected.size === rows.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelected(new Set(rows.map((r) => r.id)));
                      else setSelected(new Set());
                    }}
                  />
                </th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Last Login</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">Loading users...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">No users found.</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(row.id)) next.delete(row.id);
                            else next.add(row.id);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-900">{row.full_name || "--"}</td>
                    <td className="px-3 py-2">{row.email}</td>
                    <td className="px-3 py-2">{row.role || "--"}</td>
                    <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
                    <td className="px-3 py-2">{formatDate(row.last_login_at)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <button className="rounded border px-2 py-1 text-xs" onClick={() => rowAction("edit", row)}>Edit</button>
                        <button className="rounded border px-2 py-1 text-xs" onClick={() => rowAction("reset_password", row)}>Reset Password</button>
                        <button className="rounded border px-2 py-1 text-xs" onClick={() => rowAction("force_logout", row)}>Force Logout</button>
                        {row.status !== "active" ? (
                          <button className="rounded border px-2 py-1 text-xs" onClick={() => rowAction("status:active", row)}>Activate</button>
                        ) : (
                          <button className="rounded border px-2 py-1 text-xs" onClick={() => rowAction("status:inactive", row)}>Deactivate</button>
                        )}
                        {row.status !== "suspended" ? (
                          <button className="rounded border px-2 py-1 text-xs" onClick={() => rowAction("status:suspended", row)}>Suspend</button>
                        ) : (
                          <button className="rounded border px-2 py-1 text-xs" onClick={() => rowAction("status:active", row)}>Unsuspend</button>
                        )}
                        {row.status === "locked" ? (
                          <button className="rounded border px-2 py-1 text-xs" onClick={() => rowAction("status:active", row)}>Unlock</button>
                        ) : null}
                        <button className="rounded border px-2 py-1 text-xs" onClick={() => rowAction("audit", row)}>Audit Logs</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Page {page} of {totalPages}</p>
        <div className="flex items-center gap-2">
          <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="rounded border border-slate-300 px-2 py-1 text-sm">
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Prev</button>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Next</button>
        </div>
      </div>

      <UserDrawer
        open={drawerOpen}
        mode={editingRow ? "edit" : "create"}
        initialData={editingRow}
        roles={roles}
        onClose={() => {
          setDrawerOpen(false);
          setEditingRow(null);
        }}
        onSubmit={submitDrawer}
        loading={saving}
        serverError={error}
      />
    </div>
  );
}
