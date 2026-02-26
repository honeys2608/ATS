// src/components/candidates/StatusPipeline.jsx
import React from "react";

/**
 * Enhanced pipeline with new SUBMITTED stage
 * Props:
 * - candidates (array)
 * - onFilterByStatus(status)
 */
const STATUSES = [
  { key: "applied", label: "Applied", color: "bg-blue-100 text-blue-700" },
  {
    key: "screening",
    label: "Screening",
    color: "bg-yellow-100 text-yellow-700",
  },
  { key: "screened", label: "Screened", color: "bg-green-100 text-green-700" },
  {
    key: "submitted",
    label: "Submitted ⭐",
    color: "bg-purple-100 text-purple-700",
  }, // NEW
  {
    key: "interview_scheduled",
    label: "Interview Scheduled",
    color: "bg-orange-100 text-orange-700",
  },
  {
    key: "interview_completed",
    label: "Interview Completed",
    color: "bg-indigo-100 text-indigo-700",
  },
  {
    key: "offer_extended",
    label: "Offer Extended",
    color: "bg-pink-100 text-pink-700",
  },
  {
    key: "offer_accepted",
    label: "Offer Accepted",
    color: "bg-emerald-100 text-emerald-700",
  },
  { key: "hired", label: "Hired", color: "bg-green-200 text-green-800" },
  { key: "rejected", label: "Rejected", color: "bg-red-100 text-red-700" },
];

export default function StatusPipeline({ candidates = [], onFilterByStatus }) {
  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = (candidates || []).filter((c) => c.status === s).length;
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
      {STATUSES.map((s) => (
        <div
          key={s}
          style={{
            minWidth: 140,
            border: "1px solid #e5e7eb",
            padding: 10,
            borderRadius: 8,
          }}
        >
          <div style={{ fontWeight: 700, textTransform: "capitalize" }}>
            {s.replace(/_/g, " ")}
          </div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            {counts[s] || 0} candidates
          </div>
          <div style={{ marginTop: 8 }}>
            <button onClick={() => onFilterByStatus && onFilterByStatus(s)}>
              Show
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
