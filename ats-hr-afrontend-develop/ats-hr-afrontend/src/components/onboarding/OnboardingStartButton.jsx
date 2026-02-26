import React, { useState } from "react";
import onboardingService from "../../services/onboardingService";

export default function OnboardingStartButton({ employeeId, employeeName, onStarted }) {
  const [loading, setLoading] = useState(false);

  const handleStart = async (e) => {
    e.stopPropagation();
    if (!employeeId) return;
    setLoading(true);
    try {
      await onboardingService.startOnboarding(employeeId); // POST /v1/onboarding/{employee_id}/start
      if (onStarted) await onStarted();
      alert(`Onboarding started for ${employeeName || employeeId}`);
    } catch (err) {
      console.error("start onboarding failed", err);
      alert("Failed to start onboarding");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleStart}
      className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
      disabled={loading}
      title="Start onboarding"
    >
      {loading ? "Starting..." : "Start Onboarding"}
    </button>
  );
}
