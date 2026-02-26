// src/components/consultants/DeploymentEligibility.jsx
import React, { useEffect, useState } from "react";
import {
  checkDeploymentEligibility,
  validateDeploymentEligibility,
} from "../../services/consultantService";

export default function DeploymentEligibility({
  consultantId,
  strict = false,      // strict=true → throws error if not eligible
  onEligible,          // callback when eligible
}) {
  const [loading, setLoading] = useState(true);
  const [eligible, setEligible] = useState(false);
  const [reasons, setReasons] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!consultantId) return;
    loadEligibility();
  }, [consultantId]);

  async function loadEligibility() {
    setLoading(true);
    setError("");
    try {
      const res = strict
        ? await validateDeploymentEligibility(consultantId)
        : await checkDeploymentEligibility(consultantId);

      const data = res.data || {};

      setEligible(Boolean(data.eligible));
      setReasons(data.reasons || []);
      if (data.eligible) onEligible?.();
    } catch (err) {
      console.error(err);

      const msg =
        err?.response?.data?.message ||
        "Consultant is not eligible for deployment";

      setEligible(false);
      setError(msg);

      if (err?.response?.data?.reasons) {
        setReasons(err.response.data.reasons);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border rounded-lg p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Deployment Eligibility</h2>
        <p className="text-sm text-gray-500">
          System validation before consultant deployment.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Checking eligibility...</div>
      ) : (
        <>
          {/* STATUS */}
          <div className="flex items-center gap-3">
            <StatusBadge
              value={eligible ? "Eligible" : "Not Eligible"}
              color={eligible ? "green" : "red"}
            />

            {!eligible && (
              <button
                onClick={loadEligibility}
                className="text-sm text-indigo-600 underline"
              >
                Recheck
              </button>
            )}
          </div>

          {/* REASONS */}
          {!eligible && (
            <div className="border border-red-300 bg-red-50 rounded p-4 text-sm">
              <p className="font-medium mb-2">
                Deployment blocked for the following reasons:
              </p>
              <ul className="list-disc ml-5 space-y-1">
                {reasons.length > 0 ? (
                  reasons.map((r, idx) => <li key={idx}>{r}</li>)
                ) : (
                  <li>{error}</li>
                )}
              </ul>
            </div>
          )}

          {/* SUCCESS */}
          {eligible && (
            <div className="border border-green-300 bg-green-50 rounded p-4 text-sm text-green-800">
              Consultant is fully eligible for deployment.
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* SMALL STATUS BADGE */
function StatusBadge({ value, color }) {
  const map = {
    green: "border-green-300 text-green-700",
    red: "border-red-300 text-red-700",
  };

  return (
    <span
      className={`px-3 py-1 border rounded-full text-xs font-medium ${
        map[color]
      }`}
    >
      {value}
    </span>
  );
}
