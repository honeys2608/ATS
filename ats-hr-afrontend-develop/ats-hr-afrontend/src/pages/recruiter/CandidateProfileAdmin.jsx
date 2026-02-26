import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import candidateService from "../../services/candidateService";
import * as jobService from "../../services/jobService";
import CandidateCard from "../../components/candidate-profile/CandidateCard";
import CandidateDetail from "../../components/candidate-profile/CandidateDetail";
import CallFeedbackDrawer from "../../components/call-feedback/CallFeedbackDrawer";
import CustomMessagePanel from "../../components/semantic-search/CustomMessagePanel";
import { formatStatus } from "../../utils/formatStatus";
import {
  getCandidateApiId,
  mapCandidateToProfile,
} from "../../utils/candidateProfileUtils";
import BulkImportSection from "../../components/candidate/BulkImportSection";
import "./CandidateProfileAdmin.css";

const SENSITIVE_ROLES = new Set(["SUPER_ADMIN", "HIRING_MANAGER", "RECRUITER"]);
const RECRUITER_PROFILE_STATUSES = [
  "new",
  "applied",
  "sourced",
  "hold_revisit",
  "rejected_by_recruiter",
];
const CANDIDATE_LIST_LIMIT = 200;
const UPLOAD_SOURCE_KEYWORDS = [
  "resume upload",
  "bulk resume upload",
  "excel upload",
  "bulk upload",
];

const isUploadSourcedCandidate = (candidate) => {
  const source = String(candidate?.source || "").toLowerCase();
  return UPLOAD_SOURCE_KEYWORDS.some((keyword) => source.includes(keyword));
};

const IconMessage = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4 5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm0 2v9h16V7H4zm2 2h12v2H6V9zm0 4h8v2H6v-2z"
      fill="currentColor"
    />
  </svg>
);

const pickText = (...values) => {
  const invalidTokens = new Set([
    "n/a",
    "na",
    "none",
    "null",
    "undefined",
    "unknown",
    "unassigned",
    "--",
    "—",
    "-",
  ]);
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (!text) continue;
    if (invalidTokens.has(text.toLowerCase())) continue;
    return text;
  }
  return "";
};

const formatActionDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US");
};

const normalizeKey = (value) => String(value || "").trim().toLowerCase();
const normalizeTitle = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
const normalizeClient = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const toArrayPayload = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.candidates)) return payload.candidates;
  if (Array.isArray(payload?.requirements)) return payload.requirements;
  if (Array.isArray(payload?.jobs)) return payload.jobs;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data?.candidates)) return payload.data.candidates;
  if (Array.isArray(payload?.data?.requirements)) return payload.data.requirements;
  if (Array.isArray(payload?.data?.jobs)) return payload.data.jobs;
  return [];
};

const getCandidateKeys = (candidate = {}) =>
  [
    candidate?.id,
    candidate?._id,
    candidate?.candidate_id,
    candidate?.public_id,
    candidate?.publicId,
    candidate?.candidate?.id,
    candidate?.candidate?.candidate_id,
    candidate?.candidate?.public_id,
  ]
    .map(normalizeKey)
    .filter(Boolean);

const buildWorkflowMeta = (candidate, profile) => {
  const status = String(profile?.status || candidate?.status || "").trim();
  const roleName = pickText(
    candidate?.assignment_role,
    candidate?.requirement_title,
    candidate?.job_title,
    candidate?.applied_role,
    candidate?.applied_for,
    candidate?.requirement?.title,
    candidate?.requirement?.job_title,
    candidate?.job?.title,
    candidate?.job?.job_title,
    profile?.jobTitle,
    profile?.currentRole,
    profile?.designation,
  );
  const recruiterName = pickText(
    candidate?.recruiter_name,
    candidate?.recruiterName,
    candidate?.assigned_recruiter_name,
    candidate?.submitted_by_name,
    candidate?.submittedByName,
    candidate?.submission?.recruiter_name,
    candidate?.submission?.submitted_by_name,
    candidate?.submission?.recruiter?.name,
    candidate?.recruiter?.name,
    candidate?.owner_name,
    candidate?.owner?.name,
  );
  const amName = pickText(
    profile?.accountManager?.name,
    candidate?.assigned_by_name,
    candidate?.assigned_by,
    candidate?.am_name,
    candidate?.submitted_to_am_name,
    candidate?.accountManagerName,
    candidate?.account_manager_name,
    candidate?.account_manager?.name,
    candidate?.account_manager?.am_name,
    candidate?.submission?.account_manager_name,
    candidate?.submission?.account_manager?.name,
    candidate?.requirement?.account_manager_name,
    candidate?.requirement?.account_manager?.name,
    candidate?.job?.account_manager_name,
    candidate?.job?.account_manager?.name,
    candidate?.job?.assigned_by_name,
    candidate?.job?.assigned_by,
  );
  const clientName = pickText(
    candidate?.client_name,
    candidate?.client_display_name,
    candidate?.clientName,
    candidate?.company_name,
    candidate?.companyName,
    candidate?.client?.client_name,
    candidate?.client?.name,
    candidate?.submission?.client_name,
    candidate?.submission?.client?.client_name,
    candidate?.submission?.client?.name,
    candidate?.requirement?.client_name,
    candidate?.requirement?.client?.client_name,
    candidate?.requirement?.client?.name,
    candidate?.job?.client_name,
    candidate?.job?.client?.client_name,
    candidate?.job?.client?.name,
  );
  const actedBy = pickText(
    candidate?.last_action_by_name,
    candidate?.updated_by_name,
    candidate?.status_updated_by_name,
    candidate?.modified_by_name,
  );
  const actedOn = formatActionDate(
    candidate?.status_updated_at || candidate?.updated_at || candidate?.last_action_at,
  );

  return {
    statusRaw: status,
    statusLabel: status ? formatStatus(status) : "Unknown",
    roleName,
    recruiterName,
    amName,
    clientName,
    actedBy,
    actedOn,
  };
};

export default function CandidateProfileAdmin() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const autoOpenCandidateRef = useRef("");
  const jobAccountManagerCacheRef = useRef(new Map());
  const previewBlobUrlRef = useRef("");
  const deepLinkCandidateId = searchParams.get("candidateId");
  const viewOnlyMode = searchParams.get("viewOnly") === "1";
  const [allCandidates, setAllCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importLog, setImportLog] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCandidate, setDetailCandidate] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [resumePreviewUrl, setResumePreviewUrl] = useState("");
  const [resumePreviewSourceUrl, setResumePreviewSourceUrl] = useState("");
  const [isResumePreviewOpen, setIsResumePreviewOpen] = useState(false);
  const [resumePreviewLoading, setResumePreviewLoading] = useState(false);
  const [resumePreviewError, setResumePreviewError] = useState("");
  const [resumePreviewMode, setResumePreviewMode] = useState("pdf");
  const [resumePreviewHtml, setResumePreviewHtml] = useState("");
  const [resumePreviewText, setResumePreviewText] = useState("");
  const previewFrameUrl = useMemo(() => {
    if (!resumePreviewUrl) return "";
    const normalized = String(resumePreviewUrl).trim();
    if (!normalized) return "";
    if (normalized.startsWith("blob:")) return normalized;
    if (normalized.includes("#")) return normalized;
    if (normalized.toLowerCase().includes(".pdf")) {
      return `${normalized}#toolbar=1&navpanes=0&view=FitH`;
    }
    return normalized;
  }, [resumePreviewUrl]);

  const [showCallFeedbackDrawer, setShowCallFeedbackDrawer] = useState(false);
  const [feedbackCandidate, setFeedbackCandidate] = useState(null);
  const [feedbackInitialData, setFeedbackInitialData] = useState(null);

  const [messagePanel, setMessagePanel] = useState({
    open: false,
    recipient: "am",
    candidate: null,
  });

  const viewerRole = (localStorage.getItem("role") || "").toUpperCase();
  const canViewSensitive = SENSITIVE_ROLES.has(viewerRole);

  useEffect(() => {
    fetchAllCandidates();
  }, []);

  const normalizeId = (value) => String(value || "").trim().toLowerCase();
  const getExtensionFromUrl = (value = "") => {
    const source = String(value || "").trim();
    if (!source) return "";
    const withoutQuery = source.split("?")[0].split("#")[0];
    const dotIndex = withoutQuery.lastIndexOf(".");
    if (dotIndex < 0) return "";
    return withoutQuery.slice(dotIndex).toLowerCase();
  };
  const getExtensionFromDisposition = (value = "") => {
    const disposition = String(value || "").trim();
    if (!disposition) return "";
    const match = /filename\*?=(?:UTF-8'')?"?([^";\r\n]+)"?/i.exec(disposition);
    if (!match?.[1]) return "";
    try {
      const decoded = decodeURIComponent(match[1]);
      return getExtensionFromUrl(decoded);
    } catch {
      return getExtensionFromUrl(match[1]);
    }
  };
  const isPdfMagic = async (blob) => {
    if (!(blob instanceof Blob) || blob.size < 4) return false;
    const bytes = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    return (
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46
    );
  };
  const isZipMagic = async (blob) => {
    if (!(blob instanceof Blob) || blob.size < 4) return false;
    const bytes = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    return (
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      bytes[2] === 0x03 &&
      bytes[3] === 0x04
    );
  };

  const revokePreviewBlobUrl = () => {
    if (!previewBlobUrlRef.current) return;
    URL.revokeObjectURL(previewBlobUrlRef.current);
    previewBlobUrlRef.current = "";
  };

  const closeResumePreview = () => {
    setIsResumePreviewOpen(false);
    setResumePreviewLoading(false);
    setResumePreviewError("");
    setResumePreviewUrl("");
    setResumePreviewSourceUrl("");
    setResumePreviewMode("pdf");
    setResumePreviewHtml("");
    setResumePreviewText("");
    revokePreviewBlobUrl();
  };

  const handlePreviewResume = async (url, candidate) => {
    const sourceUrl = String(url || "").trim();
    const candidateApiId = getCandidateApiId(candidate);
    if (!sourceUrl && !candidateApiId) return;

    setIsResumePreviewOpen(true);
    setResumePreviewSourceUrl(sourceUrl);
    setResumePreviewError("");
    setResumePreviewLoading(true);
    setResumePreviewUrl("");
    setResumePreviewMode("pdf");
    setResumePreviewHtml("");
    setResumePreviewText("");
    revokePreviewBlobUrl();

    try {
      let response = null;
      if (candidateApiId) {
        try {
          response = await api.get(`/v1/candidates/${candidateApiId}/resume/download`, {
            responseType: "blob",
          });
        } catch {
          response = null;
        }
      }

      if (!response && sourceUrl) {
        response = await api.get(sourceUrl, { responseType: "blob" });
      }

      const blob = response?.data;
      if (!(blob instanceof Blob)) {
        throw new Error("Invalid preview payload");
      }

      const contentType = String(response?.headers?.["content-type"] || "").toLowerCase();
      const contentDisposition = String(
        response?.headers?.["content-disposition"] || "",
      ).toLowerCase();
      const extension =
        getExtensionFromDisposition(contentDisposition) || getExtensionFromUrl(sourceUrl);
      const isPdf =
        (await isPdfMagic(blob)) ||
        contentType.includes("application/pdf") ||
        extension === ".pdf";
      const isImage =
        contentType.startsWith("image/") ||
        [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(extension);
      const isText =
        contentType.startsWith("text/") ||
        extension === ".txt" ||
        extension === ".log";
      const looksLikeDocx =
        contentType.includes("wordprocessingml") ||
        extension === ".docx" ||
        ((await isZipMagic(blob)) && extension !== ".zip");

      if (isPdf) {
        const pdfBlob =
          blob.type === "application/pdf"
            ? blob
            : new Blob([blob], { type: "application/pdf" });
        const objectUrl = URL.createObjectURL(pdfBlob);
        previewBlobUrlRef.current = objectUrl;
        setResumePreviewMode("pdf");
        setResumePreviewUrl(objectUrl);
        return;
      }

      if (isImage) {
        const imageBlob =
          blob.type && blob.type.startsWith("image/")
            ? blob
            : new Blob([blob], {
                type: contentType || "image/png",
              });
        const objectUrl = URL.createObjectURL(imageBlob);
        previewBlobUrlRef.current = objectUrl;
        setResumePreviewMode("image");
        setResumePreviewUrl(objectUrl);
        return;
      }

      if (isText) {
        const text = await blob.text();
        setResumePreviewMode("text");
        setResumePreviewText(text || "No text content found in file.");
        return;
      }

      if (looksLikeDocx) {
        const mammoth = await import("mammoth");
        const arrayBuffer = await blob.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        const html = String(result?.value || "").trim();
        if (!html) {
          setResumePreviewError("DOCX parsed but no preview content was found.");
          setResumePreviewMode("unsupported");
          return;
        }
        setResumePreviewMode("html");
        setResumePreviewHtml(html);
        return;
      }

      if (extension === ".doc") {
        setResumePreviewMode("unsupported");
        setResumePreviewError(
          "DOC format is not supported for inline preview. Please open/download the file.",
        );
        return;
      }

      setResumePreviewMode("unsupported");
      setResumePreviewError("Unsupported file type for inline preview.");
    } catch (error) {
      console.error("Failed to load resume preview", error);
      setResumePreviewMode("unsupported");
      setResumePreviewError("Unable to render inline preview. Open in new tab instead.");
    } finally {
      setResumePreviewLoading(false);
    }
  };

  const fetchAllCandidates = async () => {
    try {
      setLoading(true);
      const [
        baseCandidatesRes,
        workflowCandidatesRes,
        assignedRequirementsRes,
        assignedJobsRes,
      ] =
        await Promise.allSettled([
          candidateService.listCandidates({ limit: CANDIDATE_LIST_LIMIT }),
          api.get("/workflow/candidates", { params: { limit: CANDIDATE_LIST_LIMIT } }),
          api.get("/v1/workflow/recruiter/requirements", { params: { scope: "assigned" } }),
          jobService.getAssignedJobs(),
        ]);

      const baseCandidates =
        baseCandidatesRes.status === "fulfilled"
          ? toArrayPayload(baseCandidatesRes.value)
          : [];
      const workflowCandidates =
        workflowCandidatesRes.status === "fulfilled"
          ? toArrayPayload(workflowCandidatesRes.value?.data)
          : [];
      const assignedRequirements =
        assignedRequirementsRes.status === "fulfilled"
          ? toArrayPayload(assignedRequirementsRes.value?.data)
          : [];
      const assignedJobs =
        assignedJobsRes.status === "fulfilled"
          ? toArrayPayload(assignedJobsRes.value?.data)
          : [];

      const assignedJobDetailById = new Map();
      const assignedJobDetailByTitle = new Map();
      const assignedJobIds = Array.from(
        new Set(
          assignedJobs
            .map((job) =>
              normalizeKey(
                job?.id ||
                  job?.job_id ||
                  job?.jobId ||
                  job?.requirement_id ||
                  job?.requirementId,
              ),
            )
            .filter(Boolean),
        ),
      );
      await Promise.allSettled(
        assignedJobIds.map(async (jobId) => {
          try {
            const detailRes = await api.get(`/v1/recruiter/assigned-jobs/${jobId}`);
            const detailPayload = detailRes?.data?.job || detailRes?.data || {};
            const accountManagerRaw =
              detailPayload?.account_manager || detailRes?.data?.account_manager || {};
            const normalizedDetail = {
              ...detailPayload,
              id: pickText(
                detailPayload?.id,
                detailPayload?.job_id,
                detailPayload?.requirement_id,
                jobId,
              ),
              job_id: pickText(
                detailPayload?.job_id,
                detailPayload?.id,
                detailPayload?.requirement_id,
                jobId,
              ),
              title: pickText(
                detailPayload?.title,
                detailPayload?.job_title,
                detailPayload?.requirement_title,
              ),
              client_name: pickText(
                detailPayload?.client_name,
                detailPayload?.client?.name,
                detailPayload?.client?.client_name,
                detailPayload?.company_name,
              ),
              account_manager: accountManagerRaw,
              account_manager_name: pickText(
                accountManagerRaw?.name,
                accountManagerRaw?.am_name,
                detailPayload?.account_manager_name,
                detailPayload?.assigned_by_name,
              ),
              account_manager_email: pickText(
                accountManagerRaw?.email,
                accountManagerRaw?.am_email,
                detailPayload?.account_manager_email,
              ),
              account_manager_id: pickText(
                accountManagerRaw?.id,
                accountManagerRaw?.am_id,
                detailPayload?.account_manager_id,
              ),
            };
            const detailId = normalizeKey(
              normalizedDetail?.id || normalizedDetail?.job_id || jobId,
            );
            if (detailId) assignedJobDetailById.set(detailId, normalizedDetail);
            const detailTitle = normalizeTitle(
              normalizedDetail?.title ||
                normalizedDetail?.job_title ||
                normalizedDetail?.requirement_title,
            );
            if (detailTitle) assignedJobDetailByTitle.set(detailTitle, normalizedDetail);
          } catch {
            // keep non-blocking, fall back to already loaded assigned-jobs list
          }
        }),
      );

      const workflowByCandidateId = new Map();
      const workflowByEmail = new Map();
      workflowCandidates.forEach((item) => {
        getCandidateKeys(item).forEach((key) => workflowByCandidateId.set(key, item));
        const emailKey = normalizeKey(item?.email || item?.candidate?.email);
        if (emailKey) workflowByEmail.set(emailKey, item);
      });

      const requirementById = new Map();
      const requirementByTitle = new Map();
      const assignedJobById = new Map();
      const assignedJobByTitle = new Map();
      const assignedJobsByRoleClient = new Map();
      const assignedJobsByRoleOnly = new Map();
      const amByClient = new Map();
      [...assignedRequirements, ...assignedJobs].forEach((req) => {
        const keys = [
          req?.id,
          req?._id,
          req?.job_id,
          req?.jobId,
          req?.requirement_id,
          req?.requirementId,
          req?.assigned_job_id,
          req?.requirement?.id,
          req?.job?.id,
          req?.job?.job_id,
          req?.requirement?.requirement_id,
        ]
          .map(normalizeKey)
          .filter(Boolean);
        keys.forEach((key) => requirementById.set(key, req));
        [
          req?.title,
          req?.job_title,
          req?.requirement_title,
          req?.role,
          req?.position_title,
          req?.requirement_code,
        ]
          .map(normalizeTitle)
          .filter(Boolean)
          .forEach((title) => requirementByTitle.set(title, req));
      });
      assignedJobs.forEach((job) => {
        const jobClientName = pickText(
          job?.client_name,
          job?.client?.client_name,
          job?.client?.name,
          job?.company_name,
        );
        const jobTitle = pickText(
          job?.title,
          job?.job_title,
          job?.requirement_title,
          job?.role,
          job?.position_title,
        );
        [
          job?.id,
          job?._id,
          job?.job_id,
          job?.jobId,
          job?.requirement_id,
          job?.requirementId,
        ]
          .map(normalizeKey)
          .filter(Boolean)
          .forEach((key) => assignedJobById.set(key, job));
        [job?.title, job?.job_title, job?.requirement_title, job?.role]
          .map(normalizeTitle)
          .filter(Boolean)
          .forEach((title) => assignedJobByTitle.set(title, job));
        const normalizedRole = normalizeTitle(jobTitle);
        const normalizedClient = normalizeClient(jobClientName);
        if (normalizedRole && normalizedClient) {
          const roleClientKey = `${normalizedRole}||${normalizedClient}`;
          if (!assignedJobsByRoleClient.has(roleClientKey)) {
            assignedJobsByRoleClient.set(roleClientKey, []);
          }
          assignedJobsByRoleClient.get(roleClientKey).push(job);
        }
        if (normalizedRole) {
          if (!assignedJobsByRoleOnly.has(normalizedRole)) {
            assignedJobsByRoleOnly.set(normalizedRole, []);
          }
          assignedJobsByRoleOnly.get(normalizedRole).push(job);
        }
        const mappedAmName = pickText(
          job?.assigned_by_name,
          job?.account_manager_name,
          job?.account_manager?.name,
          job?.account_manager?.am_name,
          job?.am?.name,
          job?.am?.am_name,
        );
        const mappedClient = normalizeClient(jobClientName);
        if (mappedAmName && mappedClient) {
          if (!amByClient.has(mappedClient)) amByClient.set(mappedClient, []);
          amByClient.get(mappedClient).push(mappedAmName);
        }
      });

      const list = baseCandidates.map((candidate) => {
        const workflowMatch =
          getCandidateKeys(candidate)
            .map((key) => workflowByCandidateId.get(key))
            .find(Boolean) ||
          workflowByEmail.get(normalizeKey(candidate?.email));

        const requirementId = normalizeKey(
          candidate?.requirement_id ||
            candidate?.job_id ||
            candidate?.applied_job_id ||
            candidate?.appliedJobId ||
            candidate?.assigned_job_id ||
            candidate?.submission?.job_id ||
            candidate?.submission?.requirement_id ||
            workflowMatch?.requirement_id ||
            workflowMatch?.job_id ||
            workflowMatch?.assigned_job_id ||
            workflowMatch?.submission?.job_id ||
            workflowMatch?.submission?.requirement_id,
        );
        const requirementTitle = normalizeTitle(
          candidate?.requirement_title ||
            candidate?.job_title ||
            candidate?.applied_role ||
            candidate?.applied_for ||
            candidate?.job?.title ||
            candidate?.job?.job_title ||
            workflowMatch?.requirement_title ||
            workflowMatch?.job_title ||
            workflowMatch?.applied_role ||
            workflowMatch?.applied_for ||
            workflowMatch?.job?.title ||
            workflowMatch?.job?.job_title ||
            candidate?.designation ||
            candidate?.current_designation ||
            candidate?.current_role ||
            candidate?.role,
        );
        const requirementMatch =
          requirementById.get(requirementId) || requirementByTitle.get(requirementTitle);
        const candidateClientNameForMatch = pickText(
          candidate?.client_name,
          candidate?.client?.client_name,
          candidate?.client?.name,
          workflowMatch?.client_name,
          workflowMatch?.client?.client_name,
          workflowMatch?.client?.name,
          requirementMatch?.client_name,
          requirementMatch?.client?.client_name,
          requirementMatch?.client?.name,
        );
        const candidateRoleForMatch = normalizeTitle(
          pickText(
            candidate?.requirement_title,
            candidate?.job_title,
            candidate?.applied_role,
            candidate?.applied_for,
            workflowMatch?.requirement_title,
            workflowMatch?.job_title,
            workflowMatch?.applied_role,
            workflowMatch?.applied_for,
            requirementMatch?.title,
            requirementMatch?.job_title,
            requirementMatch?.requirement_title,
            candidate?.designation,
            candidate?.current_designation,
          ),
        );
        const roleClientKey = `${candidateRoleForMatch}||${normalizeClient(candidateClientNameForMatch)}`;
        const clientAmFallback = (() => {
          const key = normalizeClient(candidateClientNameForMatch);
          const list = amByClient.get(key) || [];
          const unique = Array.from(new Set(list.filter(Boolean)));
          return unique.length === 1 ? unique[0] : "";
        })();
        const roleClientCandidates = assignedJobsByRoleClient.get(roleClientKey) || [];
        const roleOnlyCandidates = assignedJobsByRoleOnly.get(candidateRoleForMatch) || [];
        const inferredAssignedJobMatch =
          roleClientCandidates.length === 1
            ? roleClientCandidates[0]
            : roleOnlyCandidates.length === 1
              ? roleOnlyCandidates[0]
              : null;
        const assignedJobMatch =
          assignedJobDetailById.get(requirementId) ||
          assignedJobDetailById.get(
            normalizeKey(
              candidate?.applied_job_id ||
                candidate?.job_id ||
                candidate?.jobId ||
                workflowMatch?.job_id ||
                workflowMatch?.applied_job_id,
            ),
          ) ||
          assignedJobDetailByTitle.get(requirementTitle) ||
          inferredAssignedJobMatch ||
          assignedJobById.get(requirementId) ||
          assignedJobById.get(
            normalizeKey(
              candidate?.applied_job_id ||
                candidate?.job_id ||
                candidate?.jobId ||
                workflowMatch?.job_id ||
                workflowMatch?.applied_job_id,
            ),
          ) ||
          assignedJobByTitle.get(requirementTitle);

        const assignedRoleName = pickText(
          requirementMatch?.title,
          requirementMatch?.job_title,
          requirementMatch?.requirement_title,
          requirementMatch?.role,
          requirementMatch?.position_title,
          workflowMatch?.requirement_title,
          workflowMatch?.job_title,
          workflowMatch?.job?.title,
          workflowMatch?.job?.job_title,
          workflowMatch?.applied_role,
          workflowMatch?.applied_for,
          candidate?.requirement_title,
          candidate?.job_title,
          candidate?.applied_role,
          candidate?.applied_for,
          candidate?.job?.title,
          candidate?.job?.job_title,
        );

        const clientName = pickText(
          assignedJobMatch?.client_name,
          assignedJobMatch?.client?.name,
          assignedJobMatch?.client?.client_name,
          assignedJobMatch?.company_name,
          candidate?.client_name,
          candidate?.client?.client_name,
          candidate?.client?.name,
          candidate?.client?.company_name,
          workflowMatch?.client_name,
          workflowMatch?.client?.client_name,
          workflowMatch?.client?.name,
          workflowMatch?.client?.company_name,
          workflowMatch?.submission?.client_name,
          workflowMatch?.submission?.client?.client_name,
          workflowMatch?.submission?.client?.name,
          workflowMatch?.submission?.client?.company_name,
          workflowMatch?.requirement?.client_name,
          workflowMatch?.job?.client_name,
          requirementMatch?.client_name,
          requirementMatch?.client?.client_name,
          requirementMatch?.client?.name,
          requirementMatch?.client?.company_name,
          requirementMatch?.company,
          requirementMatch?.company_name,
        );

        const accountManagerName = pickText(
          assignedJobMatch?.assigned_by_name,
          assignedJobMatch?.assigned_by,
          assignedJobMatch?.account_manager?.name,
          assignedJobMatch?.account_manager?.am_name,
          assignedJobMatch?.am?.name,
          assignedJobMatch?.am?.am_name,
          assignedJobMatch?.assigned_am_name,
          assignedJobMatch?.account_manager_name,
          candidate?.account_manager_name,
          candidate?.account_manager?.name,
          candidate?.account_manager?.am_name,
          workflowMatch?.account_manager_name,
          workflowMatch?.account_manager?.name,
          workflowMatch?.account_manager?.am_name,
          workflowMatch?.am_name,
          workflowMatch?.submitted_to_am_name,
          workflowMatch?.submission?.account_manager_name,
          workflowMatch?.submission?.account_manager?.name,
          workflowMatch?.submission?.account_manager?.am_name,
          workflowMatch?.requirement?.account_manager_name,
          workflowMatch?.requirement?.account_manager?.name,
          workflowMatch?.job?.account_manager_name,
          workflowMatch?.job?.account_manager?.name,
          workflowMatch?.job?.account_manager?.am_name,
          requirementMatch?.account_manager?.name,
          requirementMatch?.account_manager?.am_name,
          requirementMatch?.assigned_am_name,
          requirementMatch?.assigned_by_name,
          requirementMatch?.assigned_by,
          requirementMatch?.am?.name,
          requirementMatch?.am?.am_name,
          requirementMatch?.am_name,
          requirementMatch?.account_manager_name,
          clientAmFallback,
        );

        const accountManagerEmail = pickText(
          assignedJobMatch?.account_manager?.email,
          assignedJobMatch?.account_manager?.am_email,
          assignedJobMatch?.am?.email,
          assignedJobMatch?.am?.am_email,
          assignedJobMatch?.account_manager_email,
          candidate?.account_manager_email,
          candidate?.account_manager?.email,
          candidate?.account_manager?.am_email,
          workflowMatch?.account_manager_email,
          workflowMatch?.account_manager?.email,
          workflowMatch?.account_manager?.am_email,
          workflowMatch?.submission?.account_manager_email,
          workflowMatch?.submission?.account_manager?.email,
          workflowMatch?.requirement?.account_manager_email,
          workflowMatch?.job?.account_manager_email,
          requirementMatch?.account_manager?.email,
          requirementMatch?.account_manager?.am_email,
          requirementMatch?.am?.email,
          requirementMatch?.am?.am_email,
          requirementMatch?.account_manager_email,
        );

        const accountManagerId = pickText(
          assignedJobMatch?.account_manager?.id,
          assignedJobMatch?.account_manager?.am_id,
          assignedJobMatch?.am?.id,
          assignedJobMatch?.am?.am_id,
          assignedJobMatch?.account_manager_id,
          candidate?.account_manager_id,
          candidate?.account_manager?.id,
          candidate?.account_manager?.am_id,
          workflowMatch?.account_manager_id,
          workflowMatch?.account_manager?.id,
          workflowMatch?.account_manager?.am_id,
          workflowMatch?.submission?.account_manager_id,
          workflowMatch?.submission?.account_manager?.id,
          workflowMatch?.requirement?.account_manager_id,
          workflowMatch?.job?.account_manager_id,
          requirementMatch?.account_manager?.id,
          requirementMatch?.account_manager?.am_id,
          requirementMatch?.am?.id,
          requirementMatch?.am?.am_id,
          requirementMatch?.account_manager_id,
        );

        return {
          ...workflowMatch,
          ...candidate,
          assignment_role: assignedRoleName || candidate?.assignment_role,
          requirement_title:
            assignedRoleName ||
            candidate?.requirement_title ||
            workflowMatch?.requirement_title,
          job_title:
            assignedRoleName || candidate?.job_title || workflowMatch?.job_title,
          client_name: clientName || candidate?.client_name,
          account_manager_name: accountManagerName || candidate?.account_manager_name,
          account_manager_email: accountManagerEmail || candidate?.account_manager_email,
          account_manager_id: accountManagerId || candidate?.account_manager_id,
          recruiter_name: pickText(
            candidate?.recruiter_name,
            workflowMatch?.recruiter_name,
            workflowMatch?.assigned_recruiter_name,
            workflowMatch?.submitted_by_name,
            workflowMatch?.submission?.recruiter_name,
            workflowMatch?.submission?.submitted_by_name,
          ),
          requirement: {
            ...(assignedJobMatch?.requirement || {}),
            ...(requirementMatch?.requirement || {}),
            ...(workflowMatch?.requirement || {}),
            ...(candidate?.requirement || {}),
            title: pickText(
              requirementMatch?.title,
              requirementMatch?.requirement_title,
              workflowMatch?.requirement?.title,
              workflowMatch?.requirement?.requirement_title,
              candidate?.requirement?.title,
            ),
            client_name: pickText(
              clientName,
              requirementMatch?.client_name,
              assignedJobMatch?.client_name,
              workflowMatch?.requirement?.client_name,
              candidate?.requirement?.client_name,
            ),
          },
          job: {
            ...(assignedJobMatch || {}),
            ...(requirementMatch?.job || {}),
            ...(workflowMatch?.job || {}),
            ...(candidate?.job || {}),
            title: pickText(
              requirementMatch?.title,
              requirementMatch?.job_title,
              assignedJobMatch?.title,
              assignedJobMatch?.job_title,
              workflowMatch?.job?.title,
              candidate?.job?.title,
              assignedRoleName,
            ),
            client_name: pickText(
              clientName,
              requirementMatch?.job?.client_name,
              assignedJobMatch?.client_name,
              workflowMatch?.job?.client_name,
              candidate?.job?.client_name,
            ),
          },
          account_manager: {
            ...(workflowMatch?.account_manager || {}),
            ...(candidate?.account_manager || {}),
            name: accountManagerName || candidate?.account_manager?.name,
            am_name: accountManagerName || candidate?.account_manager?.am_name,
            email: accountManagerEmail || candidate?.account_manager?.email,
            am_email: accountManagerEmail || candidate?.account_manager?.am_email,
            id: accountManagerId || candidate?.account_manager?.id,
            am_id: accountManagerId || candidate?.account_manager?.am_id,
          },
        };
      });

      // Newest parsed/imported first: sort by created_at desc fallback to updated_at
      const sorted = [...list].sort((a, b) => {
        const aDate = new Date(a.created_at || a.updated_at || 0).getTime();
        const bDate = new Date(b.created_at || b.updated_at || 0).getTime();
        return bDate - aDate;
      });
      setAllCandidates(sorted);
    } catch (error) {
      console.error("Error fetching candidates", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const requestedId = normalizeId(deepLinkCandidateId);
    if (!requestedId) {
      autoOpenCandidateRef.current = "";
      return;
    }
    if (autoOpenCandidateRef.current === requestedId) return;
    if (loading) return;

    const matchedEntry = allCandidates.find((candidate) => {
      const candidateIds = [
        getCandidateApiId(candidate),
        candidate?.id,
        candidate?._id,
        candidate?.candidate_id,
        candidate?.public_id,
        candidate?.publicId,
      ];
      return candidateIds.some((candidateId) => {
        return normalizeId(candidateId) === requestedId;
      });
    });

    if (matchedEntry) {
      autoOpenCandidateRef.current = requestedId;
      openDetail(matchedEntry);
      return;
    }

    autoOpenCandidateRef.current = requestedId;
    (async () => {
      try {
        setDetailLoading(true);
        const detail = await candidateService.getCandidateById(deepLinkCandidateId);
        if (detail) {
          setDetailOpen(true);
          setDetailCandidate(detail);
        }
      } catch (error) {
        console.error("Failed to open deep-linked candidate", error);
      } finally {
        setDetailLoading(false);
      }
    })();
  }, [allCandidates, deepLinkCandidateId, loading]);

  useEffect(() => {
    return () => {
      revokePreviewBlobUrl();
    };
  }, []);

  const profileEntries = useMemo(
    () =>
      allCandidates
        .map((candidate) => {
          const profile = mapCandidateToProfile(candidate, canViewSensitive);
          if (!profile) {
            return {
              candidate,
              profile: null,
            };
          }

          const normalizedStatus = String(profile.status || "")
            .toLowerCase()
            .trim();
          if (
            (normalizedStatus === "new" || normalizedStatus === "verified") &&
            isUploadSourcedCandidate(candidate)
          ) {
            profile.status = "sourced";
          }

          return {
            candidate,
            profile,
          };
        })
        .filter((entry) => entry.profile),
    [allCandidates, canViewSensitive],
  );

  const filteredEntries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return profileEntries.filter(({ profile }) => {
      const normalizedStatus = String(profile.status || "").toLowerCase().trim();

      const matchesStatus = statusFilter
        ? normalizedStatus === statusFilter.toLowerCase()
        : true;
      const matchesSearch = term
        ? [
            profile.name,
            profile.email,
            profile.phone,
            profile.location,
            ...(Array.isArray(profile.skills)
              ? profile.skills.map((s) => s.name || s)
              : []),
          ]
            .filter(Boolean)
            .some((field) => String(field).toLowerCase().includes(term))
        : true;
      return matchesStatus && matchesSearch;
    });
  }, [profileEntries, searchTerm, statusFilter]);

  const statusOptions = useMemo(() => {
    const dynamicStatuses = new Set();
    profileEntries.forEach(({ profile }) => {
      const value = String(profile?.status || "").toLowerCase().trim();
      if (value) dynamicStatuses.add(value);
    });

    const ordered = [
      ...RECRUITER_PROFILE_STATUSES,
      ...Array.from(dynamicStatuses).filter(
        (status) => !RECRUITER_PROFILE_STATUSES.includes(status),
      ),
    ];

    return ordered.map((status) => ({
      value: status,
      label: formatStatus(status),
    }));
  }, [profileEntries]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectAllFiltered = () => {
    setSelectedIds(
      new Set(filteredEntries.map(({ profile }) => profile.id || profile._id)),
    );
  };

  const selectedCount = selectedIds.size;

  const exportCsv = () => {
    const rowsSource =
      selectedCount > 0
        ? filteredEntries.filter(({ profile }) =>
            selectedIds.has(profile.id || profile._id),
          )
        : filteredEntries;
    if (rowsSource.length === 0) {
      alert("No candidates to export.");
      return;
    }
    const headers = [
      "Name",
      "Email",
      "Phone",
      "Status",
      "Experience",
      "Notice Period",
      "Location",
      "Skills",
    ];
    const rows = rowsSource.map(({ profile }) => [
      profile.name || "",
      profile.email || "",
      profile.phone || "",
      profile.status || "",
      profile.totalExperience || "",
      profile.noticePeriod || "",
      profile.location || "",
      Array.isArray(profile.skills)
        ? profile.skills.map((s) => s.name || s).join(", ")
        : "",
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "candidates.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const detailProfile = detailCandidate
    ? mapCandidateToProfile(detailCandidate, canViewSensitive)
    : null;

  const openDetail = async (candidate) => {
    if (!candidate) return;
    setDetailOpen(true);
    setDetailCandidate(candidate);
    const apiId = getCandidateApiId(candidate);
    if (!apiId) return;
    try {
      setDetailLoading(true);
      const detail = await candidateService.getCandidateById(apiId);
      setDetailCandidate({ ...candidate, ...(detail || {}) });
    } catch (error) {
      console.error("Failed to load candidate detail", error);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailCandidate(null);
    closeResumePreview();
    if (deepLinkCandidateId || viewOnlyMode) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("candidateId");
      nextParams.delete("viewOnly");
      setSearchParams(nextParams, { replace: true });
      autoOpenCandidateRef.current = "";
    }
  };

  const scheduleInterview = (candidate) => {
    const apiId = getCandidateApiId(candidate);
    const query = apiId ? `?candidateId=${apiId}` : "";
    navigate(`/recruiter/interviews/calendar${query}`);
  };

  const shortlistCandidate = async (candidate) => {
    const apiId = getCandidateApiId(candidate);
    if (!apiId) return;
    try {
      await candidateService.updateStatus(apiId, { status: "shortlisted" });
      fetchAllCandidates();
    } catch (error) {
      console.error("Failed to shortlist candidate", error);
    }
  };

  const sendToAccountManager = async (candidate) => {
    const apiId = getCandidateApiId(candidate);
    if (!apiId) return;
    try {
      await api.post(`/v1/candidate-workflow/${apiId}/send-to-am`);
      alert("Candidate sent to Account Manager successfully!");
      fetchAllCandidates();
      closeDetail();
    } catch (error) {
      console.error("Failed to send to Account Manager", error);
      alert("Failed to send candidate to Account Manager");
    }
  };

  const updateCandidateStatus = async (candidate, nextStatus) => {
    const target = candidate || detailCandidate;
    const apiId = getCandidateApiId(target);
    if (!apiId) {
      return { ok: false, message: "Candidate ID not found" };
    }
    if (!nextStatus) {
      return { ok: false, message: "Please select a valid status" };
    }

    try {
      await api.put(`/v1/workflow/candidates/${apiId}/status`, {
        new_status: nextStatus,
        notes: "Status updated from recruiter candidate profile",
      });

      await fetchAllCandidates();

      if (detailCandidate && getCandidateApiId(detailCandidate) === apiId) {
        const detail = await candidateService.getCandidateById(apiId);
        setDetailCandidate((prev) => ({ ...(prev || {}), ...(detail || {}) }));
      }

      return { ok: true };
    } catch (error) {
      console.error("Failed to update candidate status", error);
      return {
        ok: false,
        message: error?.response?.data?.detail || "Failed to update status",
      };
    }
  };

  const openFeedbackDrawer = (candidate, feedback = null) => {
    setFeedbackCandidate(candidate);
    setFeedbackInitialData(feedback || null);
    setShowCallFeedbackDrawer(true);
  };

  const refreshDetailCandidate = async () => {
    if (!detailCandidate) return;
    const apiId = getCandidateApiId(detailCandidate);
    if (!apiId) return;
    try {
      const detail = await candidateService.getCandidateById(apiId);
      setDetailCandidate((prev) => ({ ...(prev || {}), ...(detail || {}) }));
    } catch (error) {
      console.error("Failed to refresh candidate detail", error);
    }
  };

  const resolveAccountManagerFromCandidate = (candidate) => ({
    id:
      candidate?.account_manager_id ||
      candidate?.account_manager?.id ||
      candidate?.account_manager?.am_id ||
      "",
    name:
      candidate?.account_manager_name ||
      candidate?.account_manager?.name ||
      candidate?.account_manager?.am_name ||
      "",
    email:
      candidate?.account_manager_email ||
      candidate?.account_manager?.email ||
      candidate?.account_manager?.am_email ||
      "",
  });

  const hydrateCandidateAccountManager = async (candidate) => {
    if (!candidate) return candidate;
    const mapped = resolveAccountManagerFromCandidate(candidate);
    if (mapped.id || mapped.email || mapped.name) return candidate;

    const jobId =
      candidate?.applied_job_id ||
      candidate?.job_id ||
      candidate?.jobId ||
      "";
    if (!jobId) return candidate;

    const cached = jobAccountManagerCacheRef.current.get(jobId);
    if (cached) {
      return { ...candidate, ...cached };
    }

    try {
      const res = await api.get(`/v1/recruiter/assigned-jobs/${jobId}`);
      const am = res?.data?.account_manager || {};
      const patch = {
        account_manager_id: am.am_id || "",
        account_manager_name: am.am_name || "",
        account_manager_email: am.am_email || "",
        job_title: candidate?.job_title || res?.data?.title || "",
      };
      jobAccountManagerCacheRef.current.set(jobId, patch);
      return { ...candidate, ...patch };
    } catch (error) {
      return candidate;
    }
  };

  const handleOpenMessagePanel = async (candidate, recipient) => {
    if (!candidate) return;
    const enriched =
      recipient === "am"
        ? await hydrateCandidateAccountManager(candidate)
        : candidate;
    setMessagePanel({ open: true, recipient, candidate: enriched });
  };

  const handleSendMessage = async (message) => {
    const target = messagePanel.candidate;
    const apiId = getCandidateApiId(target);
    if (!apiId) {
      throw new Error("Candidate ID not found");
    }

    const deliveryMode = message?.deliveryMode || "email";
    const shouldSendEmail =
      deliveryMode === "email" || deliveryMode === "both";
    const shouldSendPortalNote =
      deliveryMode === "portal_note" || deliveryMode === "both";
    const recipient = message?.recipient || messagePanel.recipient || "candidate";
    const subject = String(message?.subject || "").trim();
    const body = String(message?.body || "").trim();
    const to = String(message?.to || "").trim();
    const cc = String(message?.cc || "").trim();

    if (!body) {
      throw new Error("Message body is required");
    }

    if (shouldSendPortalNote) {
      const recipientLabel = recipient === "am" ? "Account Manager" : "Candidate";
      const noteText = subject
        ? `[Message to ${recipientLabel}] ${subject}\n${body}`
        : `[Message to ${recipientLabel}] ${body}`;
      await candidateService.addCandidateNote(apiId, { note: noteText });
    }

    if (shouldSendEmail) {
      if (recipient === "candidate") {
        const form = new FormData();
        form.append("subject", subject || "Candidate Update");
        form.append("message_body", body);
        form.append("candidate_ids", apiId);
        await api.post("/v1/candidates/email/send", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        const am = resolveAccountManagerFromCandidate(target);
        const recipientEmail = to || am.email;
        if (!recipientEmail) {
          throw new Error("Account Manager email is not mapped for this job");
        }
        const query = new URLSearchParams();
        if (subject) query.set("subject", subject);
        if (body) query.set("body", body);
        if (cc) query.set("cc", cc);
        window.open(
          `mailto:${encodeURIComponent(recipientEmail)}?${query.toString()}`,
          "_blank",
        );
      }
    }

    await fetchAllCandidates();
    await refreshDetailCandidate();
  };

  const handleImportLog = (entries = []) => {
    if (!Array.isArray(entries) || entries.length === 0) return;
    setImportLog((prev) => [...entries, ...prev].slice(0, 50));
  };

  return (
    <div className="candidate-profile">
      <div className="candidate-profile__header">
        <div>
          <h1 className="candidate-profile__title">Candidate Profiles</h1>
          <p className="candidate-profile__subtitle">
            Every candidate in your pipeline, ready for quick review.
          </p>
        </div>
        <div className="candidate-profile__header-actions">
          <button
            type="button"
            className="candidate-card__btn candidate-card__btn--primary"
            onClick={fetchAllCandidates}
          >
            Refresh
          </button>
        </div>
      </div>

      <details className="candidate-profile__import-panel">
        <summary className="candidate-profile__import-summary">
          <span>Bulk Import</span>
          <span className="candidate-profile__import-summary-subtext">
            Resume and CSV tools
          </span>
        </summary>
        <div className="candidate-profile__import-content">
          <BulkImportSection
            onImportComplete={fetchAllCandidates}
            onLog={handleImportLog}
          />
        </div>
      </details>

      <div className="candidate-profile__toolbar">
        <div className="candidate-profile__filters">
          <input
            type="text"
            placeholder="Search name, email, or skills"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="candidate-profile__bulk">
          <div className="candidate-profile__bulk-meta">
            <span className="candidate-profile__bulk-count">
              {loading
                ? "Loading candidates..."
                : `${filteredEntries.length} candidates`}
            </span>
            <span className="candidate-profile__bulk-count">
              Selected {selectedCount}
            </span>
          </div>
          <div className="candidate-profile__bulk-actions">
            <button
              type="button"
              className="candidate-card__btn"
              onClick={selectAllFiltered}
            >
              Select All
            </button>
            <button
              type="button"
              className="candidate-card__btn"
              onClick={clearSelection}
            >
              Clear
            </button>
            <button
              type="button"
              className="candidate-card__btn candidate-card__btn--icon"
              disabled={selectedCount === 0}
              onClick={() => {
                const id = Array.from(selectedIds)[0];
                const entry = profileEntries.find(
                  ({ profile }) => profile.id === id || profile._id === id,
                );
                if (entry) handleOpenMessagePanel(entry.candidate, "am");
              }}
              title="Message AM"
              aria-label="Message AM"
            >
              <IconMessage />
            </button>
            <button
              type="button"
              className="candidate-card__btn"
              disabled={selectedCount === 0}
              onClick={() => {
                const id = Array.from(selectedIds)[0];
                const entry = profileEntries.find(
                  ({ profile }) => profile.id === id || profile._id === id,
                );
                if (entry) handleOpenMessagePanel(entry.candidate, "candidate");
              }}
            >
              Message Candidate
            </button>
            <button
              type="button"
              className="candidate-card__btn candidate-card__btn--primary"
              onClick={exportCsv}
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="candidate-profile__loading">Loading candidates...</div>
      ) : filteredEntries.length === 0 ? (
        <div className="candidate-profile__empty">
          No candidates found. Try refreshing the list.
        </div>
      ) : (
        <div className="candidate-grid">
          {filteredEntries.map(({ candidate, profile }) => {
            const id = profile.id || candidate.id;
            return (
              <CandidateCard
                key={id}
                candidate={candidate}
                profile={profile}
                workflowMeta={buildWorkflowMeta(candidate, profile)}
                selectable
                selected={selectedIds.has(id)}
                onSelect={toggleSelect}
                onViewDetails={openDetail}
              />
            );
          })}
        </div>
      )}

      {detailOpen && detailCandidate && detailProfile && (
        <CandidateDetail
          candidate={detailCandidate}
          profile={detailProfile}
          loading={detailLoading}
          onClose={closeDetail}
          onPreviewResume={handlePreviewResume}
          onScheduleInterview={scheduleInterview}
          onShortlist={shortlistCandidate}
          onMessageAm={(candidate) => handleOpenMessagePanel(candidate, "am")}
          onMessageCandidate={(candidate) =>
            handleOpenMessagePanel(candidate, "candidate")
          }
          onOpenFullProfile={() =>
            navigate(
              `/recruiter/candidate-profile/${getCandidateApiId(detailCandidate)}`,
            )
          }
          onOpenFeedback={openFeedbackDrawer}
          onSendToAM={() => sendToAccountManager(detailCandidate)}
          onUpdateStatus={updateCandidateStatus}
          workflowStatusOptions={statusOptions}
          hideQuickActions={viewOnlyMode}
          hideStatusControls
          hideFeedbackSection
          hideSendToAMAction
          hideScheduleInterviewAction
          hideOpenFullProfileAction
        />
      )}

      {isResumePreviewOpen && (
        <div
          className="candidate-preview-modal"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeResumePreview();
          }}
        >
          <div className="candidate-preview">
            <div className="candidate-preview__header">
              <span>Resume Preview</span>
              <button
                type="button"
                className="candidate-card__btn candidate-card__btn--ghost"
                onClick={closeResumePreview}
              >
                Close
              </button>
            </div>
            {resumePreviewLoading ? (
              <div className="candidate-profile__loading">Loading resume preview...</div>
            ) : resumePreviewMode === "html" ? (
              <div
                className="candidate-preview__html"
                dangerouslySetInnerHTML={{ __html: resumePreviewHtml }}
              />
            ) : resumePreviewMode === "text" ? (
              <pre className="candidate-preview__text">{resumePreviewText}</pre>
            ) : resumePreviewMode === "image" && resumePreviewUrl ? (
              <img
                className="candidate-preview__image"
                src={resumePreviewUrl}
                alt="Resume preview"
              />
            ) : resumePreviewUrl ? (
              <iframe src={previewFrameUrl || resumePreviewUrl} title="Resume preview" />
            ) : (
              <div className="candidate-profile__empty">Resume preview unavailable.</div>
            )}
            {resumePreviewError && (
              <div className="candidate-profile__empty">{resumePreviewError}</div>
            )}
            <div className="candidate-preview__actions">
              <button
                type="button"
                className="candidate-card__btn candidate-card__btn--ghost"
                onClick={() =>
                  window.open(resumePreviewUrl || resumePreviewSourceUrl, "_blank")
                }
                disabled={!resumePreviewUrl && !resumePreviewSourceUrl}
              >
                Open in new tab
              </button>
            </div>
          </div>
        </div>
      )}

      {showCallFeedbackDrawer && feedbackCandidate && (
        <CallFeedbackDrawer
          isOpen={showCallFeedbackDrawer}
          candidateId={getCandidateApiId(feedbackCandidate)}
          candidateName={
            feedbackCandidate.full_name || feedbackCandidate.name || "Candidate"
          }
          initialData={feedbackInitialData}
          onClose={() => {
            setShowCallFeedbackDrawer(false);
            setFeedbackInitialData(null);
          }}
          onSuccess={() => {
            setShowCallFeedbackDrawer(false);
            setFeedbackInitialData(null);
            fetchAllCandidates();
            refreshDetailCandidate();
          }}
        />
      )}

      {messagePanel.open && messagePanel.candidate && (
        <CustomMessagePanel
          candidate={messagePanel.candidate}
          recipient={messagePanel.recipient}
          onClose={() =>
            setMessagePanel({ open: false, recipient: "am", candidate: null })
          }
          onSend={async (payload) => {
            try {
              await handleSendMessage(payload);
            } catch (error) {
              alert(error?.message || "Failed to send message");
              return;
            }
            setMessagePanel({ open: false, recipient: "am", candidate: null });
          }}
        />
      )}

      {importLog.length > 0 && (
        <div className="candidate-profile__import-log">
          <h3 className="candidate-profile__import-log-title">
            Recent Imports
          </h3>
          <div className="candidate-profile__import-log-list">
            {importLog.map((entry, idx) => (
              <div key={idx} className="candidate-profile__import-log-item">
                <div className="candidate-profile__import-log-primary">
                  <span className="candidate-profile__import-log-name">
                    {entry.name || "Unknown"}
                  </span>
                  {entry.email && (
                    <span className="candidate-profile__import-log-email">
                      {entry.email}
                    </span>
                  )}
                </div>
                <div className="candidate-profile__import-log-meta">
                  <span className="candidate-profile__import-log-pill">
                    {entry.type === "excel" ? "Excel" : "Resume"}
                  </span>
                  <span className="candidate-profile__import-log-status">
                    {entry.status}
                  </span>
                  {entry.resume && (
                    <span className="candidate-profile__import-log-file">
                      {entry.resume}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

