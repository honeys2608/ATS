// src/components/employees/ExitButton.jsx
import React from "react";
import employeeService from "../../services/employeeService";

export default function ExitButton({ employeeId, onExited }) {
  const doExit = async () => {
    if (!confirm("Are you sure you want to exit this employee?")) return;
    try {
      await employeeService.exit(employeeId, { exit_reason: "manual_exit" });
      onExited?.();
      alert("Employee exited");
    } catch (err) {
      console.error(err);
      alert("Failed to exit");
    }
  };

  return (
    <button onClick={doExit} className="bg-red-600 text-white px-2 py-1 rounded text-xs">
      Exit
    </button>
  );
}
