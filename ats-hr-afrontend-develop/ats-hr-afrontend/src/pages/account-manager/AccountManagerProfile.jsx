import React, { useEffect, useState } from "react";
import api from "../../api/axios";
import { normalizeText, validateFeatureName } from "../../utils/recruiterValidations";

const normalizeProfile = (data) => {
  if (!data) return null;
  return {
    ...data,
    full_name: data.full_name || data.name || "",
  };
};

export default function AccountManagerProfile() {
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({
    full_name: "",
    company_name: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/auth/me");
      const normalized = normalizeProfile(res.data || null);
      setProfile(normalized);
      setFormData({
        full_name: normalized?.full_name || "",
        company_name: normalized?.company_name || "",
      });
    } catch (err) {
      const stored = localStorage.getItem("user");
      if (stored) {
        const parsed = normalizeProfile(JSON.parse(stored));
        setProfile(parsed);
        setFormData({
          full_name: parsed?.full_name || "",
          company_name: parsed?.company_name || "",
        });
      } else {
        setError("Unable to load profile");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSave = async () => {
    const fullName = normalizeText(formData.full_name);
    const companyName = normalizeText(formData.company_name);
    const nameError = validateFeatureName(fullName, "Full name", {
      pattern: /^[A-Za-z][A-Za-z .'-]{1,79}$/,
      patternMessage:
        "Full name can only contain letters, spaces, apostrophes, periods, and hyphens.",
    });
    if (nameError) {
      setError(nameError);
      return;
    }
    if (companyName && companyName.length < 2) {
      setError("Company name must be at least 2 characters.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const res = await api.put("/auth/me", {
        full_name: fullName,
        company_name: companyName,
      });
      const updated = normalizeProfile(res.data);
      setProfile(updated);
      setEditing(false);

      localStorage.setItem("user", JSON.stringify(updated));
    } catch (err) {
      setError(
        err.response?.data?.detail || "Failed to save profile changes"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-500">Loading profile...</div>;
  }

  if (!profile) {
    return <div className="p-6 text-red-600">{error || "Profile not found"}</div>;
  }

  const initials = (profile.full_name || profile.username || "AM")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-purple-600 text-white flex items-center justify-center text-2xl font-bold">
              {initials}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {profile.full_name || profile.username || "Account Manager"}
              </h1>
              <p className="text-sm text-gray-500">{profile.email}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditing(!editing);
              setFormData({
                full_name: profile.full_name || "",
                company_name: profile.company_name || "",
              });
            }}
            className="px-4 py-2 text-sm font-semibold rounded-md border border-purple-200 text-purple-700 hover:bg-purple-50"
          >
            {editing ? "Cancel" : "Edit Profile"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Profile Details
          </h2>
          {editing && (
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-4 py-2 rounded-md text-sm font-semibold ${
                saving
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-purple-600 text-white hover:bg-purple-700"
              }`}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Full Name</p>
            {editing ? (
              <input
                className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-gray-900"
                value={formData.full_name}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    full_name: e.target.value,
                  }))
                }
                onBlur={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    full_name: normalizeText(e.target.value),
                  }))
                }
              />
            ) : (
              <p className="font-medium text-gray-900">
                {profile.full_name || "—"}
              </p>
            )}
          </div>
          <div>
            <p className="text-gray-500">Email</p>
            <p className="font-medium text-gray-900">{profile.email || "—"}</p>
          </div>
          <div>
            <p className="text-gray-500">Company</p>
            {editing ? (
              <input
                className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-gray-900"
                value={formData.company_name}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    company_name: e.target.value,
                  }))
                }
                onBlur={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    company_name: normalizeText(e.target.value),
                  }))
                }
              />
            ) : (
              <p className="font-medium text-gray-900">
                {profile.company_name || "—"}
              </p>
            )}
          </div>
          <div>
            <p className="text-gray-500">Role</p>
            <p className="font-medium text-gray-900">
              {profile.role || "account_manager"}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Status</p>
            <p className="font-medium text-gray-900">
              {profile.is_active === false ? "Inactive" : "Active"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
