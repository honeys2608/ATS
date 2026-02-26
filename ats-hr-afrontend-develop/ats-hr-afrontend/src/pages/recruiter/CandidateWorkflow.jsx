import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import CandidateDetail from "../../components/candidate-profile/CandidateDetail";
import candidateService from "../../services/candidateService";
import { mapCandidateToProfile } from "../../utils/candidateProfileUtils";
import {
  Users,
  Phone,
  MessageSquare,
  Clock,
  XCircle,
  Send,
  Calendar,
  CheckCircle,
  Star,
  Search,
  RefreshCw,
  Eye,
  Mail,
  MapPin,
  Briefcase,
  DollarSign,
  AlertCircle,
  UserCheck,
  UserX,
  Loader2,
} from "lucide-react";

// Status configuration with colors and icons
const STATUS_CONFIG = {
  new: { label: "New", color: "bg-blue-100 text-blue-700", icon: Users },
  applied: {
    label: "Applied",
    color: "bg-blue-100 text-blue-700",
    icon: Users,
  },
  sourced: {
    label: "Sourced",
    color: "bg-blue-100 text-blue-700",
    icon: Users,
  },
  called: {
    label: "Called",
    color: "bg-indigo-100 text-indigo-700",
    icon: Phone,
  },
  feedback_added: {
    label: "Feedback Added",
    color: "bg-purple-100 text-purple-700",
    icon: MessageSquare,
  },
  hold_revisit: {
    label: "Hold/Revisit",
    color: "bg-amber-100 text-amber-700",
    icon: Clock,
  },
  rejected_by_recruiter: {
    label: "Rejected",
    color: "bg-red-100 text-red-700",
    icon: XCircle,
  },
  sent_to_am: {
    label: "Sent to AM",
    color: "bg-teal-100 text-teal-700",
    icon: Send,
  },
  am_shortlisted: {
    label: "AM Shortlisted",
    color: "bg-green-100 text-green-700",
    icon: Star,
  },
  am_rejected: {
    label: "AM Rejected",
    color: "bg-red-100 text-red-700",
    icon: UserX,
  },
  sent_to_client: {
    label: "Sent to Client",
    color: "bg-orange-100 text-orange-700",
    icon: Send,
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
  offer_declined: {
    label: "Offer Declined",
    color: "bg-gray-100 text-gray-700",
    icon: XCircle,
  },
};

const normalizeStatus = (value) =>
  {
    const normalized = String(value || "new")
      .toLowerCase()
      .trim();
    // AM Viewed is treated as part of Sent to AM in recruiter workflow UI.
    if (normalized === "am_viewed") return "sent_to_am";
    // Client Viewed is treated as part of Sent to Client in recruiter workflow UI.
    if (normalized === "client_viewed") return "sent_to_client";
    return normalized;
  };

const normalizeTimelineStatus = (value) =>
  String(value || "")
    .toLowerCase()
    .trim();

const ALL_WORKFLOW_STATUS_OPTIONS = [
  "new",
  "applied",
  "sourced",
  "called",
  "feedback_added",
  "hold_revisit",
  "rejected_by_recruiter",
  "sent_to_am",
  "am_shortlisted",
  "hold_revisit",
  "am_rejected",
  "sent_to_client",
  "client_shortlisted",
  "client_hold",
  "client_rejected",
  "interview_scheduled",
  "interview_completed",
  "selected",
  "negotiation",
  "offer_extended",
  "offer_accepted",
  "offer_declined",
  "hired",
  "joined",
  "rejected",
];

const POST_AM_STATUS_OPTIONS = [
  "sent_to_am",
  "am_shortlisted",
  "hold_revisit",
  "am_rejected",
  "sent_to_client",
  "client_shortlisted",
  "client_hold",
  "client_rejected",
  "interview_scheduled",
  "interview_completed",
  "selected",
  "negotiation",
  "offer_extended",
  "offer_accepted",
  "offer_declined",
  "hired",
  "joined",
  "rejected",
];

const formatStatusLabel = (status, options = {}) => {
  if (status === "hold_revisit" && options.isJobScoped) {
    return "AM Hold";
  }
  return (
    STATUS_CONFIG[status]?.label ||
    status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
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

const normalizeCandidateKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const PUBLIC_CANDIDATE_ID_REGEX = /^[a-z]{2,6}-c-\d{3,}$/i;
const UUID_CANDIDATE_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OBJECT_CANDIDATE_ID_REGEX = /^[0-9a-f]{24}$/i;
const HEX32_CANDIDATE_ID_REGEX = /^[0-9a-f]{32}$/i;
const ULID_CANDIDATE_ID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const NUMERIC_CANDIDATE_ID_REGEX = /^\d+$/;

const isPublicCandidateId = (value) =>
  PUBLIC_CANDIDATE_ID_REGEX.test(String(value || "").trim());

const isLikelyCandidateApiId = (value) => {
  const id = String(value || "").trim();
  if (!id || isPublicCandidateId(id)) return false;
  return (
    UUID_CANDIDATE_ID_REGEX.test(id) ||
    OBJECT_CANDIDATE_ID_REGEX.test(id) ||
    HEX32_CANDIDATE_ID_REGEX.test(id) ||
    ULID_CANDIDATE_ID_REGEX.test(id) ||
    NUMERIC_CANDIDATE_ID_REGEX.test(id)
  );
};

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
      .map((value) => normalizeCandidateKey(value))
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
    const normalizedId = normalizeCandidateKey(id);
    if (!normalizedId) continue;
    if (applicationIds.has(normalizedId)) continue;
    if (!isLikelyCandidateApiId(id)) continue;
    return id;
  }

  return "";
};

const formatExperienceLabel = (value) => {
  if (!hasDisplayValue(value)) return "--";
  const text = String(value).trim();
  if (!text) return "--";
  if (/yr|year/i.test(text)) return text;
  return `${text} yrs`;
};

const formatDateTimeLocalMin = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getCurrentUserId = () => {
  const direct = String(
    localStorage.getItem("user_id") ||
      localStorage.getItem("id") ||
      "",
  ).trim();
  if (direct) return direct;

  try {
    const rawUser = localStorage.getItem("user");
    if (!rawUser) return "";
    const parsed = JSON.parse(rawUser);
    return String(parsed?.id || parsed?.user_id || "").trim();
  } catch {
    return "";
  }
};

const getAssignedRecruiterId = (candidate = {}) =>
  String(
    pickDisplayValue(
      candidate?.assigned_recruiter_id,
      candidate?.recruiter_id,
      candidate?.submitted_by,
    ) || "",
  ).trim();

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
      if (interviewStatus === "cancelled" || interviewStatus === "rejected") {
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

const getEffectiveCandidateStatus = (candidate = {}, fallbackStatus = "new") => {
  const rawStatus = normalizeStatus(
    candidate?.status || candidate?.stage || fallbackStatus || "new",
  );

  if (rawStatus === "interview_scheduled" && !hasInterviewScheduledEvidence(candidate)) {
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

    // If AM handoff note exists and ready flag was consumed, trust interview_scheduled.
    if (!schedulingReady && schedulingNote) {
      return "interview_scheduled";
    }
    return "client_shortlisted";
  }

  return rawStatus;
};

const getCandidateIdentityTokens = (candidate = {}) => {
  const nestedCandidate =
    candidate?.candidate || candidate?.candidate_details || candidate?.profile || {};
  const values = [
    candidate?.id,
    candidate?.candidate_id,
    candidate?.application_id,
    candidate?.public_id,
    nestedCandidate?.id,
    nestedCandidate?.candidate_id,
    nestedCandidate?.public_id,
  ];
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean),
    ),
  );
};

const getCandidateCardKey = (candidate = {}) =>
  String(
    pickDisplayValue(
      candidate?.id,
      candidate?.candidate_id,
      candidate?.application_id,
      candidate?.public_id,
    ) || "",
  )
    .trim()
    .toLowerCase();

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
    );
    const candidateId = String(
      pickDisplayValue(
        interview?.candidate?.id,
        interview?.candidate_id,
        interview?.candidate?.candidate_id,
      ) || "",
    )
      .trim()
      .toLowerCase();
    const jobId = String(
      pickDisplayValue(
        interview?.job?.id,
        interview?.job_id,
      ) || "",
    )
      .trim()
      .toLowerCase();

    if (!candidateId) return;

    const record = {
      status: effectiveStatus,
      scheduledAt: scheduledAt || null,
      interviewStatus: rawStatus,
    };

    if (jobId) {
      const key = `${candidateId}::${jobId}`;
      const existing = byCandidateJob.get(key);
      if (shouldReplace(existing, scheduledAt)) {
        byCandidateJob.set(key, record);
      }
    }

    const existingAny = byCandidate.get(candidateId);
    if (shouldReplace(existingAny, scheduledAt)) {
      byCandidate.set(candidateId, record);
    }
  });

  return { byCandidateJob, byCandidate };
};

const matchesTargetCandidate = (
  candidate = {},
  targetCandidateId = "",
  targetCandidateName = "",
) => {
  const normalizedTargetId = String(targetCandidateId || "").trim().toLowerCase();
  const normalizedTargetName = String(targetCandidateName || "").trim().toLowerCase();

  if (normalizedTargetId) {
    const identityTokens = getCandidateIdentityTokens(candidate);
    if (identityTokens.includes(normalizedTargetId)) return true;
  }

  if (normalizedTargetName) {
    const candidateName = String(
      pickDisplayValue(
        candidate?.full_name,
        candidate?.candidate_name,
        candidate?.name,
      ) || "",
    )
      .trim()
      .toLowerCase();
    if (
      candidateName &&
      (candidateName.includes(normalizedTargetName) ||
        normalizedTargetName.includes(candidateName))
    ) {
      return true;
    }
  }

  return false;
};

const canRecruiterScheduleInterview = (candidate = {}, currentUserId = "") => {
  const status = getEffectiveCandidateStatus(candidate);
  if (!["client_shortlisted", "interview_scheduled", "interview_completed"].includes(status)) {
    return false;
  }
  const nestedCandidate =
    candidate?.candidate || candidate?.candidate_details || candidate?.profile || {};

  // First-round scheduling requires AM handoff notification.
  if (status === "client_shortlisted") {
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
    if (!schedulingReady || !schedulingNote) return false;
  }

  const assignedRecruiterId = getAssignedRecruiterId(candidate);
  if (assignedRecruiterId && currentUserId) {
    return assignedRecruiterId === String(currentUserId).trim();
  }
  if (candidate?.is_assigned_recruiter === true) return true;
  // If recruiter assignment is not present in payload, allow scheduling for ready handoff.
  return true;
};

const toTitleWords = (value) =>
  String(value || "")
    .trim()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

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
  interview: {
    label: "Interview",
    icon: Calendar,
    markerClass: "bg-violet-50 border-violet-200 text-violet-700",
    badgeClass: "bg-violet-50 border-violet-200 text-violet-700",
    latestClass: "ring-2 ring-violet-200 border-violet-200 shadow-md",
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
  const normalized = normalizeTimelineStatus(statusValue);

  if (normalized.includes("reject")) return "rejected";
  if (normalized.includes("hold")) return "hold";
  if (normalized.includes("interview")) return "interview";
  if (
    normalized.includes("shortlist") ||
    ["selected", "hired", "joined", "offer_accepted"].includes(normalized)
  ) {
    return "shortlisted";
  }

  return "sent";
};

const getTimelineRejectionSource = (item = {}) => {
  const normalized = normalizeTimelineStatus(item?.status);
  if (normalized === "am_rejected") return "Account Manager";
  if (normalized === "client_rejected") return "Client";

  const roleText = toTitleWords(
    pickDisplayValue(item?.role, item?.actor_role, item?.actor_type),
  ).toLowerCase();
  if (roleText.includes("account manager")) return "Account Manager";
  if (roleText.includes("client")) return "Client";

  const actorText = String(pickDisplayValue(item?.by, item?.user, item?.actor_name))
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

  const actorText = String(pickDisplayValue(item?.by, item?.user, item?.actor_name))
    .trim()
    .toLowerCase();
  if (actorText.includes("account manager")) return "Account Manager";
  if (actorText.includes("client")) return "Client";
  if (actorText.includes("recruiter")) return "Recruiter";
  if (actorText.includes("candidate")) return "Candidate";

  return "";
};

const getTimelineHoldSource = (item = {}) => {
  const normalized = normalizeTimelineStatus(item?.status);
  if (normalized === "am_hold" || normalized === "hold_revisit") {
    return "Account Manager";
  }
  if (normalized === "client_hold") return "Client";

  return getTimelineRoleSource(item);
};

const getTimelineShortlistSource = (item = {}) => {
  const normalized = normalizeTimelineStatus(item?.status);
  if (normalized === "am_shortlisted") return "Account Manager";
  if (normalized === "client_shortlisted") return "Client";
  return getTimelineRoleSource(item);
};

const getTimelineSentSource = (item = {}) => {
  const normalized = normalizeTimelineStatus(item?.status);
  const roleSource = getTimelineRoleSource(item);
  if (roleSource) return roleSource;

  if (normalized === "sent_to_client") return "Account Manager";
  if (normalized === "sent_to_am") return "Recruiter";
  if (normalized === "client_viewed") return "Client";
  if (normalized === "am_viewed") return "Account Manager";

  return "";
};

const getTimelineBadgeLabel = (item = {}, statusCategory = "sent") => {
  const normalized = normalizeTimelineStatus(item?.status);

  if (normalized === "am_viewed") {
    const source = getTimelineRoleSource(item) || "Account Manager";
    return `Viewed by ${source}`;
  }
  if (normalized === "client_viewed") {
    const source = getTimelineRoleSource(item) || "Client";
    return `Viewed by ${source}`;
  }

  if (statusCategory === "hold") {
    const source = getTimelineHoldSource(item);
    return source ? `On Hold by ${source}` : "On Hold";
  }

  if (statusCategory === "interview") {
    if (normalized === "interview_completed") return "Interview Completed";
    if (normalized === "interview_scheduled") return "Interview Scheduled";
    return "Interview";
  }

  if (statusCategory === "shortlisted") {
    const source = getTimelineShortlistSource(item);
    return source ? `Shortlisted by ${source}` : "Shortlisted";
  }

  if (statusCategory === "sent") {
    const source = getTimelineSentSource(item);
    if (normalized === "sent_to_am") {
      return source && source !== "Account Manager"
        ? `Sent to Account Manager by ${source}`
        : "Sent to Account Manager";
    }
    if (normalized === "sent_to_client") {
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

const formatCandidatePublicId = (...values) => {
  const rawValue = pickDisplayValue(...values);
  if (!rawValue) return "";

  const text = String(rawValue).trim();
  const normalized = text.toUpperCase();
  const prefixedCodeMatch = normalized.match(/^[A-Z]+-C-(\d+)$/);

  if (prefixedCodeMatch) {
    return `ATS-C-${prefixedCodeMatch[1].padStart(4, "0")}`;
  }

  return text;
};

const ensureUniqueCandidatePublicIds = (records = []) => {
  const parseAtsNumber = (value) => {
    const match = String(value || "")
      .trim()
      .toUpperCase()
      .match(/^ATS-C-(\d+)$/);
    if (!match) return null;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  let nextNumber =
    records.reduce((maxValue, candidate) => {
      const current = parseAtsNumber(candidate?.public_id);
      return current && current > maxValue ? current : maxValue;
    }, 0) + 1;

  const usedNumbers = new Set();

  return records.map((candidate) => {
    const currentNumber = parseAtsNumber(candidate?.public_id);
    let assignedNumber = currentNumber;

    if (!assignedNumber || usedNumbers.has(assignedNumber)) {
      while (usedNumbers.has(nextNumber)) {
        nextNumber += 1;
      }
      assignedNumber = nextNumber;
      nextNumber += 1;
    }

    usedNumbers.add(assignedNumber);

    return {
      ...candidate,
      public_id: `ATS-C-${String(assignedNumber).padStart(4, "0")}`,
    };
  });
};

const normalizeCandidateForCard = (candidate = {}, defaults = {}) => {
  const nestedCandidate =
    candidate?.candidate || candidate?.candidate_details || candidate?.profile || {};
  const normalizedId = pickDisplayValue(
    candidate?.candidate_id,
    candidate?.id,
    candidate?.application_id,
    nestedCandidate?.candidate_id,
    nestedCandidate?.id,
    candidate?.public_id,
  );

  const resolvedSkills = Array.isArray(candidate?.skills)
    ? candidate.skills
    : Array.isArray(nestedCandidate?.skills)
      ? nestedCandidate.skills
      : [];

  return {
    ...candidate,
    ...defaults,
    id: normalizedId ? String(normalizedId) : "",
    candidate_id: pickDisplayValue(
      candidate?.candidate_id,
      candidate?.id,
      nestedCandidate?.candidate_id,
      nestedCandidate?.id,
      normalizedId,
    ),
    application_id: pickDisplayValue(
      candidate?.application_id,
      candidate?.applicationId,
      candidate?.id,
    ),
    full_name:
      pickDisplayValue(
        candidate?.full_name,
        candidate?.candidate_name,
        candidate?.name,
        nestedCandidate?.full_name,
        nestedCandidate?.candidate_name,
        nestedCandidate?.name,
      ) || "Unknown",
    public_id: formatCandidatePublicId(
      candidate?.public_id,
      candidate?.candidate_code,
      nestedCandidate?.public_id,
      nestedCandidate?.candidate_code,
    ),
    email: pickDisplayValue(
      candidate?.email,
      candidate?.candidate_email,
      nestedCandidate?.email,
      nestedCandidate?.candidate_email,
    ),
    phone: pickDisplayValue(
      candidate?.phone,
      candidate?.mobile,
      candidate?.phone_number,
      nestedCandidate?.phone,
      nestedCandidate?.mobile,
      nestedCandidate?.phone_number,
    ),
    current_location: pickDisplayValue(
      candidate?.current_location,
      candidate?.currentLocation,
      candidate?.location,
      candidate?.city,
      candidate?.preferred_location,
      nestedCandidate?.current_location,
      nestedCandidate?.currentLocation,
      nestedCandidate?.location,
      nestedCandidate?.city,
      nestedCandidate?.preferred_location,
    ),
    experience_years: pickDisplayValue(
      candidate?.experience_years,
      candidate?.experience,
      candidate?.total_experience,
      nestedCandidate?.experience_years,
      nestedCandidate?.experience,
      nestedCandidate?.total_experience,
    ),
    skills: resolvedSkills,
    status: getEffectiveCandidateStatus(candidate, defaults?.status || "new"),
    updated_at:
      candidate?.updated_at ||
      candidate?.sent_to_am_at ||
      candidate?.sent_to_client_at ||
      candidate?.created_at ||
      defaults?.updated_at ||
      null,
  };
};

// Candidate Card Component
function CandidateCard({
  candidate,
  onViewProfile,
  onViewTimeline,
  onScheduleInterview,
  currentUserId,
  isJobScoped,
  isHighlighted = false,
  candidateCardKey = "",
}) {
  const status = getEffectiveCandidateStatus(candidate, candidate?.status || "new");
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.new;
  const statusLabel = formatStatusLabel(status, { isJobScoped });
  const canScheduleInterview = canRecruiterScheduleInterview(
    candidate,
    currentUserId,
  );
  const displayEmail = pickDisplayValue(candidate?.email, candidate?.candidate_email);
  const displayPhone = pickDisplayValue(
    candidate?.phone,
    candidate?.mobile,
    candidate?.phone_number,
  );
  const displayLocation = pickDisplayValue(
    candidate?.current_location,
    candidate?.location,
    candidate?.city,
    candidate?.preferred_location,
  );
  const displayExperience = pickDisplayValue(
    candidate?.experience_years,
    candidate?.experience,
    candidate?.total_experience,
  );

  return (
    <div
      data-candidate-key={candidateCardKey || undefined}
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow ${
        isHighlighted ? "ring-2 ring-violet-500 border-violet-300" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
            {candidate.full_name || "Unknown"}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {candidate.public_id || candidate.id?.slice(0, 8)}
          </p>
        </div>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
        >
          {statusLabel}
        </span>
      </div>

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
          <span>
            {formatExperienceLabel(displayExperience)}
          </span>
        </div>
      </div>

      {/* Skills */}
      {candidate.skills && candidate.skills.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {candidate.skills.slice(0, 4).map((skill, i) => (
            <span
              key={i}
              className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
            >
              {typeof skill === "string" ? skill : skill?.name}
            </span>
          ))}
          {candidate.skills.length > 4 && (
            <span className="text-xs text-gray-500">
              +{candidate.skills.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
        {/* View Profile */}
        <button
          onClick={() => onViewProfile(candidate.id)}
          disabled={!candidate.id}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          <Eye className="w-3 h-3" />
          View Details
        </button>
        {canScheduleInterview && (
          <button
            onClick={() => onScheduleInterview(candidate)}
            disabled={!candidate.id}
            className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700 transition-colors disabled:opacity-50"
          >
            <Calendar className="w-3 h-3" />
            Schedule Interview
          </button>
        )}
        <button
          onClick={() => onViewTimeline(candidate)}
          disabled={!candidate.id}
          className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          <Clock className="w-3 h-3" />
          Timeline
        </button>
      </div>
    </div>
  );
}

// Main Component
export default function CandidateWorkflow() {
  const [searchParams] = useSearchParams();
  const scopedJobId = searchParams.get("jobId") || "";
  const scopedJobTitle = searchParams.get("jobTitle") || "";
  const scopedCandidateId =
    (searchParams.get("candidate_id") || searchParams.get("candidateId") || "").trim();
  const scopedCandidateName =
    (searchParams.get("candidate_name") || searchParams.get("candidateName") || "").trim();
  const hasTargetCandidate = Boolean(scopedCandidateId || scopedCandidateName);
  const isJobScoped = Boolean(scopedJobId);
  const currentUserId = useMemo(() => getCurrentUserId(), []);

  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCandidate, setDetailCandidate] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineCandidateName, setTimelineCandidateName] = useState("");
  const [timelineItems, setTimelineItems] = useState([]);
  const candidateDetailsCacheRef = useRef({});

  const viewerRole = (localStorage.getItem("role") || "").toUpperCase();
  const canViewSensitive = ["SUPER_ADMIN", "HIRING_MANAGER", "RECRUITER"].includes(
    viewerRole,
  );

  // Feedback Modal State
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackCandidateId, setFeedbackCandidateId] = useState(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(3);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleCandidate, setScheduleCandidate] = useState(null);
  const [scheduleJobId, setScheduleJobId] = useState("");
  const [scheduleJobLabel, setScheduleJobLabel] = useState("");
  const [scheduleType, setScheduleType] = useState("ai_chat");
  const [scheduledAt, setScheduledAt] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [location, setLocation] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [targetScrollDone, setTargetScrollDone] = useState(false);
  const baseStatusFilterOptions = isJobScoped
    ? POST_AM_STATUS_OPTIONS
    : ALL_WORKFLOW_STATUS_OPTIONS;

  useEffect(() => {
    fetchCandidates();
  }, [scopedJobId]);

  useEffect(() => {
    setTargetScrollDone(false);
  }, [scopedJobId, scopedCandidateId, scopedCandidateName]);

  const workflowGet = async (path, config = {}) => {
    try {
      return await api.get(path, config);
    } catch (err) {
      if (err?.response?.status === 404) {
        return api.get(`/v1${path}`, config);
      }
      throw err;
    }
  };

  const workflowPost = async (path, payload = {}, config = {}) => {
    try {
      return await api.post(path, payload, config);
    } catch (err) {
      if (err?.response?.status === 404) {
        return api.post(`/v1${path}`, payload, config);
      }
      throw err;
    }
  };

  const scheduleInterview = async (payload = {}) => {
    try {
      return await api.post("/v1/interviews/recruiter/schedule-bulk", payload);
    } catch (err) {
      if (err?.response?.status === 404) {
        return api.post("/interviews/recruiter/schedule-bulk", payload);
      }
      throw err;
    }
  };

  const fetchRecruiterInterviews = async () => {
    try {
      const response = await api.get("/v1/interviews/recruiter/list");
      const payload = response?.data ?? {};
      if (Array.isArray(payload?.results)) return payload.results;
      if (Array.isArray(payload?.data)) return payload.data;
      if (Array.isArray(payload)) return payload;
      return [];
    } catch (err) {
      if (err?.response?.status === 404) {
        const fallbackResponse = await api.get("/interviews/recruiter/list");
        const payload = fallbackResponse?.data ?? {};
        if (Array.isArray(payload?.results)) return payload.results;
        if (Array.isArray(payload?.data)) return payload.data;
        if (Array.isArray(payload)) return payload;
      }
      return [];
    }
  };

  const applyInterviewStatusOverlay = async (records = []) => {
    if (!Array.isArray(records) || records.length === 0) return records;

    const interviews = await fetchRecruiterInterviews();
    if (!Array.isArray(interviews) || interviews.length === 0) return records;

    const { byCandidateJob, byCandidate } =
      buildCandidateInterviewStatusMap(interviews);
    if (byCandidateJob.size === 0 && byCandidate.size === 0) return records;

    const finalStatuses = new Set([
      "rejected_by_recruiter",
      "am_rejected",
      "client_rejected",
      "hired",
      "joined",
      "rejected",
      "offer_declined",
    ]);

    return records.map((candidate) => {
      const currentStatus = normalizeStatus(candidate?.status || "");
      if (finalStatuses.has(currentStatus)) return candidate;

      const candidateKeys = getCandidateIdentityTokens(candidate);
      if (candidateKeys.length === 0) return candidate;

      const jobKey = String(
        pickDisplayValue(candidate?.job_id, candidate?.requirement_id) || "",
      )
        .trim()
        .toLowerCase();

      let overlay = null;
      if (jobKey) {
        overlay = candidateKeys
          .map((candidateKey) => byCandidateJob.get(`${candidateKey}::${jobKey}`))
          .find(Boolean);
      }
      if (!overlay) {
        overlay = candidateKeys.map((candidateKey) => byCandidate.get(candidateKey)).find(Boolean);
      }
      if (!overlay) return candidate;

      return normalizeCandidateForCard({
        ...candidate,
        status: overlay.status,
        stage: overlay.status,
        interview_status: overlay.interviewStatus,
        scheduled_at: overlay.scheduledAt,
        interview_scheduled_at: overlay.scheduledAt,
        updated_at: overlay.scheduledAt || candidate?.updated_at,
      });
    });
  };

  const getCandidateLookupKeys = (candidate = {}) => {
    const rawValues = [
      candidate?.candidate_id,
      candidate?.id,
      candidate?.public_id,
      candidate?.application_id,
      candidate?.candidate?.id,
      candidate?.candidate?.candidate_id,
    ];
    const seen = new Set();
    const keys = [];
    rawValues.forEach((value) => {
      const raw = String(value || "").trim();
      if (!raw) return;
      const cacheKey = raw.toLowerCase();
      if (seen.has(cacheKey)) return;
      seen.add(cacheKey);
      keys.push({ raw, cacheKey });
    });
    return keys;
  };

  const getCandidateIdsForProfileFetch = (candidate = {}) => {
    const internalId = getCandidateInternalId(candidate);
    if (!internalId) return [];
    const cacheKey = normalizeCandidateKey(internalId);
    if (!cacheKey) return [];
    return [{ raw: internalId, cacheKey }];
  };

  const enrichCandidatesFromProfile = async (records = []) => {
    if (!Array.isArray(records) || records.length === 0) return records;

    const needsHydration = (candidate) => {
      const missingLocation = !hasDisplayValue(
        pickDisplayValue(
          candidate?.current_location,
          candidate?.location,
          candidate?.city,
          candidate?.preferred_location,
        ),
      );
      const missingExperience = !hasDisplayValue(
        pickDisplayValue(
          candidate?.experience_years,
          candidate?.experience,
          candidate?.total_experience,
        ),
      );
      return missingLocation || missingExperience;
    };

    const fetchTargets = [];
    const seenTargets = new Set();
    records
      .filter(needsHydration)
      .forEach((candidate) => {
        getCandidateIdsForProfileFetch(candidate).forEach((entry) => {
          if (candidateDetailsCacheRef.current[entry.cacheKey]) return;
          if (seenTargets.has(entry.cacheKey)) return;
          seenTargets.add(entry.cacheKey);
          fetchTargets.push(entry);
        });
      });

    if (fetchTargets.length > 0) {
      const detailResults = await Promise.allSettled(
        fetchTargets.map((entry) => api.get(`/v1/candidates/${entry.raw}`)),
      );

      detailResults.forEach((result, index) => {
        const entry = fetchTargets[index];
        if (!entry) return;
        if (result.status !== "fulfilled") return;
        const payload = result.value?.data?.data ?? result.value?.data ?? null;
        if (payload && typeof payload === "object") {
          candidateDetailsCacheRef.current[entry.cacheKey] = payload;
          getCandidateLookupKeys(payload).forEach((keyEntry) => {
            candidateDetailsCacheRef.current[keyEntry.cacheKey] = payload;
          });
        }
      });
    }

    return records.map((candidate) => {
      const lookupKeys = getCandidateLookupKeys(candidate);
      const cachedKey = lookupKeys.find((entry) =>
        Boolean(candidateDetailsCacheRef.current[entry.cacheKey]),
      );
      if (!cachedKey) return candidate;

      const detail = candidateDetailsCacheRef.current[cachedKey.cacheKey];
      if (!detail || typeof detail !== "object") return candidate;
      const nestedDetail =
        detail?.candidate || detail?.candidate_details || detail?.profile || {};
      const mappedProfile = mapCandidateToProfile(detail, canViewSensitive) || {};

      const mappedSkills = Array.isArray(mappedProfile?.skills)
        ? mappedProfile.skills
            .map((skill) =>
              typeof skill === "string" ? skill : skill?.name || "",
            )
            .filter(Boolean)
        : [];

      return normalizeCandidateForCard({
        ...candidate,
        email: pickDisplayValue(
          candidate?.email,
          detail?.email,
          nestedDetail?.email,
          mappedProfile?.email,
        ),
        phone: pickDisplayValue(
          candidate?.phone,
          detail?.phone,
          detail?.mobile,
          detail?.phone_number,
          nestedDetail?.phone,
          nestedDetail?.mobile,
          nestedDetail?.phone_number,
          mappedProfile?.phone,
        ),
        current_location: pickDisplayValue(
          candidate?.current_location,
          candidate?.location,
          candidate?.city,
          candidate?.preferred_location,
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
          candidate?.experience_years,
          candidate?.experience,
          candidate?.total_experience,
          detail?.experience_years,
          detail?.experience,
          detail?.total_experience,
          nestedDetail?.experience_years,
          nestedDetail?.experience,
          nestedDetail?.total_experience,
          mappedProfile?.totalExperience,
        ),
        skills:
          Array.isArray(candidate?.skills) && candidate.skills.length > 0
            ? candidate.skills
            : Array.isArray(detail?.skills) && detail.skills.length > 0
              ? detail.skills
              : Array.isArray(nestedDetail?.skills) && nestedDetail.skills.length > 0
                ? nestedDetail.skills
                : mappedSkills,
      });
    });
  };

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      if (isJobScoped) {
        const res = await api.get(`/v1/recruiter/jobs/${scopedJobId}/submissions`);
        const list = res.data?.candidates || [];
        const normalized = list.map((c) =>
          normalizeCandidateForCard({
            ...c,
            id: c.candidate_id || c.id || c.application_id,
            candidate_id: c.candidate_id || c.id || c.application_id,
            application_id: c.application_id,
            full_name: c.full_name || c.candidate_name || c.name,
            public_id: c.public_id,
            status: normalizeStatus(c.status || "sent_to_am"),
            sent_to_am_at: c.sent_to_am_at,
            sent_to_client_at: c.sent_to_client_at,
            job_id: c.job_id || scopedJobId,
            requirement_id: c.requirement_id || c.job_id || scopedJobId,
            job_title: c.job_title || scopedJobTitle,
            requirement_title: c.requirement_title || c.job_title || scopedJobTitle,
            is_final: ["rejected_by_recruiter", "am_rejected", "client_rejected", "hired", "rejected", "offer_declined"].includes(
              normalizeStatus(c.status),
            ),
            updated_at:
              c.updated_at ||
              c.sent_to_am_at ||
              c.sent_to_client_at ||
              c.created_at ||
              null,
          }),
        );

        const enrichedJobScoped = await enrichCandidatesFromProfile(normalized);
        const statusAwareJobScoped =
          await applyInterviewStatusOverlay(enrichedJobScoped);
        setCandidates(ensureUniqueCandidatePublicIds(statusAwareJobScoped));
        return;
      }

      // General workflow: fetch all candidates and use page-level filter dropdown.
      const res = await workflowGet("/workflow/candidates", {
        params: { limit: 500 },
      });
      const unique = Array.from(
        new Map(
          (res.data?.candidates || []).map((c) => [
            String(c?.candidate_id || c?.id || c?.application_id || c?.public_id || ""),
            c,
          ]),
        ).values(),
      );
      const normalized = unique
        .map((c) => normalizeCandidateForCard(c))
        .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));

      const enrichedGeneral = await enrichCandidatesFromProfile(normalized);
      const statusAwareGeneral =
        await applyInterviewStatusOverlay(enrichedGeneral);
      setCandidates(ensureUniqueCandidatePublicIds(statusAwareGeneral));
    } catch (err) {
      console.error("Failed to fetch candidates:", err);
      // Fallback to old endpoint
      try {
        const res = await api.get("/v1/candidates");
        const fallbackList = res.data?.items || res.data?.data || res.data || [];
        const normalizedFallback = (Array.isArray(fallbackList) ? fallbackList : [])
          .map((c) => normalizeCandidateForCard(c));
        const enrichedFallback = await enrichCandidatesFromProfile(normalizedFallback);
        const statusAwareFallback =
          await applyInterviewStatusOverlay(enrichedFallback);
        setCandidates(ensureUniqueCandidatePublicIds(statusAwareFallback));
      } catch (e) {
        console.error("Fallback also failed:", e);
      }
    } finally {
      setLoading(false);
    }
  };

  const resetScheduleModal = () => {
    setShowScheduleModal(false);
    setScheduleCandidate(null);
    setScheduleJobId("");
    setScheduleJobLabel("");
    setScheduleType("ai_chat");
    setScheduledAt("");
    setMeetingLink("");
    setLocation("");
    setContactPerson("");
    setScheduleError("");
    setScheduleLoading(false);
  };

  const openScheduleModal = (candidateInput = {}) => {
    const candidateId = pickDisplayValue(
      candidateInput?.candidate_id,
      candidateInput?.id,
      candidateInput?.application_id,
      candidateInput?.candidate?.id,
      candidateInput?.candidate?.candidate_id,
    );
    const jobId = pickDisplayValue(
      candidateInput?.job_id,
      candidateInput?.requirement_id,
      candidateInput?.job?.id,
      candidateInput?.job?.job_id,
      scopedJobId,
    );
    const resolvedJobLabel =
      pickDisplayValue(
        candidateInput?.job_title,
        candidateInput?.requirement_title,
        candidateInput?.job?.title,
        candidateInput?.requirement?.title,
        scopedJobTitle,
      ) || String(jobId || "");

    if (!candidateId) {
      alert("Candidate details are missing. Please refresh and try again.");
      return;
    }
    if (!jobId) {
      alert(
        "Job details are missing for this candidate. Open this workflow from a job and try again.",
      );
      return;
    }

    setScheduleCandidate({
      ...candidateInput,
      candidate_id: String(candidateId),
    });
    setScheduleJobId(String(jobId));
    setScheduleJobLabel(resolvedJobLabel);
    setScheduleType("ai_chat");
    setScheduledAt("");
    setMeetingLink("");
    setLocation("");
    setContactPerson("");
    setScheduleError("");
    setShowScheduleModal(true);
  };

  const submitScheduleInterview = async () => {
    const candidateId = String(scheduleCandidate?.candidate_id || "").trim();
    const jobId = String(scheduleJobId || "").trim();

    setScheduleError("");

    if (!candidateId || !jobId) {
      setScheduleError("Missing candidate or job context for scheduling.");
      return;
    }
    if (!scheduledAt) {
      setScheduleError("Select schedule date and time.");
      return;
    }
    if (!scheduleType) {
      setScheduleError("Select an interview type.");
      return;
    }

    const scheduledDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledDate.getTime())) {
      setScheduleError("Select a valid schedule date and time.");
      return;
    }
    if (scheduledDate < new Date()) {
      setScheduleError("Schedule time must be in the future.");
      return;
    }
    if (scheduleType === "video" && !meetingLink.trim()) {
      setScheduleError("Meeting link is required for Google Meet.");
      return;
    }
    if (scheduleType === "in_person" && !location.trim()) {
      setScheduleError("Location is required for in-person interviews.");
      return;
    }

    setScheduleLoading(true);
    try {
      const scheduledAtIso = scheduledDate.toISOString();
      await scheduleInterview({
        job_id: jobId,
        candidate_ids: [candidateId],
        interview_type: scheduleType,
        scheduled_at: scheduledAtIso,
        meeting_link: scheduleType === "video" ? meetingLink.trim() : null,
        location: scheduleType === "in_person" ? location.trim() : null,
        contact_person:
          scheduleType === "in_person" ? contactPerson.trim() : null,
      });

      let workflowStatusSynced = false;
      try {
        await workflowPost(`/workflow/candidates/${candidateId}/schedule-interview`, {
          job_id: jobId,
          interview_date: scheduledAtIso,
          notes: `Interview scheduled via recruiter workflow (${scheduleType}).`,
        });
        workflowStatusSynced = true;
      } catch (statusSyncError) {
        console.warn(
          "Interview was created but workflow status sync failed:",
          statusSyncError,
        );
      }

      const normalizedCandidateId = candidateId.toLowerCase();
      const applyScheduledState = (record) => {
        if (!record || typeof record !== "object") return record;
        const identifiers = getCandidateIdentityTokens(record);
        if (!identifiers.includes(normalizedCandidateId)) return record;
        return normalizeCandidateForCard({
          ...record,
          status: "interview_scheduled",
          stage: "interview_scheduled",
          scheduled_at: scheduledAtIso,
          interview_scheduled_at: scheduledAtIso,
          interview_scheduling_ready: false,
          updated_at: scheduledAtIso,
        });
      };

      setCandidates((prev) =>
        ensureUniqueCandidatePublicIds(
          (Array.isArray(prev) ? prev : []).map(applyScheduledState),
        ),
      );
      setDetailCandidate((prev) => {
        if (!prev) return prev;
        const updated = applyScheduledState(prev);
        return updated && typeof updated === "object" ? updated : prev;
      });

      resetScheduleModal();
      if (workflowStatusSynced) {
        fetchCandidates();
      }
    } catch (err) {
      setScheduleError(
        err?.response?.data?.detail ||
          "Failed to schedule interview. Please try again.",
      );
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleAction = async (candidateOrId, action, extra = null) => {
    setActionLoading(true);
    try {
      const candidate =
        candidateOrId && typeof candidateOrId === "object"
          ? candidateOrId
          : { id: candidateOrId };
      const candidateId =
        candidate?.candidate_id || candidate?.id || candidateOrId;
      const targetJobId =
        candidate?.job_id || candidate?.requirement_id || scopedJobId || null;

      if (!candidateId) {
        throw new Error("Candidate id missing for workflow action");
      }

      let endpoint = "";
      let payload = {};

      switch (action) {
        case "call":
          endpoint = `/workflow/candidates/${candidateId}/call`;
          break;
        case "add_feedback":
          setFeedbackCandidateId(candidateId);
          setShowFeedbackModal(true);
          setActionLoading(false);
          return;
        case "hold":
          endpoint = `/workflow/candidates/${candidateId}/hold`;
          break;
        case "reject":
          endpoint = `/workflow/candidates/${candidateId}/reject`;
          payload = { rejection_type: extra || "recruiter" };
          break;
        case "send_to_am":
          endpoint = `/workflow/candidates/${candidateId}/send-to-am`;
          payload = targetJobId ? { job_id: targetJobId } : {};
          break;
        case "schedule_interview":
          openScheduleModal({
            ...candidate,
            candidate_id: String(candidateId),
            job_id: targetJobId ? String(targetJobId) : candidate?.job_id,
          });
          return;
        case "select":
          endpoint = `/workflow/candidates/${candidateId}/select`;
          break;
        case "hire":
          endpoint = `/workflow/candidates/${candidateId}/hire`;
          break;
        default:
          console.error("Unknown action:", action);
          return;
      }

      await workflowPost(endpoint, payload);

      fetchCandidates();
    } catch (err) {
      console.error("Action failed:", err);
      alert(err.response?.data?.detail || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const submitFeedback = async () => {
    if (!feedbackCandidateId || !feedbackText.trim()) return;

    setActionLoading(true);
    try {
      await workflowPost(
        `/workflow/candidates/${feedbackCandidateId}/add-feedback`,
        null,
        {
          params: { feedback: feedbackText, rating: feedbackRating },
        },
      );
      setShowFeedbackModal(false);
      setFeedbackText("");
      setFeedbackRating(3);
      setFeedbackCandidateId(null);
      fetchCandidates();
    } catch (err) {
      console.error("Feedback submission failed:", err);
      alert(err.response?.data?.detail || "Failed to add feedback");
    } finally {
      setActionLoading(false);
    }
  };

  const openCandidateProfile = async (candidateId) => {
    if (!candidateId) return;
    const match = candidates.find((candidate) => {
      return (
        String(candidate?.id || "") === String(candidateId) ||
        String(candidate?.candidate_id || "") === String(candidateId)
      );
    });

    if (match) {
      setDetailCandidate(match);
      setDetailOpen(true);
    } else {
      setDetailCandidate(null);
      setDetailOpen(true);
    }

    try {
      setDetailLoading(true);
      const resolvedCandidateId =
        (match && getCandidateIdsForProfileFetch(match)[0]?.raw) ||
        (() => {
          const inputId = String(candidateId || "").trim();
          if (!isLikelyCandidateApiId(inputId)) return "";
          return inputId;
        })();

      if (!resolvedCandidateId) return;

      const detail = await candidateService.getCandidateById(resolvedCandidateId);
      if (detail) {
        const cacheKeys = Array.from(
          new Set(
            [
              candidateId,
              resolvedCandidateId,
              detail?.id,
              detail?.candidate_id,
              detail?.public_id,
            ]
              .map((value) => String(value || "").trim().toLowerCase())
              .filter(Boolean),
          ),
        );
        cacheKeys.forEach((cacheKey) => {
          candidateDetailsCacheRef.current[cacheKey] = detail;
        });
        setDetailCandidate((prev) => {
          const merged = { ...(prev || {}), ...(detail || {}) };
          return {
            ...merged,
            status: getEffectiveCandidateStatus(merged, merged?.status || "new"),
          };
        });
      }
    } catch (error) {
      console.error("Failed to load candidate detail", error);
    } finally {
      setDetailLoading(false);
    }
  };

  const openTimeline = async (candidate) => {
    const candidateId =
      candidate?.candidate_id || candidate?.id || candidate?.application_id;
    if (!candidateId) return;

    setTimelineOpen(true);
    setTimelineLoading(true);
    setTimelineItems([]);
    setTimelineCandidateName(candidate?.full_name || "Candidate");

    try {
      const idsToTry = Array.from(
        new Set(
          [
            candidate?.candidate_id,
            candidate?.id,
            candidate?.application_id,
          ]
            .filter(Boolean)
            .map((id) => String(id)),
        ),
      );

      let loadedItems = [];
      for (const idToTry of idsToTry) {
        try {
          const response = await workflowGet(
            `/workflow/candidates/${idToTry}/timeline`,
          );
          const items = response?.data?.timeline || response?.data?.data || [];
          if (Array.isArray(items) && items.length > 0) {
            loadedItems = items;
            break;
          }
          if (Array.isArray(items) && loadedItems.length === 0) {
            loadedItems = items;
          }
        } catch (attemptError) {
          // Try the next possible identifier.
        }
      }

      let mergedItems = Array.isArray(loadedItems) ? loadedItems : [];
      const hasInterviewLog = mergedItems.some((item) =>
        normalizeTimelineStatus(item?.status).includes("interview"),
      );

      if (!hasInterviewLog && idsToTry.length > 0) {
        const interviews = await fetchRecruiterInterviews();
        const normalizedCandidateIds = new Set(
          idsToTry.map((id) => String(id || "").trim().toLowerCase()).filter(Boolean),
        );

        const interviewTimelineEvents = (Array.isArray(interviews) ? interviews : [])
          .filter((interview) => {
            const interviewCandidateId = String(
              pickDisplayValue(
                interview?.candidate?.id,
                interview?.candidate_id,
                interview?.candidate?.candidate_id,
              ) || "",
            )
              .trim()
              .toLowerCase();
            return interviewCandidateId && normalizedCandidateIds.has(interviewCandidateId);
          })
          .map((interview) => {
            const rawInterviewStatus = normalizeTimelineStatus(interview?.status);
            const timelineStatus =
              rawInterviewStatus === "completed"
                ? "interview_completed"
                : "interview_scheduled";
            const modeLabel = String(interview?.mode || "interview")
              .replace(/_/g, " ")
              .trim();
            const roleLabel = "Recruiter";
            return {
              id: `iv-${interview?.id || Math.random()}`,
              status: timelineStatus,
              note:
                timelineStatus === "interview_completed"
                  ? `Interview completed (${modeLabel}).`
                  : `Interview scheduled (${modeLabel}).`,
              by: pickDisplayValue(
                interview?.recruiter?.full_name,
                interview?.recruiter?.email,
              ),
              role: roleLabel,
              at: pickDisplayValue(interview?.scheduled_at, interview?.created_at),
              created_at: pickDisplayValue(
                interview?.scheduled_at,
                interview?.created_at,
              ),
            };
          });

        if (interviewTimelineEvents.length > 0) {
          const keyed = new Map();
          [...interviewTimelineEvents, ...mergedItems].forEach((item) => {
            const key = [
              normalizeTimelineStatus(item?.status),
              String(item?.at || item?.created_at || "").trim(),
            ].join("::");
            if (!keyed.has(key)) {
              keyed.set(key, item);
            }
          });
          mergedItems = Array.from(keyed.values());
        }
      }

      setTimelineItems(mergedItems);
    } catch (error) {
      console.error("Failed to load candidate timeline:", error);
      setTimelineItems([]);
    } finally {
      setTimelineLoading(false);
    }
  };

  const statusFilterOptions = useMemo(() => {
    const discovered = candidates
      .map((c) => normalizeStatus(c.status))
      .filter(Boolean);
    const seen = new Set();
    return [...baseStatusFilterOptions, ...discovered].filter((status) => {
      if (!status || seen.has(status)) return false;
      seen.add(status);
      return true;
    });
  }, [baseStatusFilterOptions, candidates]);

  const filteredCandidates = useMemo(() => {
    const base = isJobScoped
      ? candidates.filter((c) =>
          POST_AM_STATUS_OPTIONS.includes(normalizeStatus(c.status)),
        )
      : candidates;

    const byTargetCandidate = hasTargetCandidate
      ? base.filter((candidate) =>
          matchesTargetCandidate(
            candidate,
            scopedCandidateId,
            scopedCandidateName,
          ),
        )
      : base;

    const byStatus =
      statusFilter && !hasTargetCandidate
        ? byTargetCandidate.filter(
            (candidate) => normalizeStatus(candidate.status) === statusFilter,
          )
        : byTargetCandidate;

    if (!searchTerm.trim()) return byStatus;
    const term = searchTerm.toLowerCase();
    return byStatus.filter(
      (c) =>
        c.full_name?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.includes(term) ||
        c.skills?.some((s) =>
          (typeof s === "string" ? s : s?.name || "")
            .toLowerCase()
            .includes(term),
        ),
    );
  }, [
    candidates,
    searchTerm,
    isJobScoped,
    statusFilter,
    hasTargetCandidate,
    scopedCandidateId,
    scopedCandidateName,
  ]);

  const highlightedCandidateCardKey = useMemo(() => {
    if (!hasTargetCandidate) return "";
    const matchedCandidate = filteredCandidates.find((candidate) =>
      matchesTargetCandidate(candidate, scopedCandidateId, scopedCandidateName),
    );
    return getCandidateCardKey(matchedCandidate);
  }, [
    filteredCandidates,
    hasTargetCandidate,
    scopedCandidateId,
    scopedCandidateName,
  ]);

  useEffect(() => {
    if (!highlightedCandidateCardKey || targetScrollDone) return;

    const targetElement = Array.from(
      document.querySelectorAll("[data-candidate-key]"),
    ).find(
      (node) =>
        String(node?.dataset?.candidateKey || "").trim().toLowerCase() ===
        highlightedCandidateCardKey,
    );

    if (!targetElement) return;

    targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
    setTargetScrollDone(true);
  }, [highlightedCandidateCardKey, targetScrollDone]);

  const detailProfile = useMemo(() => {
    if (!detailCandidate) return null;
    return mapCandidateToProfile(detailCandidate, canViewSensitive);
  }, [canViewSensitive, detailCandidate]);

  const workflowStatusOptions = useMemo(
    () =>
      statusFilterOptions.map((status) => ({
        value: status,
        label: formatStatusLabel(status, { isJobScoped }),
      })),
    [isJobScoped, statusFilterOptions],
  );

  const sortedTimelineItems = useMemo(() => {
    if (!Array.isArray(timelineItems)) return [];

    const getTimestamp = (item) => {
      const rawTime = item?.at || item?.created_at || item?.updated_at || null;
      if (!rawTime) return 0;
      const timestamp = new Date(rawTime).getTime();
      return Number.isFinite(timestamp) ? timestamp : 0;
    };

    return [...timelineItems].sort(
      (left, right) => getTimestamp(right) - getTimestamp(left),
    );
  }, [timelineItems]);

  const detailCanScheduleInterview = useMemo(
    () => canRecruiterScheduleInterview(detailCandidate, currentUserId),
    [detailCandidate, currentUserId],
  );

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Candidate Workflow
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {isJobScoped
            ? "Job-specific workflow and submissions timeline"
            : "Track and manage candidates through the recruitment pipeline"}
        </p>
        {isJobScoped && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-50 text-indigo-800 px-3 py-1.5 text-sm">
            <span className="font-medium">Requirement:</span>
            <span>{scopedJobTitle || scopedJobId}</span>
          </div>
        )}
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
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="w-44 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">All Status</option>
          {workflowStatusOptions.map((statusOption) => (
            <option key={statusOption.value} value={statusOption.value}>
              {statusOption.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            fetchCandidates();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
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
              : "No candidates found for the selected filters"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCandidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              onViewProfile={openCandidateProfile}
              onViewTimeline={openTimeline}
              onScheduleInterview={(selectedCandidate) =>
                handleAction(selectedCandidate, "schedule_interview")
              }
              currentUserId={currentUserId}
              isJobScoped={isJobScoped}
              isHighlighted={
                highlightedCandidateCardKey === getCandidateCardKey(candidate)
              }
              candidateCardKey={getCandidateCardKey(candidate)}
            />
          ))}
        </div>
      )}

      {timelineOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[80vh] bg-white dark:bg-gray-800 rounded-xl shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Status Timeline
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {timelineCandidateName}
                </p>
              </div>
              <button
                onClick={() => {
                  setTimelineOpen(false);
                  setTimelineItems([]);
                  setTimelineCandidateName("");
                }}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto">
              {timelineLoading ? (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading timeline...
                </div>
              ) : sortedTimelineItems.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No timeline entries found.</p>
              ) : (
                <div className="space-y-4">
                  {sortedTimelineItems.map((item, index) => {
                    const statusCategory = classifyTimelineStatus(item?.status);
                    const visual =
                      TIMELINE_VISUALS[statusCategory] || TIMELINE_VISUALS.sent;
                    const TimelineIcon = visual.icon;
                    const badgeLabel = getTimelineBadgeLabel(item, statusCategory);
                    const actor = pickDisplayValue(item?.by, item?.user, item?.actor_name);
                    const role = toTitleWords(
                      pickDisplayValue(item?.role, item?.actor_role),
                    );
                    const note = getDisplayTimelineNote(item?.note);
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

      {showScheduleModal && scheduleCandidate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Schedule Interview
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Candidate: {scheduleCandidate?.full_name || "Candidate"}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Job: {scheduleJobLabel || scheduleJobId}
                </p>
              </div>
              <button
                onClick={resetScheduleModal}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                aria-label="Close schedule interview modal"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {scheduleError && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {scheduleError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Interview Type
                  </label>
                  <select
                    value={scheduleType}
                    onChange={(event) => setScheduleType(event.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="ai_chat">AI Chat Interview</option>
                    <option value="video">Google Meet</option>
                    <option value="in_person">In-Person</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(event) => setScheduledAt(event.target.value)}
                    min={formatDateTimeLocalMin(new Date())}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                {scheduleType === "video" && (
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Meet Link
                    </label>
                    <input
                      type="url"
                      value={meetingLink}
                      onChange={(event) => setMeetingLink(event.target.value)}
                      placeholder="https://meet.google.com/..."
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                )}
                {scheduleType === "in_person" && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Location
                      </label>
                      <input
                        value={location}
                        onChange={(event) => setLocation(event.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Contact Person
                      </label>
                      <input
                        value={contactPerson}
                        onChange={(event) => setContactPerson(event.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
              <button
                onClick={resetScheduleModal}
                className="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitScheduleInterview}
                disabled={scheduleLoading || !scheduledAt || !scheduleType}
                className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-60"
              >
                {scheduleLoading ? "Scheduling..." : "Schedule Interview"}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailOpen && detailCandidate && detailProfile && (
        <CandidateDetail
          candidate={detailCandidate}
          profile={detailProfile}
          loading={detailLoading}
          hideQuickActions={!detailCanScheduleInterview}
          customQuickActions={
            detailCanScheduleInterview
              ? [
                  {
                    label: "Schedule Interview",
                    variant: "primary",
                    disabled: actionLoading,
                    onClick: (candidate) =>
                      handleAction(candidate, "schedule_interview"),
                  },
                ]
              : undefined
          }
          workflowStatusOptions={workflowStatusOptions}
          onClose={() => {
            setDetailOpen(false);
            setDetailCandidate(null);
            setDetailLoading(false);
          }}
          onPreviewResume={(resumeUrl) => {
            if (resumeUrl) window.open(resumeUrl, "_blank");
          }}
        />
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add Call Feedback
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rating
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button
                      key={r}
                      onClick={() => setFeedbackRating(r)}
                      className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                        feedbackRating >= r
                          ? "bg-yellow-400 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Feedback Notes
                </label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Enter your call feedback..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowFeedbackModal(false);
                  setFeedbackText("");
                  setFeedbackCandidateId(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitFeedback}
                disabled={!feedbackText.trim() || actionLoading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? "Saving..." : "Save Feedback"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

