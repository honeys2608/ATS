// src/pages/BackgroundVerification.jsx
import React, { useEffect, useState } from "react";
import api from "../api/axios";
import candidateService from "../services/candidateService";

/**
 * BackgroundVerification (Admin)
 *
 * Features:
 * - List candidates eligible for BGV (filter/search)
 * - Initiate BGV with chosen checks
 * - Assign vendor to candidate BGV
 * - View/download BGV reports and show expiry
 *
 * Assumptions:
 * - candidateService.listCandidates({ status: 'verified' | 'bgv_pending' | ... }) works
 * - candidateService.initiateBgvCheck(candidateId, payload) exists
 * - candidateService.assignBgvVendor(candidateId, payload) exists
 * - candidateService.getBgvReports(candidateId) exists and returns array of reports
 * - GET /v1/bgv/vendors returns vendor list (id, name)
 *
 * Adjust endpoint names in the code below if your backend uses different routes.
 */
export default function BackgroundVerification() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // e.g. "verified" or "bgv_pending"
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // chosen checks for initiate
  const defaultChecks = [
    "identity",
    "education",
    "employment",
    "address",
    "criminal",
  ];
  const [selectedChecks, setSelectedChecks] = useState([
    "identity",
    "education",
  ]);

  useEffect(() => {
    fetchCandidates();
    fetchVendors();
  }, []);

  // reload reports when a candidate is selected
  useEffect(() => {
    if (selectedCandidate) {
      loadReports(selectedCandidate.id || selectedCandidate._id);
    } else {
      setReports([]);
    }
  }, [selectedCandidate]);

  async function fetchCandidates() {
    setLoading(true);
    try {
      const params = {
        q: query || undefined,
        status: statusFilter || undefined, // e.g. 'verified' or backend-specific flag for eligible
        // optionally pass role/job etc.
      };
      const data = await candidateService.listCandidates(params);
      const list = Array.isArray(data) ? data : (data?.items ?? []);
      setCandidates(list);
    } catch (err) {
      console.error("fetchCandidates error", err);
      alert("Failed to load candidates");
    } finally {
      setLoading(false);
    }
  }

  async function fetchVendors() {
    setVendorLoading(true);
    try {
      // endpoint assumed: GET /v1/bgv/vendors
      const res = await api.get("/v1/bgv/vendors");
      setVendors(res.data?.data ?? res.data ?? []);
    } catch (err) {
      console.error("fetchVendors error", err);
      // vendors are optional — you can use manual entry fallback
      setVendors([]);
    } finally {
      setVendorLoading(false);
    }
  }

  function toggleCheck(check) {
    setSelectedChecks((prev) => {
      const s = new Set(prev);
      if (s.has(check)) s.delete(check);
      else s.add(check);
      return Array.from(s);
    });
  }

  async function handleInitiateBgv(candidateId) {
    if (!candidateId) return;
    if (selectedChecks.length === 0) {
      alert("Select at least one check to initiate.");
      return;
    }
    if (
      !window.confirm(
        `Initiate BGV for candidate ${candidateId} with checks: ${selectedChecks.join(
          ", ",
        )}?`,
      )
    )
      return;
    setActionLoading(true);
    try {
      const payload = { checks: selectedChecks };
      await candidateService.initiateBgvCheck(candidateId, payload);
      alert("BGV initiated");
      fetchCandidates();
      // reload reports
      loadReports(candidateId);
    } catch (err) {
      console.error("initiateBgv error", err);
      alert("Failed to initiate BGV");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAssignVendor(candidateId, vendorId) {
    if (!candidateId || !vendorId) {
      alert("Choose a vendor");
      return;
    }
    if (!window.confirm("Assign vendor for BGV?")) return;
    setActionLoading(true);
    try {
      await candidateService.assignBgvVendor(candidateId, {
        vendor_id: vendorId,
      });

      alert("Vendor assigned");

      // 🔥 candidate list refresh
      fetchCandidates();

      // 🔥 selected candidate bhi refresh karo (ye important hai)
      setSelectedCandidate((prev) =>
        prev ? { ...prev, bgv_vendor_id: vendorId } : prev,
      );

      loadReports(candidateId);
    } catch (err) {
      console.error("assignVendor error", err);
      alert("Failed to assign vendor");
    } finally {
      setActionLoading(false);
    }
  }

  async function loadReports(candidateId) {
    if (!candidateId) return;
    setReportsLoading(true);
    try {
      const r = await candidateService.getBgvReports(candidateId);
      // expect array or { items }
      const list = Array.isArray(r) ? r : (r?.items ?? []);
      setReports(list);
    } catch (err) {
      console.error("getBgvReports error", err);
      setReports([]);
    } finally {
      setReportsLoading(false);
    }
  }

  async function handleFinalVerify(candidateId, status, remarks) {
    if (!window.confirm(`Confirm mark candidate as ${status}?`)) return;

    try {
      await api.patch(`/v1/bgv/admin/verify/${candidateId}`, {
        status,
        remarks,
      });

      alert("Final verification updated");

      fetchCandidates();

      setSelectedCandidate((prev) =>
        prev ? { ...prev, bgv_final_status: status } : prev,
      );
    } catch (err) {
      console.error("final verify failed", err);
      alert("Failed to update");
    }
  }

  // convenience: open candidate and select
  function openCandidate(candidate) {
    setSelectedCandidate(candidate);
  }

  // UI render helpers
  function renderReportsList() {
    if (reportsLoading)
      return <div className="text-sm text-gray-500">Loading reports...</div>;
    if (!reports || reports.length === 0)
      return <div className="text-sm text-gray-500">No reports yet.</div>;

    return (
      <ul className="space-y-2">
        {reports.map((r) => {
          // fields may vary: r.name, r.report_url, r.status, r.expiry_date
          const id = r.id ?? r._id ?? r.report_id;
          const title = r.name || r.type || `Report ${id}`;
          const url = r.download_url || r.report_url || r.url;
          const expiry = r.expiry_date || r.expires_at || r.expiry;
          return (
            <li
              key={id}
              className="p-2 border rounded flex items-center justify-between"
            >
              <div>
                <div className="font-medium">{title}</div>
                <div className="text-xs text-gray-500">
                  {r.status || "unknown status"}
                </div>
                {expiry && (
                  <div className="text-xs text-gray-500">
                    Expiry: {new Date(expiry).toLocaleDateString()}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 items-end">
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-indigo-600 underline"
                  >
                    Open
                  </a>
                ) : (
                  <span className="text-xs text-gray-500">No URL</span>
                )}
                {/* optionally download button or mark clearance */}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Background Verification</h1>
        <div className="text-sm text-gray-500">
          BGC initiation, vendor assignment, reports & expiry
        </div>
      </div>

      {/* Filters + search */}
      <div className="flex gap-3 items-center">
        <input
          placeholder="Search name or email..."
          className="p-2 border rounded flex-1"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="">All candidates</option>
          <option value="verified">Verified / Eligible</option>
          <option value="bgv_pending">BGV Pending</option>
          <option value="bgv_in_progress">BGV In progress</option>
          <option value="bgv_complete">BGV Complete</option>
        </select>
        <button
          onClick={() => fetchCandidates()}
          className="px-3 py-2 bg-indigo-600 text-white rounded"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* candidate list */}
          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-semibold mb-2">Candidates</h3>
            {loading ? (
              <div className="text-sm text-gray-500">Loading...</div>
            ) : candidates.length === 0 ? (
              <div className="text-sm text-gray-500">No candidates found.</div>
            ) : (
              <div className="space-y-2">
                {candidates.map((c) => {
                  const cid = c.id ?? c._id;
                  return (
                    <div
                      key={cid}
                      className="p-3 border rounded flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium">
                          {c.full_name || c.email}
                        </div>
                        <div className="text-xs text-gray-500">
                          {c.email} • {c.phone || "N/A"}
                        </div>
                        <div className="text-xs text-gray-500">
                          BGV status: {c.bgv_status || c.status || "N/A"}
                        </div>
                      </div>

                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() => openCandidate(c)}
                          className="px-3 py-1 border rounded text-sm"
                        >
                          Open
                        </button>

                        <button
                          onClick={() => handleInitiateBgv(cid)}
                          disabled={actionLoading}
                          className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                        >
                          {actionLoading ? "Starting..." : "Initiate BGV"}
                        </button>

                        <div>
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              if (!e.target.value) return;
                              handleAssignVendor(cid, e.target.value);
                            }}
                            className="p-1 border rounded text-sm"
                            aria-label="Assign vendor"
                          >
                            <option value="">Assign vendor</option>
                            {vendorLoading ? (
                              <option>Loading vendors...</option>
                            ) : vendors.length === 0 ? (
                              <option>No vendors</option>
                            ) : (
                              vendors.map((v) => (
                                <option
                                  key={v.id || v._id}
                                  value={v.id || v._id}
                                >
                                  {v.name}
                                </option>
                              ))
                            )}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* right panel: selected candidate details + checks + reports */}
        <aside className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-2">Selected Candidate</h3>
          {!selectedCandidate ? (
            <div className="text-sm text-gray-500">
              Select a candidate to see BGV options and reports
            </div>
          ) : (
            <>
              <div className="mb-3">
                <div className="font-medium">
                  {selectedCandidate.name || selectedCandidate.email}
                </div>
                <div className="text-xs text-gray-500">
                  {selectedCandidate.email}
                </div>
                <div className="text-xs text-gray-500">
                  Phone: {selectedCandidate.phone || "N/A"}
                </div>
                <div className="text-xs text-gray-500">
                  BGV status:{" "}
                  {selectedCandidate.bgv_status ||
                    selectedCandidate.status ||
                    "N/A"}
                </div>
              </div>

              <div className="mb-3">
                <h4 className="text-sm font-medium mb-1">Select checks</h4>
                <div className="grid grid-cols-2 gap-2">
                  {defaultChecks.map((ch) => (
                    <label key={ch} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedChecks.includes(ch)}
                        onChange={() => toggleCheck(ch)}
                      />
                      <span className="capitalize">{ch}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-2">
                  <button
                    onClick={() =>
                      handleInitiateBgv(
                        selectedCandidate.id || selectedCandidate._id,
                      )
                    }
                    disabled={actionLoading}
                    className="px-3 py-2 bg-green-600 text-white rounded"
                  >
                    {actionLoading ? "Initiating..." : "Initiate BGV"}
                  </button>
                </div>
              </div>

              <div className="mb-3">
                <h4 className="text-sm font-medium mb-1">Assigned Vendor</h4>
                <div>
                  <select
                    value={selectedCandidate.bgv_vendor_id || ""}
                    onChange={(e) =>
                      handleAssignVendor(
                        selectedCandidate.id || selectedCandidate._id,
                        e.target.value,
                      )
                    }
                    className="p-2 border rounded w-full"
                  >
                    <option value="">Select vendor</option>
                    {vendorLoading ? (
                      <option>Loading vendors...</option>
                    ) : (
                      vendors.map((v) => (
                        <option key={v.id || v._id} value={v.id || v._id}>
                          {v.name || v.company_name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-1">Reports</h4>
                {renderReportsList()}
              </div>
              {/* FINAL HR VERIFICATION */}
              <div className="mt-4 p-3 border rounded">
                <h4 className="text-sm font-medium mb-1">
                  Final HR Verification
                </h4>

                <div className="text-xs text-gray-600 mb-2">
                  Current Status:{" "}
                  <span className="font-semibold">
                    {selectedCandidate?.bgv_final_status || "Not Reviewed"}
                  </span>
                </div>

                <textarea
                  className="w-full border p-2 rounded mb-2"
                  placeholder="Remarks (optional)"
                  onChange={(e) =>
                    (selectedCandidate._remarks = e.target.value)
                  }
                />

                <div className="flex gap-2">
                  <button
                    className="px-3 py-2 bg-green-600 text-white rounded"
                    onClick={() =>
                      handleFinalVerify(
                        selectedCandidate.id || selectedCandidate._id,
                        "verified",
                        selectedCandidate._remarks || "",
                      )
                    }
                  >
                    Approve
                  </button>

                  <button
                    className="px-3 py-2 bg-red-600 text-white rounded"
                    onClick={() =>
                      handleFinalVerify(
                        selectedCandidate.id || selectedCandidate._id,
                        "failed",
                        selectedCandidate._remarks || "",
                      )
                    }
                  >
                    Reject
                  </button>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
