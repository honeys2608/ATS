// src/components/consultants/SourcingConfigForm.jsx
import React, { useEffect, useState } from "react";
import { setSourcingConfig } from "../../services/consultantService";

export default function SourcingConfigForm({
  consultant,
  onUpdated,
}) {
  const [feeType, setFeeType] = useState("percentage");
  const [feeAmount, setFeeAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // preload existing config if present
    if (consultant?.sourcing_fee_type) {
      setFeeType(consultant.sourcing_fee_type);
    }
    if (consultant?.sourcing_fee_amount) {
      setFeeAmount(consultant.sourcing_fee_amount);
    }
  }, [consultant]);

  function validate() {
    if (!feeAmount) return "Fee amount is required";

    const amount = Number(feeAmount);
    if (amount <= 0) return "Fee amount must be greater than zero";

    if (feeType === "percentage" && amount > 100) {
      return "Percentage fee cannot exceed 100%";
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
      await setSourcingConfig(consultant.id, {
        fee_type: feeType,
        fee_amount: Number(feeAmount),
      });

      onUpdated?.();
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
          "Failed to save sourcing configuration"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border rounded-lg p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Sourcing Configuration</h2>
        <p className="text-sm text-gray-500">
          Configure referral or sourcing fee for this consultant.
        </p>
      </div>

      {/* FEE TYPE */}
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="feeType"
            value="percentage"
            checked={feeType === "percentage"}
            onChange={() => setFeeType("percentage")}
          />
          <span className="text-sm">Percentage (%)</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="feeType"
            value="flat"
            checked={feeType === "flat"}
            onChange={() => setFeeType("flat")}
          />
          <span className="text-sm">Flat Amount</span>
        </label>
      </div>

      {/* FEE AMOUNT */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Fee Amount {feeType === "percentage" ? "(%)" : ""}
        </label>
        <input
          type="number"
          value={feeAmount}
          onChange={(e) => setFeeAmount(e.target.value)}
          className="w-full border rounded px-3 py-2"
          placeholder={
            feeType === "percentage" ? "e.g. 10" : "e.g. 50000"
          }
        />
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
          className={`px-4 py-2 text-white rounded ${
            saving
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {saving ? "Saving..." : "Save Sourcing Config"}
        </button>
      </div>
    </div>
  );
}
