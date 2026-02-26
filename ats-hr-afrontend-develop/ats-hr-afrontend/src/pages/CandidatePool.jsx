import React, { useEffect, useMemo, useState } from "react";
import candidateService from "../services/candidateService";
import api from "../api/axios";
import * as XLSX from "xlsx";
import { useSearchParams, useNavigate } from "react-router-dom";

export default function CandidatePool() {
  const navigate = useNavigate();
  /* ======================
     DATA
  ====================== */
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* ======================
     INLINE FILTERS
  ====================== */
  const [filters, setFilters] = useState({
    name: "",
    email: "",
    classification: "",
  });

  /* ======================
     SELECTION
  ====================== */
  const [selectedIds, setSelectedIds] = useState(new Set());

  /* ======================
     PAGINATION
  ====================== */
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [total, setTotal] = useState(0);

  /* ======================
     CLASSIFICATION
  ====================== */
  const [selectedClassification, setSelectedClassification] = useState("");
  const [classifying, setClassifying] = useState(false);

  /* ======================
     BULK / MERGE / EMAIL
  ====================== */
  const [bulkConvertLoading, setBulkConvertLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");

  const [showMergePreview, setShowMergePreview] = useState(false);
  const [mergeLoading, setMergeLoading] = useState(false);

  const [showBulkEmail, setShowBulkEmail] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [searchParams] = useSearchParams();
  const attachJobUUID = searchParams.get("job_id");

  /* ======================
     LOAD DATA
  ====================== */
  useEffect(() => {
    fetchCandidates();
    // eslint-disable-next-line
  }, [filters, page]);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    try {
      const res = await api.get("/v1/client/master");
      setClients(res.data || []);
    } catch (err) {
      console.error("Failed to load clients", err);
    }
  }

  async function fetchCandidates() {
    setLoading(true);
    setError(null);
    try {
      const q = filters.email
        ? filters.email.trim()
        : filters.name
          ? filters.name.trim()
          : undefined;

      const params = {
        q, // ✅ backend uses ONLY this
        classification: filters.classification || undefined,
        status: "verified", // ✅ Only show verified candidates in pool
        page,
        limit: perPage,
      };

      const data = filters.classification
        ? await api.get("/v1/candidates/pool", { params }).then((r) => r.data)
        : await candidateService.listCandidates(params);

      // Additional client-side filter to ensure only verified candidates
      let candidateList = Array.isArray(data) ? data : (data?.items ?? []);
      const verifiedCandidates = candidateList.filter(
        (candidate) => candidate.status === "verified",
      );

      setCandidates(verifiedCandidates);
      setTotal(verifiedCandidates.length);
    } catch (err) {
      console.error(err);

      // Handle different error types
      if (err.response?.status === 403) {
        setError(
          "Access denied: You don't have permission to view the candidate pool. Please contact your administrator.",
        );
      } else if (err.response?.status === 404) {
        setError(
          "Candidate pool endpoint not found. Please check your configuration.",
        );
      } else {
        const errorMsg =
          err.response?.data?.detail || err.message || "Unknown error occurred";
        setError(`Failed to load candidates: ${errorMsg}`);
      }
    } finally {
      setLoading(false);
    }
  }

  /* ======================
     SORT (NEWEST FIRST)
  ====================== */
  const sortedCandidates = useMemo(() => {
    return [...candidates].sort(
      (a, b) =>
        new Date(b.created_at || b.updated_at || 0) -
        new Date(a.created_at || a.updated_at || 0),
    );
  }, [candidates]);

  const selectedCandidates = sortedCandidates.filter((c) =>
    selectedIds.has(c.id ?? c._id),
  );

  const allSelected =
    sortedCandidates.length > 0 &&
    sortedCandidates.every((c) => selectedIds.has(c.id ?? c._id));

  /* ======================
     SELECTION
  ====================== */
  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      console.log("SELECTED IDS =>", Array.from(n)); // 🔥 ADD THIS
      return n;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedCandidates.map((c) => c.id ?? c._id)));
    }
  }

  /* ======================
     CLASSIFICATION CONFIRM
  ====================== */
  async function confirmClassification() {
    if (selectedIds.size === 0 || !selectedClassification) {
      alert("Select candidates and classification");
      return;
    }

    if (
      !window.confirm(
        `Classify ${selectedIds.size} candidate(s) as ${selectedClassification}?`,
      )
    )
      return;

    setClassifying(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          api.put(`/v1/candidates/${id}/classification`, {
            classification: selectedClassification,
          }),
        ),
      );
      setSelectedClassification("");
      fetchCandidates();
    } finally {
      setClassifying(false);
    }
  }
  async function attachSelectedToJob() {
    if (!attachJobUUID) {
      alert("Job ID missing");
      return;
    }

    if (selectedIds.size === 0) {
      alert("Select at least one candidate");
      return;
    }

    try {
      // 🔥 ONE CALL PER CANDIDATE (backend expects single candidate)
      await Promise.all(
        Array.from(selectedIds).map((candidateId) =>
          api.post(`/v1/jobs/${attachJobUUID}/submissions`, {
            job_id: attachJobUUID,
            candidate_id: candidateId,
          }),
        ),
      );

      alert("Candidates successfully sent to Account Manager 🎉");
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Attach failed:", err.response?.data || err);
      alert("Failed to attach candidates");
    }
  }

  /* ======================
     BULK CONVERT (STRICT)
  ====================== */
  async function bulkConvert(type) {
    if (selectedIds.size === 0) {
      alert("Select candidates first");
      return;
    }

    if (type === "employee") {
      if (selectedCandidates.some((c) => c.classification !== "payroll")) {
        alert("Only Payroll candidates can be converted to Employee");
        return;
      }
    }

    if (type === "consultant") {
      if (
        selectedCandidates.some(
          (c) => !c.classification || c.classification === "unclassified",
        )
      ) {
        alert("Please classify candidate before converting to Consultant");
        return;
      }

      if (!selectedClientId) {
        alert("Please assign client");
        return;
      }
    }

    if (type === "consultant" && !selectedClientId) {
      alert("Please assign client");
      return;
    }

    if (!window.confirm(`Convert ${selectedIds.size} candidate(s) to ${type}?`))
      return;

    setBulkConvertLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          api.post(
            type === "employee"
              ? `/v1/employees/from-candidate/${id}`
              : `/v1/consultants/from-candidate/${id}`,
            type === "consultant" ? { client_id: selectedClientId } : undefined,
          ),
        ),
      );
      setSelectedIds(new Set());
      fetchCandidates();
    } finally {
      setBulkConvertLoading(false);
    }
  }

  /* ======================
     EXPORT
  ====================== */
  function exportCandidatesToExcel() {
    if (sortedCandidates.length === 0) return;

    const rows = sortedCandidates.map((c) => ({
      Name: c.full_name || "",
      Email: c.email || "",
      Phone: c.phone || "",
      Job: c.job_title || "",
      Classification: c.classification || "",
      Created: c.created_at ? new Date(c.created_at).toLocaleDateString() : "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Candidates");
    XLSX.writeFile(wb, "Candidate_Pool.xlsx");
  }

  /* ======================
     MERGE
  ====================== */
  function openMergePreview() {
    if (selectedIds.size < 2) {
      alert("Select at least two candidates");
      return;
    }
    setShowMergePreview(true);
  }

  async function confirmMerge() {
    console.log("MERGE CLICKED WITH IDS:", Array.from(selectedIds)); // 🔥 ADD
    if (selectedIds.size < 2) {
      alert("Select at least two candidates");
      return;
    }

    setMergeLoading(true);
    try {
      await candidateService.mergeCandidates({
        candidate_ids: Array.from(selectedIds),
      });

      // 🔥 RESET UI STATE
      setSelectedIds(new Set());
      setShowMergePreview(false);

      // 🔥 FORCE DATA REFRESH
      await fetchCandidates();

      alert("Candidates merged successfully ✅");
    } catch (err) {
      console.error("Merge failed:", err);
      alert("Merge failed ❌");
    } finally {
      setMergeLoading(false);
    }
  }

  /* ======================
     BULK EMAIL
  ====================== */
  async function sendBulkEmail() {
    if (!emailSubject || !emailBody) return;

    setEmailSending(true);
    try {
      const fd = new FormData();
      fd.append("subject", emailSubject);
      fd.append("message_body", emailBody);
      Array.from(selectedIds).forEach((id) => fd.append("candidate_ids", id));

      await api.post("/v1/candidates/email/send", fd);
      setShowBulkEmail(false);
      setEmailSubject("");
      setEmailBody("");
      setSelectedIds(new Set());
    } finally {
      setEmailSending(false);
    }
  }

  /* ======================
     RENDER
  ====================== */
  return (
    <div className="space-y-6 p-6 bg-gradient-to-br from-purple-50 via-purple-25 to-emerald-50 rounded-lg min-h-screen">
      <div className="bg-gradient-to-r from-purple-600 to-emerald-500 rounded-lg p-8 text-white shadow-lg flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold">Candidate Pool</h1>
          <p className="text-purple-100 mt-2">Manage and convert candidates</p>
        </div>
        <button
          onClick={() => navigate("/recruiter/assigned-jobs")}
          className="px-4 py-2 bg-white text-purple-600 font-semibold rounded hover:bg-gray-100 transition"
        >
          ← Back to Assigned Jobs
        </button>
      </div>

      {/* ACTION BAR */}
      <div className="flex flex-wrap gap-3 bg-white rounded-lg shadow-lg p-5 border border-purple-200">
        <button
          onClick={() => bulkConvert("employee")}
          disabled={!selectedIds.size || bulkConvertLoading}
          className="px-4 py-2 bg-gradient-to-r from-purple-100 to-purple-200 text-purple-700 rounded font-semibold disabled:opacity-50 hover:shadow-md transition"
        >
          Convert → Employee
        </button>

        <button
          onClick={() => bulkConvert("consultant")}
          disabled={!selectedIds.size || bulkConvertLoading}
          className="px-4 py-2 bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-700 rounded font-semibold disabled:opacity-50 hover:shadow-md transition"
        >
          Convert → Consultant
        </button>
        <select
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
          className="border-2 border-purple-300 px-3 py-2 rounded bg-white font-medium"
        >
          <option value="">Assign Client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company_name || c.name || c.email}
            </option>
          ))}
        </select>

        <select
          value={selectedClassification}
          onChange={(e) => setSelectedClassification(e.target.value)}
          className="border-2 border-purple-300 px-2 py-1 rounded bg-white font-medium"
        >
          <option value="">Set Classification</option>
          <option value="payroll">Payroll</option>
          <option value="sourcing">Sourcing</option>
        </select>

        <button
          onClick={confirmClassification}
          disabled={!selectedIds.size || !selectedClassification || classifying}
          className="px-4 py-2 bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-700 rounded font-semibold disabled:opacity-50 hover:shadow-md transition"
        >
          Confirm Classification
        </button>

        {attachJobUUID && (
          <button
            onClick={attachSelectedToJob}
            disabled={!selectedIds.size}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-emerald-500 text-white rounded font-semibold disabled:opacity-40 hover:shadow-md transition"
          >
            Attach Selected → Job
          </button>
        )}

        <button
          onClick={() => setShowBulkEmail(true)}
          disabled={!selectedIds.size}
          title="Bulk Email"
          className="
     p-2 rounded 
    bg-gradient-to-r from-red-500 to-red-600 text-white 
    border-2 border-red-600
    hover:shadow-md
    disabled:opacity-40
    transition
    font-semibold
  "
        >
          ✉️
        </button>

        <button
          onClick={exportCandidatesToExcel}
          className="px-4 py-2 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 border-2 border-gray-300 rounded font-semibold hover:shadow-md transition"
        >
          Export
        </button>

        <button
          onClick={() => {
            if (selectedIds.size < 2) {
              alert("Select at least two candidates");
              return;
            }

            if (
              window.confirm(
                "Are you sure you want to merge selected candidates?",
              )
            ) {
              confirmMerge();
            }
          }}
          disabled={mergeLoading}
          className="px-4 py-2 bg-gradient-to-r from-red-100 to-red-200 text-red-700 rounded font-semibold disabled:opacity-50 hover:shadow-md transition"
        >
          {mergeLoading ? "Merging..." : "Merge Selected"}
        </button>
      </div>

      {/* TABLE */}
      <div className="bg-white border-2 border-purple-200 rounded-lg shadow-lg overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gradient-to-r from-purple-50 to-emerald-50 border-b-2 border-purple-200">
            <tr>
              {/* SELECT ALL */}
              <th className="p-2 border-r border-purple-200 text-center w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="cursor-pointer w-4 h-4"
                />
              </th>

              {/* NAME FILTER */}
              <th className="p-2 border-r border-purple-200">
                <div className="relative">
                  <input
                    value={filters.name}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, name: e.target.value }))
                    }
                    className="w-full border-2 border-purple-300 px-2 py-2 text-sm bg-white rounded focus:border-emerald-400 focus:outline-none"
                  />
                  {!filters.name && (
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">
                      Name
                    </span>
                  )}
                </div>
              </th>

              {/* EMAIL FILTER */}
              <th className="p-2 border-r border-purple-200">
                <div className="relative">
                  <input
                    value={filters.email}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, email: e.target.value }))
                    }
                    className="w-full border-2 border-purple-300 px-2 py-2 text-sm bg-white rounded focus:border-emerald-400 focus:outline-none"
                  />
                  {!filters.email && (
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">
                      Email
                    </span>
                  )}
                </div>
              </th>

              {/* PHONE */}
              <th className="p-2 border-r border-purple-200 text-xs font-semibold text-center">
                Phone
              </th>

              {/* APPLIED JOB */}
              <th className="p-2 border-r border-purple-200 text-xs font-semibold text-center">
                Applied Job
              </th>

              {/* CLASSIFICATION FILTER */}
              <th className="p-2">
                <select
                  value={filters.classification}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      classification: e.target.value,
                    }))
                  }
                  className="w-full border-2 border-purple-300 px-2 py-2 text-sm bg-white rounded focus:border-emerald-400 focus:outline-none"
                >
                  <option value="">Classification</option>
                  <option value="payroll">Payroll</option>
                  <option value="sourcing">Sourcing</option>
                </select>
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="p-6 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td
                  colSpan="6"
                  className="p-6 text-center text-red-600 font-semibold"
                >
                  {error}
                </td>
              </tr>
            ) : sortedCandidates.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-6 text-center text-gray-500">
                  No candidates found
                </td>
              </tr>
            ) : (
              sortedCandidates.map((c, index) => {
                const realId = c.id ?? c._id;
                const rowKey = `${realId}-${index}`;

                return (
                  <tr
                    key={rowKey}
                    className="border-b border-purple-100 hover:bg-purple-25 transition"
                  >
                    <td className="p-2 border-r border-purple-100">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(realId)}
                        onChange={() => toggleSelect(realId)}
                        className="cursor-pointer w-4 h-4"
                      />
                    </td>
                    <td className="p-2 border-r border-purple-100 font-medium text-gray-900">
                      {c.full_name}
                    </td>
                    <td className="p-2 border-r border-purple-100 text-gray-700">
                      {c.email}
                    </td>
                    <td className="p-2 border-r border-purple-100 text-gray-700">
                      {c.phone || "—"}
                    </td>
                    <td className="p-2 border-r border-purple-100 text-gray-700">
                      {c.job_title || "—"}
                    </td>
                    <td className="p-2">
                      <span
                        className="px-2 py-1 bg-gradient-to-r from-purple-50 to-emerald-50/40

 text-purple-700 rounded text-xs font-semibold"
                      >
                        {c.classification || "—"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <div className="flex justify-between items-center text-sm bg-white rounded-lg shadow-lg p-4 border border-purple-200">
        <span className="text-gray-700 font-semibold">
          Showing {sortedCandidates.length} of {total}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1 border-2 border-purple-300 rounded font-semibold text-purple-700 hover:bg-purple-50 transition"
          >
            Prev
          </button>
          <span className="px-3 py-1 border-2 border-purple-300 rounded font-bold text-purple-700 bg-purple-50">
            {page}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 border-2 border-purple-300 rounded font-semibold text-purple-700 hover:bg-purple-50 transition"
          >
            Next
          </button>
        </div>
      </div>

      {/* MERGE + BULK EMAIL MODALS — unchanged */}
    </div>
  );
}
