import React, { useState, useEffect } from "react";

/**
 * OfferLetter
 * - Collects configurable offer details
 * - Candidate is already known
 * - Sends data upward (NO direct API call)
 */
export default function OfferLetter({
  candidate,
  onClose,
  setExternalForm,
  onSubmit,
}) {
  if (!candidate) {
    return (
      <div className="p-6 bg-white rounded shadow">No candidate selected</div>
    );
  }

  const [form, setForm] = useState({
    job_title: candidate.job_title || "",
    department: "",
    employment_type: "Full-time",
    start_date: "",
    compensation: "",
    currency: "INR",
    work_location: "",
    probation_period: "3 months",
    reporting_manager: "",
    acceptance_deadline: "",
  });

  /* Sync initial form to preview */
  useEffect(() => {
    setExternalForm?.(form);
  }, []);

  function updateField(e) {
    const updated = { ...form, [e.target.name]: e.target.value };
    setForm(updated);
    setExternalForm?.(updated); // 🔥 live preview sync
  }

  async function sendOffer() {
    if (!form.job_title || !form.start_date || !form.compensation) {
      alert("Please fill required fields");
      return;
    }

    await onSubmit({
      candidate_id: candidate.id || candidate._id,
      candidate_name: candidate.full_name,
      candidate_email: candidate.email,
      ...form,
    });
  }

  return (
    <div className="p-6 bg-white rounded shadow space-y-4 w-full max-w-lg">
      <h2 className="text-xl font-semibold">Send Offer Letter</h2>

      {/* Candidate (read-only) */}
      <input
        value={candidate.full_name}
        disabled
        className="w-full p-2 border rounded bg-gray-50"
      />
      <input
        value={candidate.email}
        disabled
        className="w-full p-2 border rounded bg-gray-50"
      />

      {/* Offer fields */}
      <input
        name="job_title"
        value={form.job_title}
        placeholder="Job Title *"
        onChange={updateField}
        className="w-full p-2 border rounded"
      />

      <input
        name="department"
        value={form.department}
        placeholder="Department"
        onChange={updateField}
        className="w-full p-2 border rounded"
      />

      <select
        name="employment_type"
        value={form.employment_type}
        onChange={updateField}
        className="w-full p-2 border rounded"
      >
        <option>Full-time</option>
        <option>Part-time</option>
        <option>Contract</option>
      </select>

      <input
        type="date"
        name="start_date"
        value={form.start_date}
        onChange={updateField}
        className="w-full p-2 border rounded"
      />

      <input
        name="compensation"
        value={form.compensation}
        placeholder="Compensation Amount *"
        onChange={updateField}
        className="w-full p-2 border rounded"
      />

      <select
        name="currency"
        value={form.currency}
        onChange={updateField}
        className="w-full p-2 border rounded"
      >
        <option>INR</option>
        <option>USD</option>
      </select>

      <input
        name="work_location"
        value={form.work_location}
        placeholder="Work Location"
        onChange={updateField}
        className="w-full p-2 border rounded"
      />

      <input
        name="probation_period"
        value={form.probation_period}
        placeholder="Probation Period"
        onChange={updateField}
        className="w-full p-2 border rounded"
      />

      <input
        name="reporting_manager"
        value={form.reporting_manager}
        placeholder="Reporting Manager"
        onChange={updateField}
        className="w-full p-2 border rounded"
      />

      <input
        type="date"
        name="acceptance_deadline"
        value={form.acceptance_deadline}
        onChange={updateField}
        className="w-full p-2 border rounded"
      />

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4">
        <button onClick={onClose} className="px-4 py-2 border rounded">
          Cancel
        </button>
        <button
          onClick={sendOffer}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          Send Offer
        </button>
      </div>
    </div>
  );
}
