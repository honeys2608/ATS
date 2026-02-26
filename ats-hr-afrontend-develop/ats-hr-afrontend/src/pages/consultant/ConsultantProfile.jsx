import React, { useEffect, useState } from "react";
import api from "../../api/axios"; // ✅ FIXED

export default function ConsultantProfile() {
  const [profile, setProfile] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  // 🔐 Reset Password States
  const [showResetModal, setShowResetModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function saveProfile() {
    try {
      setSaving(true);
      await api.put("/v1/consultant/me", {
        phone: profile.phone,
        current_location: profile.current_location,
        education: profile.education,
        experience_years: profile.experience_years,
        skills: profile.skills,
      });
      setEditMode(false);
    } catch (e) {
      alert("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      alert("Both password fields are required");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {
      setResetting(true);

      await api.post("/v1/consultant/change-password", {
        password: newPassword,
        confirm_password: confirmPassword,
      });

      alert("Password reset successfully");
      setShowResetModal(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      alert(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Failed to reset password"
      );
    } finally {
      setResetting(false);
    }
  };

  async function loadProfile() {
    try {
      const res = await api.get("/v1/consultant/me");
      setProfile(res.data);
    } catch (err) {
      console.error(err);
      setError("Failed to load consultant profile");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-6">Loading profile...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!profile) return null;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Consultant Profile</h1>

        <div className="flex gap-2">
          {!editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded"
            >
              Edit Profile
            </button>
          )}

          <button
            onClick={() => setShowResetModal(true)}
            className="px-3 py-1 text-sm bg-red-600 text-white rounded"
          >
            Reset Password
          </button>
        </div>
      </div>

      {/* BASIC INFO */}
      <div className="bg-white border rounded p-4 space-y-2">
        <h2 className="font-semibold text-lg">Basic Information</h2>
        <p>
          <b>Name:</b> {profile.full_name || "—"}
        </p>
        <p>
          <b>Designation:</b> {profile.designation || "—"}
        </p>

        <p>
          <b>Email:</b> {profile.email || "—"}
        </p>
        <p>
          <b>Phone:</b>{" "}
          {editMode ? (
            <input
              value={profile.phone || ""}
              onChange={(e) =>
                setProfile({ ...profile, phone: e.target.value })
              }
              className="border px-2 py-1 rounded ml-2"
            />
          ) : (
            profile.phone || "—"
          )}
        </p>
        <p>
          <b>Location:</b>{" "}
          {editMode ? (
            <input
              value={profile.current_location || ""}
              onChange={(e) =>
                setProfile({ ...profile, current_location: e.target.value })
              }
              className="border px-2 py-1 rounded ml-2"
            />
          ) : (
            profile.current_location || "—"
          )}
        </p>
      </div>

      {/* PROFESSIONAL */}
      <div className="bg-white border rounded p-4 space-y-2">
        <h2 className="font-semibold text-lg">Professional Details</h2>
        <p>
          <b>Experience:</b>{" "}
          {editMode ? (
            <input
              type="number"
              value={profile.experience_years ?? ""}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  experience_years: e.target.value,
                })
              }
              className="border px-2 py-1 rounded ml-2 w-24"
            />
          ) : (
            profile.experience_years ?? "—"
          )}
        </p>
        <p>
          <b>Education:</b>{" "}
          {editMode ? (
            <input
              value={profile.education || ""}
              onChange={(e) =>
                setProfile({ ...profile, education: e.target.value })
              }
              className="border px-2 py-1 rounded ml-2"
            />
          ) : (
            profile.education || "—"
          )}
        </p>
        <div>
          <b>Skills:</b>
          <div className="flex flex-wrap gap-2 mt-1">
            {(profile.skills || []).length === 0 && <span>—</span>}
            {(profile.skills || []).map((s) => (
              <span key={s} className="px-2 py-1 bg-gray-100 rounded text-sm">
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* CONSULTANT META */}
      {editMode && (
        <div className="flex gap-3">
          <button
            onClick={saveProfile}
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded"
          >
            {saving ? "Saving..." : "Save"}
          </button>

          <button
            onClick={() => {
              setEditMode(false);
              loadProfile(); // reset changes
            }}
            className="px-4 py-2 bg-gray-300 rounded"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="bg-white border rounded p-4 space-y-2">
        <h2 className="font-semibold text-lg">Consultant Status</h2>
        <p>
          <b>Consultant Code:</b> {profile.consultant_code}
        </p>
        <p>
          <b>Type:</b> {profile.type}
        </p>
        <p>
          <b>Status:</b> {profile.status}
        </p>
        <p>
          <b>Payroll Ready:</b> {profile.payroll_ready ? "Yes" : "No"}
        </p>
      </div>
      {/* 🔐 RESET PASSWORD MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-96 p-6">
            <h3 className="text-lg font-semibold mb-4">
              Reset Consultant Password
            </h3>

            <div className="mb-3">
              <label className="text-sm font-medium">Email</label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="w-full border p-2 rounded bg-gray-100"
              />
            </div>

            <div className="mb-3">
              <label className="text-sm font-medium">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border p-2 rounded"
              />
            </div>

            <div className="mb-4">
              <label className="text-sm font-medium">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border p-2 rounded"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-3 py-1 border rounded"
              >
                Cancel
              </button>

              <button
                onClick={handleResetPassword}
                disabled={resetting}
                className="px-4 py-1 bg-red-600 text-white rounded"
              >
                {resetting ? "Resetting..." : "Reset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
