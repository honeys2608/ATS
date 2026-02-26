import React, { useState } from "react";
import api from "../../api/axios";

export default function AssignConsultantModal({ data, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    billingType: "payroll",
    billingRate: "",
    payoutRate: "",
    startDate: "",
  });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit() {
    if (!form.billingRate || !form.startDate) {
      alert("Billing rate and start date are required");
      return;
    }

    if (!data.client_id && !data.clientId) {
      alert("Client not found for this consultant");
      return;
    }

    try {
      setLoading(true);

      // ✅ FORCE ISO DATE (VERY IMPORTANT)
      const startDateISO = new Date(form.startDate).toISOString();

      const payload = {
        // consultant already hai to id aayegi
        consultantId: data.consultant_id || null,

        // candidate case me backend convert karega
        applicationId: data.application_id || data.id,

        clientId: data.client_id || data.clientId,
        clientName: data.client_name || "Client",
        role: data.job_title || "Consultant",

        startDate: startDateISO,
        endDate: null,

        billingType: form.billingType,
        billingRate: Number(form.billingRate),
        payoutRate: form.payoutRate ? Number(form.payoutRate) : null,
      };

      await api.post("/v1/am/assign-consultant", payload);

      alert("Consultant assigned successfully");
      onSuccess();
    } catch (err) {
      console.error(err);
      alert("Failed to assign consultant");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-md rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold">
          {data.consultant_id
            ? "Assign Consultant"
            : "Convert & Assign Consultant"}
        </h3>

        {/* Consultant Info */}
        <div className="text-sm text-gray-700">
          <p>
            <b>Name:</b> {data.consultant_name || data.candidate_name || "—"}
          </p>
          <p>
            <b>Email:</b> {data.email}
          </p>
          <p>
            <b>Client:</b> {data.client_name}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium">Billing Type</label>
          <select
            name="billingType"
            value={form.billingType}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          >
            <option value="payroll">Payroll</option>
            <option value="sourcing">Sourcing</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Billing Rate</label>
          <input
            type="number"
            name="billingRate"
            value={form.billingRate}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Payout Rate</label>
          <input
            type="number"
            name="payoutRate"
            value={form.payoutRate}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Start Date</label>
          <input
            type="date"
            name="startDate"
            value={form.startDate}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button onClick={onClose} className="px-4 py-2 border rounded">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            {loading
              ? "Processing..."
              : data.consultant_id
              ? "Assign"
              : "Convert & Assign"}
          </button>
        </div>
      </div>
    </div>
  );
}
