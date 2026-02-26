import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import clientService from "../../services/clientService";

/**
 * ClientDashboard
 * - Client executive dashboard
 * - Read-only KPIs with interactive navigation
 * - Market-level design with modern colors
 */
export default function ClientDashboard() {
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      const res = await clientService.getDashboard();
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
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
        <span className="text-lg">⚠️</span>
        <div>
          <p className="font-semibold text-red-900">Error</p>
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ================= PAGE HEADER ================= */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Client Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Overview of requirements, candidates, deployments & billing
        </p>
      </div>

      {/* ================= KPI CARDS ================= */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Active Requirements"
          value={data?.requirements || 0}
          sub="Open hiring needs"
          icon="📋"
          color="indigo"
          onClick={() => navigate("/client/requirements")}
        />

        <StatCard
          title="Candidates Received"
          value={data?.candidates_received || 0}
          sub="Total submissions"
          icon="👥"
          color="blue"
        />

        <StatCard
          title="Active Deployments"
          value={data?.active_deployments || 0}
          sub="Currently working"
          icon="✓"
          color="green"
          onClick={() => navigate("/client/deployments")}
        />

        <StatCard
          title="Pending Invoices"
          value={data?.pending_invoices || 0}
          sub="Awaiting payment"
          icon="💰"
          color={data?.pending_invoices > 0 ? "yellow" : "gray"}
          onClick={() => navigate("/client/invoices")}
        />
      </div>

      {/* ================= OPERATIONAL METRICS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* -------- HIRING PIPELINE -------- */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            📊 Hiring Pipeline
          </h3>

          <div className="space-y-4">
            <PipelineRow
              label="New Submissions"
              value={data?.pipeline?.new || 0}
              color="blue"
            />
            <PipelineRow
              label="Shortlisted"
              value={data?.pipeline?.shortlisted || 0}
              color="indigo"
            />
            <PipelineRow
              label="Interviewing"
              value={data?.pipeline?.interview || 0}
              color="amber"
            />
            <PipelineRow
              label="Selected"
              value={data?.pipeline?.selected || 0}
              color="green"
            />
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Total candidates in pipeline:{" "}
              <span className="font-bold text-gray-900">
                {(data?.pipeline?.new || 0) +
                  (data?.pipeline?.shortlisted || 0) +
                  (data?.pipeline?.interview || 0) +
                  (data?.pipeline?.selected || 0)}
              </span>
            </p>
          </div>
        </div>

        {/* -------- SLA & COMPLIANCE -------- */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            ⏱️ SLA Status
          </h3>

          <div className="space-y-4">
            <ComplianceRow
              label="Submission SLA"
              status={data?.sla?.submission}
            />
            <ComplianceRow
              label="Interview SLA"
              status={data?.sla?.interview}
            />
            <ComplianceRow
              label="Deployment SLA"
              status={data?.sla?.deployment}
            />
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2">
              <p className="text-xs text-amber-800">
                <span className="font-semibold">⚠️ Note:</span> Delays may
                impact delivery timelines. Contact your recruiter for updates.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Reusable UI Components
   ========================= */

const colorMap = {
  indigo: {
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-700",
    icon: "bg-indigo-100",
  },
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    icon: "bg-blue-100",
  },
  green: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
    icon: "bg-green-100",
  },
  yellow: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-700",
    icon: "bg-yellow-100",
  },
  gray: {
    bg: "bg-gray-50",
    border: "border-gray-200",
    text: "text-gray-700",
    icon: "bg-gray-100",
  },
};

function StatCard({ title, value, sub, icon, color = "gray", onClick }) {
  const colors = colorMap[color] || colorMap.gray;

  return (
    <div
      onClick={onClick}
      className={`bg-white border rounded-lg shadow-sm p-5 transition-all ${
        onClick ? "cursor-pointer hover:shadow-md hover:border-gray-300" : ""
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          {title}
        </p>
        <span className={`text-2xl ${colors.icon} p-2 rounded-lg`}>{icon}</span>
      </div>

      <p className={`text-3xl font-bold ${colors.text} mb-1`}>{value}</p>
      <p className="text-xs text-gray-500">{sub}</p>
    </div>
  );
}

function PipelineRow({ label, value, color = "gray" }) {
  const colors = colorMap[color] || colorMap.gray;
  const maxValue = 50; // Scale for visualization
  const percentage = Math.min((value / maxValue) * 100, 100);

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className={`font-bold text-lg ${colors.text}`}>{value}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${colors.bg.replace("bg-", "bg-")}`}
          style={{
            width: `${percentage}%`,
            backgroundColor:
              color === "blue"
                ? "#3b82f6"
                : color === "indigo"
                  ? "#6366f1"
                  : color === "amber"
                    ? "#f59e0b"
                    : color === "green"
                      ? "#10b981"
                      : "#6b7280",
          }}
        />
      </div>
    </div>
  );
}

function ComplianceRow({ label, status }) {
  const statusConfig = {
    on_time: {
      label: "✓ On Time",
      color: "text-green-700",
      bg: "bg-green-50",
      border: "border-green-200",
    },
    delayed: {
      label: "✕ Delayed",
      color: "text-red-700",
      bg: "bg-red-50",
      border: "border-red-200",
    },
    at_risk: {
      label: "⚠ At Risk",
      color: "text-amber-700",
      bg: "bg-amber-50",
      border: "border-amber-200",
    },
  };

  const config = statusConfig[status] || {
    label: "Pending",
    color: "text-gray-700",
    bg: "bg-gray-50",
    border: "border-gray-200",
  };

  return (
    <div className={`rounded-lg border p-3 ${config.bg} ${config.border}`}>
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-800">{label}</span>
        <span className={`text-sm font-bold ${config.color}`}>
          {config.label}
        </span>
      </div>
    </div>
  );
}
