import React from "react";

/**
 * VendorStatusBadge
 * - Displays read-only status for vendor candidates
 * - Normalizes known statuses
 */

const STATUS_MAP = {
  new: {
    label: "New",
    className: "bg-gray-100 text-gray-700",
  },
  screened: {
    label: "Screened",
    className: "bg-blue-100 text-blue-700",
  },
  shortlisted: {
    label: "Shortlisted",
    className: "bg-indigo-100 text-indigo-700",
  },
  interview: {
    label: "Interview",
    className: "bg-purple-100 text-purple-700",
  },
  selected: {
    label: "Selected",
    className: "bg-green-100 text-green-700",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-700",
  },
};

export default function VendorStatusBadge({ status }) {
  const cfg = STATUS_MAP[status] || {
    label: status || "Unknown",
    className: "bg-gray-100 text-gray-600",
  };

  return (
    <span
      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}
