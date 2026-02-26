import React, { useEffect, useState } from "react";
import api from "../../api/axios";

export default function ClientDirectory() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      const res = await api.get("/v1/client/master");
      setClients(res.data || []);
    } catch (err) {
      console.error("Failed to load clients", err);
      alert("Unable to load client directory");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-gray-900">Client Directory</h1>
        <p className="text-sm text-gray-500">
          View the clients covered by your Account Manager remit. Operations
          control edits and onboarding while you focus on requirement coordination.
        </p>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>{clients.length} client{clients.length === 1 ? "" : "s"}</span>
        <button
          onClick={loadClients}
          className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-600 hover:text-blue-800"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500">
          Loading client list...
        </div>
      ) : clients.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-white p-6 text-center text-gray-500">
          No clients assigned to your account yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Account Manager</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map((client) => (
                <tr key={client.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    {client.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {client.company_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{client.email || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {client.account_manager?.name || "Unassigned"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        client.is_active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {client.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
