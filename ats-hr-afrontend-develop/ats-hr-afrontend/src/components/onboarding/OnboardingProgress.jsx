// src/components/onboarding/OnboardingProgress.jsx
import React, { useEffect, useState } from "react";
import onboardingService from "../../services/onboardingService";

export default function OnboardingProgress({ employeeId }) {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const p = await onboardingService.getProgress(employeeId);
      setProgress(p || { completed: 0, total: 0 });
    } catch (err) {
      console.error(err);
      setProgress({ completed: 0, total: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (employeeId) load(); }, [employeeId]);

  if (loading) return <div>Loading progress...</div>;
  const completed = progress?.completed || 0;
  const total = progress?.total || 0;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">Onboarding Progress</div>
        <div className="text-xs text-gray-600">{completed}/{total}</div>
      </div>
      <div className="w-full bg-gray-200 rounded h-3">
        <div style={{ width: `${pct}%` }} className="h-3 bg-blue-600 rounded"></div>
      </div>
      <div className="text-xs text-gray-500 mt-1">{pct}%</div>
    </div>
  );
}
