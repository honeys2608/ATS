// src/components/consultants/PayrollConfigForm.jsx
import React, { useEffect, useState } from "react";
import { setPayrollSetup } from "../../services/consultantService";

export default function PayrollConfigForm({ consultant, onUpdated }) {
  const [billingRate, setBillingRate] = useState("");
  const [payoutRate, setPayoutRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (consultant?.billing_rate) {
      setBillingRate(consultant.billing_rate);
    }
    if (consultant?.payout_rate) {
      setPayoutRate(consultant.payout_rate);
    }
  }, [consultant]);

  function validate() {
    if (!billingRate || !payoutRate) {
      return "Billing rate and payout rate are required";
    }

    const bill = Number(billingRate);
    const pay = Number(payoutRate);

    if (bill <= 0 || pay <= 0) {
      return "Rates must be positive values";
    }

    if (pay > bill) {
      return "Payout rate cannot exceed billing rate";
    }

    return "";
  }

  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");

    try {
      await setPayrollSetup(consultant.id, {
        billing_rate: Number(billingRate),
        payout_rate: Number(payoutRate),
      });

      onUpdated?.();
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
          "Failed to save payroll configuration"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border rounded-lg p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Payroll Configuration</h2>
        <p className="text-sm text-gray-500">
          Configure billing and payout rates for this consultant.
        </p>
      </div>

      {/* STATUS */}
      <div className="flex gap-3 text-sm">
        <StatusBadge
          label="Payroll Ready"
          value={consultant.payrollReady ? "Yes" : "No"}
          color={consultant.payrollReady ? "green" : "red"}
        />
      </div>

      {/* FORM */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-1">
            Billing Rate (per month)
          </label>
          <input
            type="number"
            value={billingRate}
            onChange={(e) => setBillingRate(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="e.g. 100000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Payout Rate (per month)
          </label>
          <input
            type="number"
            value={payoutRate}
            onChange={(e) => setPayoutRate(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="e.g. 70000"
          />
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="border border-red-300 bg-red-50 rounded p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ACTION */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-4 py-2 rounded text-white ${
            saving
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {saving ? "Saving..." : "Save Payroll Config"}
        </button>
      </div>
    </div>
  );
}

/* STATUS BADGE */
function StatusBadge({ label, value, color }) {
  const map = {
    green: "border-green-200 text-green-700",
    red: "border-red-200 text-red-700",
  };

  return (
    <span
      className={`px-3 py-1 border rounded-full text-xs ${map[color]}`}
    >
      {label}: <b>{value}</b>
    </span>
  );
}
