// src/pages/ConsultantDeploymentDetail.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getDeployment,
  endDeployment,
} from "../services/consultantDeploymentService";

export default function ConsultantDeploymentDetail() {
  const { id } = useParams(); // deployment id
  const navigate = useNavigate();

  const [deployment, setDeployment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDeployment();
  }, [id]);

  async function loadDeployment() {
    try {
      setLoading(true);
      const res = await getDeployment(id);
      const data = res.data?.data || res.data;
      setDeployment(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load deployment");
    } finally {
      setLoading(false);
    }
  }

  async function handleEndDeployment() {
    if (!deployment) return;

    const confirm = window.confirm(
      "Are you sure you want to end this deployment?"
    );
    if (!confirm) return;

    setEnding(true);
    try {
      await endDeployment(deployment.id);

      alert("Deployment ended successfully");

      // reload to reflect ended status
      await loadDeployment();
    } catch (err) {
      console.error(err);
      alert(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to end deployment"
      );
    } finally {
      setEnding(false);
    }
  }

  if (loading) return <div>Loading deployment...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!deployment) return <div>Deployment not found</div>;

  const isActive = deployment.status === "active";

  return (
    <div className="max-w-5xl space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Deployment Details
          </h1>
          <p className="text-sm text-gray-500">
            Deployment ID: {deployment.id}
          </p>
        </div>

        <button
          onClick={() => navigate(-1)}
          className="px-3 py-1 border rounded text-sm"
        >
          Back
        </button>
      </div>

      {/* STATUS CARD */}
      <div className="bg-white border rounded-lg p-6 flex items-center justify-between">
        <div className="flex gap-4">
          <StatusBadge
            value={deployment.status}
            color={isActive ? "green" : "gray"}
          />
          <span className="text-sm text-gray-600">
            Started on{" "}
            <b>{deployment.start_date}</b>
          </span>
          {deployment.end_date && (
            <span className="text-sm text-gray-600">
              Ended on <b>{deployment.end_date}</b>
            </span>
          )}
        </div>

        {isActive && (
          <button
            onClick={handleEndDeployment}
            disabled={ending}
            className={`px-4 py-2 rounded text-white ${
              ending
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {ending ? "Ending..." : "End Deployment"}
          </button>
        )}
      </div>

      {/* DETAILS */}
      <div className="bg-white border rounded-lg p-6 grid grid-cols-2 gap-6">
        <Detail label="Consultant ID" value={deployment.consultant_id} />
        <Detail label="Client" value={deployment.client} />
        <Detail label="Project" value={deployment.project || "—"} />
        <Detail label="Notes" value={deployment.notes || "—"} />
        <Detail label="Start Date" value={deployment.start_date} />
        <Detail label="End Date" value={deployment.end_date || "—"} />
      </div>
    </div>
  );
}

/* SMALL COMPONENTS */

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function StatusBadge({ value, color }) {
  const map = {
    green: "border-green-300 text-green-700",
    gray: "border-gray-300 text-gray-600",
  };

  return (
    <span
      className={`px-3 py-1 border rounded-full text-xs font-medium capitalize ${map[color]}`}
    >
      {value}
    </span>
  );
}
