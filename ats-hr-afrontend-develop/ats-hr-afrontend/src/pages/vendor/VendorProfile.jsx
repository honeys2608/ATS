import React, { useEffect, useState } from "react";
import {
  getVendorProfile,
  updateVendorProfile,
} from "../../services/vendorService";

/**
 * VendorProfile
 * - View vendor company profile
 * - Edit only contact-level information
 * - Legal / commercial fields are read-only
 */
export default function VendorProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);
      const res = await getVendorProfile();
      setProfile(res);
    } catch (err) {
      console.error(err);
      setError("Failed to load vendor profile");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        company_name: profile.company_name, // ⭐ important
        primary_contact_name: profile.primary_contact_name,
        primary_contact_email: profile.primary_contact_email,
        primary_contact_phone: profile.primary_contact_phone,
      };

      await updateVendorProfile(payload);
      setSuccess("Profile updated successfully");
    } catch (err) {
      console.error(err);
      setError("Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading profile…</p>;
  }

  if (!profile) {
    return <p className="text-sm text-red-600">Unable to load profile</p>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-800">Vendor Profile</h1>
        <p className="text-sm text-gray-500">Company and contact information</p>
      </div>

      {/* Company Details (Read-only) */}
      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Company Details</h2>

        <EditableField
          label="Company Name"
          name="company_name"
          value={profile.company_name}
          onChange={handleChange}
        />

        <ReadOnlyField label="GST Number" value={profile.gst_number} />

        <ReadOnlyField label="Payment Terms" value={profile.payment_terms} />
      </div>

      {/* Contact Details (Editable) */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Primary Contact</h2>

        <EditableField
          label="Contact Name"
          name="primary_contact_name"
          value={profile.primary_contact_name}
          onChange={handleChange}
        />

        <EditableField
          label="Contact Email"
          name="primary_contact_email"
          value={profile.primary_contact_email}
          onChange={handleChange}
        />

        <EditableField
          label="Contact Phone"
          name="primary_contact_phone"
          value={profile.primary_contact_phone}
          onChange={handleChange}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

/* =========================
   Helper Components
   ========================= */

function ReadOnlyField({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value || "—"}</p>
    </div>
  );
}

function EditableField({ label, name, value, onChange }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <input
        name={name}
        value={value || ""}
        onChange={onChange}
        className="border rounded px-3 py-2 text-sm w-full"
      />
    </div>
  );
}
