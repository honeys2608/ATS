
import React, { useState, useEffect } from "react";
import api from "../../api/axios";
import ProductSettingsToggles from "./ProductSettingsToggles";
import { normalizeText, validateFeatureName } from "../../utils/recruiterValidations";

// Helper for countdown timer
function useCountdown(seconds) {
  const [count, setCount] = useState(seconds);
  useEffect(() => {
    if (count <= 0) return;
    const t = setTimeout(() => setCount(count - 1), 1000);
    return () => clearTimeout(t);
  }, [count]);
  return [count, setCount];
}

export default function UserProfileDrawer({ open, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "" });
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Email change state
  const [emailEdit, setEmailEdit] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpMsg, setOtpMsg] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpSuccess, setOtpSuccess] = useState("");
  const [otpCountdown, setOtpCountdown] = useCountdown(0);
  const role = String(localStorage.getItem("role") || "").toLowerCase();
  const isAm = role === "am" || role === "account_manager";
  const profileBasePath = isAm ? "/v1/am/profile" : "/v1/recruiter/profile";

  useEffect(() => {
    if (open) fetchProfile();
    // eslint-disable-next-line
  }, [open]);

  async function fetchProfile() {
    setLoading(true);
    try {
      const res = await api.get(profileBasePath);
      setProfile(res.data);
      setForm({ full_name: res.data.full_name, phone: res.data.phone });
      setPhotoUrl(res.data.photo_url || "");
    } catch (e) {
      setError("Failed to load profile");
    }
    setLoading(false);
  }

  async function handleEditSave() {
    setError("");
    setSuccess("");
    const fullName = normalizeText(form.full_name);
    const phone = String(form.phone || "").replace(/[^\d]/g, "");
    const fullNameError = validateFeatureName(fullName, "Full name", {
      pattern: /^[A-Za-z][A-Za-z .'-]{1,79}$/,
      patternMessage:
        "Full name can only contain letters, spaces, apostrophes, periods, and hyphens.",
    });
    if (fullNameError) {
      setError(fullNameError);
      return;
    }
    if (phone && !/^\d{10,15}$/.test(phone)) {
      setError("Phone number must be 10-15 digits.");
      return;
    }
    try {
      await api.put(profileBasePath, {
        full_name: fullName,
        phone,
      });
      if (photo) {
        const fd = new FormData();
        fd.append("file", photo);
        await api.post(`${profileBasePath}/photo`, fd);
      }
      setEditMode(false);
      setSuccess("Profile updated");
      fetchProfile();
    } catch (e) {
      setError(e.response?.data?.detail || "Update failed");
    }
  }

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end bg-black bg-opacity-30 transition-all ${open ? "visible" : "invisible"}`}
    >
      <div className="w-full max-w-md h-full bg-white shadow-xl p-6 overflow-y-auto relative animate-slideInRight">
        <button
          className="absolute top-4 right-4 text-gray-500"
          onClick={onClose}
        >
          &times;
        </button>
        <div className="flex flex-col items-center gap-2 mt-4">
          <div className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden border-2 border-primary">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-4xl flex items-center justify-center h-full">
                👤
              </span>
            )}
          </div>
          {editMode && (
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhoto(e.target.files[0])}
              className="mt-2"
            />
          )}
          <div className="text-lg font-semibold mt-2">{profile?.full_name}</div>
          <div className="text-gray-600 flex items-center gap-2">
            {profile?.email}
            {editMode && !emailEdit && (
              <button
                className="text-xs text-primary underline"
                onClick={() => setEmailEdit(true)}
              >
                Change Email
              </button>
            )}
          </div>
          {editMode && emailEdit && (
            <div className="w-full flex flex-col gap-2 mt-2">
              <input
                className="w-full border rounded px-3 py-2"
                placeholder="New Email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onBlur={(e) => setNewEmail(normalizeText(e.target.value))}
              />
              {!otpSent && (
                <button
                  className="bg-primary text-white rounded py-1"
                  disabled={otpCountdown > 0}
                  onClick={async () => {
                    setOtpMsg("");
                    setOtpError("");
                    setOtpSuccess("");
                    const normalizedEmail = normalizeText(newEmail);
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
                      setOtpError("Enter a valid email address.");
                      return;
                    }
                    try {
                      await api.post(
                        `${profileBasePath}/email-change-request`,
                        new URLSearchParams({ new_email: normalizedEmail }),
                      );
                      setOtpSent(true);
                      setOtpCountdown(300);
                      setNewEmail(normalizedEmail);
                      setOtpMsg("OTP sent to both emails");
                    } catch (e) {
                      setOtpError(
                        e.response?.data?.detail || "Failed to send OTP",
                      );
                    }
                  }}
                >
                  Send OTP
                </button>
              )}
              {otpSent && (
                <div className="flex flex-col gap-2">
                  <input
                    className="w-full border rounded px-3 py-2"
                    placeholder="Enter OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    onBlur={(e) => setOtp(normalizeText(e.target.value))}
                  />
                  <button
                    className="bg-primary text-white rounded py-1"
                    onClick={async () => {
                      setOtpError("");
                      setOtpSuccess("");
                      const normalizedOtp = normalizeText(otp);
                      if (!/^\d{4,8}$/.test(normalizedOtp)) {
                        setOtpError("OTP must be 4-8 digits.");
                        return;
                      }
                      try {
                        await api.post(
                          `${profileBasePath}/email-change-verify`,
                          new URLSearchParams({ new_email: normalizeText(newEmail), otp: normalizedOtp }),
                        );
                        setOtpSuccess("Email updated");
                        setOtpSent(false);
                        setEmailEdit(false);
                        fetchProfile();
                      } catch (e) {
                        setOtpError(
                          e.response?.data?.detail || "OTP verification failed",
                        );
                      }
                    }}
                  >
                    Verify & Update
                  </button>
                  <span className="text-xs text-gray-400">
                    {otpCountdown > 0 ? `OTP expires in ${otpCountdown}s` : ""}
                  </span>
                </div>
              )}
              {otpMsg && <div className="text-xs text-green-600">{otpMsg}</div>}
              {otpError && (
                <div className="text-xs text-red-500">{otpError}</div>
              )}
              {otpSuccess && (
                <div className="text-xs text-green-600">{otpSuccess}</div>
              )}
              <button
                className="text-xs text-gray-500 underline mt-1"
                onClick={() => {
                  setEmailEdit(false);
                  setOtpSent(false);
                  setOtp("");
                  setNewEmail("");
                }}
              >
                Cancel
              </button>
            </div>
          )}
          <div className="text-gray-600">{profile?.phone}</div>
          <button
            className="mt-2 px-4 py-1 rounded bg-primary text-white"
            onClick={() => setEditMode(!editMode)}
          >
            {editMode ? "Cancel" : "Edit Details"}
          </button>
        </div>
        {editMode && (
          <div className="mt-4 space-y-2">
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="Full Name"
              value={form.full_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, full_name: e.target.value }))
              }
              onBlur={(e) =>
                setForm((f) => ({ ...f, full_name: normalizeText(e.target.value) }))
              }
            />
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="Phone"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  phone: String(e.target.value || "").replace(/[^\d]/g, ""),
                }))
              }
              onBlur={(e) =>
                setForm((f) => ({
                  ...f,
                  phone: String(e.target.value || "").replace(/[^\d]/g, ""),
                }))
              }
            />
            <button
              className="w-full mt-2 bg-primary text-white py-2 rounded"
              onClick={handleEditSave}
            >
              Save
            </button>
          </div>
        )}
        {error && <div className="mt-4 text-red-500">{error}</div>}
        {success && <div className="mt-4 text-green-600">{success}</div>}
        <div className="mt-8 border-t pt-6">
          <SettingsSection />
          <HelpSection />
          <FeedbackSection />
          <LogoutSection />
        </div>
      </div>
    </div>
  );
}

function SettingsSection() {
  return (
    <div className="mb-6">
      <div className="font-semibold text-lg mb-2">Settings</div>
      <ProductSettingsToggles />
      <ChangePasswordForm />
      <ForgotPasswordSection />
      <ActivityLogSection />
    </div>
  );
}

function ChangePasswordForm() {
  const [form, setForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    old: false,
    new: false,
    confirm: false,
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // "success" or "error"

  const validatePassword = (password) => {
    const minLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    return { minLength, hasUpper, hasLower, hasNumber, hasSpecial };
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.oldPassword) newErrors.oldPassword = "Old password is required";
    if (!form.newPassword) newErrors.newPassword = "New password is required";
    else {
      const validation = validatePassword(form.newPassword);
      if (!validation.minLength)
        newErrors.newPassword = "Password must be at least 8 characters";
      else if (!validation.hasUpper)
        newErrors.newPassword =
          "Password must contain at least one uppercase letter";
      else if (!validation.hasLower)
        newErrors.newPassword =
          "Password must contain at least one lowercase letter";
      else if (!validation.hasNumber)
        newErrors.newPassword = "Password must contain at least one number";
      else if (!validation.hasSpecial)
        newErrors.newPassword =
          "Password must contain at least one special character";
    }
    if (!form.confirmPassword)
      newErrors.confirmPassword = "Confirm password is required";
    else if (form.newPassword !== form.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (!window.confirm("Are you sure you want to change your password?"))
      return;

    setLoading(true);
    setMessage("");
    setMessageType("");
    try {
      const payload = new URLSearchParams();
      payload.append("current_password", form.oldPassword);
      payload.append("new_password", form.newPassword);
      await api.post("/v1/recruiter/change-password", payload);
      setMessage(
        "Password changed successfully. You will be logged out for security.",
      );
      setMessageType("success");
      setForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
      setErrors({});
      // Optionally log out
      setTimeout(() => {
        window.location.href = "/login";
      }, 3000);
    } catch (error) {
      const errorMsg =
        error.response?.data?.detail || "Failed to change password";
      setMessage(errorMsg);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const toggleShowPassword = (field) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div className="mt-4 border-t pt-4">
      <div className="font-medium mb-3">Change Password</div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Username / Email <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={profile?.email || ""}
            readOnly
            className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-100 text-gray-600"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Enter Old Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPasswords.old ? "text" : "password"}
              value={form.oldPassword}
              onChange={(e) =>
                setForm((f) => ({ ...f, oldPassword: e.target.value }))
              }
              className="w-full border border-gray-300 rounded px-3 py-2 pr-10"
              placeholder="Enter old password"
            />
            <button
              type="button"
              onClick={() => toggleShowPassword("old")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showPasswords.old ? "🙈" : "👁"}
            </button>
          </div>
          {errors.oldPassword && (
            <div className="text-red-500 text-xs mt-1">
              {errors.oldPassword}
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Enter New Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPasswords.new ? "text" : "password"}
              value={form.newPassword}
              onChange={(e) =>
                setForm((f) => ({ ...f, newPassword: e.target.value }))
              }
              className="w-full border border-gray-300 rounded px-3 py-2 pr-10"
              placeholder="Enter new password"
            />
            <button
              type="button"
              onClick={() => toggleShowPassword("new")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showPasswords.new ? "🙈" : "👁"}
            </button>
          </div>
          {errors.newPassword && (
            <div className="text-red-500 text-xs mt-1">
              {errors.newPassword}
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Confirm New Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPasswords.confirm ? "text" : "password"}
              value={form.confirmPassword}
              onChange={(e) =>
                setForm((f) => ({ ...f, confirmPassword: e.target.value }))
              }
              className="w-full border border-gray-300 rounded px-3 py-2 pr-10"
              placeholder="Confirm new password"
            />
            <button
              type="button"
              onClick={() => toggleShowPassword("confirm")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showPasswords.confirm ? "🙈" : "👁"}
            </button>
          </div>
          {errors.confirmPassword && (
            <div className="text-red-500 text-xs mt-1">
              {errors.confirmPassword}
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={loading || Object.keys(errors).length > 0}
          className="w-full bg-blue-600 text-white py-2 rounded disabled:bg-gray-400"
        >
          {loading ? "Changing..." : "Change Password"}
        </button>
      </form>
      {message && (
        <div
          className={`mt-3 text-sm ${messageType === "success" ? "text-green-600" : "text-red-500"}`}
        >
          {message}
        </div>
      )}
    </div>
  );
}

function ForgotPasswordSection() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPass, setNewPass] = useState("");
  const [step, setStep] = useState(0); // 0: email, 1: otp+pass
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [count, setCount] = useCountdown(0);

  async function handleRequest() {
    setErr("");
    setMsg("");
    try {
      const res = await api.post(
        "/v1/recruiter/reset-password-request",
        new URLSearchParams({ email }),
      );
      if (res.data.status === "blocked") {
        setErr(res.data.message);
      } else {
        setMsg("OTP sent to email");
        setStep(1);
        setCount(300);
      }
    } catch (e) {
      setErr(e.response?.data?.detail || "Failed");
    }
  }
  async function handleVerify() {
    setErr("");
    setMsg("");
    try {
      await api.post(
        "/v1/recruiter/reset-password-verify",
        new URLSearchParams({ email, otp, new_password: newPass }),
      );
      setMsg("Password reset successfully");
      setStep(0);
      setEmail("");
      setOtp("");
      setNewPass("");
    } catch (e) {
      setErr(e.response?.data?.detail || "Failed");
    }
  }
  return (
    <div className="mt-4">
      <div className="font-medium mb-1">Forgot Password</div>
      {step === 0 ? (
        <div className="flex gap-2">
          <input
            className="border rounded px-2 py-1"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            className="bg-primary text-white rounded px-2"
            onClick={handleRequest}
            disabled={count > 0}
          >
            Request OTP
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mt-2">
          <input
            className="border rounded px-2 py-1"
            placeholder="OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
          <input
            className="border rounded px-2 py-1"
            placeholder="New Password"
            type="password"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
          />
          <button
            className="bg-primary text-white rounded px-2"
            onClick={handleVerify}
          >
            Reset Password
          </button>
        </div>
      )}
      {count > 0 && (
        <span className="text-xs text-gray-400">OTP expires in {count}s</span>
      )}
      {msg && <div className="text-xs text-green-600">{msg}</div>}
      {err && <div className="text-xs text-red-500">{err}</div>}
    </div>
  );
}

function ActivityLogSection() {
  const [logs, setLogs] = useState([]);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (show) fetchLogs();
  }, [show]);
  async function fetchLogs() {
    try {
      const res = await api.get("/v1/recruiter/activity-logs");
      setLogs(res.data);
    } catch {}
  }
  return (
    <div className="mt-4">
      <button
        className="text-xs text-primary underline"
        onClick={() => setShow((s) => !s)}
      >
        {show ? "Hide" : "Show"} Activity Logs
      </button>
      {show && (
        <div className="mt-2 max-h-40 overflow-y-auto border rounded p-2 bg-gray-50 text-xs">
          {logs.length === 0 ? (
            <div>No logs</div>
          ) : (
            logs.map((l, i) => (
              <div key={i} className="mb-1">
                [{l.timestamp}] {l.action_type} ({l.ip_address})
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function HelpSection() {
  return (
    <div className="mb-6">
      <div className="font-semibold text-lg mb-2">Help</div>
      <button className="text-primary">Contact Support</button>
    </div>
  );
}
function FeedbackSection() {
  return (
    <div className="mb-6">
      <div className="font-semibold text-lg mb-2">Give Feedback</div>
      <button className="text-primary">Send Feedback</button>
    </div>
  );
}
function LogoutSection() {
  return (
    <div className="mb-6">
      <button className="w-full bg-gray-100 text-gray-700 py-2 rounded mb-2">
        Logout from Platform
      </button>
      <button className="w-full bg-gray-200 text-gray-700 py-2 rounded">
        Logout from Main Account
      </button>
    </div>
  );
}
