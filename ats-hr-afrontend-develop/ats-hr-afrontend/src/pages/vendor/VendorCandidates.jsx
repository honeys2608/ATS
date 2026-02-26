import React, { useEffect, useState } from "react";
import VendorCandidateUpload from "../../components/vendor/VendorCandidateUpload";
import VendorCandidateCard from "../../components/vendor/VendorCandidateCard";

import { getVendorCandidates } from "../../services/vendorService";

/**
 * VendorCandidates
 * - Allows vendor to upload candidates
 * - Shows list of candidates uploaded by the vendor
 * - Read-only status visibility
 */
export default function VendorCandidates() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadCandidates();
  }, []);

  async function loadCandidates() {
    try {
      setLoading(true);
      setError("");
      const res = await getVendorCandidates();
      // backend should already filter by vendor_id from JWT
      setCandidates(res?.data ?? []);
    } catch (err) {
      console.error(err);
      setError("Failed to load candidates");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-800">
          Vendor Candidates
        </h1>
        <p className="text-sm text-gray-500">
          Upload and track candidates submitted by your organization.
        </p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow p-4">
        <VendorCandidateUpload onSuccess={loadCandidates} />
      </div>

      {/* List Section */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-md font-medium mb-4">Uploaded Candidates</h2>

        {loading && (
          <p className="text-sm text-gray-500">Loading candidates...</p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && candidates.length === 0 && (
          <p className="text-sm text-gray-500">No candidates uploaded yet.</p>
        )}

        <div className="grid gap-3">
          {candidates.map((candidate) => (
            <VendorCandidateCard key={candidate.id} candidate={candidate} />
          ))}
        </div>
      </div>
    </div>
  );
}
