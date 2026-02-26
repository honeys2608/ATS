import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

import ConsultantInfoCard from "../components/consultants/ConsultantInfoCard";
import DeploymentEligibility from "../components/consultants/DeploymentEligibility";
import DeploymentForm from "../components/consultants/DeploymentForm";

import { getConsultant } from "../services/consultantService";
import { deployConsultant } from "../services/consultantDeploymentService";

export default function ConsultantDeploy() {
  const { id } = useParams(); // consultant id
  const navigate = useNavigate();

  const [consultant, setConsultant] = useState(null);
  const [eligible, setEligible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadConsultant();
  }, [id]);

  async function loadConsultant() {
    try {
      const res = await getConsultant(id);
      setConsultant(res.data);
    } catch (err) {
      console.error("Failed to load consultant", err);
    }
  }

  async function handleDeploy(form) {
    if (!eligible) return;

    setSaving(true);
    setError("");

    try {
      const res = await deployConsultant({
        consultant_id: id,
        client_id: form.client_id || undefined,
        client: form.client_name,
        project: form.project,
        start_date: form.start_date,
        end_date: form.end_date || null,
        notes: form.notes,
      });

      const deployment = res.data?.data || res.data;

      if (!deployment?.id) {
        throw new Error("Invalid deployment response");
      }

      alert("Consultant deployed successfully");
      navigate(`/consultant-deployments/${deployment.id}`);
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to deploy consultant"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Deploy Consultant</h1>
        <button
          onClick={() => navigate(-1)}
          className="text-sm px-3 py-1 border rounded"
        >
          Back
        </button>
      </div>

      {/* CONSULTANT INFO */}
      {consultant && (
        <ConsultantInfoCard consultant={consultant} showActions={false} />
      )}

      {/* ELIGIBILITY */}
      <DeploymentEligibility
        consultantId={id}
        strict={true}
        onEligible={() => setEligible(true)}
      />

      {/* FORM */}
      <DeploymentForm
        disabled={!eligible}
        submitting={saving}
        onSubmit={handleDeploy}
      />

      {/* ERROR */}
      {error && (
        <div className="border border-red-300 bg-red-50 rounded p-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
