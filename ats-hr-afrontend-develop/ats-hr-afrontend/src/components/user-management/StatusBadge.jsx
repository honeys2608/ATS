import React from "react";

const styles = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-slate-200 text-slate-700",
  suspended: "bg-amber-100 text-amber-700",
  locked: "bg-red-100 text-red-700",
  pending: "bg-blue-100 text-blue-700",
};

export default function StatusBadge({ status }) {
  const key = String(status || "inactive").toLowerCase();
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${styles[key] || styles.inactive}`}>
      {key.charAt(0).toUpperCase() + key.slice(1)}
    </span>
  );
}
