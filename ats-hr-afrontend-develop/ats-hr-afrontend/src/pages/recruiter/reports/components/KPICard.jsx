import React from "react";
import AnimatedCount from "./AnimatedCount";

export default function KPICard({ label, value, icon, color }) {
  return (
    <div
      className={`rounded-lg shadow p-4 flex flex-col items-center ${color}`}
      style={{ minWidth: 120 }}
    >
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-2xl font-bold">
        <AnimatedCount value={value} />
      </div>
      <div className="text-xs font-semibold mt-1">{label}</div>
    </div>
  );
}
