import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/axios";

const initialForm = {
  full_name: "",
  username: "",
  email: "",
  password: "",
};

function formatLastLogin(value) {
  if (!value) return "Never logged in";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleString();
}

export default function AdminManagement() {
  const [admins, setAdmins] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [searchParams] = useSearchParams();
  const query = (searchParams.get("q") || "").trim().toLowerCase();

  const loadAdmins = () => {
    api
      .get("/v1/super-admin/admins")
      .then((res) => setAdmins(Array.isArray(res.data) ? res.data : []))
      .catch(() => setAdmins([]));
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const filteredAdmins = useMemo(() => {
    if (!query) return admins;
    return admins.filter((a) =>
      [
        a?.full_name,
        a?.email,
        a?.role,
        a?.scope,
        a?.last_login,
        a?.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [admins, query]);

  const onCreateAdmin = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.username || !form.email || !form.password) {
      setError("Username, email and password are required.");
      return;
    }

    setBusy(true);
    try {
      await api.post("/v1/super-admin/admins", {
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        role: "admin",
        full_name: form.full_name.trim() || null,
      });
      setForm(initialForm);
      setShowCreate(false);
      loadAdmins();
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || "Failed to create admin.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">Govern admin users and access scope.</div>
        <button
          className="rounded-md bg-purple-600 px-4 py-2 text-sm text-white"
          onClick={() => {
            setError("");
            setShowCreate((prev) => !prev);
          }}
        >
          {showCreate ? "Close" : "Create Admin"}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={onCreateAdmin} className="rounded-lg border border-purple-200 bg-purple-50 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              className="rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="Full Name"
              value={form.full_name}
              onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
            />
            <input
              className="rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="Username *"
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
            />
            <input
              className="rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="Email *"
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
            <input
              className="rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="Password *"
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            />
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Creating..." : "Save Admin"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left">Admin Name</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Scope</th>
              <th className="px-4 py-3 text-left">Last Login</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredAdmins.map((a) => (
              <tr key={a.id} className="border-t border-slate-200">
                <td className="px-4 py-3 font-medium text-slate-900">{a.full_name || a.email}</td>
                <td className="px-4 py-3">{a.role}</td>
                <td className="px-4 py-3">{a.scope}</td>
                <td className="px-4 py-3">{formatLastLogin(a.last_login)}</td>
                <td className="px-4 py-3">{a.status}</td>
              </tr>
            ))}
            {filteredAdmins.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan="5">
                  {query ? "No admins match this search." : "No admins found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
