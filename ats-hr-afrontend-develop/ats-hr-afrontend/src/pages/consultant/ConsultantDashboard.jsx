import React, { useEffect, useState } from "react";
import api from "../../api/axios"; // ✅ same axios instance use karo

export default function ConsultantDashboard() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      const res = await api.get("/v1/consultant/dashboard");
      setDashboard(res.data);
    } catch (err) {
      console.error(err);
      setError("Failed to load consultant dashboard");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="p-6">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">{error}</div>;
  }

  const active = dashboard?.active_deployment;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Consultant Dashboard</h1>
      <p className="text-gray-600 mt-1">
        My assignment, timesheets & attendance
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {/* Assignment */}
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-500">Assignment</p>
          <p className="text-lg font-semibold">
            {active ? "Active" : "Not Assigned"}
          </p>
          {active && (
            <p className="text-sm text-gray-600 mt-1">
              {active.client_name} • {active.role}
            </p>
          )}
        </div>

        {/* Deployments */}
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-500">Total Deployments</p>
          <p className="text-lg font-semibold">{dashboard.total_deployments}</p>
        </div>

        {/* Payroll */}
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-500">Payroll Status</p>
          <p className="text-lg font-semibold">
            {dashboard.payroll_ready ? "Ready" : "Pending"}
          </p>
        </div>
      </div>
    </div>
  );
}
