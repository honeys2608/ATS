import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import {
  getConsultant,
  getConsultantSummary,
} from "../services/consultantService";
import { listDeployments } from "../services/consultantDeploymentService";

import ConsultantInfoCard from
  "../components/consultants/ConsultantInfoCard";
import PayrollConfigForm from
  "../components/consultants/PayrollConfigForm";
import SourcingConfigForm from
  "../components/consultants/SourcingConfigForm";
import DeploymentEligibility from
  "../components/consultants/DeploymentEligibility";
import DeploymentList from
  "../components/consultants/DeploymentList";

export default function ConsultantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [consultant, setConsultant] = useState(null);
  const [summary, setSummary] = useState(null);
  const [deployments, setDeployments] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);

      const [cRes, sRes, dRes] = await Promise.all([
        getConsultant(id),
        getConsultantSummary(id),
        listDeployments({ consultant_id: id }),
      ]);

      setConsultant(cRes.data);
      setSummary(sRes.data);

      const depData = dRes.data?.data ?? dRes.data ?? [];
      setDeployments(
        depData.sort(
          (a, b) => new Date(b.start_date) - new Date(a.start_date)
        )
      );
    } catch (err) {
      console.error("Failed to load consultant", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="p-6">Loading consultant…</div>;
  }

  if (!consultant) {
    return <div className="p-6 text-red-600">Consultant not found</div>;
  }

  return (
    <div className="max-w-7xl space-y-6">
      {/* CONSULTANT HEADER */}
      <ConsultantInfoCard consultant={consultant} />

      {/* TABS */}
      <div className="flex gap-6 border-b">
        {["overview", "configuration", "deployments"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 capitalize border-b-2 ${
              activeTab === tab
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-3 gap-6">
          <Stat
            label="Total Deployments"
            value={summary?.totalDeployments}
          />
          <Stat
            label="Active Deployment"
            value={summary?.activeDeployment ? "Yes" : "No"}
          />
          <Stat
            label="Current Client"
            value={summary?.activeDeployment?.client || "—"}
          />
        </div>
      )}

      {/* CONFIGURATION TAB */}
      {activeTab === "configuration" && (
        <div className="space-y-6">
          {/* PAYROLL CONSULTANT */}
          {consultant.type === "payroll" && (
            <>
              <PayrollConfigForm
                consultant={consultant}
                onUpdated={loadData}
              />

              <DeploymentEligibility
                consultantId={consultant.id}
              />
            </>
          )}

          {/* SOURCING CONSULTANT */}
          {consultant.type === "sourcing" && (
            <SourcingConfigForm
              consultant={consultant}
              onUpdated={loadData}
            />
          )}
        </div>
      )}

      {/* DEPLOYMENTS TAB */}
      {activeTab === "deployments" && (
        <DeploymentList
          deployments={deployments}
          onRowClick={(d) =>
            navigate(`/consultant-deployments/${d.id}`)
          }
        />
      )}
    </div>
  );
}

/* SMALL STAT CARD */
function Stat({ label, value }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-xl font-bold mt-1">
        {value ?? "—"}
      </p>
    </div>
  );
}
