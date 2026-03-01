const hasValue = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
};

const resolveApiAssetBaseUrl = () => {
  const fallback =
    typeof window !== "undefined"
      ? `http://${window.location.hostname || "localhost"}:8000`
      : "http://localhost:8000";

  const configured = import.meta.env?.VITE_API_BASE_URL || fallback;
  try {
    return String(configured).replace(/\/+$/, "");
  } catch {
    return String(configured || fallback).replace(/\/+$/, "");
  }
};

export const toApiAssetUrl = (value) => {
  if (!hasValue(value)) return null;

  const raw = String(value).trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("blob:") || raw.startsWith("data:")) {
    return raw;
  }

  const normalized = raw.replace(/\\/g, "/");
  const lowered = normalized.toLowerCase();

  let path = normalized;
  const uploadsWithSlash = lowered.indexOf("/uploads/");
  const uploadsWithoutSlash = lowered.indexOf("uploads/");

  if (uploadsWithSlash >= 0) {
    path = normalized.slice(uploadsWithSlash);
  } else if (uploadsWithoutSlash >= 0) {
    path = `/${normalized.slice(uploadsWithoutSlash)}`;
  } else if (!normalized.startsWith("/")) {
    path = `/${normalized}`;
  }

  return `${resolveApiAssetBaseUrl()}${path}`;
};

const valueOr = (...values) => {
  for (const value of values) {
    if (hasValue(value)) return value;
  }
  return null;
};

const ROLE_KEYWORDS = new Set([
  "engineer",
  "developer",
  "manager",
  "analyst",
  "consultant",
  "architect",
  "lead",
  "specialist",
  "executive",
  "officer",
  "intern",
  "designer",
  "administrator",
  "devops",
  "qa",
  "tester",
  "associate",
  "director",
  "head",
  "coordinator",
  "principal",
  "staff",
  "recruiter",
  "account",
  "am",
  "hr",
  "sap",
  "abap",
]);

const ROLE_NOISE_WORDS = new Set([
  "worked",
  "working",
  "experience",
  "knowledge",
  "responsible",
  "responsibilities",
  "project",
  "projects",
  "ticket",
  "tickets",
  "clarification",
  "issues",
  "resolution",
  "candidate",
  "college",
  "university",
  "payroll",
  "involved",
  "support",
]);

const NAME_NOISE_WORDS = new Set([
  "strong",
  "knowledge",
  "tickets",
  "issues",
  "clarification",
  "resolution",
  "experience",
  "resume",
  "profile",
  "summary",
  "objective",
  "skills",
  "education",
  "work",
  "project",
  "projects",
  "candidate",
]);

const LOCATION_HINT_WORDS = new Set([
  "india",
  "karnataka",
  "mysore",
  "bengaluru",
  "bangalore",
  "mumbai",
  "delhi",
  "hyderabad",
  "chennai",
  "pune",
  "noida",
  "gurgaon",
  "remote",
  "onsite",
  "hybrid",
  "city",
  "state",
]);

const LOCATION_NOISE_WORDS = new Set([
  "worked",
  "working",
  "experience",
  "knowledge",
  "responsible",
  "responsibilities",
  "project",
  "projects",
  "ticket",
  "tickets",
  "clarification",
  "issues",
  "resolution",
  "candidate",
  "college",
  "university",
  "payroll",
  "involved",
  "support",
]);

const SKILL_REJECT_WORDS = new Set([
  "and",
  "or",
  "the",
  "of",
  "in",
  "for",
  "to",
  "at",
  "by",
  "with",
  "on",
  "from",
  "as",
  "other",
  "identifying",
  "travel",
  "ensure",
  "public",
  "involvement",
  "involved",
  "team",
  "enhancements",
  "correction",
  "personal",
  "good",
  "defined",
  "executed",
  "changes",
  "responsible",
  "productivity",
  "user",
  "upgrade",
  "smart",
  "preparing",
  "post",
  "functional",
  "prepared",
  "organizational",
  "implementation",
  "knowledge",
  "groups",
  "role",
  "actively",
  "go",
  "suggestion",
  "positive",
  "provide",
  "escalating",
  "handle",
  "requirement",
  "standards",
  "handling",
  "preparation",
  "screen",
  "end",
  "medical",
  "configuring",
  "assist",
  "info",
  "providing",
  "testing",
  "coordinating",
  "working",
  "client",
  "supporting",
  "problem",
  "cross",
  "having",
  "define",
  "lead",
  "managing",
  "worked",
  "writing",
  "area",
  "day",
  "unit",
  "modules",
  "applications",
  "module",
  "project",
  "projects",
  "resume",
  "candidate",
  "profile",
  "summary",
  "technical",
  "experience",
  "professional",
  "clarification",
  "issues",
  "ticket",
  "tickets",
  "support",
  "location",
  "region",
  "country",
  "south",
  "north",
  "east",
  "west",
]);

const SKILL_MONTH_WORDS = new Set([
  "jan",
  "january",
  "feb",
  "february",
  "mar",
  "march",
  "apr",
  "april",
  "may",
  "jun",
  "june",
  "jul",
  "july",
  "aug",
  "august",
  "sep",
  "sept",
  "september",
  "oct",
  "october",
  "nov",
  "november",
  "dec",
  "december",
  "q1",
  "q2",
  "q3",
  "q4",
]);

const SKILL_CANONICAL_MAP = {
  successfactors: "SAP SuccessFactors",
  "success factors": "SAP SuccessFactors",
  fiori: "SAP Fiori",
  fieldglass: "FieldGlass",
  "field glass": "FieldGlass",
  onb: "SAP ONB",
  cats: "SAP CATS",
  ess: "SAP ESS/MSS",
  mss: "SAP ESS/MSS",
  "ess/mss": "SAP ESS/MSS",
  rmk: "SAP RMK",
  fico: "SAP FICO",
  payroll: "Payroll Processing",
  attendance: "Attendance Management",
  compensation: "Compensation & Benefits",
  workflow: "Workflow Management",
  abap: "ABAP",
};

const normalizeSkillKey = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\w#+/.\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isLikelyValidSkillName = (value) => {
  const raw = String(value || "").trim();
  if (!raw || raw.length < 2 || raw.length > 70) return false;
  if (raw.includes("@") || /https?:\/\//i.test(raw)) return false;

  const words = raw
    .toLowerCase()
    .split(/[\s/,&-]+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (!words.length || words.length > 6) return false;
  if (words.some((word) => /^(19|20)\d{2}$/.test(word))) return false;
  if (words.some((word) => /^\d+$/.test(word))) return false;
  if (words.some((word) => SKILL_MONTH_WORDS.has(word))) return false;
  if (words.every((word) => SKILL_REJECT_WORDS.has(word))) return false;
  if (words.length === 1 && SKILL_REJECT_WORDS.has(words[0])) return false;
  return true;
};

const canonicalizeSkillName = (value) => {
  const raw = String(value || "").trim();
  if (!isLikelyValidSkillName(raw)) return null;
  const normalized = normalizeSkillKey(raw);
  return SKILL_CANONICAL_MAP[normalized] || raw;
};

const normalizeComparableText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

const tokenizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .split(/[\s,;/\\|-]+/)
    .map((token) => token.trim())
    .filter(Boolean);

const isLikelyPersonName = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (raw.length < 2 || raw.length > 60) return false;
  if (raw.includes("/") || raw.includes(":")) return false;
  if (/\d/.test(raw)) return false;

  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return false;
  const lowerWords = words.map((word) => word.toLowerCase());
  if (lowerWords.some((word) => NAME_NOISE_WORDS.has(word))) return false;
  if (lowerWords.some((word) => ROLE_KEYWORDS.has(word))) return false;

  return words.every((word) => /^[A-Za-z.'-]+$/.test(word));
};

const isLikelyLocationText = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (raw.length > 60) return false;
  if (raw.includes("@")) return false;
  const tokens = tokenizeText(raw);
  if (tokens.length === 0) return false;
  if (tokens.length > 6) return false;
  if (tokens.some((token) => LOCATION_NOISE_WORDS.has(token))) return false;

  const hasRoleToken = tokens.some((token) => ROLE_KEYWORDS.has(token));
  const hasLocationToken = tokens.some((token) => LOCATION_HINT_WORDS.has(token));

  if (hasLocationToken && !hasRoleToken) return true;
  if (raw.includes(",") && !hasRoleToken && tokens.length <= 4) return true;
  if (!hasRoleToken && tokens.length <= 3 && !/\d/.test(raw)) return true;
  return false;
};

const isLikelyInvalidRoleText = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return true;
  if (raw.length < 2 || raw.length > 120) return true;
  if (raw.includes("@")) return true;
  if (/[.!?]/.test(raw) && raw.split(/\s+/).length > 4) return true;
  if (/\b(19|20)\d{2}\b/.test(raw)) return true;

  const tokens = tokenizeText(raw);
  if (tokens.length === 0 || tokens.length > 8) return true;
  if (tokens.some((token) => ROLE_NOISE_WORDS.has(token))) return true;

  const hasRoleToken = tokens.some((token) => ROLE_KEYWORDS.has(token));
  return !hasRoleToken;
};

const cleanLocationText = (value) => {
  if (!hasValue(value)) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return null;
  return isLikelyLocationText(text) ? text : null;
};

const pickCleanLocation = (values = []) => {
  for (const value of values) {
    const cleaned = cleanLocationText(value);
    if (cleaned) return cleaned;
  }
  return null;
};

const pickCleanDesignation = (values = [], locationCandidates = []) => {
  const normalizedLocations = new Set(
    locationCandidates
      .map((item) => normalizeComparableText(item))
      .filter(Boolean),
  );

  for (const value of values) {
    if (!hasValue(value)) continue;
    const text = String(value).trim();
    if (!text) continue;

    const normalized = normalizeComparableText(text);
    if (!normalized) continue;
    if (normalizedLocations.has(normalized)) continue;
    if (isLikelyLocationText(text)) continue;
    if (isLikelyInvalidRoleText(text)) continue;
    return text;
  }
  return null;
};

const deriveNameFromEmail = (email) => {
  const text = String(email || "").trim();
  if (!text || !text.includes("@")) return null;
  const local = text.split("@")[0] || "";
  const cleaned = local
    .replace(/\d+/g, " ")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;

  const candidate = cleaned
    .split(" ")
    .filter(Boolean)
    .slice(0, 4)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
  return isLikelyPersonName(candidate) ? candidate : null;
};

const extractParsedCandidateData = (candidate) => {
  if (!candidate || typeof candidate !== "object") return {};

  const parsedResume = valueOr(candidate.parsed_resume, candidate.parsedResume);
  const parsedResumeData =
    parsedResume && typeof parsedResume === "object"
      ? valueOr(
          parsedResume.data,
          parsedResume.parsed_data,
          parsedResume.parsedData,
          parsedResume,
        )
      : null;

  const parsedDataJson = valueOr(
    candidate.parsed_json,
    candidate.parsedJson,
    candidate.parsed_data_json,
    candidate.parsedDataJson,
  );

  const parsed = valueOr(parsedDataJson, parsedResumeData, {});
  if (!parsed || typeof parsed !== "object") return {};

  // Canonical parser schema support -> flatten for existing UI selectors.
  if (parsed.personal || parsed.professional || parsed.skills || parsed.experience) {
    const personal = parsed.personal || {};
    const professional = parsed.professional || {};
    const skillsObj = parsed.skills || {};
    const educationList = Array.isArray(parsed.education) ? parsed.education : [];
    const firstEducation = educationList[0] || {};
    const experienceList = Array.isArray(parsed.experience) ? parsed.experience : [];
    const certList = Array.isArray(parsed.certifications) ? parsed.certifications : [];

    return {
      ...parsed,
      full_name: personal.full_name || "",
      name: personal.full_name || "",
      email: personal.email || "",
      phone: personal.phone || "",
      dob: personal.dob || "",
      gender: personal.gender || "",
      city: personal.city || "",
      state: personal.state || "",
      country: personal.country || "",
      pincode: personal.pincode || "",
      current_address: personal.current_address || "",
      permanent_address: personal.permanent_address || "",
      linkedin_url: personal.linkedin || "",
      portfolio_url: personal.portfolio || "",
      current_role: professional.primary_role || professional.current_designation || "",
      current_designation: professional.current_designation || "",
      current_company: professional.current_company || "",
      notice_period_days: professional.notice_period_days,
      notice_period:
        professional.notice_period_days != null
          ? String(professional.notice_period_days)
          : "",
      current_ctc: professional.current_ctc,
      expected_ctc: professional.expected_ctc,
      preferred_location: professional.preferred_location || "",
      ready_to_relocate: professional.ready_to_relocate,
      experience_years: professional.total_experience_years,
      skills: Array.isArray(skillsObj.all) ? skillsObj.all : [],
      primary_skills: Array.isArray(skillsObj.primary) ? skillsObj.primary : [],
      secondary_skills: Array.isArray(skillsObj.secondary) ? skillsObj.secondary : [],
      certifications: certList,
      education_history: educationList,
      education: {
        degree: firstEducation.degree || "",
        institution: firstEducation.institution || "",
        cgpa: firstEducation.score || "",
      },
      work_history: experienceList.map((exp) => ({
        company: exp.company || "",
        designation: exp.designation || "",
        role: exp.designation || "",
        start_date: exp.start_date || "",
        end_date: exp.end_date || "",
        is_current: Boolean(exp.is_current),
        duration: exp.duration_text || "",
        years: exp.duration_text || "",
        project_done: exp.summary || "",
        skills_learned: Array.isArray(exp.tech_stack) ? exp.tech_stack : [],
      })),
      resume_text: parsed.raw_text || "",
      parser_version: parsed.parser_version || "",
    };
  }

  return parsed;
};

const asDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const formatDate = (value) => {
  const date = asDate(value);
  return date ? date.toLocaleDateString("en-US") : "N/A";
};

const formatFileSize = (bytes) => {
  if (!hasValue(bytes)) return "";
  const size = Number(bytes);
  if (Number.isNaN(size)) return String(bytes);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatExperience = (value) => {
  if (!hasValue(value)) return null;
  if (typeof value === "number") return `${value} yrs`;
  if (typeof value === "string" && value.match(/^\d+(\.\d+)?$/)) {
    return `${value} yrs`;
  }
  return value;
};

const formatNoticePeriod = (value) => {
  if (!hasValue(value)) return null;
  if (typeof value === "number") return value === 0 ? "Immediate" : `${value} days`;
  if (typeof value === "string" && value.match(/^\d+$/)) {
    return value === "0" ? "Immediate" : `${value} days`;
  }
  return value;
};

const formatCTC = (value, canViewSensitive) => {
  if (!hasValue(value)) return "N/A";
  if (!canViewSensitive) return "[REDACTED]";
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-IN").format(value);
  }
  return String(value);
};

const normalizeSkills = (value) => {
  if (!value) return [];

  const entries = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value
          .split(/,|;|\n/)
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

  const unique = new Map();

  entries.forEach((entry) => {
    let rawName = "";
    let level = "Intermediate";

    if (typeof entry === "string") {
      rawName = entry;
    } else if (entry && typeof entry === "object") {
      rawName = entry.name || entry.skill || entry.title || "";
      level = entry.level || entry.proficiency || "Intermediate";
    }

    const canonical = canonicalizeSkillName(rawName);
    if (!canonical) return;

    const key = normalizeSkillKey(canonical);
    if (!key || unique.has(key)) return;
    unique.set(key, { name: canonical, level });
  });

  return Array.from(unique.values());
};

const normalizeCertifications = (value) => {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((cert) => {
      if (typeof cert === "string") {
        return {
          name: cert,
          organization: "",
          expiryDate: null,
          isExpiring: false,
          credentialId: "",
          credentialUrl: "",
        };
      }
      const expiryDate = cert.expiry_date || cert.expiryDate;
      const expiry = asDate(expiryDate);
      const isExpiring = expiry
        ? expiry.getTime() - Date.now() <= 30 * 24 * 60 * 60 * 1000 &&
          expiry.getTime() > Date.now()
        : false;
      return {
        name: cert.name || cert.title || "Certification",
        organization: cert.organization || cert.issuer || "",
        expiryDate,
        isExpiring,
        credentialId: valueOr(cert.credential_id, cert.credentialId, cert.id),
        credentialUrl: valueOr(cert.credential_url, cert.credentialUrl, cert.url),
      };
    })
    .filter((cert) => cert && cert.name);
};

const normalizeProjects = (value) => {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((project) => {
      if (typeof project === "string") {
        return { name: project, shortDesc: "", stack: [] };
      }
      return {
        name: project.name || project.title || "Project",
        shortDesc: project.short_desc || project.shortDesc || project.summary || "",
        stack: project.stack || project.technologies || project.tech || [],
      };
    })
    .filter((project) => project && project.name);
};

const normalizeEducation = (candidate) => {
  if (Array.isArray(candidate.education_history) && candidate.education_history.length > 0) {
    const latest = candidate.education_history[0];
    const cgpa = valueOr(latest.cgpa, candidate.cgpa);
    const percentage = valueOr(latest.percentage, candidate.percentage);
    return {
      degree: latest.degree || latest.title || "",
      institution: latest.institution || latest.university || "",
      college: latest.college || latest.institution || latest.university || "",
      year: latest.end_year || latest.year || "",
      cgpa,
      percentage,
    };
  }
  if (Array.isArray(candidate.education) && candidate.education.length > 0) {
    const latest = candidate.education[0];
    const cgpa = valueOr(latest.cgpa, candidate.cgpa);
    const percentage = valueOr(latest.percentage, candidate.percentage);
    return {
      degree: latest.degree || latest.title || "",
      institution: latest.institution || latest.university || "",
      college: latest.college || latest.institution || latest.university || "",
      year: latest.end_year || latest.year || "",
      cgpa,
      percentage,
    };
  }
  if (candidate.education && typeof candidate.education === "object") {
    const cgpa = valueOr(candidate.education.cgpa, candidate.cgpa);
    const percentage = valueOr(candidate.education.percentage, candidate.percentage);
    return {
      degree: candidate.education.degree || candidate.education.title || "",
      institution: candidate.education.institution || candidate.education.university || "",
      college:
        candidate.education.college ||
        candidate.education.institution ||
        candidate.education.university ||
        "",
      year: candidate.education.year || candidate.education.graduation_year || "",
      cgpa,
      percentage,
    };
  }
  return {
    degree: candidate.education || candidate.highest_degree || candidate.degree || "",
    institution: candidate.institution || candidate.university || candidate.college || "",
    college: candidate.college || candidate.institution || candidate.university || "",
    year: candidate.graduation_year || candidate.year || "",
    cgpa: candidate.cgpa || "",
    percentage: candidate.percentage || "",
  };
};

export const getCandidateApiId = (candidate) =>
  valueOr(candidate?.apiId, candidate?.id, candidate?._id, candidate?.candidate_id);

export const mapCandidateToProfile = (candidate, canViewSensitive = true) => {
  if (!candidate) return null;

  const apiId = getCandidateApiId(candidate);
  const id = apiId || candidate.public_id || candidate.email || candidate.phone || "";
  const parsed = extractParsedCandidateData(candidate);
  const rawWorkHistory = valueOr(
    candidate.work_history,
    candidate.employment_history,
    candidate.experience_history,
    parsed.work_history,
    parsed.work_experience,
    parsed.experience,
    [],
  );
  const firstWorkEntry =
    Array.isArray(rawWorkHistory) && rawWorkHistory.length > 0
      ? rawWorkHistory[0] || {}
      : {};
  const locationCandidates = [
    candidate.current_location,
    candidate.currentLocation,
    candidate.location,
    candidate.city,
    candidate.current_city,
    candidate.currentCity,
    candidate.preferred_location,
    candidate.preferredLocation,
    parsed.current_location,
    parsed.currentLocation,
    parsed.location,
    parsed.city,
    parsed.current_city,
    parsed.currentCity,
    parsed.preferred_location,
    parsed.preferredLocation,
  ];

  const currentRole = pickCleanDesignation(
    [
      candidate.current_role,
      candidate.currentRole,
      candidate.current_job_title,
      candidate.currentJobTitle,
      candidate.current_designation,
      candidate.currentDesignation,
      candidate.designation,
      candidate.designation_title,
      candidate.role,
      candidate.title,
      parsed.current_role,
      parsed.currentRole,
      parsed.current_job_title,
      parsed.currentJobTitle,
      parsed.current_designation,
      parsed.currentDesignation,
      parsed.designation,
      parsed.designation_title,
      parsed.role,
      firstWorkEntry.role,
      firstWorkEntry.designation,
      firstWorkEntry.title,
    ],
    locationCandidates,
  );

  const designation = pickCleanDesignation(
    [
      candidate.current_designation,
      candidate.currentDesignation,
      candidate.current_job_title,
      candidate.currentJobTitle,
      candidate.designation,
      candidate.designation_title,
      candidate.current_role,
      candidate.currentRole,
      candidate.role,
      candidate.title,
      parsed.current_designation,
      parsed.currentDesignation,
      parsed.current_job_title,
      parsed.currentJobTitle,
      parsed.current_role,
      parsed.currentRole,
      parsed.designation,
      parsed.designation_title,
      parsed.role,
      firstWorkEntry.role,
      firstWorkEntry.designation,
      firstWorkEntry.title,
    ],
    locationCandidates,
  );

  const skills = normalizeSkills(
    valueOr(
      candidate.skills,
      parsed.skills,
      candidate.skill_set,
      candidate.top_skills,
    ),
  );
  const certifications = normalizeCertifications(
    valueOr(
      candidate.certifications,
      parsed.certifications,
      candidate.certifications_text,
      parsed.certifications_text,
    ),
  );
  const projects = normalizeProjects(valueOr(candidate.projects, parsed.projects));
  const education = normalizeEducation({
    ...parsed,
    ...candidate,
    education: valueOr(candidate.education, parsed.education),
    education_history: valueOr(candidate.education_history, parsed.education_history),
  });

  const rawMatchScore = valueOr(
    candidate.relevance_score,
    candidate.match_score,
    candidate.match_percentage,
    candidate.semantic_score,
  );
  let matchScore = Number(rawMatchScore);
  if (Number.isNaN(matchScore)) {
    matchScore = null;
  }

  const currentCtcRaw = valueOr(
    candidate.current_ctc,
    parsed.current_ctc,
    candidate.current_salary,
    candidate.currentCTC,
    candidate.currentCtc,
    candidate.currentSalary,
    candidate.current_compensation,
    candidate.currentCompensation,
    candidate.ctc,
    parsed.currentCTC,
    parsed.currentCtc,
    parsed.current_salary,
    parsed.currentSalary,
    parsed.current_compensation,
    parsed.currentCompensation,
    parsed.ctc,
    firstWorkEntry.current_ctc,
    firstWorkEntry.ctc,
    firstWorkEntry.salary,
    firstWorkEntry.compensation,
    firstWorkEntry.package,
  );
  const expectedCtcRaw = valueOr(
    candidate.expected_ctc,
    parsed.expected_ctc,
    candidate.expected_salary,
    candidate.expectedCTC,
    candidate.expectedCtc,
    candidate.expectedSalary,
    candidate.expected_compensation,
    candidate.expectedCompensation,
    candidate.salary_expectation,
    candidate.salaryExpectation,
    parsed.expectedCTC,
    parsed.expectedCtc,
    parsed.expected_salary,
    parsed.expectedSalary,
    parsed.expected_compensation,
    parsed.expectedCompensation,
    parsed.salary_expectation,
    parsed.salaryExpectation,
    firstWorkEntry.expected_ctc,
    firstWorkEntry.expectedCtc,
  );
  const noticePeriodRaw = valueOr(
    candidate.notice_period,
    candidate.notice_period_days,
    parsed.notice_period,
    parsed.notice_period_days,
    candidate.noticePeriod,
    candidate.noticePeriodDays,
  );

  const resumeSize = valueOr(candidate.resume_size, candidate.resumeSize);
  const resumeUpdatedAt = valueOr(
    candidate.resume_updated_at,
    candidate.resumeUpdatedAt,
    candidate.updated_at,
    candidate.updatedAt,
  );

  const resumeMetaParts = [];
  if (hasValue(resumeSize)) resumeMetaParts.push(formatFileSize(resumeSize));
  if (hasValue(resumeUpdatedAt)) resumeMetaParts.push(`Updated ${formatDate(resumeUpdatedAt)}`);

  const resolvedLocation = pickCleanLocation([
    candidate.current_location,
    candidate.location,
    candidate.city,
    parsed.current_location,
    parsed.location,
    parsed.city,
  ]);
  const resolvedCity = pickCleanLocation([
    candidate.city,
    candidate.current_city,
    candidate.current_location,
    parsed.city,
    parsed.current_location,
    parsed.location,
  ]);
  const resolvedPreferredLocation = pickCleanLocation([
    candidate.preferred_location,
    candidate.preferredLocation,
    parsed.preferred_location,
    parsed.preferredLocation,
  ]);

  const fallbackEmail = valueOr(candidate.email, parsed.email);
  const resolvedName = valueOr(
    [
      candidate.full_name,
      candidate.name,
      candidate.fullName,
      parsed.full_name,
      parsed.name,
      parsed.fullName,
    ].find((candidateName) => isLikelyPersonName(candidateName)),
    deriveNameFromEmail(fallbackEmail),
    "Unnamed Candidate",
  );

  return {
    id,
    apiId,
    name: resolvedName,
    gender: valueOr(candidate.gender, parsed.gender),
    dateOfBirth: valueOr(
      candidate.date_of_birth,
      candidate.dob,
      candidate.dateOfBirth,
      parsed.date_of_birth,
      parsed.dob,
      parsed.dateOfBirth,
    ),
    nationality: valueOr(candidate.nationality, parsed.nationality),
    isVerified: Boolean(
      valueOr(candidate.is_verified, candidate.verified, candidate.profile_verified),
    ),
    phone: valueOr(
      candidate.phone,
      candidate.mobile,
      candidate.phone_number,
      parsed.phone,
      parsed.mobile,
    ),
    mobileNumber: valueOr(
      candidate.mobile,
      candidate.phone,
      candidate.phone_number,
      parsed.phone,
      parsed.mobile,
    ),
    email: valueOr(candidate.email, parsed.email),
    location: resolvedLocation,
    city: resolvedCity || resolvedLocation,
    pincode: valueOr(candidate.pincode, candidate.pin_code, candidate.zipcode, parsed.pincode),
    currentAddress: valueOr(
      candidate.current_address,
      candidate.currentAddress,
      candidate.address,
      parsed.current_address,
      parsed.currentAddress,
    ),
    permanentAddress: valueOr(
      candidate.permanent_address,
      candidate.permanentAddress,
      parsed.permanent_address,
      parsed.permanentAddress,
    ),
    preferredLocation: resolvedPreferredLocation,
    languagesKnown: valueOr(
      candidate.languages_known,
      candidate.languagesKnown,
      candidate.languages,
      parsed.languages,
      parsed.languages_known,
    ),
    photoUrl: toApiAssetUrl(
      valueOr(
        candidate.photo_url,
        candidate.avatar_url,
        candidate.profile_picture,
        candidate.photo,
        parsed.photo_url,
        parsed.photo,
      ),
    ),
    resumeUrl: toApiAssetUrl(
      valueOr(candidate.resume_url, candidate.resumeUrl, parsed.resume_url, parsed.resumeUrl),
    ),
    resumeMeta: resumeMetaParts.join(" | ") || "Resume meta not available",
    currentRole,
    designation,
    currentCompany: valueOr(
      candidate.current_employer,
      candidate.current_company,
      parsed.current_company,
      parsed.current_employer,
    ),
    totalExperience: formatExperience(
      valueOr(
        candidate.total_experience,
        candidate.experience_years,
        candidate.experience,
        parsed.total_experience,
        parsed.experience_years,
      ),
    ),
    employmentStatus: valueOr(candidate.employment_status, candidate.employmentStatus),
    professionalHeadline: valueOr(
      candidate.professional_headline,
      candidate.headline,
      candidate.profile_headline,
    ),
    preferredWorkMode: valueOr(
      candidate.preferred_work_mode,
      candidate.preferredWorkMode,
      candidate.work_mode,
      candidate.workMode,
    ),
    willingToRelocate: valueOr(
      candidate.willing_to_relocate,
      candidate.ready_to_relocate,
      candidate.willingToRelocate,
      candidate.readyToRelocate,
      candidate.ready_for_relocation,
      candidate.readyForRelocation,
      candidate.open_to_relocate,
      candidate.openToRelocate,
      parsed.willing_to_relocate,
      parsed.ready_to_relocate,
      parsed.willingToRelocate,
      parsed.readyToRelocate,
      parsed.ready_for_relocation,
      parsed.readyForRelocation,
      parsed.open_to_relocate,
      parsed.openToRelocate,
    ),
    readyToRelocate: valueOr(
      candidate.ready_to_relocate,
      candidate.willing_to_relocate,
      candidate.readyToRelocate,
      candidate.willingToRelocate,
      candidate.ready_for_relocation,
      candidate.readyForRelocation,
      candidate.open_to_relocate,
      candidate.openToRelocate,
      parsed.ready_to_relocate,
      parsed.willing_to_relocate,
      parsed.readyToRelocate,
      parsed.willingToRelocate,
      parsed.ready_for_relocation,
      parsed.readyForRelocation,
      parsed.open_to_relocate,
      parsed.openToRelocate,
    ),
    travelAvailability: valueOr(
      candidate.travel_availability,
      candidate.travelAvailability,
    ),
    salaryNegotiable: valueOr(
      candidate.salary_negotiable,
      candidate.salaryNegotiable,
    ),
    careerSummary: valueOr(
      candidate.career_summary,
      candidate.summary,
      candidate.professional_summary,
      candidate.professionalSummary,
      parsed.professional_summary,
      parsed.professionalSummary,
      parsed.summary,
    ),
    availabilityStatus: valueOr(
      candidate.availability_status,
      candidate.availabilityStatus,
    ),
    availableFrom: valueOr(candidate.available_from, candidate.availableFrom),
    requiresSponsorship: valueOr(
      candidate.requires_sponsorship,
      candidate.requiresSponsorship,
    ),
    noticePeriod: formatNoticePeriod(noticePeriodRaw),
    currentCtcDisplay: formatCTC(currentCtcRaw, canViewSensitive),
    expectedCtcDisplay: formatCTC(expectedCtcRaw, canViewSensitive),
    skills,
    certifications,
    education,
    workHistory: rawWorkHistory,
    educationHistory: valueOr(
      candidate.education_history,
      candidate.education_details,
      parsed.education_history,
      parsed.education_list,
      parsed.education,
      [],
    ),
    projects,
    workAuthorization: valueOr(candidate.work_authorization, candidate.visa_status, candidate.citizenship),
    social: {
      linkedin: valueOr(
        candidate.linkedin_url,
        candidate.linkedin,
        parsed.linkedin_url,
        parsed.linkedin,
      ),
      github: valueOr(candidate.github_url, candidate.github, parsed.github_url, parsed.github),
      portfolio: valueOr(
        candidate.portfolio_url,
        candidate.portfolio,
        parsed.portfolio_url,
        parsed.portfolio,
      ),
    },
    jobTitle: valueOr(
      candidate.job_title,
      candidate.applied_role,
      candidate.applied_for,
      candidate.appliedJob,
      candidate.job?.title,
      parsed.applied_for,
      parsed.applied_role,
    ),
    accountManager: {
      id: valueOr(
        candidate.account_manager_id,
        candidate.account_manager?.id,
        candidate.account_manager?.am_id,
      ),
      name: valueOr(
        candidate.account_manager_name,
        candidate.account_manager?.name,
        candidate.account_manager?.am_name,
      ),
      email: valueOr(
        candidate.account_manager_email,
        candidate.account_manager?.email,
        candidate.account_manager?.am_email,
      ),
    },
    status: valueOr(candidate.status, candidate.application_status, "new"),
    appliedDate: formatDate(valueOr(candidate.applied_date, candidate.appliedAt, candidate.created_at)),
    updatedAt: formatDate(valueOr(candidate.updated_at, candidate.updatedAt)),
    matchScore,
    keyAchievement: valueOr(candidate.key_achievement, candidate.highlight),
    relevantYears: valueOr(candidate.relevant_experience_years, candidate.relevant_years),
  };
};
