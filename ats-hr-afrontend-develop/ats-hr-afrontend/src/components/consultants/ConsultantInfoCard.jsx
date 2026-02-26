// src/components/consultants/ConsultantInfoCard.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

export default function ConsultantInfoCard({
  consultant,
  showActions = true,
}) {
  const navigate = useNavigate();

  if (!consultant) return null;

  const isDeployed = consultant.status === "deployed";
  const isPayroll = consultant.type === "payroll";

  return (
    <div className="bg-white border rounded-lg p-6 flex justify-between items-center">
      {/* LEFT: INFO */}
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">
          {consultant.name || consultant.full_name || "Unnamed Consultant"}
        </h2>

        <p className="text-sm text-gray-500">
          {consultant.email || "No email"}
        </p>

        <div className="flex gap-2 mt-2">
          <Badge
            label={consultant.type}
            color={isPayroll ? "indigo" : "purple"}
          />

          <Badge
            label={consultant.status || "available"}
            color={isDeployed ? "red" : "green"}
          />

          {isPayroll && (
            <Badge
              label={
                consultant.payrollReady ? "Payroll Ready" : "Payroll Pending"
              }
              color={consultant.payrollReady ? "green" : "yellow"}
            />
          )}
        </div>
      </div>

      {/* RIGHT: ACTIONS */}
      {showActions && (
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/consultants/${consultant.id}`)}
            className="px-3 py-1 border rounded text-sm"
          >
            View
          </button>

          {isPayroll && consultant.payrollReady && !isDeployed && (
            <button
              onClick={() =>
                navigate(`/consultants/${consultant.id}/deploy`)
              }
              className="px-3 py-1 bg-green-600 text-white rounded text-sm"
            >
              Deploy
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* BADGE COMPONENT */
function Badge({ label, color }) {
  const map = {
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-700",
    indigo: "bg-indigo-100 text-indigo-700",
    purple: "bg-purple-100 text-purple-700",
    yellow: "bg-yellow-100 text-yellow-700",
  };

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
        map[color] || "bg-gray-100 text-gray-600"
      }`}
    >
      {label}
    </span>
  );
}
