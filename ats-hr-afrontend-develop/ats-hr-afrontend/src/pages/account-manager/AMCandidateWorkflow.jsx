import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import CandidateDetail from "../../components/candidate-profile/CandidateDetail";
import { mapCandidateToProfile } from "../../utils/candidateProfileUtils";
import {
  Users,
  Eye,
  Star,
  XCircle,
  Send,
  Calendar,
  CheckCircle,
  Search,
  RefreshCw,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  DollarSign,
  Clock,
  Building,
  FileText,
  AlertCircle,
  UserCheck,
  UserX,
  Loader2,
  ChevronDown,
  Filter,
  User,
  Plus,
  X,
  MessageSquare,
  GraduationCap,
  Award,
} from "lucide-react";

// Default Clients List
const DEFAULT_CLIENTS = [
  { id: "cookieman", name: "CookieMan" },
  { id: "itc_infotech", name: "ITC Infotech" },
  { id: "itc_ltd", name: "ITC Ltd" },
  { id: "tcl", name: "TCL" },
  { id: "tctsl", name: "TCTSL" },
];

// Status configuration with colors and icons
const STATUS_CONFIG = {
  sent_to_am: {
    label: "Sent to AM",
    color: "bg-teal-100 text-teal-700",
    icon: Send,
  },
  am_viewed: {
    label: "Sent to AM",
    color: "bg-cyan-100 text-cyan-700",
    icon: Eye,
  },
  am_shortlisted: {
    label: "AM Shortlisted",
    color: "bg-green-100 text-green-700",
    icon: Star,
  },
  am_hold: {
    label: "AM Hold",
    color: "bg-amber-100 text-amber-700",
    icon: Clock,
  },
  am_rejected: {
    label: "AM Rejected",
    color: "bg-red-100 text-red-700",
    icon: XCircle,
  },
  sent_to_client: {
    label: "Sent to Client",
    color: "bg-orange-100 text-orange-700",
    icon: Send,
  },
  client_viewed: {
    label: "Sent to Client",
    color: "bg-orange-100 text-orange-700",
    icon: Eye,
  },
  client_shortlisted: {
    label: "Client Shortlisted",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle,
  },
  client_hold: {
    label: "Client Hold",
    color: "bg-amber-100 text-amber-700",
    icon: Clock,
  },
  client_rejected: {
    label: "Client Rejected",
    color: "bg-red-100 text-red-700",
    icon: XCircle,
  },
  interview_scheduled: {
    label: "Interview Scheduled",
    color: "bg-violet-100 text-violet-700",
    icon: Calendar,
  },
  interview_completed: {
    label: "Interview Done",
    color: "bg-violet-100 text-violet-700",
    icon: CheckCircle,
  },
  selected: {
    label: "Selected",
    color: "bg-emerald-100 text-emerald-700",
    icon: Star,
  },
  negotiation: {
    label: "Negotiation",
    color: "bg-yellow-100 text-yellow-700",
    icon: DollarSign,
  },
  hired: {
    label: "Hired",
    color: "bg-green-100 text-green-700",
    icon: UserCheck,
  },
};

// Tab configuration for Account Manager
const AM_TABS = [
  {
    id: "inbox",
    label: "Inbox (Sent to AM)",
    statuses: ["sent_to_am", "am_viewed"],
    icon: Send,
  },
  {
    id: "shortlisted",
    label: "AM Shortlisted",
    statuses: ["am_shortlisted"],
    icon: Star,
  },
  {
    id: "am_hold",
    label: "AM Hold",
    statuses: ["am_hold"],
    icon: Clock,
  },
  {
    id: "rejected",
    label: "AM Rejected",
    statuses: ["am_rejected"],
    icon: XCircle,
  },
  {
    id: "sent_to_client",
    label: "Sent to Client",
    statuses: ["sent_to_client"],
    icon: Building,
  },
  {
    id: "client_shortlisted",
    label: "Client Shortlisted",
    statuses: ["client_shortlisted"],
    icon: CheckCircle,
  },
  {
    id: "interview_scheduled",
    label: "Interview Scheduled",
    statuses: ["interview_scheduled", "interview_completed"],
    icon: Calendar,
  },
  {
    id: "client_hold",
    label: "Client Hold",
    statuses: ["client_hold"],
    icon: Clock,
  },
  {
    id: "client_rejected",
    label: "Client Rejected",
    statuses: ["client_rejected"],
    icon: XCircle,
  },
];

const CLOSED_REQUIREMENT_STATUSES = new Set([
  "closed",
  "cancelled",
  "canceled",
  "archived",
  "inactive",
  "deleted",
  "filled",
  "completed",
]);

const normalizeStatus = (value) =>
  {
    const normalized = String(value || "")
      .trim()
      .toLowerCase();
    if (!normalized) return "";
    const underscored = normalized.replace(/[\s-]+/g, "_");
    // Backend persists AM hold as `hold_revisit`; map it to AM workflow stage.
    if (underscored === "hold_revisit") return "am_hold";
    // Treat AM viewed as inbox in this UI.
    if (underscored === "am_viewed") return "sent_to_am";
    // Treat client viewed as sent-to-client in this UI.
    if (underscored === "client_viewed") return "sent_to_client";
    // Some backends emit interview stages with suffixes/prefixes.
    if (underscored.startsWith("interview_schedule")) return "interview_scheduled";
    if (underscored.startsWith("interview_complete")) return "interview_completed";
    return underscored;
  };

const ALL_AM_STATUSES = Array.from(
  new Set(AM_TABS.flatMap((tab) => tab.statuses.map((status) => normalizeStatus(status)))),
);

const LIST_REQUEST_TIMEOUT_MS = 30000;
const PROFILE_HYDRATION_TIMEOUT_MS = 8000;
const MAX_PROFILE_HYDRATION_REQUESTS = 60;
const PROFILE_HYDRATION_BATCH_SIZE = 8;
const IGNORED_FETCH_ERROR_STATUS_CODES = new Set([401, 403, 404, 405, 422]);
const WORKFLOW_SUPPLEMENT_STATUSES = new Set([
  "sent_to_client",
  "client_shortlisted",
  "client_hold",
  "client_rejected",
  "interview_scheduled",
  "interview_completed",
  "selected",
  "negotiation",
  "hired",
]);

const isTimeoutAxiosError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return error?.code === "ECONNABORTED" || message.includes("timeout");
};

const shouldSuppressFetchWarning = (error) =>
  IGNORED_FETCH_ERROR_STATUS_CODES.has(error?.response?.status) || isTimeoutAxiosError(error);

const normalizeId = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const PUBLIC_CANDIDATE_ID_REGEX = /^[a-z]{2,6}-c-\d{3,}$/i;

const isPublicCandidateId = (value) =>
  PUBLIC_CANDIDATE_ID_REGEX.test(String(value || "").trim());

const getCandidateInternalId = (candidate = {}) => {
  const nestedCandidate =
    candidate?.candidate || candidate?.candidate_details || candidate?.profile || {};
  const applicationIds = new Set(
    [
      candidate?.application_id,
      candidate?.applicationId,
      nestedCandidate?.application_id,
      nestedCandidate?.applicationId,
    ]
      .map((value) => normalizeId(value))
      .filter(Boolean),
  );
  const candidates = [
    candidate?.candidate_uuid,
    nestedCandidate?.candidate_uuid,
    candidate?.candidate_id,
    nestedCandidate?.candidate_id,
    candidate?.id,
    nestedCandidate?.id,
  ];

  for (const value of candidates) {
    const id = String(value || "").trim();
    if (!id) continue;
    if (applicationIds.has(normalizeId(id))) continue;
    if (!isPublicCandidateId(id)) return id;
  }

  return "";
};

const normalizeClientKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const extractList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.requirements)) return payload.requirements;
  if (Array.isArray(payload?.jobs)) return payload.jobs;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const normalizeRequirementRecord = (req) => {
  const rawId = req?.job_id || req?.requirement_id || req?.id;
  const id = String(rawId || "").trim();
  const clientName =
    req?.client_name ||
    req?.client_display_name ||
    req?.company_name ||
    req?.client?.name ||
    "";
  const clientId = req?.client_id || normalizeClientKey(clientName);

  return {
    ...req,
    id,
    job_id: String(req?.job_id || id || ""),
    requirement_id: String(req?.requirement_id || id || ""),
    title:
      req?.title ||
      req?.job_title ||
      req?.requirement_title ||
      req?.requirement_code ||
      "Untitled Requirement",
    requirement_code: req?.requirement_code || req?.job_id || id,
    client_name: clientName || "Client not specified",
    client_id: clientId,
    status: normalizeStatus(req?.status || "open"),
  };
};

const isRequirementActive = (req) =>
  !CLOSED_REQUIREMENT_STATUSES.has(normalizeStatus(req?.status));

const STATUS_PRIORITY = {
  sent_to_am: 10,
  am_shortlisted: 20,
  am_hold: 30,
  am_rejected: 40,
  sent_to_client: 50,
  client_shortlisted: 60,
  client_hold: 70,
  client_rejected: 80,
  interview_scheduled: 90,
  interview_completed: 100,
  selected: 110,
  negotiation: 120,
  hired: 130,
};

const getStatusPriority = (status) =>
  STATUS_PRIORITY[normalizeStatus(status)] || 0;

const dedupeCandidates = (list = []) => {
  const unique = new Map();
  list.forEach((candidate) => {
    const candidateId = normalizeId(candidate?.candidate_id || candidate?.id);
    const jobId = normalizeId(candidate?.job_id || candidate?.requirement_id);
    const applicationId = normalizeId(candidate?.application_id);
    const key =
      (candidateId && jobId && `${candidateId}::${jobId}`) ||
      applicationId ||
      candidateId;
    if (!key) return;
    if (!unique.has(key)) {
      unique.set(key, candidate);
      return;
    }
    const existing = unique.get(key);
    const existingPriority = getStatusPriority(existing?.status || existing?.stage);
    const incomingPriority = getStatusPriority(candidate?.status || candidate?.stage);
    if (incomingPriority > existingPriority) {
      unique.set(key, candidate);
      return;
    }
    if (incomingPriority < existingPriority) {
      return;
    }
    const existingTs = new Date(
      existing?.updated_at || existing?.submitted_at || 0,
    ).getTime();
    const currentTs = new Date(
      candidate?.updated_at || candidate?.submitted_at || 0,
    ).getTime();
    if (currentTs >= existingTs) {
      unique.set(key, candidate);
    }
  });
  return Array.from(unique.values()).sort(
    (a, b) =>
      new Date(b?.updated_at || b?.submitted_at || 0).getTime() -
      new Date(a?.updated_at || a?.submitted_at || 0).getTime(),
  );
};

const buildStatusCounts = (list = []) =>
  list.reduce((acc, item) => {
    const status = normalizeStatus(item?.status || item?.stage);
    if (!status) return acc;
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

const parseMaybeJson = (value) => {
  if (!value) return {};
  if (typeof value === "object") return value;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const getFeedbackListFromPayload = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.feedbacks)) return payload.feedbacks;
  if (Array.isArray(payload.data?.feedbacks)) return payload.data.feedbacks;
  if (Array.isArray(payload.items)) return payload.items;
  if (payload.feedback && typeof payload.feedback === "object") {
    return [payload.feedback];
  }
  return [];
};

const normalizeFeedbackEntry = (entry, index = 0) => {
  const meta = parseMaybeJson(
    entry?.meta || entry?.metadata || entry?.note_meta || entry?.payload,
  );
  const ratings =
    entry?.ratings && typeof entry.ratings === "object"
      ? entry.ratings
      : meta?.ratings && typeof meta.ratings === "object"
        ? meta.ratings
        : {};

  return {
    id:
      entry?.id ||
      entry?.feedback_id ||
      entry?.note_id ||
      `feedback-${index}`,
    decision:
      entry?.decision ||
      meta?.decision ||
      entry?.status ||
      entry?.note_type ||
      "",
    call_type: entry?.call_type || meta?.call_type || "Call Feedback",
    call_date:
      entry?.call_date ||
      entry?.created_at ||
      entry?.updated_at ||
      entry?.timestamp ||
      "",
    rating: Number(entry?.rating || meta?.rating || 0),
    ratings,
    salary_alignment:
      entry?.salary_alignment || meta?.salary_alignment || "",
    candidate_intent:
      entry?.candidate_intent || meta?.candidate_intent || "",
    strengths: entry?.strengths || meta?.strengths || "",
    concerns: entry?.concerns || meta?.concerns || "",
    additional_notes:
      entry?.additional_notes || meta?.additional_notes || "",
    rejection_reason:
      entry?.rejection_reason || meta?.rejection_reason || "",
    summary:
      entry?.summary ||
      entry?.free_text ||
      entry?.note ||
      entry?.note_text ||
      entry?.content ||
      meta?.summary ||
      meta?.free_text ||
      "",
    recruiter_name:
      entry?.recruiter_name ||
      entry?.created_by_name ||
      entry?.author_name ||
      "",
    source:
      entry?.source ||
      entry?.note_stage ||
      (entry?.note_type ? "note" : "call_feedback"),
  };
};

const normalizeFeedbackList = (items = []) => {
  const normalized = items
    .map((item, index) => normalizeFeedbackEntry(item, index))
    .filter((item) => {
      const hasRatings =
        item.rating > 0 ||
        Object.values(item.ratings || {}).some((val) => Number(val) > 0);
      return Boolean(
        item.summary ||
          item.decision ||
          item.strengths ||
          item.concerns ||
          item.additional_notes ||
          hasRatings,
      );
    });

  const unique = new Map();
  normalized.forEach((item) => {
    const key = `${item.id}::${item.call_date}::${item.summary}`;
    if (!unique.has(key)) unique.set(key, item);
  });

  return Array.from(unique.values()).sort((a, b) => {
    const aTime = new Date(a.call_date || 0).getTime();
    const bTime = new Date(b.call_date || 0).getTime();
    return bTime - aTime;
  });
};

const extractFeedbackFromCandidateRecord = (candidate) => {
  const notes = Array.isArray(candidate?.notes) ? candidate.notes : [];
  const noteFeedback = notes
    .filter((note) => String(note?.note_stage || "").toLowerCase() === "call_feedback")
    .map((note) => normalizeFeedbackEntry(note));

  const directSources = [
    ...(Array.isArray(candidate?.feedbacks) ? candidate.feedbacks : []),
    ...(Array.isArray(candidate?.call_feedbacks) ? candidate.call_feedbacks : []),
    ...(candidate?.latest_call_feedback ? [candidate.latest_call_feedback] : []),
    ...(candidate?.call_feedback ? [candidate.call_feedback] : []),
  ];

  if (candidate?.feedback_summary && !directSources.length && !noteFeedback.length) {
    directSources.push({
      summary: candidate.feedback_summary,
      decision: candidate.decision || candidate.feedback_decision || "Send to AM",
      call_date: candidate.submitted_at || candidate.updated_at || candidate.created_at,
      source: "summary",
    });
  }

  return normalizeFeedbackList([...directSources, ...noteFeedback]);
};

const formatFeedbackDate = (value) => {
  if (!value) return "Date not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not available";
  return date.toLocaleString();
};

const getOverallFeedbackRating = (feedback) => {
  const ratings = feedback?.ratings && typeof feedback.ratings === "object"
    ? Object.values(feedback.ratings).map((value) => Number(value)).filter((value) => value > 0)
    : [];

  if (ratings.length > 0) {
    return (ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1);
  }

  if (Number(feedback?.rating) > 0) {
    return Number(feedback.rating).toFixed(1);
  }

  return "";
};

const hasDisplayValue = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
};

const pickDisplayValue = (...values) => {
  for (const value of values) {
    if (hasDisplayValue(value)) {
      return typeof value === "string" ? value.trim() : value;
    }
  }
  return "";
};

const toComparableText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

const isIdentityLikeValue = (value, candidate = {}) => {
  const normalizedValue = toComparableText(value);
  if (!normalizedValue) return false;

  const identityCandidates = [
    candidate?.full_name,
    candidate?.candidate_name,
    candidate?.name,
    String(candidate?.email || "").split("@")[0],
    candidate?.public_id,
    candidate?.id,
    candidate?.candidate_id,
  ]
    .map(toComparableText)
    .filter(Boolean);

  return identityCandidates.some((identity) => {
    if (!identity) return false;
    if (normalizedValue === identity) return true;
    if (identity.length >= 7 && normalizedValue.includes(identity)) return true;
    if (normalizedValue.length >= 7 && identity.includes(normalizedValue)) return true;
    return false;
  });
};

const formatExperienceLabel = (value) => {
  if (!hasDisplayValue(value)) return "--";
  const text = String(value).trim();
  if (!text) return "--";
  if (/yr|year/i.test(text)) return text;
  return `${text} yrs`;
};

const toTitleWords = (value) =>
  String(value || "")
    .trim()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const getCandidateIdentityTokens = (candidate = {}) => {
  const nestedCandidate =
    candidate?.candidate || candidate?.candidate_details || candidate?.profile || {};
  const values = [
    candidate?.id,
    candidate?.candidate_id,
    candidate?.application_id,
    candidate?.public_id,
    candidate?.email,
    candidate?.candidate_email,
    nestedCandidate?.id,
    nestedCandidate?.candidate_id,
    nestedCandidate?.public_id,
    nestedCandidate?.email,
    nestedCandidate?.candidate_email,
  ];
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean),
    ),
  );
};

const hasInterviewScheduledEvidence = (candidate = {}) => {
  const nestedCandidate =
    candidate?.candidate || candidate?.candidate_details || candidate?.profile || {};
  const sources = [candidate, nestedCandidate];

  const hasInterviewId = sources.some((source) =>
    hasDisplayValue(
      pickDisplayValue(
        source?.interview_id,
        source?.next_interview_id,
        source?.latest_interview_id,
        source?.upcoming_interview_id,
      ),
    ),
  );
  if (hasInterviewId) return true;

  const hasScheduledDate = sources.some((source) => {
    const raw = pickDisplayValue(
      source?.scheduled_at,
      source?.interview_scheduled_at,
      source?.next_interview_date,
      source?.interview_date,
      source?.interview_datetime,
    );
    if (!raw) return false;
    const parsed = new Date(raw).getTime();
    return Number.isFinite(parsed) && parsed > 0;
  });
  if (hasScheduledDate) return true;

  const hasInterviewCount = sources.some((source) => {
    const count = Number(
      pickDisplayValue(
        source?.interview_count,
        source?.interviews_count,
        source?.scheduled_interviews_count,
        source?.upcoming_interviews_count,
        source?.total_interviews,
      ) || 0,
    );
    return Number.isFinite(count) && count > 0;
  });
  if (hasInterviewCount) return true;

  const interviewCollections = [
    candidate?.interviews,
    nestedCandidate?.interviews,
    candidate?.interview_logs,
    nestedCandidate?.interview_logs,
  ];

  return interviewCollections.some((collection) => {
    if (!Array.isArray(collection) || collection.length === 0) return false;
    return collection.some((item) => {
      const interviewStatus = normalizeStatus(item?.status || item?.stage || "");
      if (["cancelled", "rejected", "no_show"].includes(interviewStatus)) {
        return false;
      }
      const interviewDate = pickDisplayValue(
        item?.scheduled_at,
        item?.interview_date,
        item?.interview_datetime,
      );
      if (interviewDate) {
        const parsed = new Date(interviewDate).getTime();
        if (Number.isFinite(parsed) && parsed > 0) return true;
      }
      return hasDisplayValue(
        pickDisplayValue(item?.id, item?.interview_id, item?.uuid),
      );
    });
  });
};

const resolveWorkflowDisplayStatus = (candidate = {}, statusValue = "") => {
  const rawStatus = normalizeStatus(
    statusValue || candidate?.status || candidate?.stage || "",
  );
  if (rawStatus !== "interview_scheduled") return rawStatus;

  if (hasInterviewScheduledEvidence(candidate)) return rawStatus;

  const nestedCandidate =
    candidate?.candidate || candidate?.candidate_details || candidate?.profile || {};
  const schedulingReady = Boolean(
    pickDisplayValue(
      candidate?.interview_scheduling_ready,
      nestedCandidate?.interview_scheduling_ready,
    ),
  );
  const schedulingNote = String(
    pickDisplayValue(
      candidate?.interview_scheduling_note,
      nestedCandidate?.interview_scheduling_note,
    ) || "",
  ).trim();

  if (!schedulingReady && schedulingNote) return "interview_scheduled";
  return "client_shortlisted";
};

const buildCandidateInterviewStatusMap = (interviews = []) => {
  const byCandidateJob = new Map();
  const byCandidate = new Map();

  const shouldReplace = (existing, incomingTime) => {
    if (!existing) return true;
    const existingTime = new Date(existing?.scheduledAt || 0).getTime();
    const incomingTs = new Date(incomingTime || 0).getTime();
    return incomingTs >= existingTime;
  };

  interviews.forEach((interview) => {
    const rawStatus = normalizeStatus(interview?.status || "scheduled");
    if (["cancelled", "rejected", "no_show"].includes(rawStatus)) return;

    const effectiveStatus =
      rawStatus === "completed" ? "interview_completed" : "interview_scheduled";
    const scheduledAt = pickDisplayValue(
      interview?.scheduled_at,
      interview?.scheduledAt,
      interview?.start_time,
      interview?.start_at,
    );
    const candidateTokens = Array.from(
      new Set(
        [
          interview?.candidate?.id,
          interview?.candidate_id,
          interview?.candidate?.candidate_id,
          interview?.candidate?.public_id,
          interview?.candidate_public_id,
          interview?.candidate_email,
          interview?.candidate?.email,
          interview?.submission?.candidate?.id,
          interview?.submission?.candidate_id,
          interview?.submission?.candidate?.candidate_id,
          interview?.submission?.candidate?.public_id,
          interview?.submission?.candidate?.email,
        ]
          .map((value) => String(value || "").trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    const jobTokens = Array.from(
      new Set(
        [
          interview?.job?.id,
          interview?.job_id,
          interview?.requirement_id,
          interview?.job?.job_id,
          interview?.submission?.job?.id,
          interview?.submission?.job_id,
          interview?.submission?.requirement_id,
          interview?.submission?.job?.job_id,
        ]
          .map((value) => String(value || "").trim().toLowerCase())
          .filter(Boolean),
      ),
    );

    if (!candidateTokens.length) return;

    const record = {
      status: effectiveStatus,
      scheduledAt: scheduledAt || null,
      interviewStatus: rawStatus,
      interviewId: pickDisplayValue(interview?.id, interview?.interview_id),
    };

    if (jobTokens.length > 0) {
      candidateTokens.forEach((candidateToken) => {
        jobTokens.forEach((jobToken) => {
          const key = `${candidateToken}::${jobToken}`;
          const existing = byCandidateJob.get(key);
          if (shouldReplace(existing, scheduledAt)) {
            byCandidateJob.set(key, record);
          }
        });
      });
    }

    candidateTokens.forEach((candidateToken) => {
      const existingAny = byCandidate.get(candidateToken);
      if (shouldReplace(existingAny, scheduledAt)) {
        byCandidate.set(candidateToken, record);
      }
    });
  });

  return { byCandidateJob, byCandidate };
};

const getInterviewListFromPayload = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.interview_logs)) return payload.interview_logs;
  if (Array.isArray(payload?.data?.interview_logs)) return payload.data.interview_logs;
  if (Array.isArray(payload?.interviews)) return payload.interviews;
  if (Array.isArray(payload?.data?.interviews)) return payload.data.interviews;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const TIMELINE_VISUALS = {
  shortlisted: {
    label: "Shortlisted",
    icon: CheckCircle,
    markerClass: "bg-green-50 border-green-200 text-green-700",
    badgeClass: "bg-green-50 border-green-200 text-green-700",
    latestClass: "ring-2 ring-green-200 border-green-200 shadow-md",
  },
  sent: {
    label: "Sent to Client",
    icon: Send,
    markerClass: "bg-blue-50 border-blue-200 text-blue-700",
    badgeClass: "bg-blue-50 border-blue-200 text-blue-700",
    latestClass: "ring-2 ring-blue-200 border-blue-200 shadow-md",
  },
  hold: {
    label: "On Hold",
    icon: Clock,
    markerClass: "bg-orange-50 border-orange-200 text-orange-700",
    badgeClass: "bg-orange-50 border-orange-200 text-orange-700",
    latestClass: "ring-2 ring-orange-200 border-orange-200 shadow-md",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    markerClass: "bg-red-50 border-red-200 text-red-700",
    badgeClass: "bg-red-50 border-red-200 text-red-700",
    latestClass: "ring-2 ring-red-200 border-red-200 shadow-md",
  },
};

const classifyTimelineStatus = (statusValue) => {
  const normalized = normalizeStatus(statusValue);

  if (normalized.includes("reject")) return "rejected";
  if (normalized.includes("hold")) return "hold";
  if (
    normalized.includes("shortlist") ||
    ["selected", "hired", "joined", "offer_accepted"].includes(normalized)
  ) {
    return "shortlisted";
  }

  return "sent";
};

const getTimelineRejectionSource = (item = {}) => {
  const normalized = normalizeStatus(item?.status);
  if (normalized === "am_rejected") return "Account Manager";
  if (normalized === "client_rejected") return "Client";

  const roleText = toTitleWords(
    pickDisplayValue(item?.role, item?.actor_role, item?.actor_type),
  ).toLowerCase();
  if (roleText.includes("account manager")) return "Account Manager";
  if (roleText.includes("client")) return "Client";

  const actorText = String(
    pickDisplayValue(item?.by, item?.user, item?.actor_name, item?.created_by_name),
  )
    .trim()
    .toLowerCase();
  if (actorText.includes("client")) return "Client";

  return "";
};

const getTimelineRoleSource = (item = {}) => {
  const roleText = toTitleWords(
    pickDisplayValue(item?.role, item?.actor_role, item?.actor_type),
  ).toLowerCase();

  if (roleText.includes("account manager")) return "Account Manager";
  if (roleText.includes("client")) return "Client";
  if (roleText.includes("recruiter")) return "Recruiter";
  if (roleText.includes("candidate")) return "Candidate";

  const actorText = String(
    pickDisplayValue(item?.by, item?.user, item?.actor_name, item?.created_by_name),
  )
    .trim()
    .toLowerCase();
  if (actorText.includes("account manager")) return "Account Manager";
  if (actorText.includes("client")) return "Client";
  if (actorText.includes("recruiter")) return "Recruiter";
  if (actorText.includes("candidate")) return "Candidate";

  return "";
};

const getTimelineHoldSource = (item = {}) => {
  const normalized = normalizeStatus(item?.status);
  if (normalized === "am_hold" || normalized === "hold_revisit") {
    return "Account Manager";
  }
  if (normalized === "client_hold") return "Client";

  return getTimelineRoleSource(item);
};

const getTimelineShortlistSource = (item = {}) => {
  const normalized = normalizeStatus(item?.status);
  if (normalized === "am_shortlisted") return "Account Manager";
  if (normalized === "client_shortlisted") return "Client";
  return getTimelineRoleSource(item);
};

const getTimelineSentSource = (item = {}) => {
  const normalized = normalizeStatus(item?.status);
  const roleSource = getTimelineRoleSource(item);
  if (roleSource) return roleSource;

  if (normalized === "sent_to_client") return "Account Manager";
  if (normalized === "sent_to_am") return "Recruiter";
  if (normalized === "client_viewed") return "Client";
  if (normalized === "am_viewed") return "Account Manager";

  return "";
};

const getTimelineBadgeLabel = (item = {}, statusCategory = "sent") => {
  if (statusCategory === "hold") {
    const source = getTimelineHoldSource(item);
    return source ? `On Hold by ${source}` : "On Hold";
  }

  if (statusCategory === "shortlisted") {
    const source = getTimelineShortlistSource(item);
    return source ? `Shortlisted by ${source}` : "Shortlisted";
  }

  if (statusCategory === "sent") {
    const normalized = normalizeStatus(item?.status);
    const source = getTimelineSentSource(item);
    if (normalized === "sent_to_am" || normalized === "am_viewed") {
      return source && source !== "Account Manager"
        ? `Sent to Account Manager by ${source}`
        : "Sent to Account Manager";
    }
    if (normalized === "sent_to_client" || normalized === "client_viewed") {
      return source && source !== "Client"
        ? `Sent to Client by ${source}`
        : "Sent to Client";
    }
    return source ? `Sent by ${source}` : "Sent";
  }

  const source = getTimelineRejectionSource(item);
  return source ? `Rejected by ${source}` : "Rejected";
};

const formatTimelineDateTime = (value) => {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  const datePart = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

  return `${datePart} • ${timePart}`;
};

const getDisplayTimelineNote = (value) => {
  const note = String(value || "").trim();
  if (!note) return "";

  if (
    /status\s+changed\s+from/i.test(note) ||
    /(?:from|to)\s+[a-z]+_[a-z0-9_]+/i.test(note) ||
    /\b[a-z]+_[a-z0-9_]+\b/i.test(note)
  ) {
    return "";
  }

  return note;
};

// Candidate Card Component for AM
function AMCandidateCard({
  candidate,
  onAction,
  onViewProfile,
  onViewFeedback,
  onViewTimeline,
}) {
  const status = candidate.status || "sent_to_am";
  const normalizedStatus = normalizeStatus(status);
  const config = STATUS_CONFIG[normalizedStatus] || STATUS_CONFIG.sent_to_am;
  const isFinal = candidate.is_final;
  const nestedCandidate =
    candidate?.candidate || candidate?.candidate_details || candidate?.profile || {};

  const displayEmail = pickDisplayValue(
    candidate.email,
    nestedCandidate.email,
    candidate.candidate_email,
  );
  const displayPhone = pickDisplayValue(
    candidate.phone,
    nestedCandidate.phone,
    candidate.mobile,
    candidate.phone_number,
  );
  const displayLocation = pickDisplayValue(
    candidate.current_location,
    candidate.currentLocation,
    candidate.location,
    candidate.city,
    candidate.preferred_location,
    nestedCandidate.current_location,
    nestedCandidate.location,
    nestedCandidate.city,
  );
  const displayExperience = pickDisplayValue(
    candidate.experience_years,
    candidate.experience,
    candidate.total_experience,
    nestedCandidate.experience_years,
    nestedCandidate.experience,
    nestedCandidate.total_experience,
  );
  const displayEmployer = pickDisplayValue(
    candidate.current_employer,
    candidate.current_company,
    nestedCandidate.current_employer,
    nestedCandidate.current_company,
  );
  const displayRole = pickDisplayValue(
    candidate.current_designation,
    candidate.designation,
    candidate.job_title,
    candidate.requirement_title,
    candidate.role,
    nestedCandidate.current_designation,
    nestedCandidate.designation,
    nestedCandidate.role,
  );
  const safeEmployer = isIdentityLikeValue(displayEmployer, candidate)
    ? ""
    : displayEmployer;
  const safeRole = isIdentityLikeValue(displayRole, candidate)
    ? ""
    : displayRole;
  const displayEmployerOrRole = safeEmployer || safeRole;
  const employerRoleIcon = safeEmployer ? Building : User;
  const displayExpectedCtc = pickDisplayValue(
    candidate.expected_ctc,
    candidate.expected_salary,
    candidate.expectedCtc,
    nestedCandidate.expected_ctc,
    nestedCandidate.expected_salary,
    nestedCandidate.expectedCtc,
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
            {candidate.full_name || candidate.candidate_name || "Unknown"}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {candidate.public_id || candidate.id?.slice(0, 8)}
          </p>
        </div>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
        >
          {config.label}
        </span>
      </div>

      {/* Client, Requirement & Recruiter Info */}
      {(candidate.client_name ||
        candidate.job_title ||
        candidate.requirement_title ||
        candidate.recruiter_name ||
        candidate.submitted_by_name) && (
        <div className="mb-3 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
          {candidate.client_name && (
            <div className="flex items-center gap-1 text-green-700 dark:text-green-300 text-sm mb-1">
              <Building className="w-3 h-3" />
              <span className="font-medium truncate">
                {candidate.client_name}
              </span>
            </div>
          )}
          {(candidate.job_title || candidate.requirement_title) && (
            <div className="flex items-center gap-1 text-purple-700 dark:text-purple-300 text-sm mb-1">
              <FileText className="w-3 h-3" />
              <span className="font-medium truncate">
                {candidate.job_title || candidate.requirement_title}
              </span>
            </div>
          )}
          {(candidate.recruiter_name || candidate.submitted_by_name) && (
            <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400 text-xs">
              <User className="w-3 h-3" />
              <span>
                Sent by:{" "}
                {candidate.recruiter_name || candidate.submitted_by_name}
              </span>
            </div>
          )}
          {candidate.submitted_at && (
            <div className="flex items-center gap-1 text-purple-500 dark:text-purple-400 text-xs mt-1">
              <Clock className="w-3 h-3" />
              <span>
                {new Date(candidate.submitted_at).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-2 text-sm mb-4">
        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
          <Mail className="w-3 h-3" />
          <span className="truncate">{displayEmail || "--"}</span>
        </div>
        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
          <Phone className="w-3 h-3" />
          <span>{displayPhone || "--"}</span>
        </div>
        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
          <MapPin className="w-3 h-3" />
          <span>{displayLocation || "--"}</span>
        </div>
        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
          <Briefcase className="w-3 h-3" />
          <span>{formatExperienceLabel(displayExperience)}</span>
        </div>
        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
          {React.createElement(employerRoleIcon, { className: "w-3 h-3" })}
          <span className="truncate">{displayEmployerOrRole || "Not Provided"}</span>
        </div>
        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
          <DollarSign className="w-3 h-3" />
          <span>{displayExpectedCtc || "--"}</span>
        </div>
      </div>

      {/* Skills */}
      {candidate.skills && candidate.skills.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {candidate.skills.slice(0, 5).map((skill, i) => (
            <span
              key={i}
              className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
            >
              {typeof skill === "string" ? skill : skill?.name}
            </span>
          ))}
          {candidate.skills.length > 5 && (
            <span className="text-xs text-gray-500">
              +{candidate.skills.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
        {/* View Detail - Always Available */}
        <button
          onClick={() => {
            if (onViewProfile) {
              onViewProfile(candidate);
            }
            // Auto-mark as viewed if still sent_to_am
            if (status === "sent_to_am") {
              onAction(candidate, "am_view");
            }
          }}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          <Eye className="w-3 h-3" />
          View Detail
        </button>

        <button
          onClick={() => onViewFeedback && onViewFeedback(candidate)}
          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm hover:bg-emerald-100 transition-colors"
        >
          <MessageSquare className="w-3 h-3" />
          View Feedback
        </button>

        <button
          onClick={() => onViewTimeline && onViewTimeline(candidate)}
          className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg text-sm hover:bg-gray-200 transition-colors"
        >
          <Clock className="w-3 h-3" />
          Timeline
        </button>

        {isFinal && (
          <span className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-sm">
            <AlertCircle className="w-3 h-3" />
            Final Status
          </span>
        )}
      </div>
    </div>
  );
}

// Main Component
export default function AMCandidateWorkflow() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTabRaw = searchParams.get("tab") || "inbox";
  const requestedTab =
    requestedTabRaw === "viewed"
      ? "inbox"
      : requestedTabRaw === "client_viewed"
        ? "sent_to_client"
        : ["interview_scheduled", "interview_completed"].includes(requestedTabRaw)
          ? "interview_scheduled"
        : requestedTabRaw;
  const initialTab = AM_TABS.some((tab) => tab.id === requestedTab)
    ? requestedTab
    : "inbox";

  const [candidates, setCandidates] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [clients, setClients] = useState(DEFAULT_CLIENTS);
  const [statusCounts, setStatusCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedRequirement, setSelectedRequirement] = useState(
    searchParams.get("requirement") || "all",
  );
  const [selectedClient, setSelectedClient] = useState(
    searchParams.get("client") || "all",
  );
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [viewingCandidate, setViewingCandidate] = useState(null);
  const [candidateDetails, setCandidateDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState({
    open: false,
    candidate: null,
    loading: false,
    error: "",
    feedbacks: [],
  });
  const [timelineModal, setTimelineModal] = useState({
    open: false,
    candidate: null,
    loading: false,
    error: "",
    items: [],
  });
  const candidateFetchVersionRef = useRef(0);
  // Keeps AM action status consistent across list refreshes for same candidate.
  const statusOverridesRef = useRef({});
  // Cache full profile responses to avoid repeated per-candidate fetches.
  const candidateDetailsCacheRef = useRef({});
  // Avoid refetching candidate profiles that are known to be unavailable.
  const missingCandidateDetailsRef = useRef(new Set());
  const preferredInterviewEndpointRef = useRef("");
  const unavailableInterviewEndpointsRef = useRef(new Set());

  const withRequestTimeout = (config = {}, timeoutMs = LIST_REQUEST_TIMEOUT_MS) => ({
    ...(config || {}),
    timeout:
      typeof config?.timeout === "number" && config.timeout > 0
        ? config.timeout
        : timeoutMs,
  });

  const getWithTimeout = (
    url,
    config = {},
    timeoutMs = LIST_REQUEST_TIMEOUT_MS,
  ) => api.get(url, withRequestTimeout(config, timeoutMs));

  const postWithTimeout = (
    url,
    payload,
    config = {},
    timeoutMs = LIST_REQUEST_TIMEOUT_MS,
  ) => api.post(url, payload, withRequestTimeout(config, timeoutMs));

  // Client-Requirement mapping (client_id -> requirement_ids)
  const clientRequirementMap = useMemo(() => {
    const map = {};
    const reqList = Array.isArray(requirements) ? requirements : [];
    reqList.forEach((req) => {
      const clientId = normalizeClientKey(req.client_id || req.client_name);
      const requirementId = normalizeId(
        req.id || req.job_id || req.requirement_id,
      );
      if (clientId) {
        if (!map[clientId]) map[clientId] = [];
        if (requirementId) {
          map[clientId].push(requirementId);
        }
      }
    });
    return map;
  }, [requirements]);

  // Filter requirements by selected client
  const filteredRequirements = useMemo(() => {
    const reqList = Array.isArray(requirements) ? requirements : [];
    if (selectedClient === "all") return reqList;
    const clientReqIds = clientRequirementMap[normalizeClientKey(selectedClient)] || [];
    return reqList.filter((r) =>
      clientReqIds.includes(normalizeId(r.id || r.job_id || r.requirement_id)),
    );
  }, [requirements, selectedClient, clientRequirementMap]);

  const enrichCandidatesFromProfile = async (records = []) => {
    if (!Array.isArray(records) || records.length === 0) return records;

    const getCandidateLookupKeys = (item) =>
      Array.from(
        new Set(
          [
            normalizeId(getCandidateInternalId(item)),
            normalizeId(item?.candidate_id),
            normalizeId(item?.candidate_uuid),
            normalizeId(item?.id),
            normalizeId(item?.candidate?.candidate_id),
            normalizeId(item?.candidate?.candidate_uuid),
            normalizeId(item?.candidate?.id),
            normalizeId(item?.public_id),
          ].filter(Boolean),
        ),
      );

    const getCandidateIdsForProfileFetch = (item) => {
      const candidateId = getCandidateInternalId(item);
      return candidateId ? [candidateId] : [];
    };

    const needsHydration = (item) => {
      const hasLocation = hasDisplayValue(
        pickDisplayValue(
          item?.current_location,
          item?.location,
          item?.city,
          item?.preferred_location,
        ),
      );
      const hasExperience = hasDisplayValue(
        pickDisplayValue(
          item?.experience_years,
          item?.experience,
          item?.total_experience,
        ),
      );
      const hasEmployerOrRole = hasDisplayValue(
        pickDisplayValue(
          item?.current_employer,
          item?.current_company,
          item?.current_designation,
          item?.designation,
          item?.role,
        ),
      );
      return !(hasLocation && hasExperience && hasEmployerOrRole);
    };

    const candidateIdsToFetch = Array.from(
      new Set(
        records
          .filter(needsHydration)
          .flatMap(getCandidateIdsForProfileFetch)
          .filter(Boolean),
      ),
    )
      .filter((id) => {
        const key = normalizeId(id);
        if (!key) return false;
        if (candidateDetailsCacheRef.current[key]) return false;
        if (missingCandidateDetailsRef.current.has(key)) return false;
        return true;
      })
      .slice(0, MAX_PROFILE_HYDRATION_REQUESTS);

    if (candidateIdsToFetch.length > 0) {
      for (
        let offset = 0;
        offset < candidateIdsToFetch.length;
        offset += PROFILE_HYDRATION_BATCH_SIZE
      ) {
        const chunk = candidateIdsToFetch.slice(
          offset,
          offset + PROFILE_HYDRATION_BATCH_SIZE,
        );
        const detailResults = await Promise.allSettled(
          chunk.map((id) =>
            getWithTimeout(`/v1/candidates/${id}`, {}, PROFILE_HYDRATION_TIMEOUT_MS),
          ),
        );

        detailResults.forEach((result, index) => {
          const id = chunk[index];
          const key = normalizeId(id);
          if (result.status !== "fulfilled") {
            const statusCode = result.reason?.response?.status;
            if (key && [400, 404, 422].includes(statusCode)) {
              missingCandidateDetailsRef.current.add(key);
            }
            return;
          }
          const payload = result.value?.data?.data ?? result.value?.data ?? null;
          if (payload && typeof payload === "object") {
            if (key) {
              candidateDetailsCacheRef.current[key] = payload;
              missingCandidateDetailsRef.current.delete(key);
            }
          } else if (key) {
            missingCandidateDetailsRef.current.add(key);
          }
        });
      }
    }

    return records.map((item) => {
      const lookupKeys = getCandidateLookupKeys(item);
      const cacheKey = lookupKeys.find((key) => candidateDetailsCacheRef.current[key]);
      if (!cacheKey) return item;

      const detail = candidateDetailsCacheRef.current[cacheKey];
      if (!detail || typeof detail !== "object") return item;

      const nestedDetail =
        detail?.candidate || detail?.candidate_details || detail?.profile || {};
      const mappedProfile = mapCandidateToProfile(detail, true) || {};

      const mergedDesignation = pickDisplayValue(
        item?.current_designation,
        item?.designation,
        item?.role,
        detail?.current_designation,
        detail?.designation,
        detail?.role,
        nestedDetail?.current_designation,
        nestedDetail?.designation,
        nestedDetail?.role,
        mappedProfile?.designation,
        mappedProfile?.currentRole,
      );

      return {
        ...item,
        email: pickDisplayValue(
          item?.email,
          detail?.email,
          detail?.candidate_email,
          nestedDetail?.email,
          mappedProfile?.email,
        ),
        phone: pickDisplayValue(
          item?.phone,
          detail?.phone,
          detail?.mobile,
          detail?.phone_number,
          nestedDetail?.phone,
          nestedDetail?.mobile,
          mappedProfile?.phone,
        ),
        current_location: pickDisplayValue(
          item?.current_location,
          item?.location,
          item?.city,
          item?.preferred_location,
          detail?.current_location,
          detail?.location,
          detail?.city,
          detail?.preferred_location,
          nestedDetail?.current_location,
          nestedDetail?.location,
          nestedDetail?.city,
          nestedDetail?.preferred_location,
          mappedProfile?.location,
          mappedProfile?.city,
          mappedProfile?.preferredLocation,
        ),
        experience_years: pickDisplayValue(
          item?.experience_years,
          item?.experience,
          item?.total_experience,
          detail?.experience_years,
          detail?.experience,
          detail?.total_experience,
          nestedDetail?.experience_years,
          nestedDetail?.experience,
          nestedDetail?.total_experience,
          mappedProfile?.totalExperience,
        ),
        current_employer: pickDisplayValue(
          item?.current_employer,
          item?.current_company,
          detail?.current_employer,
          detail?.current_company,
          nestedDetail?.current_employer,
          nestedDetail?.current_company,
          mappedProfile?.currentCompany,
        ),
        current_designation: mergedDesignation,
        designation: pickDisplayValue(item?.designation, mergedDesignation),
        expected_ctc: pickDisplayValue(
          item?.expected_ctc,
          item?.expected_salary,
          detail?.expected_ctc,
          detail?.expected_salary,
          nestedDetail?.expected_ctc,
          nestedDetail?.expected_salary,
          mappedProfile?.expectedCtcDisplay,
        ),
      };
    });
  };

  useEffect(() => {
    if (selectedRequirement === "all") return;
    if (!requirements.length) return;
    const selectedId = normalizeId(selectedRequirement);
    const isVisible = filteredRequirements.some((req) => {
      return normalizeId(req.id || req.job_id || req.requirement_id) === selectedId;
    });
    if (!isVisible) {
      setSelectedRequirement("all");
      setSearchParams({
        tab: activeTab,
        client: selectedClient,
        requirement: "all",
      });
    }
  }, [
    activeTab,
    filteredRequirements,
    requirements.length,
    selectedClient,
    selectedRequirement,
    setSearchParams,
  ]);

  const handleAddClient = () => {
    if (newClientName.trim()) {
      const newClient = {
        id: newClientName.toLowerCase().replace(/\s+/g, "_"),
        name: newClientName.trim(),
      };
      setClients([...clients, newClient]);
      setNewClientName("");
      setShowAddClientModal(false);
    }
  };

  // Fetch candidate full details for profile view
  const openCandidateProfile = async (candidate) => {
    setViewingCandidate(candidate);
    setDetailsLoading(true);
    try {
      const candidateId = getCandidateInternalId(candidate);
      if (!candidateId) {
        setCandidateDetails(candidate);
        return;
      }
      const res = await api.get(`/v1/candidates/${candidateId}`);
      const payload = res?.data?.data ?? res?.data ?? {};
      const cacheKey = normalizeId(candidateId);
      if (cacheKey && payload && typeof payload === "object") {
        candidateDetailsCacheRef.current[cacheKey] = payload;
      }
      setCandidateDetails(payload);
    } catch (err) {
      console.error("Failed to fetch candidate details:", err);
      // Use existing candidate data if API fails
      setCandidateDetails(candidate);
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeCandidateProfile = () => {
    setViewingCandidate(null);
    setCandidateDetails(null);
  };

  const closeFeedbackModal = () => {
    setFeedbackModal({
      open: false,
      candidate: null,
      loading: false,
      error: "",
      feedbacks: [],
    });
  };

  const openFeedbackModal = async (candidate) => {
    const candidateId = getCandidateInternalId(candidate);
    const fallbackFeedbacks = extractFeedbackFromCandidateRecord(candidate);

    setFeedbackModal({
      open: true,
      candidate,
      loading: true,
      error: "",
      feedbacks: fallbackFeedbacks,
    });

    if (!candidateId) {
      setFeedbackModal((prev) => ({
        ...prev,
        loading: false,
        error: fallbackFeedbacks.length
          ? ""
          : "Candidate id missing, unable to fetch recruiter feedback",
      }));
      return;
    }

    const endpoints = [
      `/v1/recruiter/candidates/${candidateId}/call-feedback`,
      `/v1/am/candidates/${candidateId}/call-feedback`,
      `/v1/candidates/${candidateId}/call-feedback`,
    ];

    let fetchedFeedbacks = [];
    let lastError = "";

    for (const endpoint of endpoints) {
      try {
        const res = await api.get(endpoint);
        fetchedFeedbacks = normalizeFeedbackList(getFeedbackListFromPayload(res?.data));
        if (fetchedFeedbacks.length > 0) break;
      } catch (err) {
        const statusCode = err?.response?.status;
        if (statusCode === 401 || statusCode === 403 || statusCode === 404) {
          continue;
        }
        lastError =
          err?.response?.data?.detail || err?.message || "Failed to fetch recruiter feedback";
      }
    }

    setFeedbackModal((prev) => ({
      ...prev,
      loading: false,
      feedbacks: fetchedFeedbacks.length > 0 ? fetchedFeedbacks : prev.feedbacks,
      error:
        fetchedFeedbacks.length > 0
          ? ""
          : lastError && prev.feedbacks.length === 0
            ? lastError
            : "",
    }));
  };

  const closeTimelineModal = () => {
    setTimelineModal({
      open: false,
      candidate: null,
      loading: false,
      error: "",
      items: [],
    });
  };

  const openTimelineModal = async (candidate) => {
    const candidateName =
      candidate?.full_name || candidate?.candidate_name || "Candidate";

    const candidateIds = Array.from(
      new Set(
        [
          candidate?.candidate_id,
          candidate?.id,
          candidate?.application_id,
          candidate?.candidate_uuid,
          candidate?.public_id,
          candidate?.candidate?.candidate_id,
          candidate?.candidate?.id,
        ]
          .filter(Boolean)
          .map((value) => String(value).trim()),
      ),
    );

    setTimelineModal({
      open: true,
      candidate: { ...(candidate || {}), full_name: candidateName },
      loading: true,
      error: "",
      items: [],
    });

    if (candidateIds.length === 0) {
      setTimelineModal((prev) => ({
        ...prev,
        loading: false,
        error: "Candidate id missing, unable to load timeline",
      }));
      return;
    }

    const extractTimeline = (payload) => {
      const list =
        payload?.timeline ||
        payload?.data?.timeline ||
        payload?.data ||
        payload ||
        [];
      return Array.isArray(list) ? list : [];
    };

    let loadedItems = [];
    let lastError = "";

    for (const id of candidateIds) {
      const endpoints = [
        `/workflow/candidates/${id}/timeline`,
        `/v1/workflow/candidates/${id}/timeline`,
        `/v1/candidates/${id}/timeline`,
      ];

      for (const endpoint of endpoints) {
        try {
          const res = await api.get(endpoint);
          const items = extractTimeline(res?.data);
          if (items.length > 0) {
            loadedItems = items;
            break;
          }
          if (!loadedItems.length) {
            loadedItems = items;
          }
        } catch (err) {
          const statusCode = err?.response?.status;
          if (statusCode === 401 || statusCode === 403 || statusCode === 404) {
            continue;
          }
          lastError =
            err?.response?.data?.detail ||
            err?.message ||
            "Failed to load timeline";
        }
      }

      if (loadedItems.length > 0) break;
    }

    setTimelineModal((prev) => ({
      ...prev,
      loading: false,
      items: loadedItems,
      error: loadedItems.length ? "" : lastError,
    }));
  };

  const updateStatusLocally = (candidateOrId, nextStatus) => {
    const candidateObj =
      candidateOrId && typeof candidateOrId === "object"
        ? candidateOrId
        : { id: candidateOrId };
    const normalizedNextStatus = resolveWorkflowDisplayStatus(
      candidateObj,
      nextStatus,
    );
    if (!normalizedNextStatus) return;

    const targetCandidateId = normalizeId(
      candidateObj?.candidate_id || candidateObj?.id,
    );
    const targetApplicationId = normalizeId(candidateObj?.application_id);
    const targetJobId = normalizeId(
      candidateObj?.job_id || candidateObj?.requirement_id,
    );
    const previousStatus = resolveWorkflowDisplayStatus(
      candidateObj,
      candidateObj?.status,
    );
    const activeTabConfig = AM_TABS.find((tab) => tab.id === activeTab);
    const activeStatusSet = new Set(
      (activeTabConfig?.statuses || []).map(normalizeStatus),
    );

    if (targetCandidateId) {
      statusOverridesRef.current[targetCandidateId] = normalizedNextStatus;
    }

    const matchesTarget = (item) => {
      if (targetApplicationId) {
        return normalizeId(item?.application_id) === targetApplicationId;
      }
      const itemCandidateId = normalizeId(item?.id || item?.candidate_id);
      const itemJobId = normalizeId(item?.job_id || item?.requirement_id);
      return (
        itemCandidateId === targetCandidateId &&
        (!targetJobId || itemJobId === targetJobId)
      );
    };

    setCandidates((prev) => {
      const next = [];
      prev.forEach((item) => {
        if (!matchesTarget(item)) {
          next.push(item);
          return;
        }
        if (activeStatusSet.has(normalizedNextStatus)) {
          next.push({
            ...item,
            status: normalizedNextStatus,
            updated_at: new Date().toISOString(),
          });
        }
      });
      return next;
    });

    setStatusCounts((prev) => {
      const next = { ...(prev || {}) };
      if (previousStatus) {
        next[previousStatus] = Math.max(0, (next[previousStatus] || 0) - 1);
      }
      next[normalizedNextStatus] = (next[normalizedNextStatus] || 0) + 1;
      return next;
    });

    setViewingCandidate((prev) =>
      prev && matchesTarget(prev) ? { ...prev, status: normalizedNextStatus } : prev,
    );
    setCandidateDetails((prev) =>
      prev ? { ...prev, status: normalizedNextStatus } : prev,
    );
  };

  useEffect(() => {
    fetchRequirements();
    fetchClients();
  }, []);

  useEffect(() => {
    fetchCandidates();
  }, [activeTab, selectedRequirement, selectedClient, requirements]);

  const fetchClients = async () => {
    try {
      const res = await api.get("/v1/am/clients");
      const apiClients = Array.isArray(res.data?.clients)
        ? res.data.clients
        : Array.isArray(res.data)
          ? res.data
          : [];
      if (apiClients.length > 0) {
        const formattedClients = apiClients
          .map((c) => ({
            id: String(c.id || c.client_id || "").trim(),
            name: c.name || c.client_name || c.full_name,
          }))
          .filter((c) => c.name);
        // Merge with default clients, avoiding duplicates
        const mergedClients = [...DEFAULT_CLIENTS];
        formattedClients.forEach((c) => {
          if (
            !mergedClients.find(
              (dc) => dc.name.toLowerCase() === c.name?.toLowerCase(),
            )
          ) {
            mergedClients.push({
              id: c.id || normalizeClientKey(c.name),
              name: c.name,
            });
          }
        });
        setClients(mergedClients);
      }
    } catch (err) {
      // Non-blocking: client list is also derived from requirements data.
    }
  };

  const fetchRequirements = async () => {
    const [amRequirementsResult, jobRequirementsResult] =
      await Promise.allSettled([
        api.get("/v1/am/requirements"),
        api.get("/v1/job-management/requirements", {
          params: { skip: 0, limit: 200 },
        }),
      ]);

    const mergedRawRequirements = [];
    if (amRequirementsResult.status === "fulfilled") {
      mergedRawRequirements.push(...extractList(amRequirementsResult.value?.data));
    } else {
      console.error(
        "Failed to fetch requirements from /v1/am/requirements:",
        amRequirementsResult.reason,
      );
    }

    if (jobRequirementsResult.status === "fulfilled") {
      mergedRawRequirements.push(...extractList(jobRequirementsResult.value?.data));
    } else {
      console.error(
        "Failed to fetch requirements from /v1/job-management/requirements:",
        jobRequirementsResult.reason,
      );
    }

    const normalizedRequirements = mergedRawRequirements
      .map(normalizeRequirementRecord)
      .filter((req) => normalizeId(req.id));

    const dedupedRequirements = Array.from(
      new Map(
        normalizedRequirements.map((req) => [
          normalizeId(req.id),
          req,
        ]),
      ).values(),
    );

    const activeRequirements = dedupedRequirements.filter(isRequirementActive);
    setRequirements(activeRequirements);

    setClients((prevClients) => {
      const merged = [...prevClients];
      activeRequirements.forEach((req) => {
        if (!req.client_name) return;
        const clientName = String(req.client_name).trim();
        if (!clientName) return;
        const existing = merged.find(
          (client) => normalizeClientKey(client.name) === normalizeClientKey(clientName),
        );
        if (!existing) {
          merged.push({
            id: req.client_id || normalizeClientKey(clientName),
            name: clientName,
          });
        }
      });
      return merged;
    });
  };

  const fetchCandidatesByRequirementIds = async (
    requirementIds = [],
    statuses = [],
  ) => {
    const statusSet = new Set(statuses.map(normalizeStatus));
    const selectedClientKey = normalizeClientKey(selectedClient);
    const clientRequirementIds = new Set(
      (clientRequirementMap[selectedClientKey] || []).map(normalizeId),
    );

    const records = [];
    for (const rawRequirementId of requirementIds) {
      const requirementId = normalizeId(rawRequirementId);
      if (!requirementId) continue;

      let response;
      try {
        response = await getWithTimeout(
          `/v1/recruiter/jobs/${requirementId}/submissions`,
        );
      } catch (recruiterErr) {
        try {
          response = await getWithTimeout(`/v1/jobs/${requirementId}/submissions`);
        } catch (genericErr) {
          if (!shouldSuppressFetchWarning(genericErr)) {
            console.warn(
              `Failed to fetch submissions for requirement ${requirementId}:`,
              genericErr,
            );
          }
          continue;
        }
      }

      const requirement = requirements.find(
        (req) => normalizeId(req.id || req.job_id || req.requirement_id) === requirementId,
      );
      const submissions = extractList(response?.data?.candidates ? response.data : response?.data);

      submissions.forEach((submission) => {
        const explicitSubmissionRequirementId = normalizeId(
          submission?.job_id ||
            submission?.requirement_id ||
            submission?.requirement?.id ||
            submission?.job?.id,
        );
        if (
          explicitSubmissionRequirementId &&
          explicitSubmissionRequirementId !== requirementId
        ) {
          return;
        }

        const currentStatus = normalizeStatus(submission?.status || submission?.stage);
        if (!statusSet.has(currentStatus)) return;

        const submissionRequirementId =
          explicitSubmissionRequirementId || requirementId;

        const submissionClientKey = normalizeClientKey(
          submission?.client_id || submission?.client_name || requirement?.client_id || requirement?.client_name,
        );
        if (selectedClientKey !== "all") {
          if (
            clientRequirementIds.size > 0 &&
            (!submissionRequirementId ||
              !clientRequirementIds.has(submissionRequirementId))
          ) {
            return;
          }
          if (
            clientRequirementIds.size === 0 &&
            submissionClientKey !== selectedClientKey
          ) {
            return;
          }
        }

        const candidateId =
          submission?.candidate_id ||
          submission?.candidate?.id ||
          submission?.candidate_uuid ||
          submission?.id ||
          submission?.application_id;
        if (!candidateId) return;
        const nestedSubmissionCandidate =
          submission?.candidate ||
          submission?.candidate_details ||
          submission?.profile ||
          {};
        const resolvedEmail = pickDisplayValue(
          submission?.email,
          nestedSubmissionCandidate?.email,
          submission?.candidate_email,
        );
        const resolvedPhone = pickDisplayValue(
          submission?.phone,
          nestedSubmissionCandidate?.phone,
          submission?.mobile,
          submission?.phone_number,
        );
        const resolvedExperience = pickDisplayValue(
          submission?.experience_years,
          submission?.experience,
          submission?.total_experience,
          nestedSubmissionCandidate?.experience_years,
          nestedSubmissionCandidate?.experience,
          nestedSubmissionCandidate?.total_experience,
        );
        const resolvedLocation = pickDisplayValue(
          submission?.current_location,
          submission?.location,
          submission?.city,
          nestedSubmissionCandidate?.current_location,
          nestedSubmissionCandidate?.location,
          nestedSubmissionCandidate?.city,
        );
        const resolvedEmployer = pickDisplayValue(
          submission?.current_employer,
          submission?.current_company,
          nestedSubmissionCandidate?.current_employer,
          nestedSubmissionCandidate?.current_company,
        );
        const resolvedDesignation = pickDisplayValue(
          submission?.current_designation,
          submission?.designation,
          submission?.role,
          nestedSubmissionCandidate?.current_designation,
          nestedSubmissionCandidate?.designation,
          nestedSubmissionCandidate?.role,
        );
        const resolvedExpectedCtc = pickDisplayValue(
          submission?.expected_ctc,
          submission?.expected_salary,
          nestedSubmissionCandidate?.expected_ctc,
          nestedSubmissionCandidate?.expected_salary,
        );

        records.push({
          ...submission,
          id: candidateId,
          candidate_id: candidateId,
          application_id: submission?.application_id || submission?.id,
          public_id: submission?.public_id,
          full_name: submission?.candidate_name || submission?.full_name,
          email: resolvedEmail,
          phone: resolvedPhone,
          status: currentStatus,
          skills: submission?.skills || [],
          job_id: submissionRequirementId,
          requirement_id: submissionRequirementId,
          job_title:
            requirement?.title ||
            submission?.job_title ||
            submission?.requirement_title,
          requirement_title:
            requirement?.title ||
            submission?.requirement_title ||
            submission?.job_title,
          client_name: requirement?.client_name || submission?.client_name,
          client_id: requirement?.client_id || submission?.client_id,
          recruiter_name: submission?.recruiter_name || submission?.submitted_by_name,
          submitted_by_name: submission?.submitted_by_name || submission?.recruiter_name,
          submitted_at:
            submission?.submitted_at ||
            submission?.sent_to_am_at ||
            submission?.created_at,
          updated_at: submission?.updated_at || submission?.sent_to_am_at,
          match_score: submission?.match_score,
          experience_years: resolvedExperience,
          current_location: resolvedLocation,
          current_employer: resolvedEmployer,
          current_designation: resolvedDesignation,
          designation: resolvedDesignation,
          expected_ctc: resolvedExpectedCtc,
          notes: Array.isArray(submission?.notes) ? submission.notes : [],
          latest_call_feedback:
            submission?.latest_call_feedback ||
            submission?.call_feedback ||
            null,
        });
      });
    }

    return records;
  };

  const fetchWorkflowCandidatesByStatuses = async (statuses = []) => {
    const normalizedStatuses = Array.from(
      new Set(statuses.map(normalizeStatus).filter(Boolean)),
    );
    if (!normalizedStatuses.length) return [];

    const requestedStatusSet = new Set(normalizedStatuses);

    const mapWorkflowCandidateToRecord = (workflowCandidate = {}, fallbackStatus = "") => {
      const workflowStatus = normalizeStatus(
        workflowCandidate?.status || workflowCandidate?.stage || fallbackStatus,
      );
      if (!workflowStatus || !requestedStatusSet.has(workflowStatus)) return null;

      const requirementId = normalizeId(
        workflowCandidate?.job_id ||
          workflowCandidate?.requirement_id ||
          workflowCandidate?.requirement?.id ||
          workflowCandidate?.job?.id,
      );
      const requirement = requirements.find(
        (req) => normalizeId(req.id || req.job_id || req.requirement_id) === requirementId,
      );
      const nestedWorkflowCandidate =
        workflowCandidate?.candidate ||
        workflowCandidate?.candidate_details ||
        workflowCandidate?.profile ||
        {};
      const candidateId =
        workflowCandidate?.candidate_id ||
        workflowCandidate?.candidate_uuid ||
        workflowCandidate?.candidate?.id ||
        workflowCandidate?.candidate?.candidate_id ||
        workflowCandidate?.id ||
        workflowCandidate?.application_id;
      if (!candidateId) return null;

      const resolvedEmail = pickDisplayValue(
        workflowCandidate?.email,
        nestedWorkflowCandidate?.email,
        workflowCandidate?.candidate_email,
      );
      const resolvedPhone = pickDisplayValue(
        workflowCandidate?.phone,
        nestedWorkflowCandidate?.phone,
        workflowCandidate?.mobile,
        workflowCandidate?.phone_number,
      );
      const resolvedExperience = pickDisplayValue(
        workflowCandidate?.experience_years,
        workflowCandidate?.experience,
        workflowCandidate?.total_experience,
        nestedWorkflowCandidate?.experience_years,
        nestedWorkflowCandidate?.experience,
        nestedWorkflowCandidate?.total_experience,
      );
      const resolvedLocation = pickDisplayValue(
        workflowCandidate?.current_location,
        workflowCandidate?.location,
        workflowCandidate?.city,
        nestedWorkflowCandidate?.current_location,
        nestedWorkflowCandidate?.location,
        nestedWorkflowCandidate?.city,
      );
      const resolvedEmployer = pickDisplayValue(
        workflowCandidate?.current_employer,
        workflowCandidate?.current_company,
        nestedWorkflowCandidate?.current_employer,
        nestedWorkflowCandidate?.current_company,
      );
      const resolvedDesignation = pickDisplayValue(
        workflowCandidate?.current_designation,
        workflowCandidate?.designation,
        workflowCandidate?.role,
        nestedWorkflowCandidate?.current_designation,
        nestedWorkflowCandidate?.designation,
        nestedWorkflowCandidate?.role,
      );
      const resolvedExpectedCtc = pickDisplayValue(
        workflowCandidate?.expected_ctc,
        workflowCandidate?.expected_salary,
        nestedWorkflowCandidate?.expected_ctc,
        nestedWorkflowCandidate?.expected_salary,
      );

      return {
        ...workflowCandidate,
        id: candidateId,
        candidate_id: candidateId,
        application_id:
          workflowCandidate?.application_id ||
          workflowCandidate?.id ||
          `${candidateId}-${requirementId || "no-job"}`,
        full_name:
          workflowCandidate?.candidate_name ||
          workflowCandidate?.full_name ||
          nestedWorkflowCandidate?.full_name ||
          nestedWorkflowCandidate?.name ||
          "",
        public_id: workflowCandidate?.public_id || nestedWorkflowCandidate?.public_id,
        email: resolvedEmail,
        phone: resolvedPhone,
        status: workflowStatus,
        skills: workflowCandidate?.skills || nestedWorkflowCandidate?.skills || [],
        job_id: requirementId || workflowCandidate?.job_id || workflowCandidate?.requirement_id,
        requirement_id:
          requirementId || workflowCandidate?.requirement_id || workflowCandidate?.job_id,
        job_title:
          requirement?.title ||
          workflowCandidate?.job_title ||
          workflowCandidate?.requirement_title ||
          workflowCandidate?.job?.title ||
          workflowCandidate?.requirement?.title,
        requirement_title:
          requirement?.title ||
          workflowCandidate?.requirement_title ||
          workflowCandidate?.job_title ||
          workflowCandidate?.requirement?.title ||
          workflowCandidate?.job?.title,
        client_name:
          requirement?.client_name ||
          workflowCandidate?.client_name ||
          workflowCandidate?.client?.name,
        client_id:
          requirement?.client_id ||
          workflowCandidate?.client_id ||
          workflowCandidate?.client?.id,
        recruiter_name:
          workflowCandidate?.recruiter_name ||
          workflowCandidate?.submitted_by_name,
        submitted_by_name:
          workflowCandidate?.submitted_by_name ||
          workflowCandidate?.recruiter_name,
        submitted_at:
          workflowCandidate?.submitted_at ||
          workflowCandidate?.created_at ||
          workflowCandidate?.updated_at,
        updated_at:
          workflowCandidate?.updated_at ||
          workflowCandidate?.submitted_at ||
          workflowCandidate?.created_at,
        match_score: workflowCandidate?.match_score,
        experience_years: resolvedExperience,
        current_location: resolvedLocation,
        current_employer: resolvedEmployer,
        current_designation: resolvedDesignation,
        designation: resolvedDesignation,
        expected_ctc: resolvedExpectedCtc,
        notes: Array.isArray(workflowCandidate?.notes) ? workflowCandidate.notes : [],
        latest_call_feedback:
          workflowCandidate?.latest_call_feedback ||
          workflowCandidate?.call_feedback ||
          null,
      };
    };

    try {
      const bulkResponse = await getWithTimeout("/workflow/candidates", {
        params: { limit: 200 },
      });
      const payloadList =
        bulkResponse?.data?.candidates ||
        bulkResponse?.data?.items ||
        bulkResponse?.data?.data ||
        [];
      const workflowCandidates = Array.isArray(payloadList) ? payloadList : [];
      return workflowCandidates
        .map((workflowCandidate) => mapWorkflowCandidateToRecord(workflowCandidate))
        .filter(Boolean);
    } catch (bulkErr) {
      if (!shouldSuppressFetchWarning(bulkErr)) {
        console.warn("Failed to fetch workflow candidates in bulk:", bulkErr);
      }
    }

    const records = [];
    for (const status of normalizedStatuses) {
      try {
        const response = await getWithTimeout("/workflow/candidates", {
          params: { status, limit: 200 },
        });
        const payloadList =
          response?.data?.candidates ||
          response?.data?.items ||
          response?.data?.data ||
          [];
        const workflowCandidates = Array.isArray(payloadList) ? payloadList : [];
        workflowCandidates.forEach((workflowCandidate) => {
          const mapped = mapWorkflowCandidateToRecord(workflowCandidate, status);
          if (mapped) {
            records.push(mapped);
          }
        });
      } catch (err) {
        if (!shouldSuppressFetchWarning(err)) {
          console.warn(`Failed to fetch workflow candidates for status "${status}"`, err);
        }
      }
    }

    return records;
  };

  const fetchInterviewRecords = async () => {
    const endpointConfigs = [
      { endpoint: "/v1/am/interview-logs" },
    ];
    const blockedEndpoints = unavailableInterviewEndpointsRef.current;
    const preferredEndpoint = preferredInterviewEndpointRef.current;
    const orderedConfigs = [];

    if (preferredEndpoint && !blockedEndpoints.has(preferredEndpoint)) {
      const preferredConfig = endpointConfigs.find(
        (config) => config.endpoint === preferredEndpoint,
      );
      if (preferredConfig) {
        orderedConfigs.push(preferredConfig);
      }
    }

    endpointConfigs.forEach((config) => {
      if (blockedEndpoints.has(config.endpoint)) return;
      if (orderedConfigs.some((item) => item.endpoint === config.endpoint)) return;
      orderedConfigs.push(config);
    });

    const collected = [];
    let hasReachableInterviewSource = false;

    for (const { endpoint, params } of orderedConfigs) {
      try {
        const requestConfig =
          params && Object.keys(params).length > 0 ? { params } : undefined;
        const res = await getWithTimeout(endpoint, requestConfig);
        hasReachableInterviewSource = true;
        preferredInterviewEndpointRef.current = endpoint;
        const items = getInterviewListFromPayload(res?.data);
        if (items.length > 0) {
          collected.push(...items);
        }
      } catch (err) {
        const statusCode = err?.response?.status;
        if (statusCode === 404 || statusCode === 405 || statusCode === 422) {
          blockedEndpoints.add(endpoint);
          if (preferredInterviewEndpointRef.current === endpoint) {
            preferredInterviewEndpointRef.current = "";
          }
        }
        if (
          statusCode === 401 ||
          statusCode === 403 ||
          statusCode === 404 ||
          statusCode === 405 ||
          statusCode === 422
        ) {
          continue;
        }
        if (!shouldSuppressFetchWarning(err)) {
          console.warn(`Failed to fetch interviews from ${endpoint}:`, err);
        }
      }
    }

    const unique = new Map();
    collected.forEach((interview) => {
      const candidateToken = normalizeId(
        pickDisplayValue(
          interview?.candidate_id,
          interview?.candidate?.id,
          interview?.candidate?.candidate_id,
          interview?.candidate?.public_id,
          interview?.candidate_public_id,
          interview?.candidate_email,
          interview?.candidate?.email,
          interview?.submission?.candidate_id,
          interview?.submission?.candidate?.id,
          interview?.submission?.candidate?.candidate_id,
          interview?.submission?.candidate?.public_id,
          interview?.submission?.candidate?.email,
        ),
      );
      const jobToken = normalizeId(
        pickDisplayValue(
          interview?.job_id,
          interview?.job?.id,
          interview?.requirement_id,
          interview?.job?.job_id,
          interview?.submission?.job_id,
          interview?.submission?.job?.id,
          interview?.submission?.requirement_id,
          interview?.submission?.job?.job_id,
        ),
      );
      const key =
        normalizeId(
          pickDisplayValue(interview?.id, interview?.interview_id),
        ) ||
        `${candidateToken || "unknown-candidate"}::${jobToken || "unknown-job"}::${String(pickDisplayValue(interview?.scheduled_at, interview?.start_time, interview?.created_at) || "").trim()}`;

      const existing = unique.get(key);
      const existingTs = new Date(
        pickDisplayValue(existing?.scheduled_at, existing?.updated_at, existing?.created_at) || 0,
      ).getTime();
      const incomingTs = new Date(
        pickDisplayValue(interview?.scheduled_at, interview?.updated_at, interview?.created_at) || 0,
      ).getTime();
      if (!existing || incomingTs >= existingTs) {
        unique.set(key, interview);
      }
    });

    return {
      records: Array.from(unique.values()),
      hasReachableInterviewSource,
    };
  };

  const applyInterviewStatusOverlay = async (records = []) => {
    if (!Array.isArray(records) || records.length === 0) return records;

    let interviewStatusMap = { byCandidateJob: new Map(), byCandidate: new Map() };
    try {
      const { records: interviews } = await fetchInterviewRecords();
      interviewStatusMap = buildCandidateInterviewStatusMap(interviews);
    } catch (err) {
      console.warn("Failed to build AM interview status overlay:", err);
    }

    return records.map((candidate) => {
      const candidateTokens = getCandidateIdentityTokens(candidate);
      const jobTokens = Array.from(
        new Set(
          [
            normalizeId(candidate?.job_id || candidate?.requirement_id),
            normalizeId(candidate?.job?.id || candidate?.requirement?.id),
          ].filter(Boolean),
        ),
      );

      let overlay = null;
      for (const candidateToken of candidateTokens) {
        for (const jobToken of jobTokens) {
          const scoped = interviewStatusMap.byCandidateJob.get(
            `${candidateToken}::${jobToken}`,
          );
          if (scoped) {
            overlay = scoped;
            break;
          }
        }
        if (overlay) break;
      }

      if (!overlay) {
        for (const candidateToken of candidateTokens) {
          const any = interviewStatusMap.byCandidate.get(candidateToken);
          if (any) {
            overlay = any;
            break;
          }
        }
      }

      if (overlay) {
        return {
          ...candidate,
          status: overlay.status,
          stage: overlay.status,
          interview_status: overlay.interviewStatus,
          interview_id: candidate?.interview_id || overlay.interviewId,
          interview_scheduled_at:
            overlay.scheduledAt || candidate?.interview_scheduled_at || candidate?.scheduled_at,
          interview_scheduling_ready: false,
        };
      }

      return candidate;
    });
  };

  const fetchCandidates = async () => {
    const requestVersion = ++candidateFetchVersionRef.current;
    const isLatestRequest = () =>
      candidateFetchVersionRef.current === requestVersion;

    setLoading(true);
    const tab = AM_TABS.find((t) => t.id === activeTab);
    const activeStatuses = (tab?.statuses || ["sent_to_am"]).map(normalizeStatus);
    const activeStatusSet = new Set(activeStatuses);
    const statusUniverseSet = new Set(ALL_AM_STATUSES);
    const selectedRequirementId = normalizeId(selectedRequirement);
    const selectedRequirementTitle = normalizeText(
      requirements.find(
        (r) =>
          normalizeId(r.id || r.job_id || r.requirement_id) ===
          selectedRequirementId,
      )?.title,
    );
    const selectedClientKey = normalizeClientKey(selectedClient);
    const clientRequirementIds = new Set(
      (clientRequirementMap[selectedClientKey] || []).map(normalizeId),
    );

    const resolveRequirementId = (item) =>
      normalizeId(
        item?.job_id ||
          item?.requirement_id ||
          item?.requirement?.id ||
          item?.job?.id,
      );

    const matchesScopeFilters = (item) => {
      const requirementId = resolveRequirementId(item);
      const requirementTitle = normalizeText(
        item?.requirement_title || item?.job_title,
      );
      if (selectedRequirementId !== "all") {
        if (requirementId) {
          if (requirementId !== selectedRequirementId) {
            return false;
          }
        } else if (
          !selectedRequirementTitle ||
          requirementTitle !== selectedRequirementTitle
        ) {
          return false;
        }
      }

      if (selectedClientKey !== "all") {
        if (clientRequirementIds.size > 0) {
          if (!requirementId || !clientRequirementIds.has(requirementId)) {
            return false;
          }
        } else {
          const clientKey = normalizeClientKey(
            item?.client_id || item?.client_name,
          );
          if (clientKey !== selectedClientKey) {
            return false;
          }
        }
      }

      return true;
    };

    const applyDataset = (dataset = []) => {
      if (!isLatestRequest()) return;
      const normalized = dedupeCandidates(dataset)
        .map((item) => {
          const baseStatus = resolveWorkflowDisplayStatus(
            item,
            item?.status?.value || item?.status || item?.stage,
          );
          const candidateKey = normalizeId(item?.candidate_id || item?.id);
          const overrideRawStatus = candidateKey
            ? statusOverridesRef.current[candidateKey]
            : "";
          const overrideStatus = overrideRawStatus
            ? resolveWorkflowDisplayStatus(
                { ...item, status: overrideRawStatus, stage: overrideRawStatus },
                overrideRawStatus,
              )
            : "";
          const status =
            overrideStatus &&
            getStatusPriority(overrideStatus) >= getStatusPriority(baseStatus)
              ? overrideStatus
              : baseStatus;
          return {
            ...item,
            id: item?.candidate_id || item?.id || item?.application_id,
            status,
          };
        })
        .filter((item) => normalizeId(item.id))
        .filter((item) => statusUniverseSet.has(normalizeStatus(item.status)))
        .filter(matchesScopeFilters);

      setStatusCounts(buildStatusCounts(normalized));
      setCandidates(
        normalized.filter((item) =>
          activeStatusSet.has(normalizeStatus(item.status)),
        ),
      );
    };

    try {
      let candidateRecords = [];

      // Primary: AM submissions endpoint
      try {
        const res = await getWithTimeout("/v1/am/submissions");
        const submissions = res.data?.submissions || [];
        const mappedCandidates = submissions
          .filter((submission) =>
            statusUniverseSet.has(
              normalizeStatus(submission?.status || submission?.stage),
            ),
          )
          .filter(matchesScopeFilters)
          .map((submission) => {
            const submissionRequirementId = resolveRequirementId(submission);
            const requirement = requirements.find(
              (req) =>
                normalizeId(req.id || req.job_id || req.requirement_id) ===
                submissionRequirementId,
            );
            const nestedSubmissionCandidate =
              submission?.candidate ||
              submission?.candidate_details ||
              submission?.profile ||
              {};
            const candidateId =
              submission?.candidate_id ||
              submission?.candidate_uuid ||
              submission?.candidate?.id ||
              submission?.application_id;
            const resolvedEmail = pickDisplayValue(
              submission?.email,
              nestedSubmissionCandidate?.email,
              submission?.candidate_email,
            );
            const resolvedPhone = pickDisplayValue(
              submission?.phone,
              nestedSubmissionCandidate?.phone,
              submission?.mobile,
              submission?.phone_number,
            );
            const resolvedExperience = pickDisplayValue(
              submission?.experience_years,
              submission?.experience,
              submission?.total_experience,
              nestedSubmissionCandidate?.experience_years,
              nestedSubmissionCandidate?.experience,
              nestedSubmissionCandidate?.total_experience,
            );
            const resolvedLocation = pickDisplayValue(
              submission?.current_location,
              submission?.location,
              submission?.city,
              nestedSubmissionCandidate?.current_location,
              nestedSubmissionCandidate?.location,
              nestedSubmissionCandidate?.city,
            );
            const resolvedEmployer = pickDisplayValue(
              submission?.current_employer,
              submission?.current_company,
              nestedSubmissionCandidate?.current_employer,
              nestedSubmissionCandidate?.current_company,
            );
            const resolvedDesignation = pickDisplayValue(
              submission?.current_designation,
              submission?.designation,
              submission?.role,
              nestedSubmissionCandidate?.current_designation,
              nestedSubmissionCandidate?.designation,
              nestedSubmissionCandidate?.role,
            );
            const resolvedExpectedCtc = pickDisplayValue(
              submission?.expected_ctc,
              submission?.expected_salary,
              nestedSubmissionCandidate?.expected_ctc,
              nestedSubmissionCandidate?.expected_salary,
            );

            return {
              ...submission,
              id: candidateId,
              candidate_id: candidateId,
              application_id:
                submission?.application_id ||
                submission?.id ||
                `${candidateId}-${submissionRequirementId}`,
              full_name:
                submission?.candidate_name || submission?.full_name || "",
              public_id: submission?.public_id,
              email: resolvedEmail,
              phone: resolvedPhone,
              status: normalizeStatus(
                submission?.status || submission?.stage || "sent_to_am",
              ),
              skills: submission?.skills || [],
              job_id: submissionRequirementId,
              requirement_id: submissionRequirementId,
              job_title:
                requirement?.title ||
                submission?.job_title ||
                submission?.requirement_title,
              requirement_title:
                requirement?.title ||
                submission?.requirement_title ||
                submission?.job_title,
              client_name: requirement?.client_name || submission?.client_name,
              client_id: requirement?.client_id || submission?.client_id,
              recruiter_name:
                submission?.recruiter_name || submission?.submitted_by_name,
              submitted_by_name:
                submission?.submitted_by_name || submission?.recruiter_name,
              submitted_at:
                submission?.submitted_at ||
                submission?.sent_to_am_at ||
                submission?.created_at,
              updated_at: submission?.updated_at || submission?.submitted_at,
              match_score: submission?.match_score,
              experience_years: resolvedExperience,
              current_location: resolvedLocation,
              current_employer: resolvedEmployer,
              current_designation: resolvedDesignation,
              designation: resolvedDesignation,
              expected_ctc: resolvedExpectedCtc,
              notes: Array.isArray(submission?.notes) ? submission.notes : [],
              latest_call_feedback:
                submission?.latest_call_feedback ||
                submission?.call_feedback ||
                null,
            };
          })
          .filter((candidate) => normalizeId(candidate.id));

        candidateRecords.push(...mappedCandidates);
      } catch (submissionsError) {
        if (!shouldSuppressFetchWarning(submissionsError)) {
          console.warn(
            "AM submissions endpoint failed, loading requirement-wise submissions:",
            submissionsError,
          );
        }
      }

      // Always ensure selected requirement has live candidates from submissions API
      const fallbackRequirementIds =
        selectedRequirementId !== "all"
          ? [selectedRequirementId]
          : candidateRecords.length === 0
            ? filteredRequirements.map((req) =>
                normalizeId(req.id || req.job_id || req.requirement_id),
              )
            : [];

      if (fallbackRequirementIds.length > 0) {
        const requirementIdsToLoad =
          selectedRequirementId !== "all"
            ? fallbackRequirementIds
            : fallbackRequirementIds.slice(0, 20);
        const requirementCandidates = await fetchCandidatesByRequirementIds(
          requirementIdsToLoad,
          activeStatuses,
        );
        candidateRecords.push(...requirementCandidates);
      }

      // Supplement from workflow status endpoint only when the active tab needs it
      // or when primary sources returned no rows.
      const shouldFetchWorkflowSupplement =
        candidateRecords.length === 0 ||
        activeStatuses.some((status) => WORKFLOW_SUPPLEMENT_STATUSES.has(status));
      if (shouldFetchWorkflowSupplement) {
        const workflowCandidates = await fetchWorkflowCandidatesByStatuses(activeStatuses);
        candidateRecords.push(...workflowCandidates);
      }

      if (candidateRecords.length > 0) {
        const enrichedCandidates = await enrichCandidatesFromProfile(candidateRecords);
        const statusAwareCandidates =
          await applyInterviewStatusOverlay(enrichedCandidates);
        applyDataset(statusAwareCandidates);
        return;
      }

      // Last fallback to generic workflow endpoint if status-wise requests failed.
      try {
        const genericWorkflowRes = await getWithTimeout("/workflow/candidates", {
          params: { limit: 200 },
        });
        const genericWorkflowList = Array.isArray(genericWorkflowRes?.data?.candidates)
          ? genericWorkflowRes.data.candidates
          : [];
        if (genericWorkflowList.length > 0) {
          const enrichedFallbackCandidates = await enrichCandidatesFromProfile(
            genericWorkflowList,
          );
          const statusAwareFallbackCandidates =
            await applyInterviewStatusOverlay(enrichedFallbackCandidates);
          applyDataset(statusAwareFallbackCandidates);
        }
      } catch (workflowFallbackErr) {
        if (!shouldSuppressFetchWarning(workflowFallbackErr)) {
          console.warn("Workflow fallback endpoint failed:", workflowFallbackErr);
        }
      }
    } catch (err) {
      console.error("Failed to fetch candidates:", err);
      // Fallback to old endpoint
      try {
        const res = await getWithTimeout("/v1/candidates");
        const list = extractList(res.data);
        const enrichedLegacyCandidates = await enrichCandidatesFromProfile(list);
        const statusAwareLegacyCandidates =
          await applyInterviewStatusOverlay(enrichedLegacyCandidates);
        applyDataset(statusAwareLegacyCandidates);
      } catch (e) {
        console.error("Fallback also failed:", e);
        if (isLatestRequest()) {
          setStatusCounts({});
          setCandidates([]);
        }
      }
    } finally {
      if (isLatestRequest()) {
        setLoading(false);
      }
    }
  };

  const handleAction = async (candidateOrId, action, extra = null) => {
    setActionLoading(true);
    try {
      const candidate =
        candidateOrId && typeof candidateOrId === "object"
          ? candidateOrId
          : { id: candidateOrId };
      const candidateId = getCandidateInternalId(candidate);
      const scopedJobId =
        candidate?.job_id ||
        candidate?.requirement_id ||
        (selectedRequirement !== "all" ? selectedRequirement : null);

      if (!candidateId) {
        alert(
          "Candidate internal id missing. Please refresh the page and open this candidate again.",
        );
        return;
      }

      let endpoint = "";
      let payload = {};

      switch (action) {
        case "am_view":
          endpoint = `/workflow/candidates/${candidateId}/am-view`;
          payload = { job_id: scopedJobId };
          break;
        case "am_shortlist":
          endpoint = `/workflow/candidates/${candidateId}/am-shortlist`;
          payload = { job_id: scopedJobId };
          break;
        case "am_hold":
          endpoint = `/workflow/candidates/${candidateId}/am-hold`;
          payload = { job_id: scopedJobId };
          break;
        case "am_reject":
          endpoint = `/workflow/candidates/${candidateId}/reject`;
          payload = { rejection_type: "am", job_id: scopedJobId };
          break;
        case "send_to_client":
          endpoint = `/workflow/candidates/${candidateId}/send-to-client`;
          payload = { job_id: scopedJobId };
          break;
        case "client_decision":
          endpoint = `/workflow/candidates/${candidateId}/client-decision`;
          payload = { decision: extra, job_id: scopedJobId };
          break;
        case "mark_interview_ready":
          if (
            normalizeStatus(candidate?.status || candidate?.stage) !==
            "client_shortlisted"
          ) {
            alert(
              "Interview scheduling can be enabled only when candidate is Client Shortlisted.",
            );
            return;
          }
          endpoint = `/workflow/candidates/${candidateId}/mark-interview-ready`;
          payload = {
            job_id: scopedJobId,
            notes:
              extra && typeof extra === "object"
                ? String(extra.notes || "").trim() || undefined
                : undefined,
          };
          break;
        default:
          console.error("Unknown action:", action);
          return;
      }

      const response = await postWithTimeout(endpoint, payload);
      const returnedStatus = normalizeStatus(response?.data?.status);
      const fallbackStatus =
        action === "client_decision"
          ? `client_${normalizeStatus(extra)}`
          : {
              am_view: "am_viewed",
              am_shortlist: "am_shortlisted",
              am_hold: "am_hold",
              am_reject: "am_rejected",
              send_to_client: "sent_to_client",
              mark_interview_ready: "client_shortlisted",
            }[action] || "";
      const nextStatus = returnedStatus || fallbackStatus;
      if (nextStatus) updateStatusLocally(candidate, nextStatus);
      await fetchCandidates();
    } catch (err) {
      console.error("Action failed:", err);
      alert(err.response?.data?.detail || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredCandidates = useMemo(() => {
    const selectedRequirementId = normalizeId(selectedRequirement);
    const selectedRequirementTitle = normalizeText(
      requirements.find(
        (r) =>
          normalizeId(r.id || r.job_id || r.requirement_id) ===
          selectedRequirementId,
      )?.title,
    );
    const selectedClientKey = normalizeClientKey(selectedClient);
    const clientReqIds = new Set(
      (clientRequirementMap[selectedClientKey] || []).map(normalizeId),
    );
    const term = searchTerm.trim().toLowerCase();

    const scopeFiltered = candidates.filter((candidate) => {
      const candidateRequirementId = normalizeId(
        candidate?.job_id ||
          candidate?.requirement_id ||
          candidate?.requirement?.id ||
          candidate?.job?.id,
      );
      const candidateRequirementTitle = normalizeText(
        candidate?.requirement_title || candidate?.job_title,
      );
      const requirementMatch =
        selectedRequirementId === "all" ||
        (candidateRequirementId
          ? candidateRequirementId === selectedRequirementId
          : Boolean(
              selectedRequirementTitle &&
                candidateRequirementTitle === selectedRequirementTitle,
            ));

      if (!requirementMatch) return false;

      if (selectedClientKey !== "all") {
        if (clientReqIds.size > 0) {
          return Boolean(
            candidateRequirementId && clientReqIds.has(candidateRequirementId),
          );
        }
        const candidateClientKey = normalizeClientKey(
          candidate?.client_id || candidate?.client_name,
        );
        return candidateClientKey === selectedClientKey;
      }

      return true;
    });

    if (!term) return scopeFiltered;
    return scopeFiltered.filter(
      (c) =>
        c.full_name?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.includes(term) ||
        c.job_title?.toLowerCase().includes(term) ||
        c.requirement_title?.toLowerCase().includes(term) ||
        c.recruiter_name?.toLowerCase().includes(term) ||
        c.submitted_by_name?.toLowerCase().includes(term) ||
        c.skills?.some((s) =>
          (typeof s === "string" ? s : s?.name || "")
            .toLowerCase()
            .includes(term),
        ),
    );
  }, [
    candidates,
    clientRequirementMap,
    requirements,
    searchTerm,
    selectedClient,
    selectedRequirement,
  ]);

  const sortedTimelineItems = useMemo(() => {
    if (!Array.isArray(timelineModal.items)) return [];

    const getTimestamp = (item) => {
      const rawTime = item?.at || item?.created_at || item?.updated_at || null;
      if (!rawTime) return 0;
      const timestamp = new Date(rawTime).getTime();
      return Number.isFinite(timestamp) ? timestamp : 0;
    };

    return [...timelineModal.items].sort(
      (left, right) => getTimestamp(right) - getTimestamp(left),
    );
  }, [timelineModal.items]);

  const getTabCount = (tab) => {
    return tab.statuses.reduce((sum, s) => sum + (statusCounts[s] || 0), 0);
  };

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Candidate Review
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Review candidates submitted by recruiters and track client decisions
        </p>
      </div>

      {/* Search and Refresh */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, phone, skills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <button
          onClick={() => {
            fetchRequirements();
            fetchCandidates();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Filters Section */}
      <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        {/* Client Filter */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <Building className="w-3 h-3 inline mr-1" />
            Client
          </label>
          <div className="flex gap-2">
            <div className="relative">
              <select
                value={selectedClient}
                onChange={(e) => {
                  setSelectedClient(e.target.value);
                  // Reset requirement when client changes
                  setSelectedRequirement("all");
                  setSearchParams({
                    tab: activeTab,
                    client: e.target.value,
                    requirement: "all",
                  });
                }}
                className="appearance-none w-48 pl-4 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none cursor-pointer"
              >
                <option value="all">All Clients</option>
                {clients.map((client, idx) => (
                  <option
                    key={`${client.id || "client"}-${client.name || "name"}-${idx}`}
                    value={client.id}
                  >
                    {client.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
            <button
              onClick={() => setShowAddClientModal(true)}
              className="flex items-center gap-1 px-3 py-2.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
              title="Add new client"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Requirement Filter */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <Filter className="w-3 h-3 inline mr-1" />
            Requirement
          </label>
          <div className="relative">
            <select
              value={selectedRequirement}
              onChange={(e) => {
                setSelectedRequirement(e.target.value);
                setSearchParams({
                  tab: activeTab,
                  client: selectedClient,
                  requirement: e.target.value,
                });
              }}
              className="appearance-none w-64 pl-4 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer"
            >
              <option value="all">All Requirements</option>
              {filteredRequirements.map((req, idx) => (
                <option
                  key={`${req.id || "req"}-${req.requirement_code || req.title || idx}`}
                  value={req.id}
                >
                  {req.title ||
                    req.requirement_code ||
                    `REQ-${req.id?.slice(0, 8)}`}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
        </div>

        {/* Status Filter */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <div className="relative">
            <select
              value={activeTab}
              onChange={(e) => {
                setActiveTab(e.target.value);
                setSearchParams({
                  tab: e.target.value,
                  client: selectedClient,
                  requirement: selectedRequirement,
                });
              }}
              className="appearance-none w-56 pl-4 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
            >
              {AM_TABS.map((tab) => {
                const count = getTabCount(tab);
                return (
                  <option key={tab.id} value={tab.id}>
                    {tab.label} {count > 0 ? `(${count})` : ""}
                  </option>
                );
              })}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
        </div>

        {/* Current Selection Summary */}
        <div className="flex items-center gap-3 ml-auto flex-wrap">
          {/* Client Badge */}
          {selectedClient !== "all" && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
              <Building className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300 max-w-[150px] truncate">
                {clients.find((c) => c.id === selectedClient)?.name ||
                  "Selected Client"}
              </span>
              <button
                onClick={() => {
                  setSelectedClient("all");
                  setSelectedRequirement("all");
                  setSearchParams({
                    tab: activeTab,
                    client: "all",
                    requirement: "all",
                  });
                }}
                className="ml-1 text-green-400 hover:text-green-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Requirement Badge */}
          {selectedRequirement !== "all" && (
            <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg">
              <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-medium text-purple-700 dark:text-purple-300 max-w-[200px] truncate">
                {requirements.find(
                  (r) =>
                    normalizeId(r.id || r.job_id || r.requirement_id) ===
                    normalizeId(selectedRequirement),
                )?.title || "Selected Requirement"}
              </span>
              <button
                onClick={() => {
                  setSelectedRequirement("all");
                  setSearchParams({
                    tab: activeTab,
                    client: selectedClient,
                    requirement: "all",
                  });
                }}
                className="ml-1 text-purple-400 hover:text-purple-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Status Badge */}
          {(() => {
            const currentTab = AM_TABS.find((t) => t.id === activeTab);
            const Icon = currentTab?.icon || Send;
            const count = getTabCount(currentTab);
            return (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  {currentTab?.label}
                </span>
                {count > 0 && (
                  <span className="px-2 py-0.5 bg-blue-600 text-white rounded-full text-xs font-medium">
                    {count}
                  </span>
                )}
              </div>
            );
          })()}

          {/* Results count */}
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {filteredCandidates.length} candidate
            {filteredCandidates.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600 dark:text-gray-400">
            Loading candidates...
          </span>
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No candidates found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchTerm
              ? "Try adjusting your search terms"
              : `No candidates in ${AM_TABS.find((t) => t.id === activeTab)?.label} stage`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCandidates.map((candidate, idx) => (
            <AMCandidateCard
              key={
                candidate.application_id ||
                `${candidate.id || "candidate"}-${candidate.job_id || candidate.requirement_id || "no-job"}-${idx}`
              }
              candidate={candidate}
              onAction={handleAction}
              onViewProfile={openCandidateProfile}
              onViewFeedback={openFeedbackModal}
              onViewTimeline={openTimelineModal}
            />
          ))}
        </div>
      )}

      {timelineModal.open && (
        <div
          className="fixed inset-0 z-[96] bg-black/50 flex items-center justify-center p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeTimelineModal();
            }
          }}
        >
          <div className="w-full max-w-3xl max-h-[86vh] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Status Timeline
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {timelineModal.candidate?.full_name ||
                    timelineModal.candidate?.candidate_name ||
                    "Candidate"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeTimelineModal}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Close timeline"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 overflow-y-auto space-y-4">
              {timelineModal.loading && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading timeline...
                </div>
              )}

              {!timelineModal.loading && timelineModal.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-900/40 dark:text-red-300">
                  {timelineModal.error}
                </div>
              )}

              {!timelineModal.loading && sortedTimelineItems.length === 0 && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-600 dark:text-gray-300">
                  No timeline entries found.
                </div>
              )}

              {!timelineModal.loading && sortedTimelineItems.length > 0 && (
                <div className="space-y-4">
                  {sortedTimelineItems.map((item, index) => {
                    const statusCategory = classifyTimelineStatus(item?.status);
                    const visual =
                      TIMELINE_VISUALS[statusCategory] || TIMELINE_VISUALS.sent;
                    const TimelineIcon = visual.icon;
                    const badgeLabel = getTimelineBadgeLabel(item, statusCategory);
                    const actor = pickDisplayValue(
                      item?.by,
                      item?.user,
                      item?.actor_name,
                      item?.created_by_name,
                    );
                    const role = toTitleWords(
                      pickDisplayValue(item?.role, item?.actor_role),
                    );
                    const note = getDisplayTimelineNote(
                      item?.note || item?.message || item?.summary,
                    );
                    const eventDate = formatTimelineDateTime(
                      item?.at || item?.created_at || item?.updated_at,
                    );
                    const isLatest = index === 0;

                    return (
                      <div
                        key={item.id || `${item.status || "status"}-${item.at || index}`}
                        className="relative pl-12"
                      >
                        {index < sortedTimelineItems.length - 1 && (
                          <span className="absolute left-[17px] top-10 bottom-[-16px] w-px bg-gray-200 dark:bg-gray-700" />
                        )}

                        <span
                          className={`absolute left-0 top-2 flex h-9 w-9 items-center justify-center rounded-full border ${visual.markerClass}`}
                        >
                          <TimelineIcon className="h-4 w-4" />
                        </span>

                        <div
                          className={`rounded-xl border bg-white dark:bg-gray-900 px-4 py-3 shadow-sm ${isLatest ? visual.latestClass : "border-gray-200 dark:border-gray-700"}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${visual.badgeClass}`}
                              >
                                {badgeLabel}
                              </span>
                              {isLatest && (
                                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                  Latest
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                              {eventDate}
                            </span>
                          </div>

                          {(actor || role) && (
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                              {actor || "System"}
                              {role ? ` • ${role}` : ""}
                            </p>
                          )}

                          {note && (
                            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                              {note}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {feedbackModal.open && (
        <div
          className="fixed inset-0 z-[95] bg-black/50 flex items-center justify-center p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeFeedbackModal();
            }
          }}
        >
          <div className="w-full max-w-3xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[88vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Recruiter Feedback
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {feedbackModal.candidate?.full_name ||
                    feedbackModal.candidate?.candidate_name ||
                    "Candidate"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeFeedbackModal}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Close feedback"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 overflow-y-auto space-y-4">
              {feedbackModal.loading && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading feedback...
                </div>
              )}

              {!feedbackModal.loading &&
                feedbackModal.error &&
                feedbackModal.feedbacks.length === 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-900/40 dark:text-red-300">
                    {feedbackModal.error}
                  </div>
                )}

              {!feedbackModal.loading && feedbackModal.feedbacks.length === 0 && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-600 dark:text-gray-300">
                  No recruiter feedback found for this candidate.
                </div>
              )}

              {!feedbackModal.loading &&
                feedbackModal.feedbacks.map((feedback, index) => {
                  const overallRating = getOverallFeedbackRating(feedback);
                  return (
                    <div
                      key={`${feedback.id}-${index}`}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900/20"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            {feedback.decision || "Feedback"}
                          </span>
                          {overallRating && (
                            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              Rating: {overallRating}/5
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatFeedbackDate(feedback.call_date)}
                        </span>
                      </div>

                      {feedback.summary && (
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                            Summary
                          </p>
                          <p className="text-sm text-gray-700 dark:text-gray-200">
                            {feedback.summary}
                          </p>
                        </div>
                      )}

                      {(feedback.strengths || feedback.concerns || feedback.additional_notes) && (
                        <div className="grid gap-3 md:grid-cols-3">
                          {feedback.strengths && (
                            <div className="rounded-md bg-emerald-50 dark:bg-emerald-900/20 p-3">
                              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase mb-1">
                                Strengths
                              </p>
                              <p className="text-sm text-emerald-900 dark:text-emerald-100">
                                {feedback.strengths}
                              </p>
                            </div>
                          )}
                          {feedback.concerns && (
                            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
                              <p className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase mb-1">
                                Concerns
                              </p>
                              <p className="text-sm text-red-900 dark:text-red-100">
                                {feedback.concerns}
                              </p>
                            </div>
                          )}
                          {feedback.additional_notes && (
                            <div className="rounded-md bg-gray-50 dark:bg-gray-800 p-3">
                              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase mb-1">
                                Additional Notes
                              </p>
                              <p className="text-sm text-gray-700 dark:text-gray-200">
                                {feedback.additional_notes}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {(feedback.salary_alignment || feedback.candidate_intent) && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {feedback.salary_alignment && (
                            <span className="px-2 py-1 text-xs rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300">
                              Salary: {feedback.salary_alignment}
                            </span>
                          )}
                          {feedback.candidate_intent && (
                            <span className="px-2 py-1 text-xs rounded-full bg-cyan-100 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300">
                              Intent: {feedback.candidate_intent}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Candidate Profile Modal - Using CandidateDetail Component */}
      {viewingCandidate && candidateDetails && (
        (() => {
          const modalStatus = normalizeStatus(
            viewingCandidate?.status || candidateDetails?.status,
          );
          const isAmShortlisted = modalStatus === "am_shortlisted";
          const isAmHold = modalStatus === "am_hold";
          const hideAllStatusActions = modalStatus === "am_rejected";
          const canSendToClient = modalStatus === "am_shortlisted";
          const isInterviewStage = [
            "interview_scheduled",
            "interview_completed",
          ].includes(modalStatus);
          const isClientStage = [
            "sent_to_client",
            "client_shortlisted",
            "client_hold",
            "client_rejected",
            "interview_scheduled",
            "interview_completed",
          ].includes(modalStatus);
          const isClientShortlisted = modalStatus === "client_shortlisted";
          const isClientHold = modalStatus === "client_hold";
          const isClientRejected = modalStatus === "client_rejected";
          const isInterviewSchedulingReady = Boolean(
            viewingCandidate?.interview_scheduling_ready ||
              candidateDetails?.interview_scheduling_ready,
          );
          const canTakeClientDecision = isClientStage && !isInterviewStage;
          const mergedModalCandidate = {
            ...(viewingCandidate || {}),
            ...(candidateDetails || {}),
            status:
              normalizeStatus(viewingCandidate?.status) ||
              normalizeStatus(candidateDetails?.status) ||
              candidateDetails?.status,
            job_id:
              candidateDetails?.job_id ||
              viewingCandidate?.job_id ||
              viewingCandidate?.requirement_id,
            requirement_id:
              candidateDetails?.requirement_id ||
              viewingCandidate?.requirement_id ||
              viewingCandidate?.job_id,
            job_title:
              candidateDetails?.job_title ||
              candidateDetails?.requirement_title ||
              viewingCandidate?.job_title ||
              viewingCandidate?.requirement_title,
            requirement_title:
              candidateDetails?.requirement_title ||
              candidateDetails?.job_title ||
              viewingCandidate?.requirement_title ||
              viewingCandidate?.job_title,
            client_name:
              candidateDetails?.client_name || viewingCandidate?.client_name,
            client_id: candidateDetails?.client_id || viewingCandidate?.client_id,
          };

          return (
        <CandidateDetail
          candidate={mergedModalCandidate}
          profile={mapCandidateToProfile(mergedModalCandidate, true)}
          loading={detailsLoading}
          onClose={closeCandidateProfile}
          onPreviewResume={(url) => window.open(url, "_blank")}
          hideFeedbackSection
          customQuickActions={[
            // AM Actions
            ...(hideAllStatusActions || isAmShortlisted || isClientStage
              ? []
              : [
                  {
                    label: "AM Shortlist",
                    variant: "success",
                    onClick: () => {
                      handleAction(viewingCandidate, "am_shortlist");
                    },
                  },
                ]),
            ...(hideAllStatusActions || isClientStage
              ? []
              : [
                  {
                    label: "Send to Client",
                    variant: "primary",
                    disabled: actionLoading || !canSendToClient,
                    onClick: () => {
                      handleAction(viewingCandidate, "send_to_client");
                    },
                  },
                ]),
            ...(!hideAllStatusActions &&
            !isAmShortlisted &&
            !isAmHold &&
            !isClientStage
              ? [
                  {
                    label: "AM Hold",
                    variant: "warning",
                    onClick: () => {
                      handleAction(viewingCandidate, "am_hold");
                    },
                  },
                ]
              : []),
            ...(hideAllStatusActions || isAmShortlisted || isClientStage
              ? []
              : [
                  {
                    label: "AM Reject",
                    variant: "danger",
                    onClick: () => {
                      handleAction(viewingCandidate, "am_reject");
                    },
                  },
                ]),
            // Client Actions
            ...(hideAllStatusActions || isClientShortlisted || isClientRejected || isInterviewStage
              ? []
              : [
                  {
                    label: "Client Shortlisted",
                    variant: "success",
                    disabled: actionLoading || !canTakeClientDecision,
                    onClick: () => {
                      handleAction(viewingCandidate, "client_decision", "shortlisted");
                    },
                  },
                  ...(!isClientHold
                    ? [
                        {
                          label: "Client Hold",
                          variant: "warning",
                          disabled: actionLoading || !canTakeClientDecision,
                          onClick: () => {
                            handleAction(viewingCandidate, "client_decision", "hold");
                          },
                        },
                      ]
                    : []),
                  {
                    label: "Client Rejected",
                    variant: "danger",
                    disabled: actionLoading || !canTakeClientDecision,
                    onClick: () => {
                      handleAction(viewingCandidate, "client_decision", "rejected");
                    },
                  },
                ]),
            ...(hideAllStatusActions || !isClientShortlisted || isInterviewSchedulingReady
              ? []
              : [
                  {
                    label: "Interview Scheduling Ready",
                    variant: "primary",
                    disabled: actionLoading,
                    onClick: () => {
                      const defaultNote =
                        "Client shortlisted candidate. Marked Interview Scheduling Ready for recruiter.";
                      const note = window.prompt(
                        "Add internal note for recruiter (optional)",
                        defaultNote,
                      );
                      if (note === null) return;
                      handleAction(viewingCandidate, "mark_interview_ready", {
                        notes: note,
                      });
                    },
                  },
                ]),
            ...(hideAllStatusActions || !isClientShortlisted || !isInterviewSchedulingReady
              ? []
              : [
                  {
                    label: "Interview Scheduling Ready",
                    variant: "success",
                    disabled: true,
                    onClick: () => {},
                  },
                ]),
            // Communication
            {
              label: "Message Recruiter",
              variant: "primary",
              onClick: (candidate) => {
                // Navigate to message recruiter or open email
                const recruiterEmail = candidateDetails?.recruiter_email;
                if (recruiterEmail) {
                  window.location.href = `mailto:${recruiterEmail}?subject=Regarding Candidate: ${candidateDetails?.full_name || candidateDetails?.candidate_name}`;
                } else {
                  alert("Recruiter contact not available");
                }
              },
            },
            {
              label: "Open Full Profile",
              variant: "ghost",
              onClick: () => {
                closeCandidateProfile();
                navigate(`/candidates/${viewingCandidate.id}`);
              },
            },
          ]}
        />
          );
        })()
      )}

      {/* Add Client Modal */}
      {showAddClientModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add New Client
              </h3>
              <button
                onClick={() => {
                  setShowAddClientModal(false);
                  setNewClientName("");
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Client Name
              </label>
              <input
                type="text"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Enter client name"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddClientModal(false);
                  setNewClientName("");
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddClient}
                disabled={!newClientName.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Client
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
