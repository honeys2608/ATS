import React, { useState, useEffect } from "react";
import api from "../../api/axios";

// Example toggles: Notification, Dark Mode, Beta Features
export default function ProductSettingsToggles() {
  const [settings, setSettings] = useState({
    email_notifications: false,
    sms_alerts: false,
    report_emails: false,
    interview_reminders: false,
    two_factor_enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/v1/recruiter/preferences");
      setSettings(res.data);
    } catch (e) {
      setError("Failed to load settings");
    }
    setLoading(false);
  }

  async function handleToggle(key) {
    setError("");
    setSuccess("");
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    try {
      const payload = new URLSearchParams();
      Object.entries(newSettings).forEach(([prefKey, value]) => {
        payload.append(prefKey, String(value));
      });
      await api.put("/v1/recruiter/preferences", payload);
      setSuccess("Settings updated");
    } catch (e) {
      setError("Failed to update settings");
      setSettings(settings); // revert
    }
  }

  if (loading) return <div>Loading settings...</div>;

  return (
    <div className="mb-4">
      <div className="font-medium mb-2">Product Settings</div>
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.email_notifications}
            onChange={() => handleToggle("email_notifications")}
          />
          Email Notifications
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.sms_alerts}
            onChange={() => handleToggle("sms_alerts")}
          />
          SMS Alerts
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.report_emails}
            onChange={() => handleToggle("report_emails")}
          />
          Report Emails
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.interview_reminders}
            onChange={() => handleToggle("interview_reminders")}
          />
          Interview Reminders
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.two_factor_enabled}
            onChange={() => handleToggle("two_factor_enabled")}
          />
          Two-Factor Authentication
        </label>
      </div>
      {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
      {success && <div className="text-xs text-green-600 mt-1">{success}</div>}
    </div>
  );
}
