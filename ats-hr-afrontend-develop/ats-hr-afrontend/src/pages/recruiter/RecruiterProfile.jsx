import React, { useState, useEffect } from "react";
import {
  getRecruiterProfile,
  updateRecruiterProfile,
  validateFullName,
  validatePhone,
} from "../../services/recruiterService";
import RecruiterSettingsSection from "./RecruiterSettingsSection";

export default function RecruiterProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ full_name: "", phone: "" });
  const [editErrors, setEditErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Fetch profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getRecruiterProfile();
        setProfile(data);
        setEditData({
          full_name: data.full_name || "",
          phone: data.phone || "",
        });
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  // Handle edit mode
  const handleEditClick = () => {
    setIsEditing(true);
    setEditErrors({});
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({
      full_name: profile?.full_name || "",
      phone: profile?.phone || "",
    });
    setEditErrors({});
  };

  // Validate and save profile
  const handleSave = async () => {
    // Validate
    const errors = {};
    const fullNameErr = validateFullName(editData.full_name);
    if (fullNameErr) errors.full_name = fullNameErr;

    const phoneErr = validatePhone(editData.phone);
    if (phoneErr) errors.phone = phoneErr;

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    try {
      setSaving(true);
      const updated = await updateRecruiterProfile(editData);
      setProfile(updated);
      setIsEditing(false);
      setEditErrors({});
    } catch (err) {
      setEditErrors({
        submit: err.response?.data?.detail || "Failed to update profile",
      });
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="text-gray-600 mt-4">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !profile) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  // Display profile
  const displayUser = profile;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-2xl font-bold text-indigo-600">
                {displayUser.full_name
                  ? displayUser.full_name.charAt(0).toUpperCase()
                  : "R"}
              </div>
              <div className="ml-6 text-white">
                <h1 className="text-2xl font-bold">
                  {displayUser.full_name || "Recruiter"}
                </h1>
                <p className="text-indigo-100">{displayUser.email}</p>
                <p className="text-indigo-200 text-sm">
                  Role: {displayUser.role || "Recruiter"}
                </p>
              </div>
            </div>
            {!isEditing && (
              <button
                onClick={handleEditClick}
                className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-medium hover:bg-indigo-50"
              >
                Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-8">
          {/* Error message */}
          {editErrors.submit && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700">{editErrors.submit}</p>
            </div>
          )}

          {isEditing ? (
            // Edit Form
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">
                Edit Profile
              </h2>
              <div className="space-y-6">
                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={editData.full_name}
                    onChange={(e) =>
                      setEditData({ ...editData, full_name: e.target.value })
                    }
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      editErrors.full_name
                        ? "border-red-500 focus:ring-red-500"
                        : "border-gray-300 focus:ring-indigo-500"
                    }`}
                    placeholder="Enter full name"
                  />
                  {editErrors.full_name && (
                    <p className="text-red-600 text-sm mt-1">
                      {editErrors.full_name}
                    </p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={editData.phone}
                    onChange={(e) =>
                      setEditData({ ...editData, phone: e.target.value })
                    }
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      editErrors.phone
                        ? "border-red-500 focus:ring-red-500"
                        : "border-gray-300 focus:ring-indigo-500"
                    }`}
                    placeholder="Enter 10-digit phone number"
                  />
                  {editErrors.phone && (
                    <p className="text-red-600 text-sm mt-1">
                      {editErrors.phone}
                    </p>
                  )}
                  <p className="text-gray-500 text-xs mt-1">
                    Format: +1234567890 (10 digits)
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-400 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // View Mode
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Information */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Personal Information
                  </h2>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        Full Name
                      </label>
                      <p className="text-gray-900">
                        {displayUser.full_name || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        Email
                      </label>
                      <p className="text-gray-900">
                        {displayUser.email || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        Phone
                      </label>
                      <p className="text-gray-900">
                        {displayUser.phone || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        Role
                      </label>
                      <p className="text-gray-900">
                        {displayUser.role || "Recruiter"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Login Information */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Login Information
                  </h2>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        Username
                      </label>
                      <p className="text-gray-900">
                        {displayUser.username || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        Last Login
                      </label>
                      <p className="text-gray-900">
                        {displayUser.last_login
                          ? new Date(displayUser.last_login).toLocaleString()
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        Account Status
                      </label>
                      <p className="text-green-600 font-medium">
                        {displayUser.is_active ? "Active" : "Inactive"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        Company
                      </label>
                      <p className="text-gray-900">
                        {displayUser.company_name || "N/A"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="mt-6 bg-gray-50 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Account Details
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      User ID
                    </label>
                    <p className="text-gray-900 break-all">
                      {displayUser.id || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Created At
                    </label>
                    <p className="text-gray-900">
                      {displayUser.created_at
                        ? new Date(displayUser.created_at).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Updated At
                    </label>
                    <p className="text-gray-900">
                      {displayUser.updated_at
                        ? new Date(displayUser.updated_at).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
          {/* Settings Section Below Profile */}
          <RecruiterSettingsSection />
        </div>
      </div>
    </div>
  );
}
