// src/components/employees/ConvertFromCandidateModal.jsx
import React from "react";

export default function ConvertFromCandidateModal({ open, onClose, payload, setPayload, onSubmit, submitting }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg max-w-lg w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Convert to Employee</h3>
          <button onClick={onClose} className="text-gray-600">✕</button>
        </div>

        <div className="space-y-3">
          <label className="block text-sm">Employee Code (optional)</label>
          <input value={payload.employee_code || ""} onChange={(e)=>setPayload(p=>({...p, employee_code:e.target.value}))} className="w-full p-2 border rounded" />
          <label className="block text-sm">Department</label>
          <input value={payload.department || ""} onChange={(e)=>setPayload(p=>({...p, department:e.target.value}))} className="w-full p-2 border rounded" />
          <label className="block text-sm">Designation</label>
          <input value={payload.designation || ""} onChange={(e)=>setPayload(p=>({...p, designation:e.target.value}))} className="w-full p-2 border rounded" />
          <label className="block text-sm">Join Date</label>
          <input type="date" value={payload.join_date || ""} onChange={(e)=>setPayload(p=>({...p, join_date:e.target.value}))} className="w-full p-2 border rounded" />

          <div className="flex justify-end gap-2 mt-3">
            <button onClick={onClose} className="px-3 py-1 border rounded">Cancel</button>
            <button onClick={onSubmit} disabled={submitting} className="px-3 py-1 bg-green-600 text-white rounded">
              {submitting ? "Processing..." : "Convert"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
