// src/components/roles/RoleForm.jsx
import React, { useEffect, useState } from 'react';
import {
  normalizeText,
  validateDescription,
  validateFeatureName,
} from "../../utils/recruiterValidations";

/**
 * Simple inline role form component.
 * Props:
 *  - initial: { id, name, description } | null
 *  - onSubmit: async (payload, id?) => {}
 *  - onCancel: () => {}
 */
export default function RoleForm({ initial = null, onSubmit, onCancel }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setName(initial.name || '');
      setDescription(initial.description || '');
    } else {
      setName('');
      setDescription('');
    }
  }, [initial]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = normalizeText(name);
    const trimmedDescription = normalizeText(description);
    const nameError = validateFeatureName(trimmedName, "Role name", {
      pattern: /^[A-Za-z0-9_ ]+$/,
      patternMessage: "Role name can only contain letters, numbers, spaces, and underscores.",
    });
    if (nameError) return alert(nameError);
    const descriptionError = validateDescription(trimmedDescription, { minLength: 20 });
    if (descriptionError) return alert(descriptionError);
    setSaving(true);
    try {
      // call parent handler. For edit, parent may pass id as second arg.
      await onSubmit({ name: trimmedName, description: trimmedDescription }, initial?.id);
    } catch (err) {
      console.error('Role save error', err);
      alert(err?.response?.data?.detail || 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm mb-1">Role name *</label>
        <input
          className="w-full border rounded p-2"
          placeholder="e.g. Recruiter"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={(e) => setName(normalizeText(e.target.value))}
          required
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Description</label>
        <input
          className="w-full border rounded p-2"
          placeholder="Short description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={(e) => setDescription(normalizeText(e.target.value))}
        />
      </div>

      <div className="flex items-center gap-2">
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">
          {saving ? 'Saving...' : (initial ? 'Save' : 'Create')}
        </button>

        {onCancel && (
          <button type="button" onClick={onCancel} className="px-3 py-2 border rounded">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
