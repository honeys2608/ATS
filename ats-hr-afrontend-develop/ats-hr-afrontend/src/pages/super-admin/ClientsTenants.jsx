import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/axios";

export default function ClientsTenants() {
  const [clients, setClients] = useState([]);
  const [busyClientId, setBusyClientId] = useState("");
  const [searchParams] = useSearchParams();
  const query = (searchParams.get("q") || "").trim().toLowerCase();

  const loadClients = () => {
    api
      .get("/v1/super-admin/clients")
      .then((res) => setClients(Array.isArray(res.data) ? res.data : []))
      .catch(() => setClients([]));
  };

  useEffect(() => {
    loadClients();
  }, []);

  const filteredClients = useMemo(() => {
    if (!query) return clients;
    return clients.filter((c) =>
      [
        c?.name,
        c?.email,
        c?.status,
        c?.account_manager_id,
        c?.active_jobs,
        c?.subscription_plan,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [clients, query]);

  const onToggleClientStatus = async (client) => {
    const isCurrentlyActive = String(client?.status || "").toLowerCase() === "active";
    const nextActive = !isCurrentlyActive;
    const reason = window.prompt(
      `${nextActive ? "Activate" : "Suspend"} client ${client.name || client.email}. Reason (optional):`,
      "",
    );

    setBusyClientId(client.id);
    try {
      await api.put(`/v1/super-admin/clients/${client.id}/status`, {
        is_active: nextActive,
        reason: reason || null,
      });
      loadClients();
    } catch (_error) {
      // Keep silent to avoid noisy UX in partial deployments.
    } finally {
      setBusyClientId("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">Manage organizations using ATS-HR.</div>
      <div className="overflow-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left">Client Name</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Account Manager</th>
              <th className="px-4 py-3 text-left">Active Jobs</th>
              <th className="px-4 py-3 text-left">Plan</th>
              <th className="px-4 py-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map((c) => {
              const isActive = String(c.status || "").toLowerCase() === "active";
              const isBusy = busyClientId === c.id;
              return (
                <tr key={c.id} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name || c.email}</td>
                  <td className="px-4 py-3">{c.status}</td>
                  <td className="px-4 py-3">{c.account_manager_id || "?"}</td>
                  <td className="px-4 py-3">{c.active_jobs}</td>
                  <td className="px-4 py-3">{c.subscription_plan || "Standard"}</td>
                  <td className="px-4 py-3">
                    <button
                      disabled={isBusy}
                      onClick={() => onToggleClientStatus(c)}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 ${
                        isActive ? "bg-red-600" : "bg-emerald-600"
                      }`}
                    >
                      {isBusy ? "Saving..." : isActive ? "Suspend" : "Activate"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredClients.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan="6">
                  {query ? "No clients match this search." : "No clients found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
