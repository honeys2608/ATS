import React from "react";

/**
 * VendorStatCard
 * ----------------
 * ATS-specific KPI card for Vendor dashboards
 *
 * Props:
 * - title (string)        : KPI title
 * - value (string|number): Main KPI value
 * - sub (string)         : Supporting text (optional)
 * - type (string)        : default | info | success | warning | danger
 */

const TYPE_STYLES = {
  default: {
    value: "text-gray-800",
    bg: "bg-white",
    border: "border-gray-200",
  },
  info: {
    value: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  success: {
    value: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
  },
  warning: {
    value: "text-yellow-600",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
  },
  danger: {
    value: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
  },
};

export default function VendorStatCard({
  title,
  value,
  sub,
  type = "default",
}) {
  const styles = TYPE_STYLES[type] || TYPE_STYLES.default;

  return (
    <div
      className={`rounded-lg border p-4 shadow-sm ${styles.bg} ${styles.border}`}
    >
      <p className="text-xs uppercase tracking-wide text-gray-500 font-medium">
        {title}
      </p>

      <p className={`text-2xl font-semibold mt-1 ${styles.value}`}>{value}</p>

      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
