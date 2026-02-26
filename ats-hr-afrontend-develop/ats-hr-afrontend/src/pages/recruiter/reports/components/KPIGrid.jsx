import React from "react";
import KPICard from "./KPICard";

export default function KPIGrid({ data }) {
  const kpis = [
    {
      label: "CVs Viewed",
      value: data.cvs_viewed,
      icon: "👁️",
      color: "bg-blue-100 text-blue-700",
    },
    {
      label: "CVs Downloaded",
      value: data.cvs_downloaded,
      icon: "⬇️",
      color: "bg-green-100 text-green-700",
    },
    {
      label: "Searches",
      value: data.searches,
      icon: "🔍",
      color: "bg-purple-100 text-purple-700",
    },
    {
      label: "Invites Sent",
      value: data.invites,
      icon: "✉️",
      color: "bg-yellow-100 text-yellow-700",
    },
    {
      label: "Total Actions",
      value: data.total_actions,
      icon: "⚡",
      color: "bg-pink-100 text-pink-700",
    },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
      {kpis.map((kpi) => (
        <KPICard key={kpi.label} {...kpi} />
      ))}
    </div>
  );
}
