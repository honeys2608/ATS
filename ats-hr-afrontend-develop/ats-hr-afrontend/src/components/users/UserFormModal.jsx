// src/components/users/UserFormModal.jsx
import React, { useEffect, useState } from 'react'

export default function UserFormModal({ open = false, initialData = null, roles = {}, onClose, onSubmit }) {
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    role: '' // no default — user must choose
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (initialData) {
      setForm({
        username: initialData.username || '',
        email: initialData.email || '',
        password: '', // never prefill password
        role: initialData.role || ''
      })
    } else {
      setForm({ username: '', email: '', password: '', role: '' })
    }
  }, [initialData, open])

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate required fields (backend requires these)
    if (!form.username || !form.email || !form.role) {
      alert('Please fill required fields: username, email and role.')
      return
    }

    setSaving(true)
    try {
      // Build payload exactly as backend expects
      const payload = {
        username: form.username,
        email: form.email,
        role: form.role
      }
      if (form.password) payload.password = form.password // include password only if provided

      // call parent handler; pass id when editing
      await onSubmit(payload, initialData?.id)
    } catch (err) {
      // let parent handle errors; show fallback
      console.error('User save error:', err)
      alert(err?.response?.data?.detail || 'Failed to save user')
    } finally {
      setSaving(false)
    }
  }

  // Build role list from backend summary, fallback to known list.
  const rawRoles = Object.keys(roles).length
    ? Object.keys(roles)
    : [
        'admin',
        'recruiter',
        'account_manager',
        'internal_hr',
        'consultant',
        'employee',
        'accounts',
        'consultant_support',
        'candidate',
        'vendor',
        'partner'
      ]

  // Hide vendor & partner in the UI
  const roleKeys = rawRoles.filter(r => r !== 'vendor' && r !== 'partner')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">{initialData ? 'Edit User' : 'Create User'}</h3>
          <button onClick={onClose} className="px-3 py-1 rounded bg-gray-100">Close</button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <div>
            <label className="text-sm block mb-1">Username *</label>
            <input
              className="w-full border p-2 rounded"
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm block mb-1">Email *</label>
            <input
              type="email"
              className="w-full border p-2 rounded"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm block mb-1">
              Password {initialData ? <span className="text-xs text-gray-500">(leave blank to keep)</span> : <span className="text-xs text-gray-500">*</span>}
            </label>
            <input
              type="password"
              className="w-full border p-2 rounded"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              {...(initialData ? {} : { required: true })}
            />
          </div>

          <div>
            <label className="text-sm block mb-1">Role *</label>
            <select
              required
              className="w-full border p-2 rounded"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="">-- Select Role --</option>
              {roleKeys.map((r) => (
                <option key={r} value={r}>
                  {roles[r]?.name || r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded">
              {saving ? 'Saving...' : initialData ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
