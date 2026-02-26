import React from "react";
import VendorStatusBadge from "./VendorStatusBadge";

/**
 * VendorCandidateCard
 * - Read-only card for vendor uploaded candidates
 * - Shows candidate info + current status
 */
export default function VendorCandidateCard({ candidate }) {
  return (
    <div className="border rounded-lg p-4 flex justify-between items-start">
      {/* Candidate Info */}
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-gray-800">
          {candidate.full_name}
        </h4>

        <p className="text-xs text-gray-500">
          {candidate.email} · {candidate.phone}
        </p>

        {candidate.experience_years !== undefined && (
          <p className="text-xs text-gray-600">
            Experience: {candidate.experience_years} years
          </p>
        )}

        {candidate.skills && candidate.skills.length > 0 && (
          <p className="text-xs text-gray-600">
            Skills:{" "}
            {Array.isArray(candidate.skills)
              ? candidate.skills.join(", ")
              : candidate.skills}
          </p>
        )}

        {candidate.billing_rate && (
          <p className="text-xs text-gray-600">
            Billing Rate: ₹{candidate.billing_rate}
          </p>
        )}
      </div>

      {/* Status */}
      <div className="flex flex-col items-end space-y-2">
        <VendorStatusBadge status={candidate.status} />

        <span className="text-[10px] text-gray-400">Source: Vendor</span>
      </div>
    </div>
  );
}
