const DEFAULT_SEMANTIC_FILTERS = {
  query: "",
  experience: { min: "", max: "", type: "total" },
  location: { current: "", preferred: "", remote: false },
  salary: { min: "", max: "", currency: "INR", type: "expected" },
  keywords: [],
  companies: [],
  designations: [],
  education: { degrees: [], institutions: [], majors: [], topTier: false },
  certifications: [],
  activeCertsOnly: false,
};

const KNOWN_SKILLS = [
  "react",
  "reactjs",
  "redux",
  "javascript",
  "typescript",
  "node.js",
  "nodejs",
  "express",
  "python",
  "java",
  "spring boot",
  "django",
  "flask",
  "fastapi",
  "sql",
  "postgresql",
  "mysql",
  "mongodb",
  "redis",
  "aws",
  "azure",
  "gcp",
  "docker",
  "kubernetes",
  "html",
  "css",
  "tailwind",
  "rest",
  "graphql",
  "microservices",
  "machine learning",
  "nlp",
];

const KNOWN_CERTIFICATIONS = [
  "aws certified",
  "aws certified solutions architect",
  "pmp",
  "scrum master",
  "azure certified",
  "google cloud certified",
];

const KNOWN_DEGREES = [
  "bachelor",
  "bachelors",
  "b.tech",
  "be",
  "master",
  "masters",
  "m.tech",
  "mba",
  "bca",
  "mca",
];

const KNOWN_MAJORS = [
  "computer science",
  "information technology",
  "software engineering",
  "electronics",
  "electrical",
  "data science",
];

const LOCATION_HINTS = [
  "bangalore",
  "bengaluru",
  "hyderabad",
  "chennai",
  "pune",
  "mumbai",
  "delhi",
  "noida",
  "gurgaon",
  "kolkata",
  "ahmedabad",
];

const FRONTEND_GENERIC_SKILLS = new Set([
  "html",
  "css",
  "tailwind",
  "javascript",
]);

const MUST_HAVE_HINTS = ["must", "required", "mandatory", "essential"];
const NICE_TO_HAVE_HINTS = ["preferred", "nice to have", "plus", "good to have"];
const REMOTE_HINTS = ["remote", "work from home", "wfh", "hybrid"];

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(/,|;|\n/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const toSkillArray = (skills) =>
  toArray(skills)
    .map((item) => {
      if (typeof item === "string") return item;
      return item?.name || item?.title || item?.label || item?.skill || "";
    })
    .map((item) => item.trim())
    .filter(Boolean);

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const capitalizeWords = (value) =>
  String(value || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const containsAny = (value, candidates) => {
  const text = normalize(value);
  return candidates.some((candidate) => text.includes(normalize(candidate)));
};

const findAllMatches = (text, phraseList) => {
  const normalized = normalize(text);
  return phraseList.filter((phrase) => {
    const escaped = normalize(phrase).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(normalized);
  });
};

const splitSentences = (text) =>
  String(text || "")
    .split(/[\n.!?]+/)
    .map((line) => line.trim())
    .filter(Boolean);

const normalizeSkillName = (skill) => {
  const cleaned = normalize(skill);
  if (cleaned === "reactjs") return "react";
  if (cleaned === "nodejs") return "node.js";
  return cleaned;
};

const extractExperience = (text) => {
  const normalized = normalize(text);
  let min = null;
  let max = null;

  const ranged = normalized.match(/(\d{1,2})\s*(?:-|to)\s*(\d{1,2})\s*(?:\+)?\s*(?:years|year|yrs|yr)/i);
  if (ranged) {
    min = Number(ranged[1]);
    max = Number(ranged[2]);
  }

  if (min === null) {
    const plus = normalized.match(/(\d{1,2})\s*\+\s*(?:years|year|yrs|yr)/i);
    if (plus) {
      min = Number(plus[1]);
      max = "";
    }
  }

  if (min === null) {
    const minimum = normalized.match(/(?:minimum|min)\s*(\d{1,2})\s*(?:\+)?\s*(?:years|year|yrs|yr)/i);
    if (minimum) {
      min = Number(minimum[1]);
      max = "";
    }
  }

  return {
    min_years: min === null ? "" : min,
    max_years: max === null ? "" : max,
    type: normalized.includes("relevant experience") ? "relevant" : "total",
  };
};

const extractLocation = (job, text) => {
  const normalizedText = normalize(text);
  const locationFromJob = String(job?.location || "").trim();
  const matchedCities = findAllMatches(normalizedText, LOCATION_HINTS)
    .map((city) => (city === "bengaluru" ? "bangalore" : city))
    .map(capitalizeWords);

  const primary = locationFromJob || matchedCities[0] || "";
  const alternatives = matchedCities.filter(
    (city) => normalize(city) !== normalize(primary),
  );

  return {
    primary,
    alternatives,
    remote_allowed: containsAny(normalizedText, REMOTE_HINTS),
  };
};

const extractEducation = (text) => {
  const normalizedText = normalize(text);
  const degrees = findAllMatches(normalizedText, KNOWN_DEGREES).map(capitalizeWords);
  const majors = findAllMatches(normalizedText, KNOWN_MAJORS).map(capitalizeWords);
  return {
    degrees,
    majors,
    institutions: [],
    tier: "any",
    required: containsAny(normalizedText, MUST_HAVE_HINTS),
  };
};

const extractCertifications = (text) =>
  findAllMatches(text, KNOWN_CERTIFICATIONS).map((name) => ({
    name: capitalizeWords(name),
    required: false,
  }));

const extractDesignations = (job, text) => {
  const keywords = [];
  const pushRole = (role) => {
    const trimmed = String(role || "").trim();
    if (!trimmed) return;
    if (keywords.some((item) => normalize(item) === normalize(trimmed))) return;
    keywords.push(trimmed);
  };

  pushRole(job?.title);
  const rolePattern =
    /\b(?:senior|sr|lead|principal|staff|junior|jr)?\s*(?:software engineer|engineer|developer|architect|analyst|consultant|manager)\b/gi;
  const matches = String(text || "").match(rolePattern) || [];
  matches.forEach((value) => pushRole(capitalizeWords(value)));
  return keywords;
};

const isFrontendRole = (job = {}, text = "") => {
  const normalized = normalize([job?.title, text].filter(Boolean).join(" "));
  return (
    normalized.includes("frontend") ||
    normalized.includes("front end") ||
    normalized.includes("web") ||
    normalized.includes("ui") ||
    normalized.includes("react") ||
    normalized.includes("angular") ||
    normalized.includes("vue")
  );
};

const classifySkillBySentence = (skill, sentences, source = "text") => {
  if (source === "job_skills") return "must_have";
  const needle = normalize(skill);
  for (const sentence of sentences) {
    const normalizedSentence = normalize(sentence);
    if (!normalizedSentence.includes(needle)) continue;
    if (containsAny(normalizedSentence, MUST_HAVE_HINTS)) return "must_have";
    if (containsAny(normalizedSentence, NICE_TO_HAVE_HINTS)) return "nice_to_have";
  }
  return "nice_to_have";
};

const extractSkills = (job, text) => {
  const sentences = splitSentences(text);
  const found = new Map();
  const frontendRole = isFrontendRole(job, text);

  toSkillArray(job?.skills).forEach((skill) => {
    const name = normalizeSkillName(skill);
    if (!name) return;
    found.set(name, { source: "job_skills" });
  });

  findAllMatches(text, KNOWN_SKILLS).forEach((skill) => {
    const name = normalizeSkillName(skill);
    if (!name) return;
    if (!frontendRole && FRONTEND_GENERIC_SKILLS.has(name)) return;
    if (!found.has(name)) found.set(name, { source: "text" });
  });

  const must_have = [];
  const nice_to_have = [];
  found.forEach((meta, rawName) => {
    const role = classifySkillBySentence(rawName, sentences, meta.source);
    const payload = {
      name: capitalizeWords(rawName),
      variations: [capitalizeWords(rawName)],
      weight: role === "must_have" ? 1.0 : 0.5,
      category: "General",
    };
    if (role === "must_have") {
      must_have.push(payload);
    } else {
      nice_to_have.push(payload);
    }
  });

  return { must_have, nice_to_have };
};

const buildQuery = (job, analysis) => {
  const title = String(job?.title || "").trim();
  if (title) return title;
  const mustSkills = (analysis?.skills?.must_have || [])
    .map((skill) => skill.name)
    .slice(0, 3);
  return mustSkills.join(" ").trim();
};

const scoreConfidence = (analysis) => {
  let signals = 0;
  if ((analysis.skills.must_have || []).length > 0) signals += 1;
  if (analysis.experience.min_years !== "" || analysis.experience.max_years !== "") signals += 1;
  if (analysis.location.primary) signals += 1;
  if ((analysis.education.degrees || []).length > 0) signals += 1;
  if ((analysis.certifications || []).length > 0) signals += 1;
  if ((analysis.designation.keywords || []).length > 0) signals += 1;
  const raw = 0.35 + (signals / 6) * 0.6;
  return Math.max(0.35, Math.min(0.95, Number(raw.toFixed(2))));
};

export const createDefaultSemanticFilters = () => deepClone(DEFAULT_SEMANTIC_FILTERS);

export const analyzeJobForSmartSearch = (job = {}) => {
  const jdText = [job?.description, job?.jd_text].filter(Boolean).join("\n");
  const fullText = [job?.title, jdText].filter(Boolean).join("\n");

  const analysis = {
    skills: extractSkills(job, fullText),
    experience: extractExperience(fullText),
    location: extractLocation(job, fullText),
    education: extractEducation(fullText),
    certifications: extractCertifications(fullText),
    designation: {
      keywords: extractDesignations(job, fullText),
    },
  };
  analysis.confidence_score = scoreConfidence(analysis);

  const filters = buildSmartSearchFiltersFromAnalysis(analysis, {
    query: "",
    keywords: [],
  });
  const query = buildQuery(job, analysis) || filters.query;
  const keywords = filters.keywords;

  return { analysis, query, keywords, filters };
};

export const buildSmartSearchFiltersFromAnalysis = (analysis = {}, base = {}) => {
  const next = createDefaultSemanticFilters();
  next.query = String(base.query || "").trim();
  next.keywords = Array.isArray(base.keywords) ? [...base.keywords] : [];

  const mustSkills = (analysis?.skills?.must_have || []).map((skill) => skill.name);
  const niceSkills = (analysis?.skills?.nice_to_have || []).map((skill) => skill.name);
  const mergedSkills = (mustSkills.length > 0 ? mustSkills : niceSkills)
    .map((skill) => String(skill || "").trim())
    .filter(Boolean);

  if (next.keywords.length === 0 && mergedSkills.length) {
    next.keywords = mergedSkills.slice(0, 5);
  }

  if (!next.query) {
    const designations = (analysis?.designation?.keywords || []).slice(0, 2);
    const loc = analysis?.location?.primary || "";
    next.query = [...designations, ...next.keywords.slice(0, 4), loc]
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  const minYears = analysis?.experience?.min_years;
  const maxYears = analysis?.experience?.max_years;
  next.experience.min = minYears === "" || minYears === undefined ? "" : String(minYears);
  next.experience.max = maxYears === "" || maxYears === undefined ? "" : String(maxYears);
  next.experience.type = analysis?.experience?.type === "relevant" ? "relevant" : "total";

  next.location.current = analysis?.location?.primary || "";
  next.location.preferred = (analysis?.location?.alternatives || [])[0] || "";
  next.location.remote = Boolean(analysis?.location?.remote_allowed);

  next.designations = (analysis?.designation?.keywords || [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  next.education.degrees = (analysis?.education?.degrees || [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  next.education.majors = (analysis?.education?.majors || [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  next.education.institutions = (analysis?.education?.institutions || [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  next.education.topTier = Boolean(analysis?.education?.top_tier || false);

  next.certifications = (analysis?.certifications || [])
    .map((item) => (typeof item === "string" ? item : item?.name || ""))
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  return next;
};

const toUrlSafeBase64 = (raw) =>
  raw.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const fromUrlSafeBase64 = (raw) => {
  const restored = String(raw || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = restored.length % 4;
  if (pad === 0) return restored;
  return restored + "=".repeat(4 - pad);
};

export const encodeSmartSearchAnalysis = (analysis) => {
  try {
    const json = JSON.stringify(analysis || {});
    const encoded = new TextEncoder().encode(json);
    let binary = "";
    encoded.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return toUrlSafeBase64(window.btoa(binary));
  } catch (error) {
    return "";
  }
};

export const decodeSmartSearchAnalysis = (encoded) => {
  try {
    if (!encoded) return null;
    const base64 = fromUrlSafeBase64(encoded);
    const binary = window.atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  } catch (error) {
    return null;
  }
};

export const summarizeSmartAnalysis = (analysis) => {
  if (!analysis) return "";
  const skills = (analysis?.skills?.must_have || [])
    .map((item) => item.name)
    .slice(0, 4);
  const minYears = analysis?.experience?.min_years;
  const maxYears = analysis?.experience?.max_years;
  const location = analysis?.location?.primary || "";
  const parts = [];
  if (skills.length) parts.push(`Skills: ${skills.join(", ")}`);
  if (minYears !== "" || maxYears !== "") {
    const exp =
      minYears !== "" && maxYears !== ""
        ? `${minYears}-${maxYears} yrs`
        : `${minYears || maxYears}+ yrs`;
    parts.push(`Experience: ${exp}`);
  }
  if (location) parts.push(`Location: ${location}`);
  return parts.join(" | ");
};
