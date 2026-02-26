// src/components/onboarding/OnboardingTask.jsx
import React, { useState } from "react";
import onboardingService from "../../services/onboardingService";

export default function OnboardingTask({ task, onComplete }) {
  const [loading, setLoading] = useState(false);

  const markComplete = async () => {
    setLoading(true);
    try {
      await onboardingService.completeTask(task.id);
      onComplete?.();
    } catch (err) {
      console.error(err);
      alert("Failed to complete task");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-3 border rounded mb-2">
      <div>
        <div className="font-medium">{task.name || task.title}</div>
        {task.description && <div className="text-sm text-gray-500">{task.description}</div>}
      </div>

      <div className="flex items-center gap-2">
        {task.completed ? (
          <span className="text-green-700 font-semibold text-sm">Completed ✓</span>
        ) : (
          <button onClick={markComplete} disabled={loading} className="px-3 py-1 bg-green-600 text-white rounded text-sm">
            {loading ? "..." : "Mark Complete"}
          </button>
        )}
      </div>
    </div>
  );
}
