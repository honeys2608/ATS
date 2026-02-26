import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import workflowService from "../../services/workflowService";
import { formatStatus } from "../../utils/formatStatus";
import { getSkillSuggestions } from "../../utils/skillsData";
import {
  Plus,
  Mail,
  Upload,
  FileText,
  X,
  Search,
  Eye,
  Edit,
  Users,
  ExternalLink,
  Loader2,
  Check,
  AlertCircle,
  Briefcase,
  CheckCircle,
  RotateCcw,
  XCircle,
} from "lucide-react";
import {
  normalizeText,
  validateDescription,
  validateFeatureName,
} from "../../utils/recruiterValidations";

const MODE_OPTIONS = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "Onsite" },
];
const DURATION_OPTIONS = ["3 Months", "6 Months", "12 Months", "Full-Time"];
const JOINING_PREFERENCE_OPTIONS = [
  "Immediate",
  "15 Days",
  "30 Days",
  "Negotiable",
];
const CURRENCY_OPTIONS = ["INR", "USD", "EUR", "GBP", "AUD"];
const QUICK_FILTERS = [
  { key: "active", label: "Active" },
  { key: "high_budget", label: "High Budget" },
  { key: "urgent", label: "Urgent" },
  { key: "remote", label: "Remote" },
];
const CLOUD_SKILLS = [
  "aws",
  "azure",
  "gcp",
  "cloud",
  "kubernetes",
  "docker",
  "devops",
  "terraform",
];
const DATABASE_SKILLS = [
  "sql",
  "mysql",
  "postgres",
  "postgresql",
  "mongodb",
  "oracle",
  "redis",
  "db",
  "database",
  "snowflake",
];
const BACKEND_SKILLS = [
  "java",
  "spring",
  "node",
  "backend",
  "python",
  "django",
  "flask",
  ".net",
  "dotnet",
  "php",
  "golang",
  "api",
  "microservice",
];
const TITLE_CASE_FIELDS = new Set(["title", "location"]);
const TITLE_CASE_SKILL_EXCEPTIONS = new Set([
  "AI",
  "API",
  "AWS",
  "BA",
  "BI",
  "BPO",
  "CRM",
  "ERP",
  "ETL",
  "GCP",
  "HR",
  "HRMS",
  "IT",
  "L2",
  "L3",
  "ML",
  "PM",
  "PMO",
  "QA",
  "REST",
  "SAP",
  "SRE",
  "SQL",
  "UI",
  "UX",
]);
const EMOJI_REGEX =
  /[\u203C-\u3299\uD83C-\uDBFF\uDC00-\uDFFF\uFE0F\u200D]/gu;
const JOB_TITLE_ALLOWED_REGEX = /^[A-Za-z0-9 ]+$/;
const CLIENT_TA_ALLOWED_REGEX = /^[A-Za-z0-9@.+\-()' ]+$/;
const LOCATION_ALLOWED_REGEX = /^[A-Za-z0-9,\- ]+$/;
const SKILL_ALLOWED_REGEX = /^[A-Za-z0-9+.#/\- ]+$/;

const normalizeSpaces = (value) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : value;

const normalizeTextarea = (value) =>
  typeof value === "string" ? value.trim() : value;

const hasEmoji = (value) => {
  if (!value || typeof value !== "string") return false;
  EMOJI_REGEX.lastIndex = 0;
  return EMOJI_REGEX.test(value);
};

const looksLikeContactValue = (value) =>
  typeof value === "string" && /[@+\d]/.test(value);

const isAcronymToken = (token) => {
  if (!token) return false;
  const cleaned = String(token).replace(/[^A-Za-z0-9]/g, "");
  if (!cleaned) return false;
  const upper = cleaned.toUpperCase();
  if (TITLE_CASE_SKILL_EXCEPTIONS.has(upper)) return true;
  if (/\d/.test(cleaned)) return true;
  if (/^[A-Z]{2,4}$/.test(token)) return true;
  return false;
};

const toTitleCaseWord = (word) => {
  if (!word) return "";
  if (isAcronymToken(word)) {
    return word.toUpperCase();
  }
  if (/^[A-Za-z]+$/.test(word)) {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }
  return word
    .split(/([.+#/\-])/)
    .map((part) => {
      if (!part || /[.+#/\-]/.test(part)) return part;
      if (isAcronymToken(part)) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");
};

const toTitleCase = (value) => {
  const normalized = normalizeSpaces(value);
  if (!normalized) return "";
  return normalized
    .split(" ")
    .map((word) => toTitleCaseWord(word))
    .join(" ");
};

const isTitleCase = (value) => {
  const normalized = normalizeSpaces(value);
  if (!normalized) return false;
  return normalized === toTitleCase(normalized);
};

const parseExperienceRange = (rawExperience, minExperience, maxExperience) => {
  if (Number.isFinite(minExperience) || Number.isFinite(maxExperience)) {
    return {
      experience_min: Number.isFinite(minExperience) ? String(minExperience) : "",
      experience_max: Number.isFinite(maxExperience) ? String(maxExperience) : "",
    };
  }

  const raw = normalizeSpaces(rawExperience || "");
  if (!raw) return { experience_min: "", experience_max: "" };

  const numbers = raw.match(/\d+/g) || [];
  return {
    experience_min: numbers[0] || "",
    experience_max: numbers[1] || numbers[0] || "",
  };
};

const parseBudgetRange = (budget) => {
  const raw = normalizeSpaces(budget || "");
  if (!raw) {
    return { ctc_currency: "INR", ctc_min: "", ctc_max: "" };
  }
  const currencyMatch = raw.match(/\b(INR|USD|EUR|GBP|AUD)\b/i);
  const numbers = raw.replace(/,/g, "").match(/\d+(\.\d+)?/g) || [];
  return {
    ctc_currency: currencyMatch ? currencyMatch[1].toUpperCase() : "INR",
    ctc_min: numbers[0] || "",
    ctc_max: numbers[1] || numbers[0] || "",
  };
};

const parseTimeRange = (rawValue) => {
  const raw = normalizeSpaces(rawValue || "");
  if (!raw) return { work_start_time: "", work_end_time: "" };

  const twentyFourHourParts = raw.match(
    /([01]?\d|2[0-3]):([0-5]\d)\s*-\s*([01]?\d|2[0-3]):([0-5]\d)/,
  );
  if (twentyFourHourParts) {
    return {
      work_start_time: `${twentyFourHourParts[1].padStart(2, "0")}:${twentyFourHourParts[2]}`,
      work_end_time: `${twentyFourHourParts[3].padStart(2, "0")}:${twentyFourHourParts[4]}`,
    };
  }

  const convert12To24 = (value) => {
    const match = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return "";
    let hours = Number(match[1]);
    const minutes = match[2];
    const period = match[3].toUpperCase();
    if (period === "AM" && hours === 12) hours = 0;
    if (period === "PM" && hours !== 12) hours += 12;
    return `${String(hours).padStart(2, "0")}:${minutes}`;
  };

  const twelveHourParts = raw.split("-").map((part) => part.trim());
  if (twelveHourParts.length === 2) {
    return {
      work_start_time: convert12To24(twelveHourParts[0]),
      work_end_time: convert12To24(twelveHourParts[1]),
    };
  }

  return { work_start_time: "", work_end_time: "" };
};

const normalizeStatusFilterValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const buildBudgetText = (ctcCurrency, ctcMin, ctcMax) => {
  if (!ctcMin || !ctcMax) return "";
  return `${ctcCurrency} ${ctcMin} - ${ctcMax}`;
};

const buildExperienceText = (experienceMin, experienceMax) => {
  if (experienceMin === "" && experienceMax === "") return "";
  if (experienceMin !== "" && experienceMax !== "") {
    return `${experienceMin}-${experienceMax}`;
  }
  return experienceMin || experienceMax || "";
};

const normalizeDurationValue = (value) => {
  const normalized = normalizeSpaces(value || "").toLowerCase();
  return (
    DURATION_OPTIONS.find(
      (durationOption) => durationOption.toLowerCase() === normalized,
    ) || ""
  );
};

const normalizeJoiningPreferenceValue = (value) => {
  const normalized = normalizeSpaces(value || "").toLowerCase();
  return (
    JOINING_PREFERENCE_OPTIONS.find(
      (joiningOption) => joiningOption.toLowerCase() === normalized,
    ) || ""
  );
};

const validateJobForm = ({ form, clients, requirements, editingJobId }) => {
  const errors = {};
  const warnings = {};
  const title = normalizeSpaces(form.title);
  const clientTa = normalizeSpaces(form.client_ta);
  const location = normalizeSpaces(form.location);
  const jdText = normalizeTextarea(form.jd_text);
  const recruiterNotes = normalizeTextarea(form.notes_for_recruiter || "");
  const skills = (form.skills || []).map((skill) => normalizeSpaces(skill));

  if (
    !title ||
    title.length < 3 ||
    title.length > 80 ||
    !JOB_TITLE_ALLOWED_REGEX.test(title) ||
    /^\d+$/.test(title) ||
    hasEmoji(title)
  ) {
    errors.title =
      "Enter a valid job title (e.g., Senior React Developer)";
  }

  if (!form.client_id) {
    errors.client_id = "Please select a client";
  } else {
    const exists = clients.some(
      (client) => String(client.id) === String(form.client_id),
    );
    if (!exists) {
      errors.client_id = "Please select a valid client from the list";
    }
  }

  if (clientTa) {
    const isContactFormat = looksLikeContactValue(clientTa);
    if (
      clientTa.length < 2 ||
      clientTa.length > 60 ||
      !CLIENT_TA_ALLOWED_REGEX.test(clientTa) ||
      hasEmoji(clientTa)
    ) {
      errors.client_ta =
        "Client TA must be 2-60 characters (name in Title Case or valid contact details)";
    } else if (!isContactFormat && !isTitleCase(clientTa)) {
      errors.client_ta =
        "Client TA name must be in Title Case (e.g., John Smith)";
    }
  }

  if (!MODE_OPTIONS.some((option) => option.value === form.mode)) {
    errors.mode = "Select a valid mode";
  }

  const minExpRaw = String(form.experience_min ?? "").trim();
  const maxExpRaw = String(form.experience_max ?? "").trim();
  const minExp = Number(minExpRaw);
  const maxExp = Number(maxExpRaw);
  const isIntegerText = (value) => /^\d+$/.test(value);

  if (
    !minExpRaw ||
    !maxExpRaw ||
    !isIntegerText(minExpRaw) ||
    !isIntegerText(maxExpRaw) ||
    minExp < 0 ||
    maxExp > 30 ||
    minExp > maxExp
  ) {
    errors.experience = "Experience must be between 0 and 30 years";
  }

  if (form.mode !== "remote") {
    if (!location) {
      errors.location = "Location is required for Hybrid and Onsite jobs";
    } else if (
      location.length < 2 ||
      location.length > 100 ||
      !LOCATION_ALLOWED_REGEX.test(location) ||
      !isTitleCase(location) ||
      hasEmoji(location)
    ) {
      errors.location =
        "Location must be 2-100 characters in Title Case (letters, numbers, commas, hyphens only)";
    }
  } else if (
    location &&
    (!LOCATION_ALLOWED_REGEX.test(location) ||
      !isTitleCase(location) ||
      hasEmoji(location))
  ) {
    errors.location =
      "Location must be in Title Case with supported characters only";
  }

  if (form.duration && !DURATION_OPTIONS.includes(form.duration)) {
    errors.duration = "Select a valid duration";
  }

  const positionsRaw = String(form.no_of_positions ?? "").trim();
  if (!/^\d+$/.test(positionsRaw)) {
    errors.no_of_positions = "Number of positions must be a whole number";
  } else {
    const positions = Number(positionsRaw);
    if (positions < 1 || positions > 500) {
      errors.no_of_positions = "Number of positions must be between 1 and 500";
    }
  }

  const ctcMinRaw = String(form.ctc_min ?? "").trim();
  const ctcMaxRaw = String(form.ctc_max ?? "").trim();
  const hasCtc = Boolean(ctcMinRaw || ctcMaxRaw);
  if (hasCtc) {
    if (!ctcMinRaw || !ctcMaxRaw) {
      errors.ctc_range = "Enter both Min CTC and Max CTC";
    } else if (
      !/^\d+(\.\d{1,2})?$/.test(ctcMinRaw) ||
      !/^\d+(\.\d{1,2})?$/.test(ctcMaxRaw)
    ) {
      errors.ctc_range = "CTC values must be numeric";
    } else {
      const ctcMin = Number(ctcMinRaw);
      const ctcMax = Number(ctcMaxRaw);
      if (ctcMin < 0 || ctcMax < 0) {
        errors.ctc_range = "CTC values cannot be negative";
      } else if (ctcMin > ctcMax) {
        errors.ctc_range = "Min CTC cannot be greater than Max CTC";
      } else if (ctcMin > 0 && (ctcMax / ctcMin > 8 || ctcMax > 100000000)) {
        warnings.ctc_range =
          "Warning: Salary range looks unusually wide. Please verify budget values.";
      }
    }
    if (!CURRENCY_OPTIONS.includes(form.ctc_currency)) {
      errors.ctc_range = "Select a valid currency";
    }
  }

  const startTime = form.work_start_time || "";
  const endTime = form.work_end_time || "";
  if (startTime || endTime) {
    if (!startTime || !endTime) {
      errors.work_timings = "Select both start and end time";
    } else if (startTime >= endTime) {
      errors.work_timings = "Start time must be earlier than end time";
    }
  }

  if (
    form.joining_preference &&
    !JOINING_PREFERENCE_OPTIONS.includes(form.joining_preference)
  ) {
    errors.joining_preference = "Select a valid joining preference";
  }

  if (skills.length < 1 || skills.length > 30) {
    errors.skills = "Add at least one valid skill";
  } else {
    const seen = new Set();
    for (const skill of skills) {
      if (
        skill.length < 2 ||
        skill.length > 30 ||
        !SKILL_ALLOWED_REGEX.test(skill) ||
        !isTitleCase(skill) ||
        hasEmoji(skill)
      ) {
        errors.skills = "Add at least one valid skill";
        break;
      }
      const key = skill.toLowerCase();
      if (seen.has(key)) {
        errors.skills = "Duplicate skills are not allowed";
        break;
      }
      seen.add(key);
    }
  }

  if (!jdText) {
    errors.jd_text = "Job description is required";
  } else if (hasEmoji(jdText)) {
    errors.jd_text = "Emojis are not allowed in Job Description";
  }

  if (recruiterNotes) {
    const notesError = validateDescription(recruiterNotes, {
      minLength: 20,
      required: false,
      label: "Recruiter notes",
    });
    if (notesError) {
      errors.notes_for_recruiter = notesError;
    }
  }

  if (hasEmoji(form.notes_for_recruiter || "")) {
    errors.notes_for_recruiter = "Emojis are not allowed in recruiter notes";
  }

  if (form.client_id && title) {
    const selectedClient = clients.find(
      (client) => String(client.id) === String(form.client_id),
    );
    const selectedClientName = normalizeSpaces(
      selectedClient?.client_name || selectedClient?.name || "",
    ).toLowerCase();

    const duplicate = requirements.find((req) => {
      if (editingJobId && String(req.id) === String(editingJobId)) return false;
      const reqTitle = normalizeSpaces(req.job_title || req.title || "").toLowerCase();
      const reqClientId = String(req.client_id || "");
      const reqClientName = normalizeSpaces(req.client_name || "").toLowerCase();
      return (
        reqTitle === title.toLowerCase() &&
        (reqClientId === String(form.client_id) ||
          (selectedClientName && reqClientName === selectedClientName))
      );
    });

    if (duplicate) {
      warnings.duplicate =
        "Potential duplicate detected: same Client + Job Title already exists.";
    }
  }

  return {
    errors,
    warnings,
    isValid: Object.keys(errors).length === 0,
  };
};

// Job Creation Form - with all fields from specification
const emptyJobForm = {
  // Basic Info
  title: "",
  client_id: "",
  client_name: "",
  client_ta: "",
  // Job Details
  mode: "hybrid",
  skills: [],
  jd_text: "",
  experience_min: "",
  experience_max: "",
  location: "",
  duration: "",
  no_of_positions: "1",
  ctc_currency: "INR",
  ctc_min: "",
  ctc_max: "",
  budget: "",
  work_start_time: "",
  work_end_time: "",
  work_timings: "",
  joining_preference: "",
  // Assignment
  assign_recruiters: [],
  notes_for_recruiter: "",
  // Status
  status: "open",
};

// Job Posting Form - external facing
const emptyPostingForm = {
  job_id: "",
  title: "",
  client_display_name: "",
  jd_content: "",
  ctc: "",
  location: "",
  mode: "hybrid",
  experience: "",
  skills: [],
  last_date_to_apply: "",
  status: "draft",
};

export default function RequirementsList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(
    normalizeStatusFilterValue(searchParams.get("status")),
  );
  const [clientFilter, setClientFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [quickFilters, setQuickFilters] = useState([]);

  // Modal states
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [showCreatePosting, setShowCreatePosting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState(null);
  const [activeTab, setActiveTab] = useState("manual");

  // Assign Recruiters Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignJobId, setAssignJobId] = useState(null);
  const [assignJobTitle, setAssignJobTitle] = useState("");
  const [selectedRecruiters, setSelectedRecruiters] = useState([]);
  const [slaDays, setSlaDays] = useState(7);
  const [targetCVs, setTargetCVs] = useState(5);
  const [assigning, setAssigning] = useState(false);
  const [availableRecruiters, setAvailableRecruiters] = useState([]);

  // Form data
  const [jobForm, setJobForm] = useState(emptyJobForm);
  const [postingForm, setPostingForm] = useState(emptyPostingForm);
  const [emailContent, setEmailContent] = useState("");
  const [jdFile, setJdFile] = useState(null);
  const [jdText, setJdText] = useState("");
  const [skillInput, setSkillInput] = useState("");
  const [postingSkillInput, setPostingSkillInput] = useState("");
  const [skillSuggestions, setSkillSuggestions] = useState([]);
  const [showSkillSuggestions, setShowSkillSuggestions] = useState(false);
  const skillInputRef = useRef(null);
  const skillSuggestionsRef = useRef(null);

  // Dropdown data
  const [recruiters, setRecruiters] = useState([]);
  const [clients, setClients] = useState([]);

  // Edit mode
  const [editingJobId, setEditingJobId] = useState(null);

  // States
  const [submitting, setSubmitting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [jobTouched, setJobTouched] = useState({});
  const [jobServerErrors, setJobServerErrors] = useState({});

  useEffect(() => {
    setStatusFilter(normalizeStatusFilterValue(searchParams.get("status")));
  }, [searchParams]);

  const handleStatusFilterChange = (value) => {
    const normalized = normalizeStatusFilterValue(value);
    setStatusFilter(normalized);

    const params = new URLSearchParams(searchParams);
    if (normalized) {
      params.set("status", normalized);
    } else {
      params.delete("status");
    }
    setSearchParams(params, { replace: true });
  };

  const jobValidation = useMemo(
    () =>
      validateJobForm({
        form: jobForm,
        clients,
        requirements,
        editingJobId,
      }),
    [jobForm, clients, requirements, editingJobId],
  );
  const jobErrors = useMemo(
    () => ({ ...jobValidation.errors, ...jobServerErrors }),
    [jobValidation.errors, jobServerErrors],
  );
  const jobWarnings = jobValidation.warnings;
  const isJobFormValid =
    jobValidation.isValid && Object.keys(jobServerErrors).length === 0;

  const toggleQuickFilter = (key) => {
    setQuickFilters((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  };

  const getBudgetMaxValue = (req) => {
    const parsedCtcMax = Number(req?.ctc_max);
    if (Number.isFinite(parsedCtcMax) && parsedCtcMax > 0) return parsedCtcMax;

    const rawBudget = normalizeSpaces(req?.budget || "");
    if (!rawBudget) return null;
    const matches = rawBudget.replace(/,/g, "").match(/\d+(\.\d+)?/g) || [];
    if (matches.length === 0) return null;
    const fallback = Number(matches[matches.length > 1 ? 1 : 0]);
    return Number.isFinite(fallback) ? fallback : null;
  };

  const isUrgentRequirement = (req) => {
    const joiningPreference = normalizeSpaces(req?.joining_preference || "").toLowerCase();
    if (joiningPreference === "immediate") return true;

    const createdAtRaw = req?.date_created || req?.created_at;
    if (createdAtRaw) {
      const createdAt = new Date(createdAtRaw);
      if (!Number.isNaN(createdAt.getTime())) {
        const ageInDays =
          (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        if (ageInDays <= 7) return true;
      }
    }

    const positions = Number(req?.no_of_positions || 0);
    return Number.isFinite(positions) && positions >= 5;
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requirements.filter((req) => {
      const reqSkills = Array.isArray(req.skills)
        ? req.skills.map((skill) =>
            typeof skill === "string" ? skill : skill?.name || "",
          )
        : [];
      const matchesTerm = term
        ? (req.job_title || req.title)?.toLowerCase().includes(term) ||
          req.client_name?.toLowerCase().includes(term) ||
          req.serial_number?.toLowerCase().includes(term) ||
          reqSkills.some((s) => String(s).toLowerCase().includes(term))
        : true;
      const matchesStatus = statusFilter ? req.status === statusFilter : true;
      const matchesClient = clientFilter
        ? req.client_name?.toLowerCase() === clientFilter.toLowerCase() ||
          req.client_id === clientFilter
        : true;
      const matchesMode = modeFilter ? req.mode === modeFilter : true;
      const matchesQuickFilters = quickFilters.every((quickFilter) => {
        if (quickFilter === "active") {
          return ["active", "open", "in_progress"].includes(
            String(req.status || "").toLowerCase(),
          );
        }
        if (quickFilter === "remote") return req.mode === "remote";
        if (quickFilter === "high_budget") {
          const budgetMax = getBudgetMaxValue(req);
          return Number.isFinite(budgetMax) && budgetMax >= 20;
        }
        if (quickFilter === "urgent") return isUrgentRequirement(req);
        return true;
      });

      return (
        matchesTerm &&
        matchesStatus &&
        matchesClient &&
        matchesMode &&
        matchesQuickFilters
      );
    });
  }, [requirements, search, statusFilter, clientFilter, modeFilter, quickFilters]);

  // Closed requirements - always show all closed ones regardless of filters
  const closedRequirements = useMemo(() => {
    return requirements.filter((req) => req.status === "closed");
  }, [requirements]);

  // Active/filtered requirements (exclude closed from main grid when not filtering by status)
  const activeFiltered = useMemo(() => {
    if (statusFilter === "closed") return filtered;
    return filtered.filter((req) => req.status !== "closed");
  }, [filtered, statusFilter]);

  const fetchRequirements = async () => {
    setLoading(true);
    try {
      // Try new job-management endpoint first
      const res = await api.get("/v1/job-management/requirements", {
        params: {
          status: statusFilter || undefined,
          client_name: clientFilter || undefined,
          search: search || undefined,
        },
      });
      setRequirements(res.data.jobs || res.data.requirements || []);
    } catch (err) {
      console.error("Error fetching requirements:", err);
      // Fallback to old endpoint
      try {
        const res = await workflowService.getAmRequirements({
          status: statusFilter || undefined,
          client_name: clientFilter || undefined,
          q: search || undefined,
        });
        setRequirements(res.requirements || []);
      } catch (e) {
        console.error("Fallback also failed:", e);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchRecruiters = async () => {
    try {
      const res = await api.get("/v1/users?role=recruiter");
      setRecruiters(res.data.users || res.data || []);
    } catch (err) {
      try {
        const res = await api.get("/v1/am/recruiters");
        setRecruiters(res.data || []);
      } catch (e) {
        console.error("Failed to load recruiters", e);
      }
    }
  };

  const fetchClients = async () => {
    try {
      const res = await api.get("/v1/am/clients");
      const apiClients = res.data?.clients || res.data || [];
      const normalizedClients = apiClients
        .map((client) => ({
          id:
            client.id ||
            client.client_id ||
            normalizeSpaces(client.client_name || client.name || "")
              .toLowerCase()
              .replace(/\s+/g, "_"),
          client_name: normalizeSpaces(
            client.client_name || client.name || client.company_name || "",
          ),
        }))
        .filter((client) => client.id && client.client_name);

      setClients(normalizedClients);
    } catch (err) {
      console.error("Failed to load clients", err);
      setClients([]);
    }
  };

  // Open Assign Recruiters Modal
  const openAssignModal = async (job) => {
    setAssignJobId(job.id);
    setAssignJobTitle(job.title || job.job_title || "");
    setSelectedRecruiters([]);
    setSlaDays(7);
    setTargetCVs(5);
    setShowAssignModal(true);

    // Load recruiters with workload
    try {
      const res = await api.get("/v1/am/recruiters");
      setAvailableRecruiters(res.data?.data || res.data || []);
    } catch (err) {
      console.error("Failed to load recruiters:", err);
      // Fallback to simple recruiter list
      try {
        const res = await api.get("/v1/users?role=recruiter");
        const users = res.data?.users || res.data || [];
        setAvailableRecruiters(
          users.map((u) => ({
            id: u.id,
            full_name: u.full_name || u.name,
            email: u.email,
            workload: 0,
            status: "available",
            specialization: [],
          })),
        );
      } catch (e) {
        console.error("Fallback also failed:", e);
      }
    }
  };

  // Open Edit Modal
  const openEditModal = (job) => {
    let clientId = job.client_id || "";
    const incomingClientName = normalizeSpaces(job.client_name || "");

    if (incomingClientName && clients.length > 0) {
      const matchByName = clients.find(
        (client) =>
          normalizeSpaces(client.client_name || client.name || "").toLowerCase() ===
          incomingClientName.toLowerCase(),
      );
      if (matchByName) {
        clientId = matchByName.id;
      }
    }

    const normalizedMode = (() => {
      const rawMode = String(job.mode || "").toLowerCase();
      if (rawMode === "on-site" || rawMode === "on site") return "onsite";
      return MODE_OPTIONS.some((option) => option.value === rawMode)
        ? rawMode
        : "hybrid";
    })();

    const parsedExperience = parseExperienceRange(
      job.experience,
      Number.isFinite(Number(job.min_experience))
        ? Number(job.min_experience)
        : undefined,
      Number.isFinite(Number(job.max_experience))
        ? Number(job.max_experience)
        : undefined,
    );
    const parsedBudget = parseBudgetRange(job.budget);
    const parsedTimeRange = parseTimeRange(job.work_timings);
    const nextSkills = (Array.isArray(job.skills) ? job.skills : [])
      .map((skill) => toTitleCase(normalizeSpaces(skill)))
      .filter(Boolean)
      .slice(0, 30);

    setJobForm({
      ...emptyJobForm,
      title: toTitleCase(normalizeSpaces(job.title || job.job_title || "")),
      client_id: clientId,
      client_name: incomingClientName,
      client_ta: (() => {
        const candidateTa = normalizeSpaces(job.client_ta || "");
        return looksLikeContactValue(candidateTa)
          ? candidateTa
          : toTitleCase(candidateTa);
      })(),
      mode: normalizedMode,
      skills: nextSkills,
      jd_text: normalizeTextarea(job.jd_text || job.description || ""),
      experience_min: parsedExperience.experience_min,
      experience_max: parsedExperience.experience_max,
      location:
        normalizedMode === "remote"
          ? "Remote"
          : toTitleCase(normalizeSpaces(job.location || "")),
      duration: normalizeDurationValue(job.duration),
      no_of_positions:
        job.no_of_positions && Number(job.no_of_positions) > 0
          ? String(job.no_of_positions)
          : "1",
      ctc_currency: parsedBudget.ctc_currency,
      ctc_min: parsedBudget.ctc_min,
      ctc_max: parsedBudget.ctc_max,
      budget: normalizeSpaces(job.budget || ""),
      work_start_time: parsedTimeRange.work_start_time,
      work_end_time: parsedTimeRange.work_end_time,
      work_timings: normalizeSpaces(job.work_timings || ""),
      joining_preference: normalizeJoiningPreferenceValue(
        job.joining_preference,
      ),
      assign_recruiters: (job.recruiters || []).map((recruiter) => recruiter.id),
      notes_for_recruiter: normalizeTextarea(job.notes_for_recruiter || ""),
      status: job.status || "active",
    });
    setJobTouched({});
    setJobServerErrors({});
    setSkillInput("");
    setSkillSuggestions([]);
    setShowSkillSuggestions(false);
    setEditingJobId(job.id);
    setShowCreateJob(true);
  };

  // Handle Assign Recruiters
  const handleAssignRecruiters = async () => {
    if (selectedRecruiters.length === 0) {
      setError("Please select at least one recruiter");
      return;
    }

    setAssigning(true);
    try {
      await api.post("/v1/am/requirements/assign", {
        requirement_id: assignJobId,
        recruiter_ids: selectedRecruiters,
        sla_deadline_days: parseInt(slaDays),
        target_cv_count: parseInt(targetCVs),
      });

      setSuccess(
        `Successfully assigned ${selectedRecruiters.length} recruiter(s)!`,
      );
      setShowAssignModal(false);
      fetchRequirements(); // Refresh list

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Assignment failed:", err);
      setError("Failed to assign recruiters. Please try again.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setAssigning(false);
    }
  };

  // Toggle recruiter selection in assign modal
  const toggleRecruiterSelection = (id) => {
    setSelectedRecruiters((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  };

  // Handle Close/Revoke Requirement
  const handleStatusChange = async (jobId, newStatus) => {
    const actionText = newStatus === "closed" ? "close" : "revoke (reopen)";
    const confirmMessage =
      newStatus === "closed"
        ? "Are you sure you want to close this requirement? It will be moved to Closed Requirements."
        : "Are you sure you want to revoke (reopen) this requirement? It will become active again.";

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await api.put(`/v1/job-management/requirements/${jobId}`, {
        status: newStatus,
      });

      setSuccess(
        newStatus === "closed"
          ? "Requirement closed successfully!"
          : "Requirement revoked (reopened) successfully!",
      );
      fetchRequirements(); // Refresh list
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error(`Failed to ${actionText} requirement:`, err);
      setError(`Failed to ${actionText} requirement. Please try again.`);
      setTimeout(() => setError(null), 3000);
    }
  };

  useEffect(() => {
    fetchRequirements();
    fetchRecruiters();
    fetchClients();
  }, []);

  useEffect(() => {
    const onDocumentClick = (event) => {
      if (
        skillSuggestionsRef.current &&
        !skillSuggestionsRef.current.contains(event.target) &&
        skillInputRef.current &&
        !skillInputRef.current.contains(event.target)
      ) {
        setShowSkillSuggestions(false);
      }
    };

    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  // Job Form Handlers
  const markFieldTouched = (field) => {
    setJobTouched((prev) => ({ ...prev, [field]: true }));
  };

  const clearFieldServerErrors = (field) => {
    setJobServerErrors((prev) => {
      if (!prev || Object.keys(prev).length === 0) return prev;
      const next = { ...prev };
      delete next[field];
      if (field === "experience_min" || field === "experience_max") {
        delete next.experience;
      }
      if (field === "ctc_min" || field === "ctc_max" || field === "ctc_currency") {
        delete next.ctc_range;
      }
      if (field === "work_start_time" || field === "work_end_time") {
        delete next.work_timings;
      }
      return next;
    });
  };

  const handleJobFormChange = (field, value) => {
    markFieldTouched(field);
    clearFieldServerErrors(field);
    if (error) {
      setError(null);
    }

    let nextValue = value;
    if (field === "title") {
      nextValue = String(value).replace(/[^A-Za-z0-9 ]/g, "");
    } else if (field === "client_ta") {
      nextValue = String(value).replace(/[^A-Za-z0-9@.+\-()' ]/g, "");
    } else if (field === "location") {
      nextValue = String(value).replace(/[^A-Za-z0-9,\- ]/g, "");
    } else if (field === "experience_min" || field === "experience_max") {
      nextValue = String(value).replace(/[^\d]/g, "");
    } else if (field === "no_of_positions") {
      nextValue = String(value).replace(/[^\d]/g, "");
    } else if (field === "ctc_min" || field === "ctc_max") {
      nextValue = String(value)
        .replace(/[^\d.]/g, "")
        .replace(/^(\d*\.?\d{0,2}).*$/, "$1");
    } else if (field === "jd_text" || field === "notes_for_recruiter") {
      nextValue = String(value).replace(EMOJI_REGEX, "");
    } else if (typeof nextValue === "string") {
      nextValue = String(nextValue);
    }

    setJobForm((prev) => {
      const updated = { ...prev, [field]: nextValue };
      if (field === "mode" && nextValue === "remote") {
        updated.location = "Remote";
      }
      if (
        field === "mode" &&
        nextValue !== "remote" &&
        normalizeSpaces(prev.location) === "Remote"
      ) {
        updated.location = "";
      }
      return updated;
    });
  };

  const handleJobFieldBlur = (field) => {
    markFieldTouched(field);
    clearFieldServerErrors(field);

    setJobForm((prev) => {
      const next = { ...prev };
      if (typeof next[field] === "string") {
        if (field === "jd_text" || field === "notes_for_recruiter") {
          next[field] = normalizeTextarea(next[field]);
        } else {
          next[field] = normalizeSpaces(next[field]);
          if (TITLE_CASE_FIELDS.has(field)) {
            next[field] = toTitleCase(next[field]);
          } else if (
            field === "client_ta" &&
            next[field] &&
            !looksLikeContactValue(next[field])
          ) {
            next[field] = toTitleCase(next[field]);
          }
        }
      }
      return next;
    });
  };

  const getFieldError = (field, groupedField = null) =>
    jobErrors[field] || (groupedField ? jobErrors[groupedField] : null);

  const getFieldClasses = (field, groupedField = null, extra = "") => {
    const hasError = Boolean(getFieldError(field, groupedField));
    const isTouched = Boolean(jobTouched[field]) || Boolean(jobTouched[groupedField]);
    const stateClass = hasError
      ? "border-red-500 focus:ring-red-300"
      : isTouched
        ? "border-green-500 focus:ring-green-200"
        : "border-gray-300 dark:border-gray-600 focus:ring-purple-200";
    return `w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 ${stateClass} ${extra}`;
  };

  const appendSkills = (rawSkills) => {
    markFieldTouched("skills");

    let nextSkills = [...jobForm.skills];
    let errorMessage = "";

    rawSkills.forEach((rawSkill) => {
      const formattedSkill = toTitleCase(normalizeSpaces(rawSkill || ""));
      if (!formattedSkill) return;

      if (
        formattedSkill.length < 2 ||
        formattedSkill.length > 30 ||
        !SKILL_ALLOWED_REGEX.test(formattedSkill) ||
        hasEmoji(formattedSkill) ||
        !isTitleCase(formattedSkill)
      ) {
        errorMessage =
          "Each skill must be 2-30 characters in Title Case using supported characters";
        return;
      }

      if (nextSkills.length >= 30) {
        errorMessage = "Maximum 30 skills are allowed";
        return;
      }

      const exists = nextSkills.some(
        (skill) => skill.toLowerCase() === formattedSkill.toLowerCase(),
      );
      if (exists) {
        errorMessage = "Duplicate skills are not allowed";
        return;
      }

      nextSkills.push(formattedSkill);
    });

    if (nextSkills.length !== jobForm.skills.length) {
      setJobForm((prev) => ({ ...prev, skills: nextSkills }));
    }

    if (errorMessage) {
      setJobServerErrors((prev) => ({ ...prev, skills: errorMessage }));
    } else {
      setJobServerErrors((prev) => {
        const next = { ...prev };
        delete next.skills;
        return next;
      });
    }
  };

  const handleAddSkill = () => {
    const parts = skillInput
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length === 0) return;

    appendSkills(parts);
    setSkillInput("");
    setSkillSuggestions([]);
    setShowSkillSuggestions(false);
  };

  const handleRemoveSkill = (skill) => {
    markFieldTouched("skills");
    clearFieldServerErrors("skills");
    setJobForm((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skill),
    }));
  };

  const handleSkillInputChange = (value) => {
    clearFieldServerErrors("skills");
    const filteredValue = String(value).replace(/[^A-Za-z0-9+.#/\- ,]/g, "");
    setSkillInput(filteredValue);

    if (!filteredValue.trim()) {
      setSkillSuggestions([]);
      setShowSkillSuggestions(false);
      return;
    }

    const suggestions = getSkillSuggestions(filteredValue)
      .map((skill) => toTitleCase(skill))
      .filter(
        (skill) =>
          !jobForm.skills.some(
            (existing) => existing.toLowerCase() === skill.toLowerCase(),
          ),
      )
      .slice(0, 8);
    setSkillSuggestions(suggestions);
    setShowSkillSuggestions(true);
  };

  const handleSkillKeyPress = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddSkill();
    }
  };

  const toggleRecruiter = (id) => {
    setJobForm((prev) => {
      const exists = prev.assign_recruiters.includes(id);
      return {
        ...prev,
        assign_recruiters: exists
          ? prev.assign_recruiters.filter((rid) => rid !== id)
          : [...prev.assign_recruiters, id],
      };
    });
  };

  // Posting Form Handlers
  const handlePostingFormChange = (field, value) => {
    setPostingForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddPostingSkill = () => {
    const normalizedSkill = toTitleCase(normalizeSpaces(postingSkillInput));
    if (
      normalizedSkill &&
      !postingForm.skills.some(
        (skill) => String(skill || "").toLowerCase() === normalizedSkill.toLowerCase(),
      )
    ) {
      setPostingForm((prev) => ({
        ...prev,
        skills: [...prev.skills, normalizedSkill],
      }));
      setPostingSkillInput("");
    }
  };

  const handleRemovePostingSkill = (skill) => {
    setPostingForm((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skill),
    }));
  };

  const handlePostingSkillKeyPress = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddPostingSkill();
    }
  };

  // File Upload for JD
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
      ];
      if (!validTypes.includes(file.type)) {
        setError("Please upload a PDF or DOCX file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("File size must be less than 5MB");
        return;
      }
      setJdFile(file);
      setError(null);
    }
  };

  const handleParseJD = async () => {
    if (!jdFile && !jdText.trim()) {
      setError("Please upload a file or paste JD text");
      return;
    }

    setParsing(true);
    setError(null);

    try {
      let response;
      if (jdFile) {
        const formData = new FormData();
        formData.append("file", jdFile);
        response = await api.post("/v1/job-management/parse-jd", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        response = await api.post("/v1/job-management/parse-jd-text", {
          text: jdText,
        });
      }

      const parsed = response.data;

      // Auto-fill form with parsed data
      setJobForm((prev) => {
        const parsedModeRaw = String(parsed.mode || "").toLowerCase();
        const parsedMode = MODE_OPTIONS.some(
          (option) => option.value === parsedModeRaw,
        )
          ? parsedModeRaw
          : prev.mode;
        const parsedExperience = parseExperienceRange(
          parsed.experience,
          Number.isFinite(Number(parsed.experience_min))
            ? Number(parsed.experience_min)
            : undefined,
          Number.isFinite(Number(parsed.experience_max))
            ? Number(parsed.experience_max)
            : undefined,
        );
        const parsedBudget = parseBudgetRange(parsed.budget || parsed.ctc || "");
        const parsedTimeRange = parseTimeRange(parsed.work_timings || "");
        const parsedSkills = (Array.isArray(parsed.skills) ? parsed.skills : [])
          .map((skill) => toTitleCase(normalizeSpaces(skill)))
          .filter(Boolean)
          .slice(0, 30);

        return {
          ...prev,
          title: toTitleCase(
            normalizeSpaces(parsed.job_title || parsed.title || prev.title),
          ),
          mode: parsedMode,
          skills: parsedSkills.length > 0 ? parsedSkills : prev.skills,
          experience_min:
            parsedExperience.experience_min || prev.experience_min,
          experience_max:
            parsedExperience.experience_max || prev.experience_max,
          location:
            parsedMode === "remote"
              ? "Remote"
              : toTitleCase(normalizeSpaces(parsed.location || prev.location)),
          ctc_currency: parsedBudget.ctc_currency || prev.ctc_currency,
          ctc_min: parsedBudget.ctc_min || prev.ctc_min,
          ctc_max: parsedBudget.ctc_max || prev.ctc_max,
          work_start_time:
            parsedTimeRange.work_start_time || prev.work_start_time,
          work_end_time: parsedTimeRange.work_end_time || prev.work_end_time,
          duration: normalizeDurationValue(parsed.duration || prev.duration),
          joining_preference: normalizeJoiningPreferenceValue(
            parsed.joining_preference || prev.joining_preference,
          ),
          jd_text: normalizeTextarea(parsed.jd_text || jdText || prev.jd_text),
        };
      });

      setActiveTab("manual");
      setSuccess("JD parsed successfully! Review and edit the fields.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error parsing JD:", err);
      setError("Failed to parse JD. Please enter manually.");
    } finally {
      setParsing(false);
    }
  };

  const resetJobForm = () => {
    setJobForm(emptyJobForm);
    setJobTouched({});
    setJobServerErrors({});
    setSkillInput("");
    setSkillSuggestions([]);
    setShowSkillSuggestions(false);
    setJdFile(null);
    setJdText("");
    setEmailContent("");
    setEditingJobId(null);
    setError(null);
    setSuccess(null);
  };

  const resetPostingForm = () => {
    setPostingForm(emptyPostingForm);
    setPostingSkillInput("");
    setError(null);
    setSuccess(null);
  };

  const handleCreateJob = async (event, status = "open") => {
    event.preventDefault();

    const normalizedSkills = (jobForm.skills || [])
      .map((skill) => toTitleCase(normalizeSpaces(skill)))
      .filter(Boolean);
    const normalizedForm = {
      ...jobForm,
      title: toTitleCase(normalizeSpaces(jobForm.title)),
      client_ta: (() => {
        const candidateTa = normalizeSpaces(jobForm.client_ta);
        return looksLikeContactValue(candidateTa)
          ? candidateTa
          : toTitleCase(candidateTa);
      })(),
      location:
        jobForm.mode === "remote"
          ? "Remote"
          : toTitleCase(normalizeSpaces(jobForm.location)),
      jd_text: normalizeTextarea(jobForm.jd_text),
      notes_for_recruiter: normalizeTextarea(jobForm.notes_for_recruiter),
      skills: normalizedSkills,
      experience_min: String(jobForm.experience_min || ""),
      experience_max: String(jobForm.experience_max || ""),
      ctc_min: String(jobForm.ctc_min || ""),
      ctc_max: String(jobForm.ctc_max || ""),
      no_of_positions: String(jobForm.no_of_positions || ""),
    };

    const validation = validateJobForm({
      form: normalizedForm,
      clients,
      requirements,
      editingJobId,
    });
    setJobForm(normalizedForm);
    setJobTouched({
      title: true,
      client_id: true,
      client_ta: true,
      mode: true,
      experience_min: true,
      experience_max: true,
      location: true,
      duration: true,
      no_of_positions: true,
      ctc_min: true,
      ctc_max: true,
      ctc_currency: true,
      work_start_time: true,
      work_end_time: true,
      joining_preference: true,
      skills: true,
      jd_text: true,
      notes_for_recruiter: true,
    });

    if (!validation.isValid) {
      // Keep server errors separate; local validation is derived from `jobValidation`
      // and should not be persisted in `jobServerErrors` to avoid stale messages.
      setJobServerErrors({});
      setError("Please fix the highlighted fields before submitting.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setJobServerErrors({});

    try {
      const selectedClient = clients.find(
        (client) => String(client.id) === String(normalizedForm.client_id),
      );
      const experienceMin = Number(normalizedForm.experience_min);
      const experienceMax = Number(normalizedForm.experience_max);
      const hasCtcRange = Boolean(normalizedForm.ctc_min && normalizedForm.ctc_max);
      const budgetText = hasCtcRange
        ? buildBudgetText(
            normalizedForm.ctc_currency,
            normalizedForm.ctc_min,
            normalizedForm.ctc_max,
          )
        : normalizeSpaces(normalizedForm.budget || "");
      const workTimings =
        normalizedForm.work_start_time && normalizedForm.work_end_time
          ? `${normalizedForm.work_start_time} - ${normalizedForm.work_end_time}`
          : normalizeSpaces(normalizedForm.work_timings || "");

      const payload = {
        job_title: normalizedForm.title,
        date_created: new Date().toISOString().split("T")[0],
        client_id: normalizedForm.client_id || null,
        client_name:
          selectedClient?.client_name ||
          selectedClient?.name ||
          normalizedForm.client_name ||
          null,
        client_ta: normalizedForm.client_ta || null,
        mode: normalizedForm.mode,
        skills: normalizedForm.skills,
        jd_text: normalizedForm.jd_text,
        experience: buildExperienceText(
          normalizedForm.experience_min,
          normalizedForm.experience_max,
        ),
        experience_min: experienceMin,
        experience_max: experienceMax,
        location:
          normalizedForm.mode === "remote"
            ? "Remote"
            : normalizedForm.location || "",
        duration: normalizedForm.duration || null,
        no_of_positions: Number(normalizedForm.no_of_positions) || 1,
        ctc_currency: hasCtcRange ? normalizedForm.ctc_currency : null,
        ctc_min: hasCtcRange ? Number(normalizedForm.ctc_min) : null,
        ctc_max: hasCtcRange ? Number(normalizedForm.ctc_max) : null,
        budget: budgetText,
        work_start_time: normalizedForm.work_start_time || null,
        work_end_time: normalizedForm.work_end_time || null,
        work_timings: workTimings || null,
        joining_preference: normalizedForm.joining_preference || null,
        recruiter_ids: normalizedForm.assign_recruiters,
        am_notes: normalizedForm.notes_for_recruiter
          ? [normalizedForm.notes_for_recruiter]
          : null,
        status: status || "open",
      };

      if (editingJobId) {
        // Update existing job
        await api.put(
          `/v1/job-management/requirements/${editingJobId}`,
          payload,
        );
        setSuccess("Job updated successfully!");
      } else {
        // Create new job
        await api.post("/v1/job-management/requirements", payload);
        setSuccess("Job created successfully!");
      }
      resetJobForm();
      setShowCreateJob(false);
      fetchRequirements();
    } catch (err) {
      console.error("Failed to save job", err);
      const detail = err.response?.data?.detail;
      if (detail?.errors && typeof detail.errors === "object") {
        setJobServerErrors(detail.errors);
        setError(detail.message || "Please fix highlighted fields and try again.");
        setJobTouched((prev) => ({
          ...prev,
          ...Object.keys(detail.errors).reduce(
            (acc, key) => ({ ...acc, [key]: true }),
            {},
          ),
        }));
      } else if (typeof detail === "string") {
        setError(detail);
      } else {
        setError("Failed to save job");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePosting = async (event, status = "active") => {
    event.preventDefault();

    const normalizedTitle = toTitleCase(normalizeSpaces(postingForm.title));
    const normalizedClientDisplayName = normalizeSpaces(postingForm.client_display_name);
    const normalizedJdContent = normalizeTextarea(postingForm.jd_content);
    const normalizedLocation = toTitleCase(normalizeSpaces(postingForm.location));
    const normalizedExperience = normalizeSpaces(postingForm.experience);
    const normalizedCtc = normalizeSpaces(postingForm.ctc);
    const normalizedSkills = (postingForm.skills || [])
      .map((skill) => toTitleCase(normalizeSpaces(skill)))
      .filter(Boolean);

    const titleError = validateFeatureName(normalizedTitle, "Posting title");
    if (titleError) {
      setError(titleError);
      return;
    }
    if (!normalizedClientDisplayName) {
      setError("Company display name is required");
      return;
    }
    const jdError = validateDescription(normalizedJdContent, {
      minLength: 20,
      required: true,
      label: "Job description",
    });
    if (jdError) {
      setError(jdError);
      return;
    }
    if (!normalizedLocation) {
      setError("Location is required");
      return;
    }
    if (!postingForm.last_date_to_apply) {
      setError("Last date to apply is required");
      return;
    }
    const duplicatePosting = requirements.some((req) => {
      const reqTitle = normalizeText(req?.job_title || req?.title).toLowerCase();
      const reqClientName = normalizeText(
        req?.client?.client_name || req?.client_name || req?.client_display_name,
      ).toLowerCase();
      return (
        reqTitle === normalizedTitle.toLowerCase() &&
        reqClientName === normalizedClientDisplayName.toLowerCase()
      );
    });
    if (duplicatePosting) {
      setError("Duplicate Feature name under the same Sub-Category is not allowed.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setPostingForm((prev) => ({
      ...prev,
      title: normalizedTitle,
      client_display_name: normalizedClientDisplayName,
      jd_content: normalizedJdContent,
      location: normalizedLocation,
      experience: normalizedExperience,
      ctc: normalizedCtc,
      skills: normalizedSkills,
    }));

    try {
      const payload = {
        job_id: postingForm.job_id || null,
        title: normalizedTitle,
        client_display_name: normalizedClientDisplayName,
        jd_content: normalizedJdContent,
        ctc: normalizedCtc || "",
        location: normalizedLocation,
        mode: postingForm.mode,
        experience_required: normalizedExperience || "",
        skills: normalizedSkills,
        last_date_to_apply: postingForm.last_date_to_apply,
      };

      await api.post("/v1/job-management/postings", payload);
      setSuccess("Job posting created successfully!");
      resetPostingForm();
      setShowCreatePosting(false);
    } catch (err) {
      console.error("Failed to create posting", err);
      setError(err.response?.data?.detail || "Failed to create posting");
    } finally {
      setSubmitting(false);
    }
  };

  const handleParseEmail = async () => {
    const normalizedEmailContent = normalizeTextarea(emailContent);
    if (!normalizedEmailContent) return;
    const emailContentError = validateDescription(normalizedEmailContent, {
      minLength: 20,
      required: true,
      label: "Email content",
    });
    if (emailContentError) {
      setError(emailContentError);
      return;
    }
    setParsing(true);
    try {
      const parsed = await workflowService.parseRequirementEmail(normalizedEmailContent);
      setEmailContent(normalizedEmailContent);
      setJobForm((prev) => {
        const parsedExperience = parseExperienceRange(
          "",
          Number.isFinite(Number(parsed.experience_min))
            ? Number(parsed.experience_min)
            : undefined,
          Number.isFinite(Number(parsed.experience_max))
            ? Number(parsed.experience_max)
            : undefined,
        );
        const parsedModeRaw = String(parsed.mode || "").toLowerCase();
        const parsedMode = MODE_OPTIONS.some(
          (option) => option.value === parsedModeRaw,
        )
          ? parsedModeRaw
          : prev.mode;
        const parsedSkills = (Array.isArray(parsed.skills_mandatory)
          ? parsed.skills_mandatory
          : []
        )
          .map((skill) => toTitleCase(normalizeSpaces(skill)))
          .filter(Boolean)
          .slice(0, 30);

        return {
          ...prev,
          title: toTitleCase(normalizeSpaces(parsed.title || prev.title)),
          skills: parsedSkills.length > 0 ? parsedSkills : prev.skills,
          experience_min:
            parsedExperience.experience_min || prev.experience_min,
          experience_max:
            parsedExperience.experience_max || prev.experience_max,
          location:
            parsedMode === "remote"
              ? "Remote"
              : toTitleCase(normalizeSpaces(parsed.location || prev.location)),
          mode: parsedMode,
          duration: normalizeDurationValue(parsed.duration || prev.duration),
          joining_preference: normalizeJoiningPreferenceValue(
            parsed.joining_preference || prev.joining_preference,
          ),
          jd_text: normalizeTextarea(emailContent),
        };
      });
      setShowImport(false);
      setShowCreateJob(true);
      setSuccess("Email parsed successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Email parse failed", err);
      setError("Failed to parse email");
    } finally {
      setParsing(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "--";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "--";
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      open: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      in_progress: "bg-sky-50 text-sky-700 border border-sky-200",
      closed: "bg-red-50 text-red-700 border border-red-200",
      on_hold: "bg-amber-50 text-amber-700 border border-amber-200",
      draft: "bg-violet-50 text-violet-700 border border-violet-200",
    };
    return (
      <span
        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${styles[status] || styles.active}`}
      >
        {(status || "active").replace("_", " ").toUpperCase()}
      </span>
    );
  };

  const getModeBadge = (mode) => {
    const styles = {
      hybrid: "bg-violet-50 text-violet-700 border border-violet-200",
      remote: "bg-blue-50 text-blue-700 border border-blue-200",
      onsite: "bg-orange-50 text-orange-700 border border-orange-200",
      contract: "bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200",
    };
    return (
      <span
        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${styles[mode] || styles.hybrid}`}
      >
        {(mode || "hybrid").toUpperCase()}
      </span>
    );
  };

  const getSkillChipTone = (skill) => {
    const normalized = normalizeSpaces(skill || "").toLowerCase();
    if (!normalized) {
      return "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200";
    }

    if (CLOUD_SKILLS.some((keyword) => normalized.includes(keyword))) {
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-900/20 dark:text-blue-300";
    }
    if (DATABASE_SKILLS.some((keyword) => normalized.includes(keyword))) {
      return "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-500/40 dark:bg-teal-900/20 dark:text-teal-300";
    }
    if (BACKEND_SKILLS.some((keyword) => normalized.includes(keyword))) {
      return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/40 dark:bg-violet-900/20 dark:text-violet-300";
    }
    return "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200";
  };

  const getClientDisplayName = (req) =>
    req?.client?.client_name || req?.client_name || "--";

  const getExperienceDisplay = (req) => {
    const raw = normalizeSpaces(req?.experience || "");
    if (raw) {
      return /year|yr/i.test(raw) ? raw : `${raw} yrs`;
    }

    const minExp =
      req?.min_experience !== null && req?.min_experience !== undefined
        ? Number(req.min_experience)
        : null;
    const maxExp =
      req?.max_experience !== null && req?.max_experience !== undefined
        ? Number(req.max_experience)
        : null;

    if (Number.isFinite(minExp) && Number.isFinite(maxExp)) {
      return `${minExp}-${maxExp} yrs`;
    }
    if (Number.isFinite(minExp)) return `${minExp}+ yrs`;
    if (Number.isFinite(maxExp)) return `0-${maxExp} yrs`;
    return "--";
  };

  const getBudgetDisplay = (req) => {
    const budgetText = normalizeSpaces(req?.budget || "");
    if (budgetText) return budgetText;

    const ctcMin =
      req?.ctc_min !== null && req?.ctc_min !== undefined ? Number(req.ctc_min) : null;
    const ctcMax =
      req?.ctc_max !== null && req?.ctc_max !== undefined ? Number(req.ctc_max) : null;
    const currency = normalizeSpaces(req?.ctc_currency || "INR") || "INR";

    if (Number.isFinite(ctcMin) && Number.isFinite(ctcMax)) {
      return `${currency} ${ctcMin} - ${ctcMax}`;
    }
    return "--";
  };

  const getSkillList = (req) =>
    (Array.isArray(req?.skills) ? req.skills : [])
      .map((skill) => {
        if (typeof skill === "string") return normalizeSpaces(skill);
        return normalizeSpaces(skill?.name || "");
      })
      .filter(Boolean);

  const renderRequirementCard = (req, index, isClosed = false) => {
    const title = req.job_title || req.title || "Untitled Role";
    const clientName = getClientDisplayName(req);
    const location = normalizeSpaces(req.location || "") || "--";
    const experience = getExperienceDisplay(req);
    const budget = getBudgetDisplay(req);
    const skills = getSkillList(req);
    const visibleSkills = skills.slice(0, 3);
    const hiddenSkillsCount = Math.max(0, skills.length - visibleSkills.length);

    return (
      <article
        key={req.id}
        className={`group h-full min-h-[248px] rounded-xl border p-4 shadow-sm transition-all duration-200 ease-out flex flex-col cursor-pointer ${
          isClosed
            ? "bg-white dark:bg-gray-800 border-red-100 dark:border-red-900/40 hover:border-red-200 dark:hover:border-red-700/60 hover:shadow-md"
            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-500/60 hover:shadow-md hover:-translate-y-0.5"
        }`}
        onClick={() => {
          setSelectedRequirement(req);
          setShowDetailModal(true);
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                #{req.serial_number || index + 1}
              </span>
              {isClosed ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
                  CLOSED
                </span>
              ) : (
                getStatusBadge(req.status)
              )}
            </div>
            <h3
              className={`text-[19px] font-semibold leading-6 line-clamp-2 ${
                isClosed
                  ? "text-gray-700 dark:text-gray-300"
                  : "text-gray-900 dark:text-white"
              }`}
            >
              {title}
            </h3>
          </div>
          {getModeBadge(req.mode)}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Client
            </p>
            <p className="mt-1 text-[15px] font-medium text-gray-900 dark:text-white truncate">
              {clientName}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Location
            </p>
            <p className="mt-1 text-[15px] font-medium text-gray-700 dark:text-gray-200 truncate">
              {location}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Experience
            </p>
            <p className="mt-1 text-[15px] font-medium text-indigo-700 dark:text-indigo-300 truncate">
              {experience}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Budget
            </p>
            <p className="mt-1 text-[15px] font-semibold text-emerald-700 dark:text-emerald-300 truncate">
              {budget}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            Skills
          </p>
          <div className="flex flex-wrap gap-1.5 min-h-[24px]">
            {visibleSkills.length > 0 ? (
              <>
                {visibleSkills.map((skill, idx) => (
                  <span
                    key={`${req.id || index}-skill-${idx}`}
                    className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium ${getSkillChipTone(
                      skill,
                    )}`}
                  >
                    {skill}
                  </span>
                ))}
                {hiddenSkillsCount > 0 ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                    +{hiddenSkillsCount} more
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                No skills added
              </span>
            )}
          </div>
        </div>

        <div className="mt-auto pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2">
          <button
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors ${
              isClosed
                ? "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                : "border-indigo-200 dark:border-indigo-500/50 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
            }`}
            onClick={(event) => {
              event.stopPropagation();
              setSelectedRequirement(req);
              setShowDetailModal(true);
            }}
          >
            <Eye className="w-3.5 h-3.5" />
            Details
          </button>

          <div className="flex items-center gap-1">
            {!isClosed ? (
              <>
                <button
                  className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                  title="Edit"
                  onClick={(event) => {
                    event.stopPropagation();
                    openEditModal(req);
                  }}
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-md transition-colors"
                  title="Assign Recruiters"
                  onClick={(event) => {
                    event.stopPropagation();
                    openAssignModal(req);
                  }}
                >
                  <Users className="w-4 h-4" />
                </button>
                <button
                  className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                  title="Close Requirement"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleStatusChange(req.id, "closed");
                  }}
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors"
                title="Revoke (Reopen) Requirement"
                onClick={(event) => {
                  event.stopPropagation();
                  handleStatusChange(req.id, "active");
                }}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  const today = new Date().toISOString().split("T")[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Job Requirements ({requirements.length})
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Manage job requirements and postings
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg shadow-sm hover:bg-purple-700 transition-colors"
            onClick={() => {
              resetJobForm();
              setShowCreateJob(true);
            }}
          >
            <Plus className="w-4 h-4" />
            Create Job
          </button>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            onClick={() => setShowImport(true)}
          >
            <Mail className="w-4 h-4" />
            Import from Email
          </button>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            onClick={() => setShowCreatePosting(true)}
          >
            <ExternalLink className="w-4 h-4" />
            Create Posting
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by title, skill, client..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900"
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
        >
          <option value="">All Clients</option>
          {clients.map((client) => (
            <option key={client.id} value={client.client_name}>
              {client.client_name}
            </option>
          ))}
        </select>
        <select
          className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900"
          value={statusFilter}
          onChange={(e) => handleStatusFilterChange(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="closed">Closed</option>
          <option value="on_hold">On Hold</option>
        </select>
        <select
          className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900"
          value={modeFilter}
          onChange={(e) => setModeFilter(e.target.value)}
        >
          <option value="">All Modes</option>
          <option value="hybrid">Hybrid</option>
          <option value="remote">Remote</option>
          <option value="onsite">On-site</option>
          <option value="contract">Contract</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {QUICK_FILTERS.map((quickFilter) => {
          const active = quickFilters.includes(quickFilter.key);
          return (
            <button
              key={quickFilter.key}
              type="button"
              onClick={() => toggleQuickFilter(quickFilter.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? "bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-600 text-purple-700 dark:text-purple-300"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              {quickFilter.label}
            </button>
          );
        })}
      </div>

      {/* Requirements Cards */}
      {activeFiltered.length === 0 ? (
        <div className="text-center py-12">
          <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No requirements found
          </p>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            onClick={() => {
              resetJobForm();
              setShowCreateJob(true);
            }}
          >
            <Plus className="w-4 h-4" />
            Create Your First Job
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 auto-rows-fr">
          {activeFiltered.map((req, index) =>
            renderRequirementCard(req, index, req.status === "closed"),
          )}
        </div>
      )}

      {/* Closed Requirements Section */}
      {closedRequirements.length > 0 && statusFilter !== "closed" && (
        <div className="mt-10">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Closed Requirements
            </h2>
            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
              {closedRequirements.length}
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 auto-rows-fr">
            {closedRequirements.map((req, index) =>
              renderRequirementCard(req, index, true),
            )}
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {showDetailModal && selectedRequirement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {selectedRequirement.job_title || selectedRequirement.title}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-gray-500">
                    #
                    {selectedRequirement.serial_number ||
                      selectedRequirement.id?.slice(0, 8)}
                  </span>
                  {getStatusBadge(selectedRequirement.status)}
                  {getModeBadge(selectedRequirement.mode)}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedRequirement(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Basic Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Client
                  </span>
                  <p className="text-gray-900 dark:text-white mt-1">
                    {selectedRequirement.client?.client_name ||
                      selectedRequirement.client_name ||
                      "--"}
                  </p>
                </div>
                {selectedRequirement.client_ta && (
                  <div>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Client TA
                    </span>
                    <p className="text-gray-900 dark:text-white mt-1">
                      {selectedRequirement.client_ta}
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Location
                  </span>
                  <p className="text-gray-900 dark:text-white mt-1">
                    {selectedRequirement.location || "--"}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Experience
                  </span>
                  <p className="text-gray-900 dark:text-white mt-1">
                    {selectedRequirement.experience ||
                      `${selectedRequirement.min_experience || 0} - ${selectedRequirement.max_experience || "N/A"}`}{" "}
                    years
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Positions
                  </span>
                  <p className="text-gray-900 dark:text-white mt-1 font-semibold">
                    {selectedRequirement.no_of_positions || 1}
                  </p>
                </div>
                {selectedRequirement.duration && (
                  <div>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Duration
                    </span>
                    <p className="text-gray-900 dark:text-white mt-1">
                      {selectedRequirement.duration}
                    </p>
                  </div>
                )}
                {selectedRequirement.budget && (
                  <div>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Budget / CTC
                    </span>
                    <p className="text-green-600 dark:text-green-400 mt-1 font-semibold">
                      {selectedRequirement.budget}
                    </p>
                  </div>
                )}
                {selectedRequirement.work_timings && (
                  <div>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Work Timings
                    </span>
                    <p className="text-gray-900 dark:text-white mt-1">
                      {selectedRequirement.work_timings}
                    </p>
                  </div>
                )}
                {selectedRequirement.joining_preference && (
                  <div>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Joining Preference
                    </span>
                    <p className="text-gray-900 dark:text-white mt-1">
                      {selectedRequirement.joining_preference}
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Created
                  </span>
                  <p className="text-gray-600 dark:text-gray-300 mt-1">
                    {formatDate(
                      selectedRequirement.date_created ||
                        selectedRequirement.created_at,
                    )}
                  </p>
                </div>
              </div>

              {/* Skills */}
              <div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 block mb-2">
                  Skills
                </span>
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(selectedRequirement.skills)
                    ? selectedRequirement.skills
                    : []
                  ).map((skill, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 rounded-full text-sm"
                    >
                      {typeof skill === "string" ? skill : skill?.name || skill}
                    </span>
                  ))}
                  {(!selectedRequirement.skills ||
                    selectedRequirement.skills.length === 0) && (
                    <span className="text-gray-400">No skills specified</span>
                  )}
                </div>
              </div>

              {/* Job Description */}
              {(selectedRequirement.jd_text ||
                selectedRequirement.description) && (
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400 block mb-2">
                    Job Description
                  </span>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-sm">
                      {selectedRequirement.jd_text ||
                        selectedRequirement.description}
                    </p>
                  </div>
                </div>
              )}

              {/* Notes for Recruiter */}
              {selectedRequirement.notes_for_recruiter && (
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400 block mb-2">
                    Notes for Recruiter
                  </span>
                  <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-sm">
                      {selectedRequirement.notes_for_recruiter}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedRequirement(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  openAssignModal(selectedRequirement);
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                Assign Recruiters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Job Modal */}
      {showCreateJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingJobId ? "Edit Job" : "Create New Job"}
                </h3>
                <p className="text-sm text-gray-500">
                  {editingJobId
                    ? "Update job requirement details"
                    : "Add a new job requirement"}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCreateJob(false);
                  resetJobForm();
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-6 pt-4 flex gap-4 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab("manual")}
                className={`pb-3 px-1 text-sm font-medium transition-colors ${
                  activeTab === "manual"
                    ? "text-purple-600 border-b-2 border-purple-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Manual Entry
              </button>
              <button
                onClick={() => setActiveTab("import")}
                className={`pb-3 px-1 text-sm font-medium transition-colors ${
                  activeTab === "import"
                    ? "text-purple-600 border-b-2 border-purple-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Import from JD
              </button>
            </div>

            {/* Messages */}
            {error && (
              <div className="mx-6 mt-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-700 dark:text-red-300">
                  {error}
                </span>
                <button onClick={() => setError(null)} className="ml-auto">
                  <X className="w-4 h-4 text-red-600" />
                </button>
              </div>
            )}
            {success && (
              <div className="mx-6 mt-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-700 dark:text-green-300">
                  {success}
                </span>
              </div>
            )}

            {/* Import Tab Content */}
            {activeTab === "import" && (
              <div className="p-6">
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center mb-4">
                  {jdFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="w-8 h-8 text-purple-600" />
                      <span className="text-gray-900 dark:text-white">
                        {jdFile.name}
                      </span>
                      <button
                        onClick={() => setJdFile(null)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 dark:text-gray-400 mb-2">
                        Drag & drop a JD file or click to upload
                      </p>
                      <p className="text-sm text-gray-500">
                        PDF, DOCX | Max 5MB
                      </p>
                      <input
                        type="file"
                        accept=".pdf,.docx,.doc"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                <div className="text-center text-gray-500 my-4">OR</div>

                <textarea
                  placeholder="Paste raw JD text here..."
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />

                <button
                  type="button"
                  onClick={handleParseJD}
                  disabled={parsing || (!jdFile && !jdText.trim())}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {parsing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Parsing JD...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      Parse JD
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Manual Entry Form */}
            {activeTab === "manual" && (
              <form
                onSubmit={(e) => handleCreateJob(e, "open")}
                className="p-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Job Title */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Job Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={jobForm.title}
                      onChange={(e) =>
                        handleJobFormChange("title", e.target.value)
                      }
                      onBlur={() => handleJobFieldBlur("title")}
                      maxLength={80}
                      placeholder="e.g., Senior SAP FICO Consultant"
                      className={getFieldClasses("title")}
                    />
                    {getFieldError("title") && (
                      <p className="mt-1 text-xs text-red-600">
                        {getFieldError("title")}
                      </p>
                    )}
                    {jobWarnings.duplicate && !getFieldError("title") && (
                      <p className="mt-1 text-xs text-amber-600">
                        {jobWarnings.duplicate}
                      </p>
                    )}
                  </div>

                  {/* Client */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Client <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={jobForm.client_id}
                      onChange={(e) => {
                        const clientId = e.target.value;
                        const selectedClient = clients.find(
                          (client) => String(client.id) === String(clientId),
                        );
                        handleJobFormChange("client_id", clientId);
                        setJobForm((prev) => ({
                          ...prev,
                          client_name:
                            selectedClient?.client_name || selectedClient?.name || "",
                        }));
                      }}
                      onBlur={() => markFieldTouched("client_id")}
                      className={getFieldClasses("client_id")}
                    >
                      <option value="">Select Client</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.client_name || client.name}
                        </option>
                      ))}
                    </select>
                    {getFieldError("client_id") && (
                      <p className="mt-1 text-xs text-red-600">
                        {getFieldError("client_id")}
                      </p>
                    )}
                  </div>

                  {/* Client TA */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Client TA (Contact)
                    </label>
                    <input
                      type="text"
                      value={jobForm.client_ta}
                      onChange={(e) =>
                        handleJobFormChange("client_ta", e.target.value)
                      }
                      onBlur={() => handleJobFieldBlur("client_ta")}
                      maxLength={60}
                      placeholder="Client's HR/TA contact name"
                      className={getFieldClasses("client_ta")}
                    />
                    {getFieldError("client_ta") && (
                      <p className="mt-1 text-xs text-red-600">
                        {getFieldError("client_ta")}
                      </p>
                    )}
                  </div>

                  {/* Mode */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Mode <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={jobForm.mode}
                      onChange={(e) =>
                        handleJobFormChange("mode", e.target.value)
                      }
                      onBlur={() => markFieldTouched("mode")}
                      className={getFieldClasses("mode")}
                    >
                      {MODE_OPTIONS.map((modeOption) => (
                        <option key={modeOption.value} value={modeOption.value}>
                          {modeOption.label}
                        </option>
                      ))}
                    </select>
                    {getFieldError("mode") && (
                      <p className="mt-1 text-xs text-red-600">
                        {getFieldError("mode")}
                      </p>
                    )}
                  </div>

                  {/* Experience */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Experience (Years) <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={jobForm.experience_min}
                        onChange={(e) =>
                          handleJobFormChange("experience_min", e.target.value)
                        }
                        onBlur={() => markFieldTouched("experience_min")}
                        placeholder="Min (0-30)"
                        className={getFieldClasses("experience_min", "experience")}
                      />
                      <input
                        type="text"
                        value={jobForm.experience_max}
                        onChange={(e) =>
                          handleJobFormChange("experience_max", e.target.value)
                        }
                        onBlur={() => markFieldTouched("experience_max")}
                        placeholder="Max (0-30)"
                        className={getFieldClasses("experience_max", "experience")}
                      />
                    </div>
                    {getFieldError("experience_min", "experience") && (
                      <p className="mt-1 text-xs text-red-600">
                        {getFieldError("experience_min", "experience")}
                      </p>
                    )}
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Location{" "}
                      {jobForm.mode !== "remote" && (
                        <span className="text-red-500">*</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={jobForm.location}
                      onChange={(e) =>
                        handleJobFormChange("location", e.target.value)
                      }
                      onBlur={() => handleJobFieldBlur("location")}
                      maxLength={100}
                      disabled={jobForm.mode === "remote"}
                      placeholder="e.g., Bengaluru, India"
                      className={getFieldClasses(
                        "location",
                        null,
                        jobForm.mode === "remote" ? "opacity-80 cursor-not-allowed" : "",
                      )}
                    />
                    {getFieldError("location") && (
                      <p className="mt-1 text-xs text-red-600">
                        {getFieldError("location")}
                      </p>
                    )}
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Duration
                    </label>
                    <select
                      value={jobForm.duration}
                      onChange={(e) =>
                        handleJobFormChange("duration", e.target.value)
                      }
                      onBlur={() => markFieldTouched("duration")}
                      className={getFieldClasses("duration")}
                    >
                      <option value="">Select Duration</option>
                      {DURATION_OPTIONS.map((durationOption) => (
                        <option key={durationOption} value={durationOption}>
                          {durationOption}
                        </option>
                      ))}
                    </select>
                    {getFieldError("duration") && (
                      <p className="mt-1 text-xs text-red-600">
                        {getFieldError("duration")}
                      </p>
                    )}
                  </div>

                  {/* No of Positions */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Number of Positions <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={jobForm.no_of_positions}
                      onChange={(e) =>
                        handleJobFormChange("no_of_positions", e.target.value)
                      }
                      onBlur={() => markFieldTouched("no_of_positions")}
                      placeholder="1 - 500"
                      className={getFieldClasses("no_of_positions")}
                    />
                    {getFieldError("no_of_positions") && (
                      <p className="mt-1 text-xs text-red-600">
                        {getFieldError("no_of_positions")}
                      </p>
                    )}
                  </div>

                  {/* Budget */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Budget / CTC
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={jobForm.ctc_currency}
                        onChange={(e) =>
                          handleJobFormChange("ctc_currency", e.target.value)
                        }
                        onBlur={() => markFieldTouched("ctc_currency")}
                        className={getFieldClasses("ctc_currency", "ctc_range")}
                      >
                        {CURRENCY_OPTIONS.map((currency) => (
                          <option key={currency} value={currency}>
                            {currency}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={jobForm.ctc_min}
                        onChange={(e) =>
                          handleJobFormChange("ctc_min", e.target.value)
                        }
                        onBlur={() => markFieldTouched("ctc_min")}
                        placeholder="Min CTC"
                        className={getFieldClasses("ctc_min", "ctc_range")}
                      />
                      <input
                        type="text"
                        value={jobForm.ctc_max}
                        onChange={(e) =>
                          handleJobFormChange("ctc_max", e.target.value)
                        }
                        onBlur={() => markFieldTouched("ctc_max")}
                        placeholder="Max CTC"
                        className={getFieldClasses("ctc_max", "ctc_range")}
                      />
                    </div>
                    {getFieldError("ctc_min", "ctc_range") && (
                      <p className="mt-1 text-xs text-red-600">
                        {getFieldError("ctc_min", "ctc_range")}
                      </p>
                    )}
                    {!getFieldError("ctc_min", "ctc_range") &&
                      jobWarnings.ctc_range && (
                        <p className="mt-1 text-xs text-amber-600">
                          {jobWarnings.ctc_range}
                        </p>
                      )}
                  </div>

                  {/* Work Timings */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Work Timings
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="time"
                        value={jobForm.work_start_time}
                        onChange={(e) =>
                          handleJobFormChange("work_start_time", e.target.value)
                        }
                        onBlur={() => markFieldTouched("work_start_time")}
                        className={getFieldClasses(
                          "work_start_time",
                          "work_timings",
                        )}
                      />
                      <input
                        type="time"
                        value={jobForm.work_end_time}
                        onChange={(e) =>
                          handleJobFormChange("work_end_time", e.target.value)
                        }
                        onBlur={() => markFieldTouched("work_end_time")}
                        className={getFieldClasses("work_end_time", "work_timings")}
                      />
                    </div>
                    {getFieldError("work_start_time", "work_timings") && (
                      <p className="mt-1 text-xs text-red-600">
                        {getFieldError("work_start_time", "work_timings")}
                      </p>
                    )}
                  </div>

                  {/* Joining Preference */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Joining Preference
                    </label>
                    <select
                      value={jobForm.joining_preference}
                      onChange={(e) =>
                        handleJobFormChange("joining_preference", e.target.value)
                      }
                      onBlur={() => markFieldTouched("joining_preference")}
                      className={getFieldClasses("joining_preference")}
                    >
                      <option value="">Select Joining Preference</option>
                      {JOINING_PREFERENCE_OPTIONS.map((preference) => (
                        <option key={preference} value={preference}>
                          {preference}
                        </option>
                      ))}
                    </select>
                    {getFieldError("joining_preference") && (
                      <p className="mt-1 text-xs text-red-600">
                        {getFieldError("joining_preference")}
                      </p>
                    )}
                  </div>

                  {/* Skills */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Skills <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {jobForm.skills.map((skill, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 rounded-full text-sm"
                        >
                          {skill}
                          <button
                            type="button"
                            onClick={() => handleRemoveSkill(skill)}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2 relative">
                      <input
                        ref={skillInputRef}
                        type="text"
                        value={skillInput}
                        onChange={(e) => handleSkillInputChange(e.target.value)}
                        onKeyDown={handleSkillKeyPress}
                        onFocus={() => {
                          if (skillSuggestions.length > 0) {
                            setShowSkillSuggestions(true);
                          }
                        }}
                        onBlur={() => {
                          markFieldTouched("skills");
                          setTimeout(() => setShowSkillSuggestions(false), 100);
                        }}
                        placeholder="Type a skill and press Enter"
                        className={getFieldClasses("skills")}
                      />
                      <button
                        type="button"
                        onClick={handleAddSkill}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                      {showSkillSuggestions && skillSuggestions.length > 0 && (
                        <div
                          ref={skillSuggestionsRef}
                          className="absolute z-20 top-[42px] left-0 right-14 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-44 overflow-y-auto"
                        >
                          {skillSuggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                appendSkills([suggestion]);
                                setSkillInput("");
                                setShowSkillSuggestions(false);
                                setSkillSuggestions([]);
                              }}
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {jobForm.skills.length}/30 skills added
                    </p>
                    {getFieldError("skills") && (
                      <p className="mt-1 text-xs text-red-600">
                        {getFieldError("skills")}
                      </p>
                    )}
                  </div>

                  {/* Job Description */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Job Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={jobForm.jd_text}
                      onChange={(e) =>
                        handleJobFormChange("jd_text", e.target.value)
                      }
                      onBlur={() => handleJobFieldBlur("jd_text")}
                      rows={8}
                      placeholder="Enter the full job description..."
                      className={getFieldClasses("jd_text")}
                    />
                    {getFieldError("jd_text") && (
                      <p className="mt-1 text-xs text-red-600">
                        {getFieldError("jd_text")}
                      </p>
                    )}
                  </div>

                  {/* Notes for Recruiter */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Notes for Recruiter (Internal)
                    </label>
                    <textarea
                      value={jobForm.notes_for_recruiter}
                      onChange={(e) =>
                        handleJobFormChange(
                          "notes_for_recruiter",
                          e.target.value,
                        )
                      }
                      onBlur={() => handleJobFieldBlur("notes_for_recruiter")}
                      rows={3}
                      placeholder="Private instructions for assigned recruiters..."
                      className={getFieldClasses("notes_for_recruiter")}
                    />
                    {getFieldError("notes_for_recruiter") && (
                      <p className="mt-1 text-xs text-red-600">
                        {getFieldError("notes_for_recruiter")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateJob(false);
                      resetJobForm();
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleCreateJob(e, "draft")}
                    disabled={submitting || !isJobFormValid}
                    className="px-4 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 disabled:opacity-50"
                  >
                    Save as Draft
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !isJobFormValid}
                    className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {editingJobId ? "Updating..." : "Creating..."}
                      </>
                    ) : editingJobId ? (
                      "Update Job"
                    ) : (
                      "Publish Job"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Create Posting Modal */}
      {showCreatePosting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Create Job Posting
                </h3>
                <p className="text-sm text-gray-500">
                  Create an external job posting for candidates
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCreatePosting(false);
                  resetPostingForm();
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mx-6 mt-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-700 dark:text-red-300">
                  {error}
                </span>
                <button onClick={() => setError(null)} className="ml-auto">
                  <X className="w-4 h-4 text-red-600" />
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => handleCreatePosting(e, "active")}
              className="p-6"
            >
              {/* Link to Existing Job */}
              <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Link to Existing Job (Optional)
                </label>
                <select
                  value={postingForm.job_id}
                  onChange={(e) => {
                    const jobId = e.target.value;
                    if (jobId) {
                      const job = requirements.find(
                        (r) => r.id === jobId || r.id === Number(jobId),
                      );
                      if (job) {
                        setPostingForm((prev) => ({
                          ...prev,
                          job_id: jobId,
                          title: job.job_title || job.title || "",
                          client_display_name:
                            job.client?.client_name || job.client_name || "",
                          jd_content: job.jd_text || job.description || "",
                          ctc: job.budget || "",
                          location: job.location || "",
                          mode: job.mode || "hybrid",
                          experience: job.experience || "",
                          skills: job.skills || [],
                        }));
                      }
                    } else {
                      handlePostingFormChange("job_id", "");
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">-- Create standalone posting --</option>
                  {requirements.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.job_title || job.title} -{" "}
                      {job.client?.client_name || job.client_name || "Unknown"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Posting Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={postingForm.title}
                    onChange={(e) =>
                      handlePostingFormChange("title", e.target.value)
                    }
                    onBlur={(e) =>
                      handlePostingFormChange("title", toTitleCase(normalizeSpaces(e.target.value)))
                    }
                    required
                    placeholder="e.g., Senior Software Engineer"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Client Display Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Company Display Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={postingForm.client_display_name}
                    onChange={(e) =>
                      handlePostingFormChange(
                        "client_display_name",
                        e.target.value,
                      )
                    }
                    onBlur={(e) =>
                      handlePostingFormChange(
                        "client_display_name",
                        normalizeText(e.target.value),
                      )
                    }
                    required
                    placeholder="e.g., Leading IT MNC"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Location <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={postingForm.location}
                    onChange={(e) =>
                      handlePostingFormChange("location", e.target.value)
                    }
                    onBlur={(e) =>
                      handlePostingFormChange("location", toTitleCase(normalizeSpaces(e.target.value)))
                    }
                    required
                    placeholder="e.g., Bengaluru, India"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Mode */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Work Mode
                  </label>
                  <select
                    value={postingForm.mode}
                    onChange={(e) =>
                      handlePostingFormChange("mode", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="hybrid">Hybrid</option>
                    <option value="remote">Remote</option>
                    <option value="onsite">On-site</option>
                    <option value="contract">Contract</option>
                  </select>
                </div>

                {/* Experience */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Experience
                  </label>
                  <input
                    type="text"
                    value={postingForm.experience}
                    onChange={(e) =>
                      handlePostingFormChange("experience", e.target.value)
                    }
                    onBlur={(e) =>
                      handlePostingFormChange("experience", normalizeText(e.target.value))
                    }
                    placeholder="e.g., 5-8 years"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                {/* CTC */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    CTC / Salary Range
                  </label>
                  <input
                    type="text"
                    value={postingForm.ctc}
                    onChange={(e) =>
                      handlePostingFormChange("ctc", e.target.value)
                    }
                    onBlur={(e) =>
                      handlePostingFormChange("ctc", normalizeText(e.target.value))
                    }
                    placeholder="e.g., INR 15-20 LPA"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Last Date to Apply */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Last Date to Apply <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={postingForm.last_date_to_apply}
                    onChange={(e) =>
                      handlePostingFormChange(
                        "last_date_to_apply",
                        e.target.value,
                      )
                    }
                    required
                    min={today}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Skills */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Required Skills
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {postingForm.skills.map((skill, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 rounded-full text-sm"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => handleRemovePostingSkill(skill)}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={postingSkillInput}
                      onChange={(e) => setPostingSkillInput(e.target.value)}
                      onKeyPress={handlePostingSkillKeyPress}
                      placeholder="Type a skill and press Enter"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddPostingSkill}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Job Description */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Job Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={postingForm.jd_content}
                    onChange={(e) =>
                      handlePostingFormChange("jd_content", e.target.value)
                    }
                    onBlur={(e) =>
                      handlePostingFormChange("jd_content", normalizeText(e.target.value))
                    }
                    required
                    rows={8}
                    placeholder="Enter the job description that will be visible to candidates..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    This description will be visible to candidates. Remove any
                    confidential information.
                  </p>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreatePosting(false);
                    resetPostingForm();
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => handleCreatePosting(e, "draft")}
                  disabled={submitting}
                  className="px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 disabled:opacity-50"
                >
                  Save as Draft
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    "Publish Posting"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import from Email Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Import from Email
              </h3>
              <button
                onClick={() => setShowImport(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {error && (
              <div className="mx-6 mt-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-700 dark:text-red-300">
                  {error}
                </span>
              </div>
            )}
            <div className="p-6">
              <textarea
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-h-[200px]"
                placeholder="Paste raw email content here..."
                value={emailContent}
                onChange={(e) => setEmailContent(e.target.value)}
                onBlur={(e) => setEmailContent(normalizeText(e.target.value))}
              />
              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50"
                  onClick={() => setShowImport(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  onClick={handleParseEmail}
                  disabled={parsing || !emailContent.trim()}
                >
                  {parsing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Parsing...
                    </>
                  ) : (
                    "Parse Requirement"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Recruiters Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Assign Recruiters
                </h2>
                <p className="text-purple-200 text-sm mt-1">
                  Job: <span className="font-semibold">{assignJobTitle}</span>
                </p>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Recruiter Selection */}
                <div className="lg:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Available Recruiters
                    </h3>
                    <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {availableRecruiters.length} Total
                    </span>
                  </div>

                  {availableRecruiters.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No recruiters available</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {availableRecruiters.map((r) => {
                        const isSelected = selectedRecruiters.includes(r.id);
                        return (
                          <div
                            key={r.id}
                            onClick={() => toggleRecruiterSelection(r.id)}
                            className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                              isSelected
                                ? "border-purple-600 bg-purple-50 dark:bg-purple-900/20 ring-2 ring-purple-200"
                                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-purple-300"
                            }`}
                          >
                            {isSelected && (
                              <Check
                                className="absolute top-3 right-3 text-purple-600"
                                size={20}
                              />
                            )}

                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-sm">
                                {r.full_name?.charAt(0) || "R"}
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                                  {r.full_name}
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {r.email}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between">
                              <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                                <Briefcase size={14} />
                                <span>{r.workload || 0} Active Jobs</span>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  r.status === "busy"
                                    ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                                    : "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                                }`}
                              >
                                {r.status || "available"}
                              </span>
                            </div>

                            {r.specialization &&
                              r.specialization.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-1">
                                  {r.specialization.slice(0, 3).map((skill) => (
                                    <span
                                      key={skill}
                                      className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-[10px]"
                                    >
                                      {skill}
                                    </span>
                                  ))}
                                </div>
                              )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Right: SLA & Summary */}
                <div className="space-y-4">
                  {/* SLA Settings */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      SLA & Targets
                    </h3>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        1st CV Deadline (Days)
                      </label>
                      <input
                        type="number"
                        value={slaDays}
                        onChange={(e) => setSlaDays(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        min="1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Target CV Count
                      </label>
                      <input
                        type="number"
                        value={targetCVs}
                        onChange={(e) => setTargetCVs(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        min="1"
                      />
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex gap-3">
                    <AlertCircle className="text-blue-500 shrink-0" size={20} />
                    <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                      Assigning multiple recruiters activates{" "}
                      <b>competitive sourcing mode</b>. First to submit quality
                      profiles wins the slot.
                    </p>
                  </div>

                  {/* Selected Summary */}
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
                    <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                      Selected ({selectedRecruiters.length})
                    </h3>
                    <ul className="space-y-2 max-h-40 overflow-y-auto">
                      {availableRecruiters
                        .filter((r) => selectedRecruiters.includes(r.id))
                        .map((r) => (
                          <li
                            key={r.id}
                            className="flex justify-between items-center text-sm"
                          >
                            <span className="text-gray-700 dark:text-gray-300">
                              {r.full_name}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRecruiterSelection(r.id);
                              }}
                              className="text-red-500 hover:text-red-700 text-xs"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      {selectedRecruiters.length === 0 && (
                        <li className="text-sm text-gray-400 italic">
                          No recruiters selected
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-5 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignRecruiters}
                disabled={assigning || selectedRecruiters.length === 0}
                className={`px-6 py-2.5 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                  assigning || selectedRecruiters.length === 0
                    ? "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                    : "bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-200 dark:shadow-purple-900/30"
                }`}
              >
                {assigning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4" />
                    Assign {selectedRecruiters.length} Recruiter
                    {selectedRecruiters.length !== 1 ? "s" : ""}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

