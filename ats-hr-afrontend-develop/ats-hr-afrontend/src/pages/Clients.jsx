import React, { useEffect, useState } from "react";
import axios from "../api/axios";
import { useNavigate } from "react-router-dom";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  // ⭐ Assign AM UI state
  const [showAMModal, setShowAMModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [accountManagers, setAccountManagers] = useState([]);
  const [selectedAM, setSelectedAM] = useState("");

  const navigate = useNavigate();

  // --------------------------------------------------
  // FETCH CLIENTS
  // --------------------------------------------------
  const fetchClients = async () => {
    try {
      const token = localStorage.getItem("access_token");

      const res = await axios.get("/v1/client/master", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setClients(res.data || []);
    } catch (err) {
      console.error("Failed to load clients", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  if (loading) return <div className="p-4">Loading clients...</div>;

  // --------------------------------------------------
  // OPEN ASSIGN AM MODAL
  // --------------------------------------------------
  const openAssignAMModal = async (client) => {
    try {
      const token = localStorage.getItem("access_token");

      setSelectedClient(client);
      setSelectedAM(client.account_manager?.id || "");
      setShowAMModal(true);

      // 🔥 Fetch Account Managers
      const res = await axios.get("/v1/client/admin/account-managers", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setAccountManagers(res.data || []);
    } catch (err) {
      console.error("Failed to load account managers", err);
      alert("Failed to load account managers");
    }
  };

  // --------------------------------------------------
  // ASSIGN ACCOUNT MANAGER
  // --------------------------------------------------
  const assignAccountManager = async () => {
    if (!selectedAM) {
      alert("Please select an Account Manager");
      return;
    }

    try {
      const token = localStorage.getItem("access_token");

      await axios.put(
        `/v1/client/master/${selectedClient.id}/assign-account-manager`,
        { account_manager_id: selectedAM },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      alert("Account Manager assigned successfully");
      setShowAMModal(false);
      fetchClients();
    } catch (err) {
      console.error("Assign failed", err);
      alert("Failed to assign Account Manager");
    }
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Client List</h1>
      </div>

      {clients.length === 0 ? (
        <div className="text-gray-500">No clients found</div>
      ) : (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 text-sm text-gray-600">
              <tr>
                <th className="p-2 border">S. No.</th> {/* ✅ Serial */}
                <th className="p-2 border">Name</th>
                <th className="p-2 border">Email</th>
                <th className="p-2 border">Company</th>
                <th className="p-2 border">Account Manager</th>
                <th className="p-2 border">Status</th>
                <th className="p-2 border">Action</th>
              </tr>
            </thead>

            <tbody>
              {clients.map((c, index) => (
                <tr key={c.id} className="border hover:bg-slate-50 transition">
                  <td className="p-2 border text-center font-medium">
                    {index + 1}
                  </td>

                  <td className="p-2 border">{c.name || "N/A"}</td>
                  <td className="p-2 border">{c.email || "N/A"}</td>
                  <td className="p-2 border">{c.company_name || "N/A"}</td>

                  {/* ⭐ Account Manager Column */}
                  <td className="p-2 border">
                    {c.account_manager?.name ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                        {c.account_manager.name}
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">
                        Not Assigned
                      </span>
                    )}
                  </td>

                  <td className="p-2 border">
                    {c.is_active ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-200 text-gray-600">
                        Inactive
                      </span>
                    )}
                  </td>

                  <td className="p-2 border text-center space-x-2">
                    <button
                      onClick={() => navigate(`/clients/${c.id}/requirements`)}
                      className="px-3 py-1.5 rounded-md text-sm bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                      View
                    </button>

                    <button
                      onClick={() => openAssignAMModal(c)}
                      className="px-3 py-1.5 rounded-md text-sm bg-blue-600 text-white hover:bg-blue-700"
                    >
                      {c.account_manager?.id
                        ? "Change Account Manager"
                        : "Assign Account Manager"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= ASSIGN AM MODAL ================= */}
      {showAMModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-[400px] shadow-lg">
            <h2 className="text-lg font-semibold mb-4">
              Assign Account Manager
            </h2>

            <p className="text-sm mb-2">
              Client:{" "}
              <b>{selectedClient?.company_name || selectedClient?.name}</b>
            </p>

            <select
              className="w-full border p-2 rounded mb-4"
              value={selectedAM}
              onChange={(e) => setSelectedAM(e.target.value)}
            >
              <option value="">Select Account Manager</option>
              {accountManagers.map((am) => (
                <option key={am.id} value={am.id}>
                  {am.full_name}
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-gray-300 rounded"
                onClick={() => setShowAMModal(false)}
              >
                Cancel
              </button>

              <button
                className="px-4 py-2 bg-indigo-600 text-white rounded"
                onClick={assignAccountManager}
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
