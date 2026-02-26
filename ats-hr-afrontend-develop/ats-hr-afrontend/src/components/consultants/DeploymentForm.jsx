// src/components/consultants/DeploymentForm.jsx
import React, { useState } from "react";

export default function DeploymentForm({
  onSubmit,
  submitting = false,
  disabled = false,
}) {
  const [form, setForm] = useState({
    client_name: "",
    client_id: "",
    project: "",
    start_date: "",
    end_date: "",
    notes: "",
  });

  const [error, setError] = useState("");

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();

    if (!form.client_name || !form.start_date) {
      setError("Client name and start date are required.");
      return;
    }

    setError("");
    onSubmit?.({
      client: form.client_name,
      client_id: form.client_id || undefined,
      project: form.project || undefined,
      start_date: form.start_date,
      end_date: form.end_date || null,
      notes: form.notes || undefined,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`bg-white border rounded-lg p-6 space-y-4 ${
        disabled ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      <h2 className="text-lg font-semibold">Deployment Details</h2>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-1">
            Client Name *
          </label>
          <input
            value={form.client_name}
            onChange={(e) =>
              updateField("client_name", e.target.value)
            }
            className="w-full border rounded px-3 py-2"
            placeholder="Client / Company name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Project / Assignment
          </label>
          <input
            value={form.project}
            onChange={(e) => updateField("project", e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="Project name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Start Date *
          </label>
          <input
            type="date"
            value={form.start_date}
            onChange={(e) =>
              updateField("start_date", e.target.value)
            }
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            End Date (optional)
          </label>
          <input
            type="date"
            value={form.end_date}
            onChange={(e) =>
              updateField("end_date", e.target.value)
            }
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Notes (optional)
        </label>
        <textarea
          value={form.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          className="w-full border rounded px-3 py-2"
          rows={3}
          placeholder="Additional deployment notes"
        />
      </div>

      {error && (
        <div className="border border-red-300 bg-red-50 rounded p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={submitting}
          className={`px-4 py-2 rounded text-white ${
            submitting
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {submitting ? "Deploying..." : "Deploy Consultant"}
        </button>
      </div>
    </form>
  );
}
