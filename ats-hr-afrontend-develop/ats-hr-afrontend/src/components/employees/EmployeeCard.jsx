// src/components/employees/EmployeeCard.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import onboardingService from "../../services/onboardingService";
import employeeService from "../../services/employeeService";

export default function EmployeeCard({ employee, onRefetch }) {
  const navigate = useNavigate();

  const startOnboarding = async () => {
    try {
      await onboardingService.startOnboarding(employee.id);
      onRefetch?.();
      alert("Onboarding started");
    } catch (err) {
      console.error(err);
      alert("Failed to start onboarding");
    }
  };

  const handleExit = async () => {
    if (!confirm(`Mark ${employee.full_name} as exited?`)) return;
    try {
      await employeeService.exit(employee.id, { exit_reason: "manual_exit" });
      onRefetch?.();
      alert("Employee exited");
    } catch (err) {
      console.error(err);
      alert("Failed to exit employee");
    }
  };

  return (
    <div className="p-4 border rounded bg-white">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-semibold">{employee.full_name || "—"}</h4>
          <div className="text-sm text-gray-600">{employee.designation || "—"}</div>
          <div className="text-xs text-gray-500">{employee.department}</div>
        </div>

        <div className="flex flex-col items-end space-y-2">
          <button
            onClick={() => navigate(`/employees/${employee.id}`)}
            className="text-blue-600 text-sm"
          >
            View
          </button>

          {employee.status !== "onboarding" && employee.status !== "exited" && (
            <button
              onClick={startOnboarding}
              className="bg-blue-600 text-white px-2 py-1 rounded text-xs"
            >
              Start Onboarding
            </button>
          )}

          {employee.status !== "exited" && (
            <button
              onClick={handleExit}
              className="bg-red-600 text-white px-2 py-1 rounded text-xs"
            >
              Exit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
