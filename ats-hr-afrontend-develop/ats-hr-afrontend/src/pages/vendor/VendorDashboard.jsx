import React, { useEffect, useState } from "react";
import { getVendorDashboard } from "../../services/vendorService";

/**
 * VendorDashboard
 * - Read-only intelligence dashboard
 * - ATS-specific KPIs (no charts in Phase-1)
 * - Clean executive-style UI
 */
export default function VendorDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      const res = await getVendorDashboard();
      setData(res);
    } catch (err) {
      console.error(err);
      setError("Unable to load dashboard data");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="text-sm text-gray-500">Loading vendor dashboard…</div>
    );
  }

  if (error) {
    return <div className="text-sm text-red-600">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-800">
          Vendor Dashboard
        </h1>
        <p className="text-sm text-gray-500">
          Overview of your candidate supply, deployments, and payouts
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Candidates Supplied"
          value={data.total_candidates}
          sub="Total profiles submitted"
        />

        <StatCard
          title="Active Deployments"
          value={data.active_deployments}
          sub="Currently working"
          highlight
        />

        <StatCard
          title="Pending Timesheets"
          value={data.pending_timesheets}
          sub="Awaiting approval"
          warning={data.pending_timesheets > 0}
        />

        <StatCard
          title="Expected Payout"
          value={`₹${formatAmount(data.expected_payout)}`}
          sub="Based on approved work"
          success
        />
      </div>

      {/* Operational Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Supply Pipeline */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Supply Pipeline Snapshot
          </h3>

          <PipelineRow
            label="New / Screening"
            value={data.pipeline?.new || 0}
          />
          <PipelineRow
            label="Shortlisted"
            value={data.pipeline?.shortlisted || 0}
          />
          <PipelineRow
            label="Interviewing"
            value={data.pipeline?.interview || 0}
          />
          <PipelineRow label="Selected" value={data.pipeline?.selected || 0} />
        </div>

        {/* Compliance Health */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Compliance Status
          </h3>

          <ComplianceRow
            label="GST / Agreement"
            status={data.compliance?.gst}
          />
          <ComplianceRow
            label="Insurance"
            status={data.compliance?.insurance}
          />
          <ComplianceRow label="Tax Documents" status={data.compliance?.tax} />

          <p className="text-xs text-gray-400 mt-3">
            ⚠ Payouts may be held if documents expire or are rejected.
          </p>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Helper Components
   ========================= */

function StatCard({ title, value, sub, highlight, warning, success }) {
  let color = "text-gray-800";
  if (highlight) color = "text-indigo-600";
  if (warning) color = "text-yellow-600";
  if (success) color = "text-green-600";

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-xs text-gray-500">{title}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
      <p className="text-xs text-gray-400">{sub}</p>
    </div>
  );
}

function PipelineRow({ label, value }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}

function ComplianceRow({ label, status }) {
  const color =
    status === "approved"
      ? "text-green-600"
      : status === "rejected"
      ? "text-red-600"
      : "text-yellow-600";

  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-gray-600">{label}</span>
      <span className={`font-medium ${color}`}>{status || "pending"}</span>
    </div>
  );
}

function formatAmount(amount = 0) {
  return Number(amount).toLocaleString("en-IN");
}
