// src/components/roles/RoleFormModal.jsx
import React, { useEffect, useState } from 'react';
import {
  normalizeText,
  validateDescription,
  validateFeatureName,
} from "../../utils/recruiterValidations";

/**
 * Modal version of RoleForm to match your UserFormModal pattern.
 * Props:
 *  - open: boolean
 *  - initial: { id, name, description } | null
 *  - onClose: () => void
 *  - onSubmit: async (payload, id?) => {}
 */
export default function RoleFormModal({ open = false, initial = null, onClose, onSubmit }) {
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) setForm({ name: initial.name || '', description: initial.description || '' });
    else setForm({ name: '', description: '' });
  }, [initial, open]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = normalizeText(form.name);
    const trimmedDescription = normalizeText(form.description);
    const nameError = validateFeatureName(trimmedName, "Role name", {
      pattern: /^[A-Za-z0-9_ ]+$/,
      patternMessage: "Role name can only contain letters, numbers, spaces, and underscores.",
    });
    if (nameError) return alert(nameError);
    const descriptionError = validateDescription(trimmedDescription, { minLength: 20 });
    if (descriptionError) return alert(descriptionError);
    setSaving(true);
    try {
      await onSubmit({ name: trimmedName, description: trimmedDescription }, initial?.id);
      onClose();
    } catch (err) {
      console.error('Save role failed', err);
      alert(err?.response?.data?.detail || 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{initial ? 'Edit Role' : 'Create Role'}</h3>
          <button onClick={onClose} className="px-2 py-1 rounded bg-gray-100">Close</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Role name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              onBlur={(e) => setForm(f => ({ ...f, name: normalizeText(e.target.value) }))}
              className="w-full border p-2 rounded"
              placeholder="Recruiter"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              onBlur={(e) => setForm(f => ({ ...f, description: normalizeText(e.target.value) }))}
              className="w-full border p-2 rounded"
              placeholder="Optional description"
            />
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 border rounded">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded">
              {saving ? 'Saving...' : (initial ? 'Save' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
