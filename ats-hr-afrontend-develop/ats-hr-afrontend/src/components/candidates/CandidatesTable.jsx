// src/components/candidates/CandidatesTable.jsx
import React, { useEffect, useMemo, useState } from "react";
import useCandidates from "../../hooks/useCandidates";
import CandidateActions from "./CandidateActions";
import api from "../../api/axios";

export default function CandidatesTable({ isDirectFlag = undefined }) {
  // initialize hook with initialIsDirect
  const {
    candidates,
    loading,
    error,
    filters,
    setFilters,
    page,
    limit,
    total,
    setPage,
    fetchCandidates,
    setIsDirect,
  } = useCandidates({ initialIsDirect: isDirectFlag, pageSize: 25 });

  // when parent button toggles, update hook's isDirect state
  useEffect(() => {
    setIsDirect(
      typeof isDirectFlag === "undefined" ? undefined : Boolean(isDirectFlag),
    );
  }, [isDirectFlag, setIsDirect]);

  const [q, setQ] = useState(filters.q || "");
  const [appliedJob, setAppliedJob] = useState(filters.applied_job || "");
  // local selects for UI binding (keeps hook filters in sync)
  const [statusFilter, setStatusFilter] = useState(filters.status || "");
  const [sourceFilter, setSourceFilter] = useState(filters.source || "");

  // debounce search input (q and appliedJob)
  useEffect(() => {
    const to = setTimeout(() => {
      const newFilters = { ...filters, q, applied_job: appliedJob };
      setFilters((prev) => ({ ...prev, q, applied_job: appliedJob }));
      fetchCandidates({
        page: 1,
        filters: newFilters,
        is_direct: isDirectFlag,
      });
    }, 300);
    return () => clearTimeout(to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, appliedJob]);

  // when status/source UI selects change, update hook filters and refetch
  useEffect(() => {
    const newFilters = {
      ...filters,
      status: statusFilter,
      source: sourceFilter,
    };
    setFilters(newFilters);
    fetchCandidates({ page: 1, filters: newFilters, is_direct: isDirectFlag });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, sourceFilter]);

  const handlePage = (next) => {
    setPage(next);
    fetchCandidates({ page: next, filters, is_direct: isDirectFlag });
  };

  const columns = useMemo(
    () => [
      "#",
      "Name",
      "Email",
      "Phone",
      "Title/Exp",
      "Location",
      "Jobs",
      "Status",
      "Source",
      "Owner",
      "Actions",
    ],
    [],
  );

  // -------------------------
  // Convert helpers
  // -------------------------
  async function convertToEmployee(candidate) {
    const id = candidate.candidate_id || candidate.id;
    if (
      !window.confirm(
        `Convert ${candidate.first_name || candidate.name || candidate.email} to Employee?`,
      )
    )
      return;
    try {
      // call convert endpoint - backend may expect POST/PUT - adapt if necessary
      const res = await api.post(`/v1/candidates/${id}/convert`, {
        to: "employee",
      });
      alert("Converted to employee");
      // refresh
      fetchCandidates({ page, filters, is_direct: isDirectFlag });
    } catch (err) {
      console.error("convertToEmployee error:", err);
      alert(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          "Conversion failed",
      );
    }
  }

  async function convertToConsultant(candidate) {
    const id = candidate.candidate_id || candidate.id;
    if (
      !window.confirm(
        `Convert ${candidate.first_name || candidate.name || candidate.email} to Consultant?`,
      )
    )
      return;
    try {
      const res = await api.post(`/v1/candidates/${id}/convert`, {
        to: "consultant",
      });
      alert("Converted to consultant");
      fetchCandidates({ page, filters, is_direct: isDirectFlag });
    } catch (err) {
      console.error("convertToConsultant error:", err);
      alert(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          "Conversion failed",
      );
    }
  }

  return (
    <div className="p-4 bg-white rounded shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Search by name, email, phone..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="border rounded px-3 py-1"
          />
          <input
            type="text"
            placeholder="Filter by applied job (title or id)..."
            value={appliedJob}
            onChange={(e) => setAppliedJob(e.target.value)}
            className="border rounded px-3 py-1"
          />

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded px-3 py-1"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="screening">Screening</option>
            <option value="interview_scheduled">Interview Scheduled</option>
            <option value="interview_completed">Interview Completed</option>
            <option value="offer_extended">Offer Extended</option>
            <option value="offer_accepted">Offer Accepted</option>
            <option value="hired">Hired</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Source filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="border rounded px-3 py-1"
            aria-label="Filter by source"
          >
            <option value="">All sources</option>
            <option value="direct">Direct</option>
            <option value="portal">Portal</option>
            <option value="referral">Referral</option>
            <option value="agency">Agency</option>
          </select>
        </div>

        <div>
          <span className="text-sm text-gray-600">Total: {total}</span>
        </div>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full">
          <thead className="bg-gray-100 text-left text-sm">
            <tr>
              {columns.map((c, idx) => (
                <th key={idx} className="px-3 py-2">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="p-6 text-center">
                  Loading...
                </td>
              </tr>
            ) : candidates.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="p-6 text-center text-sm"
                >
                  No candidates
                </td>
              </tr>
            ) : (
              candidates.map((r, i) => (
                <tr
                  key={r.candidate_id || r.id || i}
                  className="border-t hover:bg-gray-50"
                >
                  <td className="px-3 py-2">{(page - 1) * limit + i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">
                      {r.first_name} {r.last_name}
                    </div>
                    {r.is_direct || r.source === "direct" ? (
                      <span className="text-xs bg-yellow-100 px-1 rounded ml-2">
                        Direct
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{r.email}</td>
                  <td className="px-3 py-2">{r.phone}</td>
                  <td className="px-3 py-2">
                    {r.current_title ||
                      `${Math.floor((r.experience_months || 0) / 12)} yrs`}
                  </td>
                  <td className="px-3 py-2">{r.location_city}</td>
                  <td className="px-3 py-2">
                    {r.applied_jobs_count ??
                      (Array.isArray(r.applied_jobs)
                        ? r.applied_jobs.length
                        : 0)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-sm">{r.status}</span>
                  </td>
                  <td className="px-3 py-2">{r.source}</td>
                  <td className="px-3 py-2">
                    {r.assigned_to_name || r.assigned_to}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2 items-center">
                      <button
                        className="text-xs px-2 py-1 bg-green-600 text-white rounded"
                        onClick={() => convertToEmployee(r)}
                        title="Convert to Employee"
                      >
                        To Employee
                      </button>

                      <button
                        className="text-xs px-2 py-1 bg-purple-600 text-white rounded"
                        onClick={() => convertToConsultant(r)}
                        title="Convert to Consultant"
                      >
                        To Consultant
                      </button>

                      <button
                        className="text-sm px-2 py-1 bg-blue-600 text-white rounded"
                        onClick={() =>
                          (window.location = `/candidates/${r.candidate_id || r.id}`)
                        }
                      >
                        View
                      </button>

                      {/* in-row actions */}
                      <CandidateActions
                        candidate={r}
                        onActionComplete={() =>
                          fetchCandidates({
                            page,
                            filters,
                            is_direct: isDirectFlag,
                          })
                        }
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* simple pagination */}
      <div className="mt-3 flex items-center justify-between">
        <div className="text-sm">Page {page}</div>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => handlePage(page - 1)}
            className="px-3 py-1 border rounded"
          >
            Prev
          </button>
          <button
            disabled={page * limit >= total}
            onClick={() => handlePage(page + 1)}
            className="px-3 py-1 border rounded"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
