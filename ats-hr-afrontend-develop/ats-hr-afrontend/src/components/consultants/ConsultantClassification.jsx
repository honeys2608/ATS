// src/components/consultants/ConsultantClassification.jsx
import React, { useState } from "react";
import { classifyConsultant } from "../../services/consultantService";

export default function ConsultantClassification({
  consultant,
  onUpdated,
}) {
  const [type, setType] = useState(consultant.type);
  const [saving, setSaving] = useState(false);

  const isChanged = type !== consultant.type;

  async function handleSave() {
    if (!isChanged) return;

    const confirm = window.confirm(
      "Changing consultant type will reset payroll configuration. Continue?"
    );
    if (!confirm) {
      setType(consultant.type);
      return;
    }

    try {
      setSaving(true);
      await classifyConsultant(consultant.id, { type });
      onUpdated?.();
    } catch (err) {
      console.error(err);
      alert("Failed to update consultant classification");
      setType(consultant.type);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border rounded-lg p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Consultant Classification</h2>
        <p className="text-sm text-gray-500">
          Defines how this consultant is billed and managed.
        </p>
      </div>

      {/* CURRENT STATUS */}
      <div className="flex gap-4 text-sm">
        <StatusBadge
          label="Current Type"
          value={consultant.type}
          color="indigo"
        />
        <StatusBadge
          label="Payroll Ready"
          value={consultant.payrollReady ? "Yes" : "No"}
          color={consultant.payrollReady ? "green" : "red"}
        />
      </div>

      {/* TYPE SELECTOR */}
      <div className="mt-4 space-y-3">
        <label className="flex items-start gap-3 border rounded p-4 cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="type"
            value="sourcing"
            checked={type === "sourcing"}
            onChange={() => setType("sourcing")}
            className="mt-1"
          />
          <div>
            <p className="font-medium">Sourcing Consultant</p>
            <p className="text-sm text-gray-500">
              Used for referral / sourcing-based engagements. Paid via fee.
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3 border rounded p-4 cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="type"
            value="payroll"
            checked={type === "payroll"}
            onChange={() => setType("payroll")}
            className="mt-1"
          />
          <div>
            <p className="font-medium">Payroll Consultant</p>
            <p className="text-sm text-gray-500">
              Deployed to client, billable, payroll-managed resource.
            </p>
          </div>
        </label>
      </div>

      {/* WARNING */}
      {isChanged && (
        <div className="mt-4 p-3 border border-yellow-300 bg-yellow-50 rounded text-sm">
          ⚠ Changing consultant type will reset payroll configuration and
          require re-setup.
        </div>
      )}

      {/* ACTION */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={!isChanged || saving}
          className={`px-4 py-2 rounded text-white ${
            !isChanged || saving
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {saving ? "Saving..." : "Save Classification"}
        </button>
      </div>
    </div>
  );
}

/* SMALL BADGE */
function StatusBadge({ label, value, color }) {
  const colorMap = {
    indigo: "border-indigo-200 text-indigo-700",
    green: "border-green-200 text-green-700",
    red: "border-red-200 text-red-700",
  };

  return (
    <span
      className={`px-3 py-1 border rounded-full text-xs ${
        colorMap[color] || ""
      }`}
    >
      {label}: <b className="capitalize">{value}</b>
    </span>
  );
}
