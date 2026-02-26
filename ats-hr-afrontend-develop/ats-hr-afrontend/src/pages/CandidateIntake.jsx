// src/pages/CandidateIntake.jsx
import React, { useEffect, useState, useMemo, useRef } from "react";
import { formatDate } from "../utils/dateFormatter";
import { useParams } from "react-router-dom";
import api from "../api/axios";
import candidateService from "../services/candidateService";
import CallFeedbackDrawer from "../components/call-feedback/CallFeedbackDrawer";
import CallFeedbackHistory from "../components/call-feedback/CallFeedbackHistory";
import { getCandidateCallFeedback } from "../services/callFeedbackService";
import {
  ActivitySummary,
  ActivityBadge,
} from "../components/ActivityIndicator";
import {
  BULK_UPLOAD_LIMITS,
  validateBulkUploadFile,
} from "../utils/bulkUploadValidators";
import * as XLSX from "xlsx";
import PaginatedCardGrid from "../components/common/PaginatedCardGrid";
import usePersistedPagination from "../hooks/usePersistedPagination";

function EyeIcon({ className = "w-4 h-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PlusIcon({ className = "w-4 h-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function EditIcon({ className = "w-4 h-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function DeleteIcon({ className = "w-4 h-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export default function CandidateIntake() {
  const maxFileSizeMb = Math.round(
    BULK_UPLOAD_LIMITS.maxFileSizeBytes / (1024 * 1024),
  );
  const resumeMaxFiles = 50;
  const resumeMaxSizeBytes = 5 * 1024 * 1024;
  const resumeAllowedExts = [".pdf", ".doc", ".docx", ".zip"];
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [candidateError, setCandidateError] = useState("");
  const [filters, setFilters] = useState({
    name: "",
    email: "",
    applied_job: "",
    source: "",
    status: "",
  });
  const [selected, setSelected] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [showCallFeedbackDrawer, setShowCallFeedbackDrawer] = useState(false);
  const [feedbackCandidate, setFeedbackCandidate] = useState(null);
  const [feedbackInitialData, setFeedbackInitialData] = useState(null);
  const [showFeedbackHistory, setShowFeedbackHistory] = useState(false);
  const [sortBy, setSortBy] = useState("Date (Newest First)");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [verifying, setVerifying] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadErrors, setUploadErrors] = useState([]);
  const [bulkFileError, setBulkFileError] = useState("");
  const [showUploadErrorPopup, setShowUploadErrorPopup] = useState(false);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [isEditingCandidate, setIsEditingCandidate] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const historyPageSize = 10;
  const [showResumeUploadModal, setShowResumeUploadModal] = useState(false);
  const [resumeFiles, setResumeFiles] = useState([]);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeUploadProgress, setResumeUploadProgress] = useState(0);
  const [resumeUploadResult, setResumeUploadResult] = useState(null);
  const [resumeUploadLogs, setResumeUploadLogs] = useState(null);
  const [resumeUploadError, setResumeUploadError] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileValidationErrors, setFileValidationErrors] = useState([]);
  const [uploadedFilesSummary, setUploadedFilesSummary] = useState(null);
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [failedFiles, setFailedFiles] = useState([]);
  const [duplicateOptions, setDuplicateOptions] = useState("skip"); // skip, overwrite, merge
  const [asyncTaskId, setAsyncTaskId] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);
  const resumeUploadInputRef = useRef(null);
  const {
    page: candidatePage,
    setPage: setCandidatePage,
    limit: candidatePageSize,
    setLimit: setCandidatePageSize,
    pageSizeOptions: candidatePageSizeOptions,
  } = usePersistedPagination("candidates:intake");

  function formatPublicId(value) {
    if (!value) return "--";
    const normalized = String(value).trim().toUpperCase();
    if (!normalized) return "--";
    if (normalized.startsWith("TEMP-")) return "--";

    const match = normalized.match(/^([A-Z]{2,6})-C-(\d{1,})$/);
    if (!match) return "--";

    const org = match[1];
    const num = match[2];
    const padded = num.length >= 4 ? num : num.padStart(4, "0");
    return `${org}-C-${padded}`;
  }

  function deriveNameFromEmail(email) {
    if (!email || typeof email !== "string" || !email.includes("@")) return "";
    const local = email.split("@")[0] || "";
    const cleaned = local
      .toLowerCase()
      .replace(/\d+/g, " ")
      .replace(/[._-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) return "";
    const parts = cleaned.split(" ").slice(0, 4);
    return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
  }

  function deriveNameFromResumeFilename(path) {
    if (!path || typeof path !== "string") return "";
    const base = path.replace(/\\/g, "/").split("/").pop() || "";
    const withoutExt = base.replace(/\.[^/.]+$/, "");
    let cleaned = withoutExt.replace(/\(\d+\)\s*$/, "").trim();
    cleaned = cleaned.replace(/([a-z])([A-Z])/g, "$1 $2");
    cleaned = cleaned.replace(/[._-]+/g, " ");
    cleaned = cleaned.replace(
      /\b(resume|cv|profile|updated|final|latest)\b/gi,
      " ",
    );
    cleaned = cleaned.replace(/\s+/g, " ").trim();
    if (!cleaned || cleaned.length < 2) return "";

    // Avoid UUID-ish strings like "62C92949-5E76-4C5C..."
    if (/[0-9]{4,}/.test(cleaned) && cleaned.length > 12) return "";

    const parts = cleaned.split(" ").slice(0, 4);
    return parts
      .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : ""))
      .filter(Boolean)
      .join(" ");
  }

  function getCandidatePublicId(candidate) {
    return (
      candidate?.public_id ||
      candidate?.publicId ||
      candidate?.candidate_public_id ||
      candidate?.candidatePublicId ||
      candidate?.candidate_code ||
      candidate?.candidateCode ||
      candidate?.code ||
      ""
    );
  }

  const { id: candidateIdFromUrl } = useParams();

  useEffect(() => {
    fetchCandidates();
  }, []);

  useEffect(() => {
    refreshUploadHistory();
  }, []);

  useEffect(() => {
    if (candidateIdFromUrl && candidates.length > 0) {
      const candidate = candidates.find(
        (c) => c.id === candidateIdFromUrl || c._id === candidateIdFromUrl,
      );
      if (candidate) {
        setSelected(candidate);
      }
    }
  }, [candidateIdFromUrl, candidates]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  async function fetchCandidates() {
    setLoading(true);
    setCandidateError("");
    try {
      const res = await candidateService.listCandidates();
      console.log("Candidates loaded:", res?.length || 0);
      setCandidates(res || []);
    } catch (err) {
      console.error("Failed to fetch candidates:", err);
      console.error("Error details:", err.response?.data);
      console.error("Error status:", err.response?.status);
      setCandidateError("Failed to load candidates. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteCandidate(candidateId) {
    try {
      await api.delete(`/v1/candidates/${candidateId}`);
      // Remove the candidate from the local state
      setCandidates((prevCandidates) =>
        prevCandidates.filter((c) => (c.id || c._id) !== candidateId),
      );
      // Remove from selected if it was selected
      setSelectedIds((prevSelected) => {
        const newSelected = new Set(prevSelected);
        newSelected.delete(candidateId);
        return newSelected;
      });
      console.log("Candidate deleted successfully");
      alert("Candidate deleted successfully");
    } catch (err) {
      console.error("Failed to delete candidate:", err);

      // Handle different error types
      if (err.response?.status === 403) {
        alert(
          "Access denied: You don't have permission to delete candidates. Please contact your administrator.",
        );
      } else if (err.response?.status === 404) {
        alert("Candidate not found. It may have already been deleted.");
        // Remove from local state anyway since it doesn't exist
        setCandidates((prevCandidates) =>
          prevCandidates.filter((c) => (c.id || c._id) !== candidateId),
        );
        setSelectedIds((prevSelected) => {
          const newSelected = new Set(prevSelected);
          newSelected.delete(candidateId);
          return newSelected;
        });
      } else {
        const errorMsg =
          err.response?.data?.detail || err.message || "Unknown error occurred";
        alert(`Failed to delete candidate: ${errorMsg}. Please try again.`);
      }
    }
  }

  function handleEditCandidate(candidate) {
    setEditingCandidate({ ...candidate });
    setIsEditingCandidate(true);
  }

  async function saveCandidate() {
    try {
      const candidateId = editingCandidate.id || editingCandidate._id;
      await api.put(`/v1/candidates/${candidateId}`, {
        full_name: editingCandidate.full_name || editingCandidate.name,
        email: editingCandidate.email,
        phone: editingCandidate.phone,
        current_location: editingCandidate.current_location,
        current_address: editingCandidate.current_address,
        permanent_address: editingCandidate.permanent_address,
        skills: Array.isArray(editingCandidate.skills)
          ? editingCandidate.skills.join(", ")
          : editingCandidate.skills,
        experience:
          editingCandidate.experience_years || editingCandidate.experience,
        education: editingCandidate.education,
        current_employer: editingCandidate.current_employer,
        previous_employers: editingCandidate.previous_employers,
        notice_period: editingCandidate.notice_period,
        expected_salary:
          editingCandidate.expected_salary || editingCandidate.expectedCtc,
        preferred_location: editingCandidate.preferred_location,
        languages_known: editingCandidate.languages_known,
        linkedin_url: editingCandidate.linkedin_url,
        github_url: editingCandidate.github_url,
        source: editingCandidate.source,
        referral: editingCandidate.referral,
      });

      // Update the candidate in local state
      setCandidates((prevCandidates) =>
        prevCandidates.map((c) =>
          (c.id || c._id) === candidateId ? { ...c, ...editingCandidate } : c,
        ),
      );

      // Update the selected candidate if it's the one being edited
      if (selected && (selected.id || selected._id) === candidateId) {
        setSelected({ ...selected, ...editingCandidate });
      }

      setIsEditingCandidate(false);
      setEditingCandidate(null);
      console.log("Candidate updated successfully");
    } catch (err) {
      console.error("Failed to update candidate:", err);
      alert("Failed to update candidate. Please try again.");
    }
  }

  async function refreshUploadHistory() {
    setHistoryLoading(true);
    try {
      const res = await candidateService.getCandidateBulkUploadHistory();
      const next = Array.isArray(res) ? res : [];
      setUploadHistory(next);
      setHistoryPage(1);
    } catch (err) {
      console.error("Failed to fetch upload history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }

  function handleBulkFileChange(file) {
    const validation = validateBulkUploadFile(file);
    if (!validation.ok) {
      setBulkFile(null);
      setBulkFileError(validation.message);
      setShowUploadErrorPopup(true);
      return;
    }
    setBulkFile(file);
    setBulkFileError("");
  }

  async function submitBulkUpload() {
    const validation = validateBulkUploadFile(bulkFile);
    if (!validation.ok) {
      setBulkFileError(validation.message);
      setShowUploadErrorPopup(true);
      return;
    }

    setBulkUploading(true);
    setUploadProgress(0);
    setUploadResult(null);
    setUploadErrors([]);

    try {
      const res = await candidateService.bulkUploadCandidates(bulkFile, {
        onUploadProgress: (evt) => {
          if (!evt.total) return;
          const percent = Math.round((evt.loaded * 100) / evt.total);
          setUploadProgress(percent);
        },
      });
      setUploadResult(res);
      setUploadErrors(res.errors || []);
      if ((res.errors || []).length > 0) {
        setShowUploadErrorPopup(true);
      }
      await fetchCandidates();
      await refreshUploadHistory();
    } catch (err) {
      const errorMsg =
        err.response.data.message ||
        err.response.data.detail ||
        "Bulk upload failed. Please check your file and try again.";
      setBulkFileError(errorMsg);
      setShowUploadErrorPopup(true);
    } finally {
      setBulkUploading(false);
      setBulkFile(null);
    }
  }

  function validateResumeFile(file) {
    if (!file) return { ok: false, message: "File is required." };

    const ext = `.${file.name.split(".").pop()}`.toLowerCase();
    if (!resumeAllowedExts.includes(ext)) {
      return {
        ok: false,
        message: `Unsupported file type: ${ext}. Only PDF, DOC, DOCX, ZIP files are allowed.`,
      };
    }

    if (file.size > resumeMaxSizeBytes) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return {
        ok: false,
        message: `File "${file.name}" is too large (${sizeMB}MB). Maximum size is 5MB.`,
      };
    }

    if (file.size === 0) {
      return { ok: false, message: `File "${file.name}" is empty.` };
    }

    return { ok: true };
  }

  function handleResumeFiles(files = []) {
    const incoming = Array.from(files || []);
    if (incoming.length === 0) return;

    const errors = [];
    const validIncoming = [];

    // Reset prior results when selecting new files
    setResumeUploadResult(null);
    setUploadedFilesSummary(null);
    setFailedFiles([]);
    setAsyncTaskId(null);
    setResumeUploadProgress(0);

    // Validate each file
    for (const file of incoming) {
      const validation = validateResumeFile(file);
      if (!validation.ok) {
        errors.push({ file: file.name, message: validation.message });
      } else {
        validIncoming.push(file);
      }
    }

    const existing = Array.isArray(resumeFiles) ? resumeFiles : [];
    const remainingSlots = Math.max(0, resumeMaxFiles - existing.length);

    let filesToAdd = validIncoming;
    if (filesToAdd.length > remainingSlots) {
      filesToAdd = filesToAdd.slice(0, remainingSlots);
      errors.push({
        file: "Selection",
        message: `Only ${remainingSlots} more file(s) can be added (max ${resumeMaxFiles}).`,
      });
    }

    // Set files and errors
    setFileValidationErrors(errors);
    setResumeFiles([...existing, ...filesToAdd]);

    if (errors.length > 0) {
      setResumeUploadError(
        "Some files were skipped. Please review the messages below.",
      );
    } else {
      setResumeUploadError("");
    }
  }

  async function submitResumeUpload() {
    if (resumeFiles.length === 0) {
      setResumeUploadError("Please select at least one resume file.");
      return;
    }

    setResumeUploading(true);
    setResumeUploadProgress(0);
    setResumeUploadResult(null);
    setResumeUploadError("");
    setUploadedFilesSummary(null);

    try {
      // Use async upload for large batches (>10 files) or large total size
      const totalSize = resumeFiles.reduce((sum, file) => sum + file.size, 0);
      const useAsync = resumeFiles.length > 10 || totalSize > 50 * 1024 * 1024; // >50MB total

      if (useAsync) {
        // Start async upload and poll for progress
        const asyncRes = await candidateService.bulkResumeUploadCandidatesAsync(
          resumeFiles,
          {
            duplicateOption: duplicateOptions,
          },
        );

        setAsyncTaskId(asyncRes.task_id);

        // Start polling for progress
        const interval = setInterval(async () => {
          try {
            const status = await candidateService.getBulkUploadStatus(
              asyncRes.task_id,
            );

            if (status.status === "processing") {
              setResumeUploadProgress(status.progress || 0);
            } else if (status.status === "completed") {
              clearInterval(interval);
              setPollingInterval(null);
              setResumeUploadResult(status.result);

              // Process results for summary
              const summary = {
                total: status.result?.total_processed || resumeFiles.length,
                success: status.result?.success || 0,
                failed: status.result?.failed || 0,
                duplicates: status.result?.duplicates || 0,
                updated: status.result?.updated || 0,
                created:
                  status.result?.results?.filter((r) => r.status === "Created")
                    .length || 0,
              };

              setUploadedFilesSummary(summary);
              setResumeUploadLogs({
                created_at: new Date().toISOString(),
                task_id: asyncRes.task_id,
                duplicate_option: duplicateOptions,
                summary,
                results: status.result?.results || [],
              });
              setResumeUploading(false);
              setResumeUploadProgress(100);

              // Set failed files for retry
              if (status.result?.results) {
                const failed = status.result.results.filter(
                  (r) =>
                    r.status.includes("Failed") &&
                    !r.status.includes("Duplicate"),
                );
                setFailedFiles(failed);
              }

              await fetchCandidates();
            } else if (status.status === "failed") {
              clearInterval(interval);
              setPollingInterval(null);
              setResumeUploading(false);
              setResumeUploadError(
                `Upload failed: ${status.error || "Unknown error"}`,
              );
            }
          } catch (err) {
            console.error("Error polling task status:", err);
          }
        }, 2000); // Poll every 2 seconds

        setPollingInterval(interval);
      } else {
        // Use synchronous upload for smaller batches
        const res = await candidateService.bulkResumeUploadCandidates(
          resumeFiles,
          {
            duplicateOption: duplicateOptions,
            onUploadProgress: (evt) => {
              if (!evt.total) return;
              const percent = Math.round((evt.loaded * 100) / evt.total);
              setResumeUploadProgress(percent);
            },
          },
        );

        setResumeUploadResult(res);

        // Process results for better display
        const summary = {
          total: res.total_processed || resumeFiles.length,
          success: res.success || 0,
          failed: res.failed || 0,
          duplicates: res.duplicates || 0,
          updated: res.updated || 0,
          created:
            res.results?.filter((r) => r.status === "Created").length || 0,
        };

        setUploadedFilesSummary(summary);
        setResumeUploadLogs({
          created_at: new Date().toISOString(),
          duplicate_option: duplicateOptions,
          summary,
          results: res.results || [],
        });

        // Set failed files for retry option
        if (res.results) {
          const failed = res.results.filter(
            (r) =>
              r.status.includes("Failed") && !r.status.includes("Duplicate"),
          );
          setFailedFiles(failed);
        }

        await fetchCandidates();
        setResumeUploading(false);
      }
    } catch (err) {
      const errorMsg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Resume upload failed. Please check your files and try again.";
      setResumeUploadError(errorMsg);
      setResumeUploading(false);

      // Clear polling if it was started
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    }
  }

  function resetResumeUpload() {
    setResumeFiles([]);
    setResumeUploadResult(null);
    setResumeUploadError("");
    setFileValidationErrors([]);
    setUploadedFilesSummary(null);
    setFailedFiles([]);
    setResumeUploadProgress(0);
    setAsyncTaskId(null);

    // Clear any active polling
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  function removeFile(index) {
    const newFiles = resumeFiles.filter((_, i) => i !== index);
    setResumeFiles(newFiles);

    // Remove related validation errors
    const fileName = resumeFiles[index]?.name;
    if (fileName) {
      setFileValidationErrors((errors) =>
        errors.filter((error) => error.file !== fileName),
      );
    }

    if (newFiles.length === 0) {
      setResumeUploadError("");
      setFileValidationErrors([]);
    }
  }

  async function verifySelectedCandidates() {
    if (selectedIds.size === 0) {
      setBulkFileError("Please select at least one candidate to verify.");
      setShowUploadErrorPopup(true);
      return;
    }

    const confirm = window.confirm(
      `Verify ${selectedIds.size} candidate(s) and move to Candidate Pool-`,
    );
    if (!confirm) return;

    setVerifying(true);
    try {
      await candidateService.verifyCandidatesBulk(Array.from(selectedIds));
      setSelectedIds(new Set());
      await fetchCandidates();
    } catch (err) {
      const errorMsg =
        err.response.data.detail || "Failed to verify selected candidates.";
      setBulkFileError(errorMsg);
      setShowUploadErrorPopup(true);
    } finally {
      setVerifying(false);
    }
  }

  function exportSelectedCandidates() {
    if (selectedIds.size === 0) {
      setBulkFileError("Please select at least one candidate to export.");
      setShowUploadErrorPopup(true);
      return;
    }

    const rows = sortedCandidates
      .filter((c) => selectedIds.has(c.id ?? c._id))
      .map((c) => ({
        "Full Name": c.full_name || c.name || "",
        Email: c.email || "",
        Phone: c.phone || "",
        "Alternate Phone": c.alternate_phone || "",
        "Date of Birth": c.dob || c.date_of_birth || "",
        Gender: c.gender || "",
        "Marital Status": c.marital_status || "",
        "Current Company": c.current_employer || "",
        "Current Job Title": c.current_job_title || "",
        "Total Experience (Years)": c.experience_years ?? c.experience ?? "",
        "Relevant Experience (Years)": c.relevant_experience_years ?? "",
        "Current CTC": c.current_ctc ?? "",
        "Expected CTC": c.expected_ctc ?? c.expected_salary ?? "",
        "Notice Period (Days)": c.notice_period_days ?? c.notice_period ?? "",
        "Current Location": c.current_location || "",
        "Preferred Location": c.preferred_location || "",
        Skills: Array.isArray(c.skills) ? c.skills.join(", ") : c.skills || "",
        "Primary Skill": c.primary_skill || "",
        "Secondary Skill": c.secondary_skill || "",
        Qualification: c.qualification || "",
        "University/College": c.university || "",
        "Year of Graduation": c.graduation_year || "",
        Certifications: c.certifications_text || "",
        "Resume URL": c.resume_url || "",
        "LinkedIn URL": c.linkedin_url || "",
        "GitHub URL": c.github_url || "",
        "Portfolio URL": c.portfolio_url || "",
        Address: c.current_address || "",
        City: c.city || "",
        State: c.state || "",
        Country: c.country || "",
        Pincode: c.pincode || "",
        "Willing to Relocate (Yes/No)":
          c.willing_to_relocate === true
            ? "Yes"
            : c.willing_to_relocate === false
              ? "No"
              : "",
        "Preferred Employment Type": c.preferred_employment_type || "",
        "Availability to Join (Date)": c.availability_to_join || "",
        "Last Working Day": c.last_working_day || "",
        "Recruiter Notes": c.internal_notes || "",
        Source: c.source || "",
        Status: c.status || "",
        "Applied Job": c.job_title || "",
        "Created At": c.created_at || "",
      }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Candidates");
    XLSX.writeFile(wb, "selected_candidates.xlsx");
  }

  async function downloadBulkTemplate() {
    setBulkFileError("");
    try {
      const res = await api.get("/v1/candidates/bulk-template", {
        responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Candidate_Bulk_Upload_Template.xlsx";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const errorMsg =
        err.response.data.detail ||
        "Unable to download template. Please login and try again.";
      setBulkFileError(errorMsg);
    }
  }

  async function downloadErrorCsv(url) {
    if (!url) return;
    setBulkFileError("");
    try {
      const res = await api.get(url, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "text/csv" });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = "candidate_bulk_upload_errors.csv";
      link.click();
      window.URL.revokeObjectURL(link.href);
    } catch (err) {
      const errorMsg =
        err.response.data.detail ||
        "Unable to download error CSV. Please login and try again.";
      setBulkFileError(errorMsg);
      setShowUploadErrorPopup(true);
    }
  }

  const filteredCandidates = candidates.filter((c) => {
    const nameMatch =
      !filters.name ||
      (c.full_name || c.name || "")
        .toLowerCase()
        .includes(filters.name.toLowerCase());

    const emailMatch =
      !filters.email ||
      (c.email || "").toLowerCase().includes(filters.email.toLowerCase());

    const jobMatch =
      !filters.applied_job ||
      (c.job_title || "")
        .toLowerCase()
        .includes(filters.applied_job.toLowerCase());

    return nameMatch && emailMatch && jobMatch;
  });

  const sortedCandidates = useMemo(() => {
    const sorted = [...filteredCandidates];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "Name (A-Z)":
          const nameA = (a.full_name || a.name || "").toLowerCase();
          const nameB = (b.full_name || b.name || "").toLowerCase();
          return nameA.localeCompare(nameB);
        case "Name (Z-A)":
          const nameZA = (a.full_name || a.name || "").toLowerCase();
          const nameZB = (b.full_name || b.name || "").toLowerCase();
          return nameZB.localeCompare(nameZA);
        case "Email (A-Z)":
          const emailA = (a.email || "").toLowerCase();
          const emailB = (b.email || "").toLowerCase();
          return emailA.localeCompare(emailB);
        case "Email (Z-A)":
          const emailZA = (a.email || "").toLowerCase();
          const emailZB = (b.email || "").toLowerCase();
          return emailZB.localeCompare(emailZA);
        case "Date (Newest First)":
          return new Date(b.created_at) - new Date(a.created_at);
        case "Date (Oldest First)":
          return new Date(a.created_at) - new Date(b.created_at);
        default:
          return 0;
      }
    });
    return sorted;
  }, [filteredCandidates, sortBy]);

  const allSelected =
    sortedCandidates.length > 0 &&
    sortedCandidates.every((c) =>
      selectedIds.has(c.id ?? c._id ?? c.email ?? c.public_id),
    );
  const candidateTotalPages = Math.max(
    1,
    Math.ceil(sortedCandidates.length / Math.max(1, candidatePageSize)),
  );

  useEffect(() => {
    if (candidatePage > candidateTotalPages) {
      setCandidatePage(candidateTotalPages);
    }
  }, [candidatePage, candidateTotalPages, setCandidatePage]);

  useEffect(() => {
    setCandidatePage(1);
  }, [filters.name, filters.email, filters.applied_job, sortBy, setCandidatePage]);

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(
        new Set(
          sortedCandidates
            .map((c) => c.id ?? c._id ?? c.email ?? c.public_id)
            .filter(Boolean),
        ),
      );
    }
  }

  async function downloadResume(candidate) {
    const id = candidate.id || candidate._id;
    if (!id) return alert("Candidate ID missing");

    if (candidate.resume_url) {
      const rawUrl = String(candidate.resume_url).trim();
      const normalizedPath = rawUrl.replace(/\\/g, "/");
      const isAbsolute = /^https?:\/\//i.test(normalizedPath);
      const baseUrl =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      const normalized = normalizedPath.startsWith("/")
        ? normalizedPath
        : `/${normalizedPath}`;
      const finalUrl = isAbsolute ? normalizedPath : `${baseUrl}${normalized}`;
      window.open(encodeURI(finalUrl), "_blank", "noopener,noreferrer");
      return;
    }

    const res = await api.get(`/v1/candidates/${id}/resume/download`, {
      responseType: "blob",
    });

    const blob = new Blob([res.data]);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resume.pdf";
    a.click();
    window.URL.revokeObjectURL(url);
  }

  // Open feedback drawer and fetch latest feedback for candidate
  const openFeedbackDrawer = async (candidate) => {
    setFeedbackCandidate(candidate);

    const candidateId = candidate._id || candidate.id;
    if (!candidateId) {
      alert("Candidate ID missing");
      return;
    }

    try {
      const res = await getCandidateCallFeedback(candidateId);
      setFeedbackInitialData(res?.feedbacks?.[0] || null);
    } catch (e) {
      console.error("Failed to load feedback:", e);
      setFeedbackInitialData(null);
    }

    setShowFeedbackHistory(false);
    setShowCallFeedbackDrawer(true);
  };

  const openCandidateProfile = async (candidate) => {
    setShowCallFeedbackDrawer(false);
    setShowFeedbackHistory(false);

    const candidateId = candidate?.id || candidate?._id;
    if (!candidateId) {
      setSelected(candidate);
      return;
    }

    // Open immediately, then hydrate with full parsed data
    setSelected(candidate);
    try {
      const detail = await candidateService.getCandidateById(candidateId);
      if (detail) {
        setSelected({
          ...detail,
          job_title: candidate.job_title || detail.job_title,
        });
      }
    } catch (e) {
      console.error("Failed to fetch candidate details:", e);
    }
  };

  const historyTotalPages = Math.max(
    1,
    Math.ceil(uploadHistory.length / historyPageSize),
  );
  const historyStart = (historyPage - 1) * historyPageSize;
  const historyPageItems = uploadHistory.slice(
    historyStart,
    historyStart + historyPageSize,
  );
  return (
    <div className="space-y-6">
      {showResumeUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowResumeUploadModal(false)}
          />
          <div className="relative bg-white w-full max-w-4xl p-6 rounded-xl shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-800">
                Bulk Resume Upload
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowResumeUploadModal(false);
                  resetResumeUpload();
                }}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ×
              </button>
            </div>

            {/* Duplicate Handling Options */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duplicate Candidate Handling:
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="duplicateOption"
                    value="skip"
                    checked={duplicateOptions === "skip"}
                    onChange={(e) => setDuplicateOptions(e.target.value)}
                    className="mr-2"
                  />
                  Skip duplicates
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="duplicateOption"
                    value="overwrite"
                    checked={duplicateOptions === "overwrite"}
                    onChange={(e) => setDuplicateOptions(e.target.value)}
                    className="mr-2"
                  />
                  Update existing
                </label>
              </div>
            </div>

            {/* Enhanced Drag and Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                isDragOver
                  ? "border-purple-400 bg-purple-100"
                  : resumeFiles.length > 0
                    ? "border-green-300 bg-green-50"
                    : "border-purple-200 bg-purple-50"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                handleResumeFiles(e.dataTransfer.files);
              }}
            >
              <input
                id="resumeUploadInput"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.zip"
                className="hidden"
                ref={resumeUploadInputRef}
                onChange={(e) => {
                  handleResumeFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <div className="space-y-3">
                <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <div>
                  <label
                    htmlFor="resumeUploadInput"
                    className="cursor-pointer text-lg font-medium text-purple-700 hover:text-purple-800"
                  >
                    {isDragOver
                      ? "Drop files here"
                      : "Click to browse or drag and drop files"}
                  </label>
                  <p className="text-sm text-gray-600 mt-2">
                    Maximum {resumeMaxFiles} files • 5MB each • PDF, DOC, DOCX,
                    ZIP
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Tip: Select multiple files (Ctrl/Shift) or add more files
                    again anytime.
                  </p>
                </div>
              </div>
            </div>

            {/* File Validation Errors */}
            {fileValidationErrors.length > 0 && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="text-sm font-semibold text-red-800 mb-2">
                  File Validation Errors:
                </h4>
                <ul className="text-sm text-red-700 space-y-1">
                  {fileValidationErrors.map((error, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="text-red-500 mr-2">•</span>
                      <span>
                        <strong>{error.file}:</strong> {error.message}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Selected Files Preview */}
            {resumeFiles.length > 0 && (
              <div className="mt-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-t-lg">
                  <h4 className="text-sm font-semibold text-gray-800">
                    Selected Files ({resumeFiles.length}/{resumeMaxFiles})
                  </h4>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => resumeUploadInputRef.current?.click()}
                      className="text-xs text-purple-700 hover:text-purple-900 underline"
                    >
                      Add More
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResumeFiles([]);
                        setFileValidationErrors([]);
                        setResumeUploadError("");
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                <div className="max-h-48 overflow-auto">
                  {resumeFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                          <svg
                            className="w-4 h-4 text-blue-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800 truncate max-w-sm">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Remove file"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Error Display */}
            {resumeUploadError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start">
                  <svg
                    className="w-5 h-5 text-red-400 mt-0.5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 15.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                  <span className="text-sm text-red-700">
                    {resumeUploadError}
                  </span>
                </div>
              </div>
            )}

            {/* Upload Progress */}
            {resumeUploading && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {asyncTaskId
                      ? "Processing resumes in background..."
                      : "Processing resumes..."}
                  </span>
                  <span className="text-sm text-gray-600">
                    {resumeUploadProgress}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${resumeUploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500">
                  {asyncTaskId
                    ? `Task ID: ${asyncTaskId} - Please wait while we parse and extract information from your resumes...`
                    : "Please wait while we parse and extract information from your resumes..."}
                </p>
                {asyncTaskId && (
                  <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                    <strong>Large batch detected:</strong> Processing in
                    background for better performance. You can close this modal
                    and check progress later if needed.
                  </div>
                )}
              </div>
            )}

            {/* Upload Results Summary */}
            {uploadedFilesSummary && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-semibold text-blue-800 mb-3">
                  Upload Summary
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-800">
                      {uploadedFilesSummary.total}
                    </div>
                    <div className="text-gray-600">Total Files</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {uploadedFilesSummary.created}
                    </div>
                    <div className="text-gray-600">Created</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {uploadedFilesSummary.updated}
                    </div>
                    <div className="text-gray-600">Updated</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {uploadedFilesSummary.duplicates}
                    </div>
                    <div className="text-gray-600">Duplicates</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {uploadedFilesSummary.failed}
                    </div>
                    <div className="text-gray-600">Failed</div>
                  </div>
                </div>
              </div>
            )}

            {/* Detailed Results Table */}
            {resumeUploadResult &&
              resumeUploadResult.results &&
              resumeUploadResult.results.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">
                    Detailed Results
                  </h4>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="max-h-64 overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="p-3 text-left font-medium text-gray-700">
                              Resume
                            </th>
                            <th className="p-3 text-left font-medium text-gray-700">
                              Candidate ID
                            </th>
                            <th className="p-3 text-left font-medium text-gray-700">
                              Candidate Name
                            </th>
                            <th className="p-3 text-left font-medium text-gray-700">
                              Email
                            </th>
                            <th className="p-3 text-left font-medium text-gray-700">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {resumeUploadResult.results.map((row, idx) => (
                            <tr
                              key={`${row.resume}-${idx}`}
                              className="border-b border-gray-100"
                            >
                              <td
                                className="p-3 truncate max-w-xs"
                                title={row.resume}
                              >
                                {row.resume}
                              </td>
                              <td className="p-3 font-mono text-xs whitespace-nowrap">
                                {formatPublicId(
                                  row.candidate_id ||
                                    row.public_id ||
                                    row.publicId ||
                                    row.candidate_public_id ||
                                    row.candidatePublicId,
                                )}
                              </td>
                              <td className="p-3">{row.name || "--"}</td>
                              <td className="p-3">{row.email || "--"}</td>
                              <td className="p-3">
                                <span
                                  className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                    row.status === "Created"
                                      ? "bg-green-100 text-green-800"
                                      : row.status === "Updated"
                                        ? "bg-blue-100 text-blue-800"
                                        : row.status.includes("Duplicate")
                                          ? "bg-yellow-100 text-yellow-800"
                                          : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

            {/* Action Buttons */}
            <div className="mt-6 flex justify-between">
              <div>
                {failedFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowRetryModal(true)}
                    className="px-4 py-2 text-sm bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200"
                  >
                    Retry Failed ({failedFiles.length})
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  onClick={() => {
                    setShowResumeUploadModal(false);
                    resetResumeUpload();
                  }}
                >
                  {resumeUploadResult ? "Close" : "Cancel"}
                </button>
                {!resumeUploadResult && (
                  <button
                    type="button"
                    onClick={submitResumeUpload}
                    disabled={resumeUploading || resumeFiles.length === 0}
                    className="px-6 py-2 rounded-md bg-purple-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-purple-700 font-medium"
                  >
                    {resumeUploading
                      ? "Processing..."
                      : `Upload ${resumeFiles.length} Resume${resumeFiles.length !== 1 ? "s" : ""}`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Retry Failed Uploads Modal */}
      {showRetryModal && failedFiles.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowRetryModal(false)}
          />
          <div className="relative bg-white w-full max-w-2xl p-6 rounded-xl shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-red-700">
                Retry Failed Uploads
              </h3>
              <button
                type="button"
                onClick={() => setShowRetryModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                The following {failedFiles.length} file(s) failed to upload.
                Review the errors and decide how to proceed:
              </p>

              <div className="max-h-64 overflow-auto border border-gray-200 rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">File</th>
                      <th className="p-2 text-left">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedFiles.map((item, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-2">{item.resume}</td>
                        <td className="p-2 text-red-600">{item.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-2">
                  <strong>Common fixes:</strong>
                  <br />
                  • Check file format (PDF, DOC, DOCX only)
                  <br />
                  • Ensure files are under 5MB each
                  <br />• Verify files are not corrupted
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRetryModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRetryModal(false);
                    // User would need to re-select and re-upload fixed files
                    resetResumeUpload();
                  }}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
                >
                  Start Over
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ACTION BAR */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-white p-4 rounded shadow">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-600">
            Selected: <strong>{selectedIds.size}</strong>
          </span>
          <button
            type="button"
            onClick={downloadBulkTemplate}
            className="px-3 py-2 rounded-md bg-indigo-50 text-indigo-700 border"
          >
            Download Template
          </button>

          {bulkFile ? (
            <button
              type="button"
              onClick={submitBulkUpload}
              disabled={bulkUploading}
              className="bg-blue-600 text-white px-3 py-2 rounded disabled:bg-gray-300"
            >
              {bulkUploading ? "Uploading..." : "Upload"}
            </button>
          ) : (
            <label className="bg-gray-100 px-3 py-2 rounded cursor-pointer">
              Select Excel (.xlsx)
              <input
                type="file"
                hidden
                accept=".xlsx"
                onChange={(e) => handleBulkFileChange(e.target.files?.[0])}
              />
            </label>
          )}

          <button
            type="button"
            onClick={() => setShowResumeUploadModal(true)}
            className="px-3 py-2 rounded-md bg-purple-50 text-purple-700 border"
          >
            Upload Resumes
          </button>

          {bulkFile && (
            <>
              <span className="text-sm text-gray-600 flex items-center gap-2">
                Selected: <strong>{bulkFile.name}</strong>
                <button
                  type="button"
                  onClick={() => setBulkFile(null)}
                  className="text-xs px-2 py-1 border rounded"
                >
                  Clear
                </button>
              </span>
              <span className="text-sm text-gray-500">
                Max {maxFileSizeMb}MB - Max {BULK_UPLOAD_LIMITS.maxRows} rows
              </span>
            </>
          )}

          {bulkUploading && (
            <span className="text-xs text-gray-500">
              {uploadProgress}% uploaded
            </span>
          )}

          <button
            type="button"
            onClick={exportSelectedCandidates}
            disabled={selectedIds.size === 0}
            className="bg-gray-900 text-white px-4 py-2 rounded disabled:bg-gray-300"
          >
            Export Selected
          </button>

          <button
            type="button"
            onClick={verifySelectedCandidates}
            disabled={selectedIds.size === 0 || verifying}
            className="bg-emerald-600 text-white px-4 py-2 rounded disabled:bg-gray-300"
          >
            {verifying ? "Verifying..." : "Verify Selected"}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Sort by</span>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="
      px-3 py-1.5
      text-sm
      font-medium
      text-gray-700
      bg-gray-100
      border border-gray-200
      rounded-full
      cursor-pointer
      hover:bg-gray-200
      focus:outline-none
      focus:ring-0
      transition
    "
          >
            <option value="Date (Newest First)">Date (Newest First)</option>
            <option value="Date (Oldest First)">Date (Oldest First)</option>
            <option value="Name (A-Z)">Name (A-Z)</option>
            <option value="Name (Z-A)">Name (Z-A)</option>
            <option value="Email (A-Z)">Email (A-Z)</option>
            <option value="Email (Z-A)">Email (Z-A)</option>
          </select>
        </div>
      </div>

      {bulkFileError && (
        <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded">
          {bulkFileError}
        </div>
      )}

      {uploadResult && (
        <div className="bg-white p-4 rounded shadow space-y-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-sm">
              <span className="text-gray-500">Total Rows:</span>{" "}
              <strong>{uploadResult.total_rows}</strong>
            </div>
            <div className="text-sm text-green-700">
              <span className="text-gray-500">Success:</span>{" "}
              <strong>{uploadResult.success_count}</strong>
            </div>
            <div className="text-sm text-red-700">
              <span className="text-gray-500">Failed:</span>{" "}
              <strong>{uploadResult.failed_count}</strong>
            </div>

            {uploadHistory[0].error_csv_url && (
              <button
                type="button"
                onClick={() => downloadErrorCsv(uploadHistory[0].error_csv_url)}
                className="text-sm text-blue-600 underline"
              >
                Download Error CSV
              </button>
            )}
          </div>

          {uploadErrors.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border p-2 text-left">Row</th>
                    <th className="border p-2 text-left">Field</th>
                    <th className="border p-2 text-left">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadErrors.map((err, idx) => (
                    <tr key={`${err.row}-${err.field}-${idx}`}>
                      <td className="border p-2">{err.row}</td>
                      <td className="border p-2">{err.field}</td>
                      <td className="border p-2">{err.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-gray-600">No row errors reported.</div>
          )}
        </div>
      )}

      {showUploadErrorPopup && (bulkFileError || uploadErrors.length > 0) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowUploadErrorPopup(false)}
          />
          <div className="relative bg-white w-full max-w-lg p-5 rounded-lg shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Upload Errors</h3>
              <button
                onClick={() => setShowUploadErrorPopup(false)}
                className="text-lg"
              >
                x
              </button>
            </div>
            {bulkFileError && (
              <div className="text-sm text-red-700 mb-3">{bulkFileError}</div>
            )}
            {uploadErrors.length > 0 && (
              <div className="max-h-64 overflow-auto border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">Row</th>
                      <th className="p-2 text-left">Field</th>
                      <th className="p-2 text-left">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadErrors.map((err, idx) => (
                      <tr key={`${err.row}-${err.field}-${idx}`}>
                        <td className="p-2 border-t">{err.row}</td>
                        <td className="p-2 border-t">{err.field}</td>
                        <td className="p-2 border-t">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button
                className="px-4 py-2 border rounded"
                onClick={() => setShowUploadErrorPopup(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Cards */}
      <div className="bg-white p-4 rounded shadow space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={filters.name}
            onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))}
            className="w-full border-2 border-purple-300 px-3 py-2 text-sm bg-white rounded focus:border-emerald-400 focus:outline-none"
            placeholder="Filter by Name"
          />
          <input
            value={filters.email}
            onChange={(e) => setFilters((f) => ({ ...f, email: e.target.value }))}
            className="w-full border-2 border-purple-300 px-3 py-2 text-sm bg-white rounded focus:border-emerald-400 focus:outline-none"
            placeholder="Filter by Email"
          />
          <input
            value={filters.applied_job}
            onChange={(e) =>
              setFilters((f) => ({ ...f, applied_job: e.target.value }))
            }
            className="w-full border-2 border-purple-300 px-3 py-2 text-sm bg-white rounded focus:border-emerald-400 focus:outline-none"
            placeholder="Filter by Applied Job"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
            Select all filtered candidates
          </label>
          <span className="text-sm text-gray-600">Selected: {selectedIds.size}</span>
        </div>

        <PaginatedCardGrid
          items={sortedCandidates}
          totalPages={candidateTotalPages}
          currentPage={candidatePage}
          onPageChange={setCandidatePage}
          totalRecords={sortedCandidates.length}
          pageSize={candidatePageSize}
          onPageSizeChange={(nextSize) => {
            setCandidatePageSize(nextSize);
            setCandidatePage(1);
          }}
          pageSizeOptions={candidatePageSizeOptions}
          loading={loading}
          error={candidateError || null}
          onRetry={fetchCandidates}
          emptyMessage="No candidates"
          keyExtractor={(c) => c.id || c._id || c.email || c.public_id}
          renderCard={(c) => {
            const candidateKey = c.id || c._id || c.email || c.public_id;
            return (
              <article
                className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition"
                onClick={() => openCandidateProfile(c)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(candidateKey)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelect(candidateKey);
                      }}
                    />
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">
                        {c.full_name ||
                          c.name ||
                          c.parsed_data_json?.full_name ||
                          c.parsed_resume?.data?.full_name ||
                          deriveNameFromResumeFilename(c.resume_url || c.resume_path) ||
                          deriveNameFromEmail(c.email) ||
                          "--"}
                      </h3>
                      <div className="text-xs text-gray-500 font-mono">
                        {formatPublicId(getCandidatePublicId(c))}
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700">
                    {c.intake_status || c.status || "--"}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-gray-700">
                  <div><span className="text-gray-500">Email:</span> {c.email || "--"}</div>
                  <div><span className="text-gray-500">Phone:</span> {c.phone || "--"}</div>
                  <div><span className="text-gray-500">Applied Job:</span> {c.job_title || "--"}</div>
                  <div><span className="text-gray-500">Date:</span> {formatDate(c.created_at)}</div>
                </div>

                <div className="mt-3">
                  <ActivitySummary
                    lastActivityAt={c.last_activity_at}
                    lastActivityType={c.last_activity_type}
                    lastActivityRelative={c.last_activity_relative}
                    className="min-w-0"
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openCandidateProfile(c);
                    }}
                    title="View Candidate"
                    className="w-8 h-8 rounded-full hover:bg-indigo-100 text-indigo-600 inline-flex items-center justify-center"
                  >
                    <EyeIcon className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    className="w-8 h-8 rounded-full hover:bg-purple-100 text-purple-600 cursor-pointer inline-flex items-center justify-center"
                    title="Add Call Feedback"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(null);
                      if (showCallFeedbackDrawer && feedbackCandidate?.id === c.id) {
                        setShowCallFeedbackDrawer(false);
                      } else {
                        openFeedbackDrawer(c);
                      }
                    }}
                  >
                    <PlusIcon className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    className="w-8 h-8 rounded-full hover:bg-rose-100 text-rose-600 cursor-pointer inline-flex items-center justify-center"
                    title="View Feedback History"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(null);
                      const candidateId = c.id || c._id;
                      if (!candidateId) {
                        alert("Candidate ID missing");
                        return;
                      }
                      setFeedbackCandidate(c);
                      setShowCallFeedbackDrawer(false);
                      setShowFeedbackHistory(true);
                    }}
                  >
                    <EyeIcon className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    className="w-8 h-8 rounded-full hover:bg-blue-100 text-blue-600 cursor-pointer inline-flex items-center justify-center"
                    title="Edit Candidate"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditCandidate(c);
                    }}
                  >
                    <EditIcon className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    className="w-8 h-8 rounded-full hover:bg-red-100 text-red-600 cursor-pointer inline-flex items-center justify-center"
                    title="Delete Candidate"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        window.confirm(
                          `Are you sure you want to delete ${c.full_name || c.name || "this candidate"}?`,
                        )
                      ) {
                        deleteCandidate(c.id || c._id);
                      }
                    }}
                  >
                    <DeleteIcon className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    className="px-3 py-1 text-xs border rounded hover:bg-gray-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadResume(c);
                    }}
                  >
                    Resume
                  </button>
                </div>
              </article>
            );
          }}
        />
      </div>
      {/* UPLOAD HISTORY */}
      <div className="bg-white p-4 rounded shadow">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Upload History</h3>
          <button
            onClick={refreshUploadHistory}
            className="text-sm px-3 py-1 border rounded"
            disabled={historyLoading}
          >
            {historyLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {historyLoading ? (
          <div className="text-sm text-gray-500">Loading history...</div>
        ) : uploadHistory.length === 0 ? (
          <div className="text-sm text-gray-500">No uploads yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border p-2 text-left">Date</th>
                  <th className="border p-2 text-left">File</th>
                  <th className="border p-2 text-left">Total</th>
                  <th className="border p-2 text-left">Success</th>
                  <th className="border p-2 text-left">Failed</th>
                  <th className="border p-2 text-left">Errors</th>
                </tr>
              </thead>
              <tbody>
                {historyPageItems.map((item) => (
                  <tr key={item.id}>
                    <td className="border p-2">
                      {item.created_at
                        ? new Date(item.created_at).toLocaleString()
                        : "--"}
                    </td>
                    <td className="border p-2">{item.filename || "--"}</td>
                    <td className="border p-2">{item.total_rows}</td>
                    <td className="border p-2 text-green-700">
                      {item.success_count}
                    </td>
                    <td className="border p-2 text-red-700">
                      {item.failed_count}
                    </td>
                    <td className="border p-2">
                      {item.error_csv_url ? (
                        <button
                          type="button"
                          onClick={() => downloadErrorCsv(item.error_csv_url)}
                          className="text-blue-600 underline"
                        >
                          Download CSV
                        </button>
                      ) : (
                        "--"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {uploadHistory.length > historyPageSize && (
              <div className="flex items-center justify-between mt-3 text-sm">
                <span className="text-gray-500">
                  Page {historyPage} of {historyTotalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-1 border rounded disabled:opacity-50"
                    disabled={historyPage === 1}
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </button>
                  <button
                    className="px-3 py-1 border rounded disabled:opacity-50"
                    disabled={historyPage === historyTotalPages}
                    onClick={() =>
                      setHistoryPage((p) => Math.min(historyTotalPages, p + 1))
                    }
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* RESUME UPLOAD LOGS */}
      <div className="bg-white p-4 rounded shadow">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Resume Upload Logs</h3>
          {resumeUploadLogs?.created_at && (
            <span className="text-xs text-gray-500">
              Last upload:{" "}
              {new Date(resumeUploadLogs.created_at).toLocaleString()}
            </span>
          )}
        </div>

        {!resumeUploadLogs ||
        !Array.isArray(resumeUploadLogs.results) ||
        resumeUploadLogs.results.length === 0 ? (
          <div className="text-sm text-gray-500">No resume uploads yet.</div>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <div>
                <div className="text-xs text-gray-500">Total</div>
                <div className="font-semibold">
                  {resumeUploadLogs.summary?.total ??
                    resumeUploadLogs.results.length}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Created</div>
                <div className="font-semibold text-green-700">
                  {resumeUploadLogs.summary?.created ??
                    resumeUploadLogs.results.filter(
                      (r) => r.status === "Created",
                    ).length}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Updated</div>
                <div className="font-semibold text-blue-700">
                  {resumeUploadLogs.summary?.updated ?? 0}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Duplicates</div>
                <div className="font-semibold text-yellow-700">
                  {resumeUploadLogs.summary?.duplicates ?? 0}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Failed</div>
                <div className="font-semibold text-red-700">
                  {resumeUploadLogs.summary?.failed ?? 0}
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="p-3 text-left font-medium text-gray-700">
                        Candidate ID
                      </th>
                      <th className="p-3 text-left font-medium text-gray-700">
                        Resume
                      </th>
                      <th className="p-3 text-left font-medium text-gray-700">
                        Candidate Name
                      </th>
                      <th className="p-3 text-left font-medium text-gray-700">
                        Email
                      </th>
                      <th className="p-3 text-left font-medium text-gray-700">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumeUploadLogs.results.map((row, idx) => (
                      <tr
                        key={`${row.resume}-${idx}`}
                        className="border-b border-gray-100"
                      >
                        <td className="p-3 font-mono text-xs whitespace-nowrap">
                          {formatPublicId(
                            row.candidate_id ||
                              row.public_id ||
                              row.publicId ||
                              row.candidate_public_id ||
                              row.candidatePublicId,
                          )}
                        </td>
                        <td
                          className="p-3 truncate max-w-xs"
                          title={row.resume}
                        >
                          {row.resume}
                        </td>
                        <td className="p-3">
                          {row.name || deriveNameFromEmail(row.email) || "--"}
                        </td>
                        <td className="p-3">{row.email || "--"}</td>
                        <td className="p-3">
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              row.status === "Created"
                                ? "bg-green-100 text-green-800"
                                : row.status === "Updated"
                                  ? "bg-blue-100 text-blue-800"
                                  : row.status.includes("Duplicate")
                                    ? "bg-yellow-100 text-yellow-800"
                                    : row.status.includes("Failed")
                                      ? "bg-red-100 text-red-800"
                                      : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* MODAL */}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSelected(null)}
          />
          <div className="relative bg-white w-full max-w-2xl p-6 rounded-xl shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between mb-4">
              <h2 className="font-semibold text-lg">Candidate Profile</h2>
              <button onClick={() => setSelected(null)} className="text-lg">
                x
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <b>Name:</b>{" "}
                {selected.full_name ||
                  selected.name ||
                  selected.parsed_data_json?.full_name ||
                  selected.parsed_resume?.data?.full_name ||
                  deriveNameFromResumeFilename(
                    selected.resume_url || selected.resume_path,
                  ) ||
                  deriveNameFromEmail(selected.email) ||
                  "--"}
              </div>
              <div>
                <b>Candidate ID:</b>{" "}
                {formatPublicId(getCandidatePublicId(selected))}
              </div>
              <div>
                <b>Email:</b> {selected.email || "--"}
              </div>
              <div>
                <b>Phone:</b> {selected.phone || "--"}
              </div>
              <div>
                <b>Date of Birth:</b>{" "}
                {selected.dob || selected.date_of_birth || "--"}
              </div>
              <div>
                <b>Current Location:</b>{" "}
                {selected.current_location || selected.currentLocation || "--"}
              </div>
              <div>
                <b>City:</b> {selected.city || "--"}
              </div>
              <div>
                <b>Pincode:</b> {selected.pincode || "--"}
              </div>
              <div>
                <b>Current Address:</b>{" "}
                {selected.current_address || selected.currentAddress || "--"}
              </div>
              <div>
                <b>Permanent Address:</b>{" "}
                {selected.permanent_address ||
                  selected.permanentAddress ||
                  "--"}
              </div>
              <div>
                <b>Applied Job:</b> {selected.job_title || "--"}
              </div>
              <div>
                <b>Classification:</b> {selected.classification || "--"}
              </div>
              <div>
                <b>Source:</b> {selected.source || "--"}
              </div>
              <div>
                <b>Referral:</b> {selected.referral || "--"}
              </div>
              <div>
                <b>Skills:</b>{" "}
                {Array.isArray(selected.skills)
                  ? selected.skills.join(", ")
                  : selected.skills || "--"}
              </div>
              <div>
                <b>Experience (years):</b>{" "}
                {selected.experience_years || selected.experience || "--"}
              </div>
              <div>
                <b>Education:</b> {selected.education || "--"}
              </div>
              <div>
                <b>Current Employer:</b>{" "}
                {selected.current_employer || selected.currentEmployer || "--"}
              </div>
              <div>
                <b>Previous Employers:</b>{" "}
                {selected.previous_employers ||
                  selected.previousEmployers ||
                  "--"}
              </div>
              <div>
                <b>Notice Period:</b>{" "}
                {selected.notice_period || selected.noticePeriod || "--"}
              </div>
              <div>
                <b>Expected CTC:</b>{" "}
                {selected.expected_salary || selected.expectedCtc || "--"}
              </div>
              <div>
                <b>Preferred Location:</b>{" "}
                {selected.preferred_location ||
                  selected.preferredLocation ||
                  "--"}
              </div>
              <div>
                <b>Languages Known:</b>{" "}
                {selected.languages_known || selected.languagesKnown || "--"}
              </div>
              <div>
                <b>Ready to Relocate:</b>{" "}
                {selected.ready_to_relocate !== undefined
                  ? selected.ready_to_relocate
                    ? "Yes"
                    : "No"
                  : selected.readyToRelocate !== undefined
                    ? selected.readyToRelocate
                      ? "Yes"
                      : "No"
                    : "--"}
              </div>
              <div>
                <b>LinkedIn:</b>{" "}
                {selected.linkedin_url || selected.linkedinUrl || "--"}
              </div>
              <div>
                <b>GitHub:</b>{" "}
                {selected.github_url || selected.githubUrl || "--"}
              </div>{" "}
              {/* End of grid col */}
            </div>{" "}
            {/* End of grid */}
            {selected.parsed_data_json && (
              <div className="mt-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-800">
                    Parsed Resume Data
                  </h3>
                  <span className="text-xs text-gray-500">
                    (auto-extracted from resume)
                  </span>
                </div>
                {selected.parsed_data_json.resume_text && (
                  <div className="mb-3">
                    <div className="text-xs font-semibold text-gray-700 mb-1">
                      Resume Text (preview)
                    </div>
                    <div className="text-xs text-gray-700 whitespace-pre-wrap bg-white border border-gray-200 rounded p-2 max-h-40 overflow-auto">
                      {selected.parsed_data_json.resume_text}
                    </div>
                  </div>
                )}
                <pre className="text-xs bg-white border border-gray-200 rounded p-2 overflow-auto max-h-64">
                  {JSON.stringify(selected.parsed_data_json, null, 2)}
                </pre>
              </div>
            )}
            <div className="mt-6 flex justify-between">
              <button
                onClick={() => downloadResume(selected)}
                className="text-indigo-600 font-semibold"
              >
                Download Resume
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditCandidate(selected)}
                  className="bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className="bg-gray-100 px-4 py-1.5 rounded"
                >
                  Close
                </button>
              </div>
            </div>
          </div>{" "}
          {/* End of modal content */}
        </div>
      )}

      {/* Editing Modal */}
      {isEditingCandidate && editingCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setIsEditingCandidate(false);
              setEditingCandidate(null);
            }}
          />
          <div className="relative bg-white w-full max-w-4xl p-6 rounded-xl shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between mb-4">
              <h2 className="font-semibold text-lg">Edit Candidate Profile</h2>
              <button
                onClick={() => {
                  setIsEditingCandidate(false);
                  setEditingCandidate(null);
                }}
                className="text-lg"
              >
                x
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block font-semibold mb-1">Name:</label>
                <input
                  type="text"
                  value={
                    editingCandidate.full_name || editingCandidate.name || ""
                  }
                  onChange={(e) =>
                    setEditingCandidate({
                      ...editingCandidate,
                      full_name: e.target.value,
                      name: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  Candidate ID:
                </label>
                <input
                  type="text"
                  value={formatPublicId(getCandidatePublicId(editingCandidate))}
                  readOnly
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-100"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Email:</label>
                <input
                  type="email"
                  value={editingCandidate.email || ""}
                  onChange={(e) =>
                    setEditingCandidate({
                      ...editingCandidate,
                      email: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Phone:</label>
                <input
                  type="text"
                  value={editingCandidate.phone || ""}
                  onChange={(e) =>
                    setEditingCandidate({
                      ...editingCandidate,
                      phone: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  Current Location:
                </label>
                <input
                  type="text"
                  value={editingCandidate.current_location || ""}
                  onChange={(e) =>
                    setEditingCandidate({
                      ...editingCandidate,
                      current_location: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">City:</label>
                <input
                  type="text"
                  value={editingCandidate.city || ""}
                  onChange={(e) =>
                    setEditingCandidate({
                      ...editingCandidate,
                      city: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-semibold mb-1">
                  Current Address:
                </label>
                <textarea
                  value={editingCandidate.current_address || ""}
                  onChange={(e) =>
                    setEditingCandidate({
                      ...editingCandidate,
                      current_address: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2 h-20"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-semibold mb-1">Skills:</label>
                <input
                  type="text"
                  value={
                    Array.isArray(editingCandidate.skills)
                      ? editingCandidate.skills.join(", ")
                      : editingCandidate.skills || ""
                  }
                  onChange={(e) =>
                    setEditingCandidate({
                      ...editingCandidate,
                      skills: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="Comma separated skills"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  Experience (years):
                </label>
                <input
                  type="number"
                  value={
                    editingCandidate.experience_years ||
                    editingCandidate.experience ||
                    ""
                  }
                  onChange={(e) =>
                    setEditingCandidate({
                      ...editingCandidate,
                      experience_years: e.target.value,
                      experience: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Education:</label>
                <input
                  type="text"
                  value={editingCandidate.education || ""}
                  onChange={(e) =>
                    setEditingCandidate({
                      ...editingCandidate,
                      education: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  Current Employer:
                </label>
                <input
                  type="text"
                  value={editingCandidate.current_employer || ""}
                  onChange={(e) =>
                    setEditingCandidate({
                      ...editingCandidate,
                      current_employer: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  Expected CTC:
                </label>
                <input
                  type="text"
                  value={
                    editingCandidate.expected_salary ||
                    editingCandidate.expectedCtc ||
                    ""
                  }
                  onChange={(e) =>
                    setEditingCandidate({
                      ...editingCandidate,
                      expected_salary: e.target.value,
                      expectedCtc: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Source:</label>
                <select
                  value={editingCandidate.source || ""}
                  onChange={(e) =>
                    setEditingCandidate({
                      ...editingCandidate,
                      source: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="">Select Source</option>
                  <option value="Direct">Direct</option>
                  <option value="Referral">Referral</option>
                  <option value="Bulk Resume Upload">Bulk Resume Upload</option>
                  <option value="Portal">Portal</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">LinkedIn:</label>
                <input
                  type="url"
                  value={editingCandidate.linkedin_url || ""}
                  onChange={(e) =>
                    setEditingCandidate({
                      ...editingCandidate,
                      linkedin_url: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsEditingCandidate(false);
                  setEditingCandidate(null);
                }}
                className="bg-gray-100 px-6 py-2 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={saveCandidate}
                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Call Feedback Drawer */}
      {showCallFeedbackDrawer && (
        <CallFeedbackDrawer
          isOpen={showCallFeedbackDrawer}
          candidateId={feedbackCandidate.id || feedbackCandidate._id}
          candidateName={feedbackCandidate.full_name || feedbackCandidate.name}
          initialData={feedbackInitialData}
          onClose={() => setShowCallFeedbackDrawer(false)}
          onSuccess={() => setShowCallFeedbackDrawer(false)}
        />
      )}

      {/* Call Feedback History Modal */}
      {showFeedbackHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowFeedbackHistory(false)}
          />
          <div className="relative bg-white w-full max-w-4xl p-6 rounded-xl shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between mb-4">
              <h2 className="font-semibold text-lg">Call Feedback History</h2>
              <button
                onClick={() => setShowFeedbackHistory(false)}
                className="text-lg"
              >
                x
              </button>
            </div>
            <CallFeedbackHistory
              candidateId={feedbackCandidate._id || feedbackCandidate.id}
              onFeedbackSelect={(feedback) => {
                setFeedbackInitialData(feedback);
                setShowFeedbackHistory(false);
                setShowCallFeedbackDrawer(true);
              }}
              onAddNew={() => {
                setFeedbackInitialData(null);
                setShowFeedbackHistory(false);
                setShowCallFeedbackDrawer(true);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
