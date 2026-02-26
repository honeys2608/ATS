import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, FileSearch, FileText, FileUp, Sparkles } from "lucide-react";
import api from "../../api/axios";
import {
  normalizeText,
  validateDescription,
  validateFeatureName,
} from "../../utils/recruiterValidations";
import "./CandidateProfile.css";

const STEPS = [
  "Notice Period",
  "Personal Information",
  "Professional Information",
  "Education Details",
  "Skills",
  "Certifications",
  "Experience",
];

const INITIAL_FORM = {
  name: "",
  noticePeriod: "",
  gender: "",
  dateOfBirth: "",
  phone: "",
  email: "",
  currentAddress: "",
  permanentAddress: "",
  city: "",
  pincode: "",
  readyToRelocate: false,
  preferredLocation: "",
  designation: "",
  currentCtc: "",
  expectedCtc: "",
  highestDegree: "",
  collegeName: "",
  cgpaPercentage: "",
  skills: "",
  certificationName: "",
  certificationCredentialId: "",
  certificationCredentialLink: "",
  experienceCompany: "",
  experienceRole: "",
  experienceProject: "",
  experienceSkillsLearnt: "",
  experienceYears: "",
  experienceCtc: "",
  additionalEducations: [],
  additionalCertifications: [],
  additionalExperiences: [],
};

const EMPTY_EDUCATION = {
  highestDegree: "",
  collegeName: "",
  cgpaPercentage: "",
};

const EMPTY_CERTIFICATION = {
  certificationName: "",
  certificationCredentialId: "",
  certificationCredentialLink: "",
};

const EMPTY_EXPERIENCE = {
  experienceCompany: "",
  experienceRole: "",
  experienceProject: "",
  experienceSkillsLearnt: "",
  experienceYears: "",
  experienceCtc: "",
};

const REQUIRED = new Set([
  "name",
  "email",
  "phone",
  "designation",
  "skills",
  "experienceYears",
]);

const MIN_CROP_SIZE = 80;
const OUTPUT_CROP_SIZE = 300;
const MAX_RESUME_SIZE = 5 * 1024 * 1024;
const RESUME_ALLOWED_EXTENSIONS = new Set([".pdf", ".doc", ".docx"]);
const RESUME_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const getDisplayedImageBounds = (img) => {
  const elementWidth = img?.clientWidth || 0;
  const elementHeight = img?.clientHeight || 0;
  const naturalWidth = img?.naturalWidth || 0;
  const naturalHeight = img?.naturalHeight || 0;

  if (!elementWidth || !elementHeight || !naturalWidth || !naturalHeight) {
    return {
      x: 0,
      y: 0,
      width: elementWidth,
      height: elementHeight,
    };
  }

  const imageRatio = naturalWidth / naturalHeight;
  const elementRatio = elementWidth / elementHeight;

  if (imageRatio > elementRatio) {
    const renderedHeight = elementWidth / imageRatio;
    return {
      x: 0,
      y: (elementHeight - renderedHeight) / 2,
      width: elementWidth,
      height: renderedHeight,
    };
  }

  const renderedWidth = elementHeight * imageRatio;
  return {
    x: (elementWidth - renderedWidth) / 2,
    y: 0,
    width: renderedWidth,
    height: elementHeight,
  };
};

const clampCropRectToBounds = (rect, bounds) => {
  const maxSize = Math.max(Math.min(bounds.width, bounds.height), 1);
  const minSize = Math.min(MIN_CROP_SIZE, maxSize);
  const size = Math.min(Math.max(rect.size, minSize), maxSize);

  const minX = bounds.x;
  const minY = bounds.y;
  const maxX = Math.max(bounds.x + bounds.width - size, minX);
  const maxY = Math.max(bounds.y + bounds.height - size, minY);

  return {
    size,
    x: Math.min(Math.max(rect.x, minX), maxX),
    y: Math.min(Math.max(rect.y, minY), maxY),
  };
};

const getFileExtension = (name = "") => {
  const idx = String(name).lastIndexOf(".");
  return idx >= 0 ? String(name).slice(idx).toLowerCase() : "";
};

const validateResumeUploadFile = (file) => {
  if (!file) return { valid: false, message: "Please select a resume file." };
  const ext = getFileExtension(file.name);
  const mime = String(file.type || "").toLowerCase();
  if (!RESUME_ALLOWED_EXTENSIONS.has(ext) && !RESUME_ALLOWED_MIME_TYPES.has(mime)) {
    return { valid: false, message: "Only PDF, DOC, or DOCX files are allowed." };
  }
  if (file.size > MAX_RESUME_SIZE) {
    return { valid: false, message: "Resume size must be 5 MB or less." };
  }
  return { valid: true };
};

const hasValue = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.some((item) => hasValue(item));
  if (typeof value === "object") return Object.values(value).some((item) => hasValue(item));
  return true;
};

const comparableValue = (value) => {
  if (Array.isArray(value)) {
    return JSON.stringify(
      value.map((item) =>
        typeof item === "object" && item !== null
          ? Object.fromEntries(
              Object.entries(item).map(([key, itemValue]) => [
                key,
                String(itemValue ?? "").trim().toLowerCase(),
              ]),
            )
          : String(item ?? "").trim().toLowerCase(),
      ),
    );
  }
  if (typeof value === "object" && value !== null) {
    return JSON.stringify(
      Object.fromEntries(
        Object.entries(value).map(([key, itemValue]) => [
          key,
          String(itemValue ?? "").trim().toLowerCase(),
        ]),
      ),
    );
  }
  return String(value ?? "").trim().toLowerCase();
};

const normalizeParsedResumeToForm = (parsed = {}) => {
  const educationSource = Array.isArray(parsed.education_history)
    ? parsed.education_history
    : Array.isArray(parsed.education_details)
      ? parsed.education_details
      : Array.isArray(parsed.education)
        ? parsed.education
        : hasValue(parsed.education)
          ? [parsed.education]
          : [];

  const workSource = Array.isArray(parsed.work_history)
    ? parsed.work_history
    : Array.isArray(parsed.experiences)
      ? parsed.experiences
      : Array.isArray(parsed.employment_history)
        ? parsed.employment_history
        : Array.isArray(parsed.experience_history)
          ? parsed.experience_history
          : [];

  const certSource = Array.isArray(parsed.certifications)
    ? parsed.certifications
    : hasValue(parsed.certifications)
      ? [parsed.certifications]
      : hasValue(parsed.certification)
        ? [parsed.certification]
        : [];

  const educationRows = educationSource
    .map((item) => {
      if (typeof item === "string") {
        return {
          highestDegree: item.trim(),
          collegeName: "",
          cgpaPercentage: "",
        };
      }
      return {
        highestDegree: String(
          pick(item, ["degree", "title", "qualification", "course", "education"], ""),
        ).trim(),
        collegeName: String(
          pick(item, ["college", "institution", "university", "school"], ""),
        ).trim(),
        cgpaPercentage: String(
          pick(item, ["cgpa", "percentage", "score", "grade"], ""),
        ).trim(),
      };
    })
    .filter((item) => hasValue(item));

  const experienceRows = workSource
    .map((item) => ({
      experienceCompany: String(
        pick(item, ["company", "company_name", "employer", "organization"], ""),
      ).trim(),
      experienceRole: String(
        pick(item, ["role", "designation", "title", "position"], ""),
      ).trim(),
      experienceProject: String(
        pick(item, ["project_done", "project", "project_name", "projects", "summary"], ""),
      ).trim(),
      experienceSkillsLearnt: toCsv(
        pick(
          item,
          ["skills_learned", "skillsLearnt", "skills", "technologies", "tech_stack", "stack"],
          "",
        ),
      ).trim(),
      experienceYears: String(
        pick(item, ["years", "duration_years", "total_years", "duration", "experience"], ""),
      ).trim(),
      experienceCtc: String(
        pick(item, ["ctc", "current_ctc", "salary", "compensation", "package"], ""),
      ).trim(),
    }))
    .filter((item) => hasValue(item));

  const certificationRows = certSource
    .map((item) => {
      if (typeof item === "string") {
        return {
          certificationName: item.trim(),
          certificationCredentialId: "",
          certificationCredentialLink: "",
        };
      }
      return {
        certificationName: String(
          pick(item, ["name", "title", "certification_name"], ""),
        ).trim(),
        certificationCredentialId: String(
          pick(item, ["credential_id", "credentialId", "id"], ""),
        ).trim(),
        certificationCredentialLink: String(
          pick(item, ["credential_url", "credentialUrl", "url"], ""),
        ).trim(),
      };
    })
    .filter((item) => hasValue(item));

  const topExperienceYears = String(
    pick(parsed, ["total_experience", "experience_years", "experience"], ""),
  ).trim();

  return {
    name: String(pick(parsed, ["full_name", "fullName", "name"], "")).trim(),
    email: String(pick(parsed, ["email"], "")).trim(),
    phone: String(pick(parsed, ["phone", "mobile", "contact_number"], "")).trim(),
    skills: toCsv(pick(parsed, ["skills", "primary_skills", "skill_set", "top_skills"], "")).trim(),
    highestDegree:
      educationRows[0]?.highestDegree ||
      String(pick(parsed, ["highest_degree", "education", "degree"], "")).trim(),
    collegeName:
      educationRows[0]?.collegeName ||
      String(pick(parsed, ["college", "institution", "university"], "")).trim(),
    cgpaPercentage:
      educationRows[0]?.cgpaPercentage ||
      String(pick(parsed, ["cgpa", "percentage"], "")).trim(),
    additionalEducations: educationRows.slice(1),
    certificationName: certificationRows[0]?.certificationName || "",
    certificationCredentialId: certificationRows[0]?.certificationCredentialId || "",
    certificationCredentialLink: certificationRows[0]?.certificationCredentialLink || "",
    additionalCertifications: certificationRows.slice(1),
    experienceCompany: experienceRows[0]?.experienceCompany || "",
    experienceRole: experienceRows[0]?.experienceRole || "",
    experienceProject: experienceRows[0]?.experienceProject || "",
    experienceSkillsLearnt: experienceRows[0]?.experienceSkillsLearnt || "",
    experienceYears:
      topExperienceYears ||
      String(experienceRows[0]?.experienceYears || "").trim(),
    experienceCtc: experienceRows[0]?.experienceCtc || "",
    additionalExperiences: experienceRows.slice(1),
  };
};

const hasParsedResumeContent = (parsed) =>
  [
    "name",
    "email",
    "phone",
    "skills",
    "highestDegree",
    "collegeName",
    "experienceCompany",
    "experienceRole",
    "experienceYears",
    "certificationName",
    "additionalEducations",
    "additionalExperiences",
    "additionalCertifications",
  ].some((key) => hasValue(parsed?.[key]));

const buildResumeParseConflicts = (existingForm, parsedForm) => {
  const fields = [
    { key: "name", label: "Full Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "skills", label: "Skills" },
    { key: "highestDegree", label: "Highest Degree" },
    { key: "collegeName", label: "College Name" },
    { key: "cgpaPercentage", label: "CGPA / %" },
    { key: "certificationName", label: "Certification Name" },
    { key: "experienceCompany", label: "Experience Company" },
    { key: "experienceRole", label: "Experience Role" },
    { key: "experienceYears", label: "Experience Years" },
  ];

  const conflicts = fields
    .filter(({ key }) => hasValue(parsedForm?.[key]) && hasValue(existingForm?.[key]))
    .filter(({ key }) => comparableValue(parsedForm[key]) !== comparableValue(existingForm[key]))
    .map(({ key, label }) => ({
      key,
      label,
      existing: existingForm[key],
      parsed: parsedForm[key],
    }));

  const arrayFields = [
    { key: "additionalEducations", label: "Additional Education" },
    { key: "additionalCertifications", label: "Additional Certifications" },
    { key: "additionalExperiences", label: "Additional Experience" },
  ];

  arrayFields.forEach(({ key, label }) => {
    if (!hasValue(parsedForm?.[key]) || !hasValue(existingForm?.[key])) return;
    if (comparableValue(parsedForm[key]) === comparableValue(existingForm[key])) return;
    conflicts.push({
      key,
      label,
      existing: `${existingForm[key].length || 0} entries`,
      parsed: `${parsedForm[key].length || 0} entries`,
    });
  });

  return conflicts;
};

const mergeParsedResumeIntoForm = (existingForm, parsedForm) => {
  const next = { ...existingForm };
  const copyIfPresent = (key) => {
    if (!hasValue(parsedForm?.[key])) return;
    next[key] = parsedForm[key];
  };

  [
    "name",
    "email",
    "phone",
    "skills",
    "highestDegree",
    "collegeName",
    "cgpaPercentage",
    "certificationName",
    "certificationCredentialId",
    "certificationCredentialLink",
    "experienceCompany",
    "experienceRole",
    "experienceProject",
    "experienceSkillsLearnt",
    "experienceYears",
    "experienceCtc",
  ].forEach(copyIfPresent);

  if (Array.isArray(parsedForm?.additionalEducations) && parsedForm.additionalEducations.length > 0) {
    next.additionalEducations = parsedForm.additionalEducations;
  }
  if (
    Array.isArray(parsedForm?.additionalCertifications) &&
    parsedForm.additionalCertifications.length > 0
  ) {
    next.additionalCertifications = parsedForm.additionalCertifications;
  }
  if (
    Array.isArray(parsedForm?.additionalExperiences) &&
    parsedForm.additionalExperiences.length > 0
  ) {
    next.additionalExperiences = parsedForm.additionalExperiences;
  }

  return next;
};

const buildResumePreviewRows = (parsedForm) => {
  if (!parsedForm) return [];
  const rows = [];
  const add = (label, value) => {
    if (!hasValue(value)) return;
    rows.push({ label, value: String(value) });
  };

  add("Full Name", parsedForm.name);
  add("Email", parsedForm.email);
  add("Phone", parsedForm.phone);
  add("Skills", parsedForm.skills);

  if (
    hasValue(parsedForm.highestDegree) ||
    hasValue(parsedForm.collegeName) ||
    hasValue(parsedForm.cgpaPercentage)
  ) {
    rows.push({
      label: "Education",
      value: [
        parsedForm.highestDegree,
        parsedForm.collegeName,
        parsedForm.cgpaPercentage ? `CGPA/%: ${parsedForm.cgpaPercentage}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
    });
  }

  if (
    hasValue(parsedForm.experienceCompany) ||
    hasValue(parsedForm.experienceRole) ||
    hasValue(parsedForm.experienceYears)
  ) {
    rows.push({
      label: "Experience",
      value: [
        parsedForm.experienceCompany,
        parsedForm.experienceRole,
        parsedForm.experienceYears ? `${parsedForm.experienceYears} years` : "",
      ]
        .filter(Boolean)
        .join(" | "),
    });
  }

  if (hasValue(parsedForm.certificationName)) {
    rows.push({
      label: "Certifications",
      value: parsedForm.certificationName,
    });
  }

  if (Array.isArray(parsedForm.additionalEducations) && parsedForm.additionalEducations.length > 0) {
    rows.push({
      label: "Additional Education",
      value: `${parsedForm.additionalEducations.length} more entries`,
    });
  }
  if (
    Array.isArray(parsedForm.additionalExperiences) &&
    parsedForm.additionalExperiences.length > 0
  ) {
    rows.push({
      label: "Additional Experience",
      value: `${parsedForm.additionalExperiences.length} more entries`,
    });
  }
  if (
    Array.isArray(parsedForm.additionalCertifications) &&
    parsedForm.additionalCertifications.length > 0
  ) {
    rows.push({
      label: "Additional Certifications",
      value: `${parsedForm.additionalCertifications.length} more entries`,
    });
  }

  return rows;
};

const STEP_FIELDS = [
  [
    { key: "noticePeriod", label: "Notice Period" },
  ],
  [
    { key: "photo", label: "Profile Photo", type: "photo", full: true },
    { key: "resume", label: "Resume", type: "file", full: true },
    { key: "name", label: "Name" },
    {
      key: "gender",
      label: "Gender",
      type: "select",
      options: ["", "Male", "Female", "Non-binary", "Prefer not to say"],
    },
    { key: "dateOfBirth", label: "DOB", type: "date" },
    { key: "phone", label: "Phone Number" },
    { key: "email", label: "Email", type: "email" },
    { key: "currentAddress", label: "Current Address", type: "textarea", full: true },
    { key: "permanentAddress", label: "Permanent Address", type: "textarea", full: true },
    { key: "city", label: "City" },
    { key: "pincode", label: "Pincode" },
    { key: "readyToRelocate", label: "Ready To Relocate", type: "checkbox" },
    { key: "preferredLocation", label: "Preferred Location" },
  ],
  [
    { key: "designation", label: "Designation" },
    { key: "currentCtc", label: "Current CTC" },
    { key: "expectedCtc", label: "Expected CTC" },
  ],
  [
    { key: "highestDegree", label: "Highest Degree" },
    { key: "collegeName", label: "College Name" },
    { key: "cgpaPercentage", label: "CGPA / %" },
    {
      key: "additionalEducations",
      label: "Add More Education",
      type: "add-more-education",
      full: true,
    },
  ],
  [{ key: "skills", label: "Skills", hint: "Comma separated tags" }],
  [
    { key: "certificationName", label: "Certification Name" },
    { key: "certificationCredentialId", label: "Credential ID" },
    {
      key: "certificationCredentialLink",
      label: "Credential Link",
      hint: "Must be valid URL",
    },
    {
      key: "additionalCertifications",
      label: "Add More Certifications",
      type: "add-more-certification",
      full: true,
    },
  ],
  [
    { key: "experienceCompany", label: "Company Worked For" },
    { key: "experienceRole", label: "Role" },
    { key: "experienceProject", label: "Project Done" },
    { key: "experienceSkillsLearnt", label: "Skills Learnt", hint: "Comma separated" },
    { key: "experienceYears", label: "Years" },
    { key: "experienceCtc", label: "CTC There" },
    {
      key: "additionalExperiences",
      label: "Add More Experience",
      type: "add-more-experience",
      full: true,
    },
  ],
];

const unwrap = (payload) => payload?.data?.data ?? payload?.data ?? payload ?? null;

const pick = (obj, keys, fallback = "") => {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return fallback;
};

const toCsv = (value) => {
  if (!value) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : item?.name || item?.skill || ""))
      .filter(Boolean)
      .join(", ");
  }
  return String(value);
};

const toUrl = (value) => {
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || String(value).startsWith("blob:")) return value;
  return `http://localhost:8000/${String(value).replace(/^\/+/, "")}`;
};

const isValidUrl = (value) => {
  if (!value) return true;
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const splitCsv = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const normalizePhoneInputText = (value) =>
  String(value || "")
    .replace(/[\u00A0\u2007\u202F]/g, " ")
    .trim();

const toCanonicalPhoneValue = (value) => {
  const raw = normalizePhoneInputText(value);
  if (!raw) return "";
  if (raw.startsWith("+")) {
    const digits = raw.replace(/[^\d]/g, "");
    return digits ? `+${digits}` : "";
  }
  return raw.replace(/[^\d]/g, "");
};

const mapCandidate = (candidate = {}) => {
  const directName = pick(candidate, ["full_name", "fullName", "name"], "").trim();
  const firstName = pick(candidate, ["first_name", "firstName"], "").trim();
  const lastName = pick(candidate, ["last_name", "lastName"], "").trim();
  const fullName = directName || [firstName, lastName].filter(Boolean).join(" ").trim();
  const educationHistory = Array.isArray(candidate.education_history)
    ? candidate.education_history
    : Array.isArray(candidate.education_details)
      ? candidate.education_details
      : [];
  const latestEducation = educationHistory[0] || {};
  const workHistory = Array.isArray(candidate.work_history)
    ? candidate.work_history
    : Array.isArray(candidate.employment_history)
      ? candidate.employment_history
      : Array.isArray(candidate.experience_history)
        ? candidate.experience_history
        : [];
  const latestWork = workHistory[0] || {};

  const certifications = Array.isArray(candidate.certifications)
    ? candidate.certifications
    : candidate.certifications
      ? [candidate.certifications]
      : [];
  const firstCertification = certifications[0];
  const certName =
    typeof firstCertification === "string"
      ? firstCertification
      : pick(firstCertification, ["name", "title", "certification_name"], "");
  const certCredentialId =
    typeof firstCertification === "object"
      ? pick(firstCertification, ["credential_id", "credentialId", "id"], "")
      : "";
  const certCredentialLink =
    typeof firstCertification === "object"
      ? pick(firstCertification, ["credential_url", "credentialUrl", "url"], "")
      : "";

  const additionalEducations = educationHistory.slice(1).map((item) => ({
    highestDegree: String(pick(item, ["degree", "title"], "")),
    collegeName: String(pick(item, ["college", "institution", "university"], "")),
    cgpaPercentage: String(pick(item, ["cgpa", "percentage"], "")),
  }));

  const additionalCertifications = certifications.slice(1).map((item) => ({
    certificationName:
      typeof item === "string"
        ? item
        : String(pick(item, ["name", "title", "certification_name"], "")),
    certificationCredentialId:
      typeof item === "object"
        ? String(pick(item, ["credential_id", "credentialId", "id"], ""))
        : "",
    certificationCredentialLink:
      typeof item === "object"
        ? String(pick(item, ["credential_url", "credentialUrl", "url"], ""))
        : "",
  }));

  const additionalExperiences = workHistory.slice(1).map((item) => ({
    experienceCompany: String(pick(item, ["company", "company_name", "employer"], "")),
    experienceRole: String(pick(item, ["role", "designation", "title"], "")),
    experienceProject: String(
      pick(item, ["project_done", "project", "project_name", "projects"], ""),
    ),
    experienceSkillsLearnt: toCsv(
      pick(
        item,
        ["skills_learned", "skillsLearnt", "skills", "technologies", "tech_stack", "stack"],
        "",
      ),
    ),
    experienceYears: String(
      pick(item, ["years", "duration_years", "total_years", "duration"], ""),
    ),
    experienceCtc: String(
      pick(item, ["ctc", "current_ctc", "salary", "compensation", "package"], ""),
    ),
  }));

  return {
    id: pick(candidate, ["id", "_id", "candidate_id"], null),
    photoUrl: pick(
      candidate,
      ["photo_url", "photo", "profile_picture", "data_profile_picture", "avatar_url", "avatarUrl"],
      "",
    ),
    resumeUrl: pick(candidate, ["resume_url", "resumeUrl", "resume_path", "resumePath"], ""),
    data: {
      ...INITIAL_FORM,
      name: String(fullName),
      noticePeriod: String(
        pick(candidate, ["notice_period", "notice_period_days", "noticePeriod"], ""),
      ),
      gender: String(pick(candidate, ["gender"], "")),
      dateOfBirth: String(pick(candidate, ["date_of_birth", "dob", "dateOfBirth"], "")).split("T")[0],
      phone: normalizePhoneInputText(
        pick(candidate, ["phone", "mobile", "contact_number", "phone_number"], ""),
      ),
      email: String(pick(candidate, ["email"], "")),
      currentAddress: String(pick(candidate, ["current_address", "currentAddress", "address"], "")),
      permanentAddress: String(
        pick(candidate, ["permanent_address", "permanentAddress"], ""),
      ),
      city: String(pick(candidate, ["city", "current_city"], "")),
      pincode: String(pick(candidate, ["pincode", "pin_code", "zipcode"], "")),
      readyToRelocate: ["yes", "true", "1"].includes(
        String(
          pick(
            candidate,
            ["ready_to_relocate", "willing_to_relocate", "readyToRelocate", "willingToRelocate"],
            "",
          ),
        ).toLowerCase(),
      ),
      preferredLocation: String(
        pick(candidate, ["preferred_location", "preferredLocation"], ""),
      ),
      designation: String(
        pick(candidate, ["current_designation", "current_job_title", "designation", "current_role"], ""),
      ),
      currentCtc: String(pick(candidate, ["current_ctc", "current_salary"], "")),
      expectedCtc: String(pick(candidate, ["expected_ctc", "expected_salary"], "")),
      highestDegree: String(
        pick(
          latestEducation,
          ["degree", "title"],
          pick(candidate, ["highest_degree", "highest_qualification", "education", "degree"], ""),
        ),
      ),
      collegeName: String(
        pick(
          latestEducation,
          ["college", "institution", "university"],
          pick(candidate, ["college", "institution", "university"], ""),
        ),
      ),
      cgpaPercentage: String(
        pick(
          latestEducation,
          ["cgpa", "percentage"],
          pick(candidate, ["cgpa", "percentage"], ""),
        ),
      ),
      skills: toCsv(pick(candidate, ["skills", "primary_skills", "skill_set", "top_skills"], "")),
      certificationName: String(certName),
      certificationCredentialId: String(certCredentialId),
      certificationCredentialLink: String(certCredentialLink),
      experienceCompany: String(
        pick(latestWork, ["company", "company_name", "employer"], ""),
      ),
      experienceRole: String(
        pick(latestWork, ["role", "designation", "title"], ""),
      ),
      experienceProject: String(
        pick(latestWork, ["project_done", "project", "project_name", "projects"], ""),
      ),
      experienceSkillsLearnt: toCsv(
        pick(
          latestWork,
          ["skills_learned", "skillsLearnt", "skills", "technologies", "tech_stack", "stack"],
          "",
        ),
      ),
      experienceYears: String(
        pick(latestWork, ["years", "duration_years", "total_years", "duration"], pick(candidate, ["total_experience", "experience_years", "experience"], "")),
      ),
      experienceCtc: String(
        pick(latestWork, ["ctc", "current_ctc", "salary", "compensation", "package"], ""),
      ),
      additionalEducations,
      additionalCertifications,
      additionalExperiences,
    },
  };
};

const buildPayload = (form, photoBlob, resumeFile) => {
  const fd = new FormData();
  const append = (key, value) => {
    if (value === undefined || value === null) return;
    fd.append(key, String(value));
  };

  const full = form.name.trim();
  const parts = full.split(/\s+/).filter(Boolean);
  const first = parts[0] || "";
  const last = parts.slice(1).join(" ");
  const canonicalPhone = toCanonicalPhoneValue(form.phone);
  const skills = splitCsv(form.skills);
  const baseCertification =
    form.certificationName || form.certificationCredentialId || form.certificationCredentialLink
      ? [
          {
            name: form.certificationName.trim(),
            credential_id: form.certificationCredentialId.trim(),
            credential_url: form.certificationCredentialLink.trim(),
          },
        ]
      : [];
  const extraCertifications = (Array.isArray(form.additionalCertifications)
    ? form.additionalCertifications
    : []
  )
    .map((item) => ({
      name: String(item?.certificationName || "").trim(),
      credential_id: String(item?.certificationCredentialId || "").trim(),
      credential_url: String(item?.certificationCredentialLink || "").trim(),
    }))
    .filter((item) => item.name || item.credential_id || item.credential_url);
  const certs = [...baseCertification, ...extraCertifications];

  const baseExperience =
    form.experienceCompany ||
    form.experienceRole ||
    form.experienceProject ||
    form.experienceSkillsLearnt ||
    form.experienceYears ||
    form.experienceCtc
      ? [
          {
            company: form.experienceCompany.trim(),
            role: form.experienceRole.trim(),
            project_done: form.experienceProject.trim(),
            skills_learned: splitCsv(form.experienceSkillsLearnt),
            years: form.experienceYears.trim(),
            ctc: form.experienceCtc.trim(),
          },
        ]
      : [];
  const extraExperiences = (Array.isArray(form.additionalExperiences)
    ? form.additionalExperiences
    : []
  )
    .map((item) => ({
      company: String(item?.experienceCompany || "").trim(),
      role: String(item?.experienceRole || "").trim(),
      project_done: String(item?.experienceProject || "").trim(),
      skills_learned: splitCsv(item?.experienceSkillsLearnt || ""),
      years: String(item?.experienceYears || "").trim(),
      ctc: String(item?.experienceCtc || "").trim(),
    }))
    .filter(
      (item) =>
        item.company ||
        item.role ||
        item.project_done ||
        item.skills_learned.length > 0 ||
        item.years ||
        item.ctc,
    );
  const workHistory = [...baseExperience, ...extraExperiences];

  const baseEducation =
    form.highestDegree || form.collegeName || form.cgpaPercentage
      ? [
          {
            degree: form.highestDegree.trim(),
            college: form.collegeName.trim(),
            cgpa: form.cgpaPercentage.trim(),
            percentage: form.cgpaPercentage.trim(),
          },
        ]
      : [];
  const extraEducations = (Array.isArray(form.additionalEducations)
    ? form.additionalEducations
    : []
  )
    .map((item) => ({
      degree: String(item?.highestDegree || "").trim(),
      college: String(item?.collegeName || "").trim(),
      cgpa: String(item?.cgpaPercentage || "").trim(),
      percentage: String(item?.cgpaPercentage || "").trim(),
    }))
    .filter((item) => item.degree || item.college || item.cgpa || item.percentage);
  const educationHistory = [...baseEducation, ...extraEducations];

  append("first_name", first);
  append("last_name", last);
  append("full_name", full);
  append("email", form.email.trim());
  append("phone", canonicalPhone);
  append("mobile", canonicalPhone);
  append("contact_number", canonicalPhone);
  append("phone_number", canonicalPhone);
  append("date_of_birth", form.dateOfBirth);
  append("dob", form.dateOfBirth);
  append("gender", form.gender);
  append("notice_period", form.noticePeriod.trim());
  if (/^\d+$/.test(form.noticePeriod.trim())) {
    append("notice_period_days", form.noticePeriod.trim());
  }
  append("current_address", form.currentAddress.trim());
  append("permanent_address", form.permanentAddress.trim());
  append("city", form.city.trim());
  append("pincode", form.pincode.trim());
  append("willing_to_relocate", form.readyToRelocate);
  append("ready_to_relocate", form.readyToRelocate);
  append("preferred_location", form.preferredLocation.trim());
  append("current_designation", form.designation.trim());
  append("current_role", form.designation.trim());
  append("designation", form.designation.trim());
  append("current_ctc", form.currentCtc.trim());
  append("expected_ctc", form.expectedCtc.trim());
  append("highest_degree", form.highestDegree.trim());
  append("education", form.highestDegree.trim());
  append("college", form.collegeName.trim());
  append("institution", form.collegeName.trim());
  append("cgpa", form.cgpaPercentage.trim());
  append("percentage", form.cgpaPercentage.trim());
  append("skills", JSON.stringify(skills));
  append("primary_skills", JSON.stringify(skills));
  append("certifications", JSON.stringify(certs));
  append("work_history", JSON.stringify(workHistory));
  append("education_history", JSON.stringify(educationHistory));
  append("total_experience", form.experienceYears.trim());
  append("experience_years", form.experienceYears.trim());

  if (photoBlob) fd.append("photo", photoBlob, "profile-photo.jpg");
  if (resumeFile) fd.append("resume", resumeFile);
  return fd;
};

const buildJsonPayload = (form) => {
  const full = form.name.trim();
  const parts = full.split(/\s+/).filter(Boolean);
  const first = parts[0] || "";
  const last = parts.slice(1).join(" ");
  const canonicalPhone = toCanonicalPhoneValue(form.phone);
  const skills = splitCsv(form.skills);
  const baseCertification =
    form.certificationName || form.certificationCredentialId || form.certificationCredentialLink
      ? [
          {
            name: form.certificationName.trim(),
            credential_id: form.certificationCredentialId.trim(),
            credential_url: form.certificationCredentialLink.trim(),
          },
        ]
      : [];
  const extraCertifications = (Array.isArray(form.additionalCertifications)
    ? form.additionalCertifications
    : []
  )
    .map((item) => ({
      name: String(item?.certificationName || "").trim(),
      credential_id: String(item?.certificationCredentialId || "").trim(),
      credential_url: String(item?.certificationCredentialLink || "").trim(),
    }))
    .filter((item) => item.name || item.credential_id || item.credential_url);
  const certs = [...baseCertification, ...extraCertifications];

  const baseExperience =
    form.experienceCompany ||
    form.experienceRole ||
    form.experienceProject ||
    form.experienceSkillsLearnt ||
    form.experienceYears ||
    form.experienceCtc
      ? [
          {
            company: form.experienceCompany.trim(),
            role: form.experienceRole.trim(),
            project_done: form.experienceProject.trim(),
            skills_learned: splitCsv(form.experienceSkillsLearnt),
            years: form.experienceYears.trim(),
            ctc: form.experienceCtc.trim(),
          },
        ]
      : [];
  const extraExperiences = (Array.isArray(form.additionalExperiences)
    ? form.additionalExperiences
    : []
  )
    .map((item) => ({
      company: String(item?.experienceCompany || "").trim(),
      role: String(item?.experienceRole || "").trim(),
      project_done: String(item?.experienceProject || "").trim(),
      skills_learned: splitCsv(item?.experienceSkillsLearnt || ""),
      years: String(item?.experienceYears || "").trim(),
      ctc: String(item?.experienceCtc || "").trim(),
    }))
    .filter(
      (item) =>
        item.company ||
        item.role ||
        item.project_done ||
        item.skills_learned.length > 0 ||
        item.years ||
        item.ctc,
    );
  const workHistory = [...baseExperience, ...extraExperiences];

  const baseEducation =
    form.highestDegree || form.collegeName || form.cgpaPercentage
      ? [
          {
            degree: form.highestDegree.trim(),
            college: form.collegeName.trim(),
            cgpa: form.cgpaPercentage.trim(),
            percentage: form.cgpaPercentage.trim(),
          },
        ]
      : [];
  const extraEducations = (Array.isArray(form.additionalEducations)
    ? form.additionalEducations
    : []
  )
    .map((item) => ({
      degree: String(item?.highestDegree || "").trim(),
      college: String(item?.collegeName || "").trim(),
      cgpa: String(item?.cgpaPercentage || "").trim(),
      percentage: String(item?.cgpaPercentage || "").trim(),
    }))
    .filter((item) => item.degree || item.college || item.cgpa || item.percentage);
  const educationHistory = [...baseEducation, ...extraEducations];

  return {
    firstName: first,
    lastName: last,
    fullName: full,
    full_name: full,
    email: form.email.trim(),
    phone: canonicalPhone,
    mobile: canonicalPhone,
    contact_number: canonicalPhone,
    phone_number: canonicalPhone,
    dateOfBirth: form.dateOfBirth || null,
    date_of_birth: form.dateOfBirth || null,
    gender: form.gender || null,
    noticePeriod: form.noticePeriod.trim(),
    notice_period: form.noticePeriod.trim(),
    currentAddress: form.currentAddress.trim(),
    current_address: form.currentAddress.trim(),
    permanentAddress: form.permanentAddress.trim(),
    permanent_address: form.permanentAddress.trim(),
    city: form.city.trim(),
    pincode: form.pincode.trim(),
    readyToRelocate: Boolean(form.readyToRelocate),
    ready_to_relocate: Boolean(form.readyToRelocate),
    willingToRelocate: Boolean(form.readyToRelocate),
    willing_to_relocate: Boolean(form.readyToRelocate),
    preferredLocation: form.preferredLocation.trim(),
    preferred_location: form.preferredLocation.trim(),
    currentDesignation: form.designation.trim(),
    current_designation: form.designation.trim(),
    current_role: form.designation.trim(),
    current_job_title: form.designation.trim(),
    designation: form.designation.trim(),
    currentCtc: form.currentCtc.trim(),
    current_ctc: form.currentCtc.trim(),
    expectedCtc: form.expectedCtc.trim(),
    expected_ctc: form.expectedCtc.trim(),
    highestDegree: form.highestDegree.trim(),
    highest_degree: form.highestDegree.trim(),
    collegeName: form.collegeName.trim(),
    college: form.collegeName.trim(),
    institution: form.collegeName.trim(),
    cgpa: form.cgpaPercentage.trim(),
    percentage: form.cgpaPercentage.trim(),
    skills,
    primarySkills: skills,
    certifications: certs,
    educationHistory,
    education_history: educationHistory,
    workHistory,
    work_history: workHistory,
    totalExperience: form.experienceYears.trim(),
    total_experience: form.experienceYears.trim(),
    experience_years: form.experienceYears.trim(),
  };
};

const compactArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => {
    if (item === null || item === undefined) return false;
    if (typeof item === "string") return item.trim() !== "";
    if (typeof item === "object") return Object.values(item).some((v) => String(v ?? "").trim() !== "");
    return true;
  });
};

const parseNumberOrNull = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : null;
};

const buildSelfUpdatePayload = (form) => {
  const canonicalPhone = toCanonicalPhoneValue(form.phone);
  const skills = splitCsv(form.skills);
  const workHistory = compactArray(
    (Array.isArray(form.additionalExperiences) ? form.additionalExperiences : [])
      .map((item) => ({
        company: String(item?.experienceCompany || "").trim(),
        role: String(item?.experienceRole || "").trim(),
        project_done: String(item?.experienceProject || "").trim(),
        skills_learned: splitCsv(item?.experienceSkillsLearnt || ""),
        years: String(item?.experienceYears || "").trim(),
        ctc: String(item?.experienceCtc || "").trim(),
      }))
      .concat(
        form.experienceCompany ||
          form.experienceRole ||
          form.experienceProject ||
          form.experienceSkillsLearnt ||
          form.experienceYears ||
          form.experienceCtc
          ? [
              {
                company: form.experienceCompany.trim(),
                role: form.experienceRole.trim(),
                project_done: form.experienceProject.trim(),
                skills_learned: splitCsv(form.experienceSkillsLearnt),
                years: form.experienceYears.trim(),
                ctc: form.experienceCtc.trim(),
              },
            ]
          : [],
      ),
  );

  const educationHistory = compactArray(
    (Array.isArray(form.additionalEducations) ? form.additionalEducations : [])
      .map((item) => ({
        degree: String(item?.highestDegree || "").trim(),
        college: String(item?.collegeName || "").trim(),
        cgpa: String(item?.cgpaPercentage || "").trim(),
        percentage: String(item?.cgpaPercentage || "").trim(),
      }))
      .concat(
        form.highestDegree || form.collegeName || form.cgpaPercentage
          ? [
              {
                degree: form.highestDegree.trim(),
                college: form.collegeName.trim(),
                cgpa: form.cgpaPercentage.trim(),
                percentage: form.cgpaPercentage.trim(),
              },
            ]
          : [],
      ),
  );

  const certifications = compactArray(
    (Array.isArray(form.additionalCertifications) ? form.additionalCertifications : [])
      .map((item) => ({
        name: String(item?.certificationName || "").trim(),
        organization: "Self Reported",
        credential_id: String(item?.certificationCredentialId || "").trim(),
        credential_url: String(item?.certificationCredentialLink || "").trim(),
      }))
      .concat(
        form.certificationName ||
          form.certificationCredentialId ||
          form.certificationCredentialLink
          ? [
              {
                name: form.certificationName.trim(),
                organization: "Self Reported",
                credential_id: form.certificationCredentialId.trim(),
                credential_url: form.certificationCredentialLink.trim(),
              },
            ]
          : [],
      ),
  ).filter((item) => String(item?.name || "").trim() !== "");

  const currentCtcNumber = parseNumberOrNull(form.currentCtc);
  const expectedSalaryNumber = parseNumberOrNull(form.expectedCtc);
  const normalizedExperience = String(form.experienceYears || "").trim();

  const previousEmployers = compactArray(
    (Array.isArray(form.additionalExperiences) ? form.additionalExperiences : []).map((item) =>
      String(item?.experienceCompany || "").trim(),
    ),
  ).join(", ");

  const payload = {
    full_name: form.name.trim(),
    email: form.email.trim(),
    phone: canonicalPhone,
    mobile: canonicalPhone,
    contact_number: canonicalPhone,
    phone_number: canonicalPhone,
    dob: form.dateOfBirth || null,
    dateOfBirth: form.dateOfBirth || null,
    gender: form.gender || null,
    current_location: form.city.trim() || null,
    notice_period: form.noticePeriod.trim() || null,
    current_address: form.currentAddress.trim() || null,
    permanent_address: form.permanentAddress.trim() || null,
    city: form.city.trim() || null,
    pincode: form.pincode.trim() || null,
    ready_to_relocate: form.readyToRelocate ? "Yes" : "No",
    preferred_location: form.preferredLocation.trim() || null,
    current_role: form.designation.trim() || null,
    current_designation: form.designation.trim() || null,
    current_job_title: form.designation.trim() || null,
    current_ctc: currentCtcNumber,
    expected_salary: expectedSalaryNumber,
    experience: normalizedExperience || null,
    current_employer: form.experienceCompany.trim() || null,
    previous_employers: previousEmployers || null,
    education: form.highestDegree.trim() || null,
    skills,
    work_history: workHistory,
    education_history: educationHistory,
    certifications,
  };

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "string") return value.trim() !== "";
      if (Array.isArray(value)) return value.length > 0;
      return true;
    }),
  );
};

const getApiErrorMessage = (error, fallback = "Failed to save profile") => {
  const detail = error?.response?.data?.detail;
  if (Array.isArray(detail)) {
    const message = detail
      .map((item) => {
        if (!item) return "";
        if (typeof item === "string") return item.trim();
        if (typeof item === "object") {
          const fieldPath = Array.isArray(item.loc)
            ? item.loc
                .filter((part) => part !== "body")
                .map((part) => String(part))
                .join(".")
            : "";
          const reason = String(item.msg || item.message || "").trim();
          if (fieldPath && reason) return `${fieldPath}: ${reason}`;
          return reason;
        }
        return String(item).trim();
      })
      .filter(Boolean)
      .join(", ");
    return message || fallback;
  }
  if (detail && typeof detail === "object") {
    const message = String(detail.msg || detail.message || "").trim();
    return message || fallback;
  }
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  return fallback;
};

export default function CandidateProfile() {
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const authRole = String(localStorage.getItem("role") || "")
    .trim()
    .toLowerCase();
  const isCandidateSelfUser = authRole === "candidate";

  const [mode, setMode] = useState("create");
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(new Set());
  const [form, setForm] = useState(INITIAL_FORM);
  const [original, setOriginal] = useState(INITIAL_FORM);
  const [recordId, setRecordId] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null);

  const [photoPreview, setPhotoPreview] = useState("");
  const [croppedPhotoBlob, setCroppedPhotoBlob] = useState(null);
  const [resumeUrl, setResumeUrl] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeClientFile, setResumeClientFile] = useState(null);
  const [lastUploadedResumeName, setLastUploadedResumeName] = useState("");
  const [resumeUploadProgress, setResumeUploadProgress] = useState(0);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [parsingResume, setParsingResume] = useState(false);
  const [resumeStatusText, setResumeStatusText] = useState("");
  const [showParsePreview, setShowParsePreview] = useState(false);
  const [parsedResumeDraft, setParsedResumeDraft] = useState(null);
  const [parseConflicts, setParseConflicts] = useState([]);
  const [toast, setToast] = useState(null);
  const [originalPhotoPreview, setOriginalPhotoPreview] = useState("");
  const [originalResumeUrl, setOriginalResumeUrl] = useState("");

  const [showCropper, setShowCropper] = useState(false);
  const [cropSource, setCropSource] = useState("");
  const [cropRect, setCropRect] = useState({ x: 40, y: 40, size: 170 });
  const [cropBounds, setCropBounds] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);

  const photoInputRef = useRef(null);
  const resumeInputRef = useRef(null);
  const resumeActionRef = useRef("upload");
  const cropImgRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const cropSourceUrlRef = useRef("");
  const photoObjectUrlRef = useRef("");

  const fullName = useMemo(
    () => form.name?.trim() || "Candidate",
    [form.name],
  );
  const photoSrc = useMemo(() => (photoPreview ? toUrl(photoPreview) : `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=E5E7EB&color=111827`), [photoPreview, fullName]);
  const cropMaxSize = Math.max(Math.floor(Math.min(cropBounds.width, cropBounds.height)), 1);
  const cropMinSize = Math.min(MIN_CROP_SIZE, cropMaxSize);
  const resumePreviewRows = useMemo(() => buildResumePreviewRows(parsedResumeDraft), [parsedResumeDraft]);

  useEffect(() => {
    return () => {
      if (cropSourceUrlRef.current) URL.revokeObjectURL(cropSourceUrlRef.current);
      if (photoObjectUrlRef.current) URL.revokeObjectURL(photoObjectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setBanner(null);
      setResumeClientFile(null);
      setResumeFile(null);
      setResumeUploadProgress(0);
      setResumeStatusText("");
      setParsedResumeDraft(null);
      setParseConflicts([]);
      setShowParsePreview(false);
      setLastUploadedResumeName("");
      try {
        let response;
        if (isCandidateSelfUser) {
          try {
            response = await api.get("/v1/candidate/me");
          } catch {
            if (routeId) response = await api.get(`/v1/candidates/${routeId}`);
            else {
              setMode("create");
              setLoading(false);
              return;
            }
          }
        } else if (routeId) {
          response = await api.get(`/v1/candidates/${routeId}`);
        } else {
          response = await api.get("/v1/candidate/me");
        }

        const data = unwrap(response);
        if (!data || typeof data !== "object" || Object.keys(data).length === 0) {
          setMode("create");
          setLoading(false);
          return;
        }

        const mapped = mapCandidate(data);
        setForm(mapped.data);
        setOriginal(mapped.data);
        setRecordId(mapped.id || routeId || null);
        setPhotoPreview(mapped.photoUrl || "");
        setResumeUrl(mapped.resumeUrl || "");
        setLastUploadedResumeName(
          String(mapped.resumeUrl || "")
            .split("/")
            .pop() || "",
        );
        setOriginalPhotoPreview(mapped.photoUrl || "");
        setOriginalResumeUrl(mapped.resumeUrl || "");
        setMode("view");
        setCompleted(new Set(STEPS.map((_, index) => index)));
      } catch (error) {
        console.error(error);
        setBanner({ type: "error", text: "Failed to load profile." });
        setMode("create");
      } finally {
        setLoading(false);
      }
    })();
  }, [routeId, isCandidateSelfUser]);

  useEffect(() => {
    const onMouseMove = (event) => {
      if (!dragging || !cropImgRef.current) return;
      const imgRect = cropImgRef.current.getBoundingClientRect();
      const bounds = cropBounds.width > 0 && cropBounds.height > 0
        ? cropBounds
        : { x: 0, y: 0, width: imgRect.width, height: imgRect.height };

      const minX = bounds.x;
      const minY = bounds.y;
      const maxX = Math.max(bounds.x + bounds.width - cropRect.size, minX);
      const maxY = Math.max(bounds.y + bounds.height - cropRect.size, minY);
      const x = Math.min(Math.max(event.clientX - imgRect.left - dragOffsetRef.current.x, minX), maxX);
      const y = Math.min(Math.max(event.clientY - imgRect.top - dragOffsetRef.current.y, minY), maxY);
      setCropRect((prev) => ({ ...prev, x, y }));
    };
    const onMouseUp = () => setDragging(false);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging, cropBounds, cropRect.size]);

  useEffect(() => {
    if (!showCropper || cropBounds.width <= 0 || cropBounds.height <= 0) return;
    setCropRect((prev) => clampCropRectToBounds(prev, cropBounds));
  }, [showCropper, cropBounds]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const addListItem = (listKey, emptyItem) => {
    setForm((prev) => ({
      ...prev,
      [listKey]: [...(Array.isArray(prev[listKey]) ? prev[listKey] : []), { ...emptyItem }],
    }));
  };

  const updateListItem = (listKey, index, itemKey, value) => {
    setForm((prev) => {
      const list = Array.isArray(prev[listKey]) ? [...prev[listKey]] : [];
      const current = list[index] || {};
      list[index] = { ...current, [itemKey]: value };
      return { ...prev, [listKey]: list };
    });
  };

  const removeListItem = (listKey, index) => {
    setForm((prev) => {
      const list = Array.isArray(prev[listKey]) ? [...prev[listKey]] : [];
      list.splice(index, 1);
      return { ...prev, [listKey]: list };
    });
  };

  const validate = (field) => {
    const value = form[field];
    const raw = typeof value === "string" ? value.trim() : value;

    if (field === "resume") {
      if (!resumeFile && !resumeUrl) return "Resume is required";
      return null;
    }

    if (REQUIRED.has(field)) {
      if (raw === "" || raw === null || raw === undefined) return "Required";
    }

    if (field === "name" && raw) {
      const nameError = validateFeatureName(raw, "Name", {
        pattern: /^[A-Za-z][A-Za-z .'-]{1,79}$/,
        patternMessage:
          "Name can only contain letters, spaces, apostrophes, periods, and hyphens.",
      });
      if (nameError) return nameError;
    }

    if (field === "email" && raw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return "Invalid email";
    if (field === "phone" && raw && !/^\d{10,15}$/.test(String(raw).replace(/[^\d]/g, ""))) return "10-15 digits";
    if (
      ["currentCtc", "expectedCtc", "experienceYears", "experienceCtc"].includes(
        field,
      ) &&
      raw &&
      !/^\d+(\.\d+)?$/.test(raw)
    ) {
      return "Invalid number";
    }
    if (field === "pincode" && raw && !/^\d{6}$/.test(raw)) return "Use 6-digit pincode";
    if (field === "certificationCredentialLink" && raw && !isValidUrl(raw)) return "Invalid URL";
    if (field === "skills" && raw) {
      const skills = String(raw)
        .split(",")
        .map((item) => normalizeText(item))
        .filter(Boolean);
      if (skills.length === 0) return "Add at least one skill";
      const seenSkills = new Set();
      for (const skill of skills) {
        const skillError = validateFeatureName(skill, "Skill", {
          pattern: /^[A-Za-z0-9+.#/\- ]+$/,
          patternMessage:
            "Skill can only contain letters, numbers, spaces, and + . # / -",
        });
        if (skillError) return skillError;
        const key = skill.toLowerCase();
        if (seenSkills.has(key)) return "Duplicate skills are not allowed";
        seenSkills.add(key);
      }
    }
    if (field === "experienceProject" && raw) {
      const projectError = validateDescription(raw, {
        minLength: 20,
        required: false,
        label: "Project description",
      });
      if (projectError) return projectError;
    }
    if (field === "additionalCertifications") {
      const list = Array.isArray(form.additionalCertifications)
        ? form.additionalCertifications
        : [];
      for (const item of list) {
        const link = String(item?.certificationCredentialLink || "").trim();
        if (link && !isValidUrl(link)) return "Invalid URL in additional certifications";
      }
    }
    if (field === "additionalExperiences") {
      const list = Array.isArray(form.additionalExperiences)
        ? form.additionalExperiences
        : [];
      for (const item of list) {
        const project = normalizeText(item?.experienceProject || "");
        if (!project) continue;
        const projectError = validateDescription(project, {
          minLength: 20,
          required: false,
          label: "Project description",
        });
        if (projectError) return "Project description in additional experiences must be at least 20 characters";
      }
    }
    return null;
  };

  const validateStep = (step) => {
    const fields = STEP_FIELDS[step].map((f) => f.key);
    const nextErrors = {};
    fields.forEach((field) => {
      const err = validate(field);
      if (err) nextErrors[field] = err;
    });

    setErrors((prev) => {
      const next = { ...prev };
      fields.forEach((field) => delete next[field]);
      return { ...next, ...nextErrors };
    });
    return Object.keys(nextErrors).length === 0;
  };

  const validateAll = () => {
    const fields = STEP_FIELDS.flatMap((step) => step.map((f) => f.key));
    const nextErrors = {};
    fields.forEach((field) => {
      const err = validate(field);
      if (err) nextErrors[field] = err;
    });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onNext = () => {
    if (!validateStep(currentStep)) return;
    setCompleted((prev) => new Set([...prev, currentStep]));
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const onPrev = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const onJump = (index) => {
    if (index <= currentStep || completed.has(index)) {
      setCurrentStep(index);
      return;
    }
    if (!validateStep(currentStep)) return;
    setCompleted((prev) => new Set([...prev, currentStep]));
    setCurrentStep(index);
  };

  const openCropper = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!String(file.type || "").toLowerCase().startsWith("image/")) {
      setBanner({ type: "error", text: "Please select an image file" });
      return;
    }
    if (cropSourceUrlRef.current) URL.revokeObjectURL(cropSourceUrlRef.current);
    const url = URL.createObjectURL(file);
    cropSourceUrlRef.current = url;
    setCropBounds({ x: 0, y: 0, width: 0, height: 0 });
    setCropRect({ x: 40, y: 40, size: 170 });
    setCropSource(url);
    setShowCropper(true);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.photo;
      return next;
    });
  };

  const onCropImageLoad = () => {
    const img = cropImgRef.current;
    if (!img) return;
    const bounds = getDisplayedImageBounds(img);
    setCropBounds(bounds);
    const maxSize = Math.max(Math.min(bounds.width, bounds.height), 1);
    const minSize = Math.min(MIN_CROP_SIZE, maxSize);
    const size = Math.max(maxSize * 0.8, minSize);
    setCropRect(clampCropRectToBounds({
      x: bounds.x + (bounds.width - size) / 2,
      y: bounds.y + (bounds.height - size) / 2,
      size,
    }, bounds));
  };

  const onCropDown = (event) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    dragOffsetRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    setDragging(true);
  };

  const onCropSize = (event) => {
    const img = cropImgRef.current;
    if (!img) return;
    const bounds = getDisplayedImageBounds(img);
    setCropBounds(bounds);

    const maxSize = Math.max(Math.min(bounds.width, bounds.height), 1);
    const minSize = Math.min(MIN_CROP_SIZE, maxSize);
    const size = Math.min(Math.max(Number(event.target.value), minSize), maxSize);
    const minX = bounds.x;
    const minY = bounds.y;
    const maxX = Math.max(bounds.x + bounds.width - size, minX);
    const maxY = Math.max(bounds.y + bounds.height - size, minY);

    setCropRect((prev) => {
      const cx = prev.x + prev.size / 2;
      const cy = prev.y + prev.size / 2;
      return {
        size,
        x: Math.min(Math.max(cx - size / 2, minX), maxX),
        y: Math.min(Math.max(cy - size / 2, minY), maxY),
      };
    });
  };

  const closeCropper = () => {
    setShowCropper(false);
    setCropSource("");
    setDragging(false);
    setCropBounds({ x: 0, y: 0, width: 0, height: 0 });
    if (cropSourceUrlRef.current) {
      URL.revokeObjectURL(cropSourceUrlRef.current);
      cropSourceUrlRef.current = "";
    }
  };

  const applyCrop = () => {
    if (!cropImgRef.current) return;
    const img = cropImgRef.current;
    const bounds = getDisplayedImageBounds(img);
    const safeBounds = bounds.width > 0 && bounds.height > 0
      ? bounds
      : { x: 0, y: 0, width: img.clientWidth, height: img.clientHeight };
    if (safeBounds.width <= 0 || safeBounds.height <= 0) return;
    const safeRect = clampCropRectToBounds(cropRect, safeBounds);

    const scaleX = img.naturalWidth / safeBounds.width;
    const scaleY = img.naturalHeight / safeBounds.height;
    const sx = Math.max((safeRect.x - safeBounds.x) * scaleX, 0);
    const sy = Math.max((safeRect.y - safeBounds.y) * scaleY, 0);
    const sWidth = Math.min(Math.max(safeRect.size * scaleX, 1), img.naturalWidth - sx);
    const sHeight = Math.min(Math.max(safeRect.size * scaleY, 1), img.naturalHeight - sy);

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_CROP_SIZE;
    canvas.height = OUTPUT_CROP_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, OUTPUT_CROP_SIZE, OUTPUT_CROP_SIZE);

    canvas.toBlob((blob) => {
      if (!blob) return;
      setCroppedPhotoBlob(blob);
      if (photoObjectUrlRef.current) URL.revokeObjectURL(photoObjectUrlRef.current);
      const preview = URL.createObjectURL(blob);
      photoObjectUrlRef.current = preview;
      setPhotoPreview(preview);
      closeCropper();
    }, "image/jpeg", 0.92);
  };

  const pushToast = (type, text) => {
    setToast({ type, text });
  };

  const clearResumeInputValue = () => {
    if (resumeInputRef.current) resumeInputRef.current.value = "";
  };

  const clearResumeSelection = () => {
    setResumeFile(null);
    setResumeClientFile(null);
    setResumeUploadProgress(0);
    setResumeStatusText("");
    clearResumeInputValue();
  };

  const clearResumeError = () => {
    setErrors((prev) => {
      if (!prev.resume) return prev;
      const next = { ...prev };
      delete next.resume;
      return next;
    });
  };

  const openResumePicker = (action = "upload") => {
    resumeActionRef.current = action;
    if (!resumeInputRef.current) return;
    resumeInputRef.current.value = "";
    resumeInputRef.current.click();
  };

  const uploadResumeToBackend = async (file, options = {}) => {
    const { silent = false } = options;
    const validation = validateResumeUploadFile(file);
    if (!validation.valid) {
      if (!silent) {
        setBanner({ type: "error", text: validation.message });
        pushToast("error", validation.message);
      }
      return { ok: false, queued: false, message: validation.message };
    }

    setUploadingResume(true);
    setResumeUploadProgress(0);
    setResumeStatusText("Uploading resume...");
    setResumeClientFile(file);
    clearResumeError();

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await api.post("/v1/candidate/resume", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (!event.total) return;
          setResumeUploadProgress(Math.round((event.loaded * 100) / event.total));
        },
      });
      const payload = unwrap(response) || response?.data || {};
      const uploadedUrl = pick(
        payload,
        ["resume_url", "resumeUrl", "resume_path", "resumePath", "url", "path"],
        "",
      );
      if (uploadedUrl) setResumeUrl(uploadedUrl);
      setResumeFile(null);
      setLastUploadedResumeName(file.name);
      setResumeUploadProgress(100);
      setResumeStatusText("Resume uploaded successfully.");
      clearResumeError();
      if (!silent) {
        setBanner({ type: "success", text: "Resume uploaded successfully." });
      }
      return { ok: true, queued: false, url: uploadedUrl };
    } catch (error) {
      const status = Number(error?.response?.status || 0);
      const queueOnSaveStatuses = new Set([400, 404, 405, 422]);
      if (queueOnSaveStatuses.has(status)) {
        setResumeFile(file);
        setResumeStatusText("Resume selected. It will upload when you save your profile.");
        if (!silent) {
          setBanner({
            type: "success",
            text: "Resume selected. It will upload when profile is saved.",
          });
        }
        return { ok: false, queued: true };
      }

      const message = getApiErrorMessage(error, "Failed to upload resume.");
      if (!silent) {
        setBanner({ type: "error", text: message });
        pushToast("error", message);
      }
      return { ok: false, queued: false, message };
    } finally {
      setUploadingResume(false);
    }
  };

  const parseResumeFromFile = async (file) => {
    const validation = validateResumeUploadFile(file);
    if (!validation.valid) {
      setBanner({ type: "error", text: validation.message });
      pushToast("error", validation.message);
      return;
    }

    setParsingResume(true);
    setResumeStatusText("Parsing your resume...");
    setResumeClientFile(file);
    clearResumeError();

    try {
      const shouldUploadBeforeParse =
        !resumeUrl || !lastUploadedResumeName || lastUploadedResumeName !== file.name;
      if (shouldUploadBeforeParse) {
        const uploadResult = await uploadResumeToBackend(file, { silent: true });
        if (!uploadResult.ok && !uploadResult.queued) {
          const msg = uploadResult.message || "Unable to upload resume for parsing.";
          setBanner({ type: "error", text: `${msg} You can continue with manual entry.` });
          pushToast("error", msg);
          return;
        }
      }

      const parsePayload = new FormData();
      parsePayload.append("file", file);
      const parseResponse = await api.post("/v1/candidate/resume/parse", parsePayload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const raw = unwrap(parseResponse) || parseResponse?.data || {};
      const parsedSource = raw?.parsed || raw?.data?.parsed || raw;
      const parsedNormalized = normalizeParsedResumeToForm(parsedSource);

      if (!hasParsedResumeContent(parsedNormalized)) {
        const msg = "No usable details were found in this resume.";
        setBanner({
          type: "error",
          text: `${msg} Please fill details manually or try another resume.`,
        });
        pushToast("error", msg);
        return;
      }

      setParsedResumeDraft(parsedNormalized);
      setParseConflicts(buildResumeParseConflicts(form, parsedNormalized));
      setShowParsePreview(true);
      setResumeStatusText("Resume parsed. Review details before applying.");
      setBanner({ type: "success", text: "Resume parsed successfully." });
      pushToast("success", "Resume parsed successfully.");
    } catch (error) {
      const message = getApiErrorMessage(
        error,
        "Unable to parse resume right now.",
      );
      setBanner({
        type: "error",
        text: `${message} You can continue with manual entry.`,
      });
      pushToast("error", "Could not parse resume. You can continue manually.");
    } finally {
      setParsingResume(false);
    }
  };

  const onResumeActionFilePicked = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setResumeClientFile(file);
    setResumeStatusText(`Selected: ${file.name}`);
    clearResumeError();

    if (resumeActionRef.current === "parse") {
      await parseResumeFromFile(file);
    } else {
      await uploadResumeToBackend(file);
    }
    clearResumeInputValue();
  };

  const onParseResumeClick = async () => {
    if (parsingResume || uploadingResume) return;
    if (resumeClientFile) {
      await parseResumeFromFile(resumeClientFile);
      return;
    }
    openResumePicker("parse");
  };

  const acceptParsedResume = () => {
    if (!parsedResumeDraft) return;
    setForm((prev) => mergeParsedResumeIntoForm(prev, parsedResumeDraft));
    setShowParsePreview(false);
    setParsedResumeDraft(null);
    setParseConflicts([]);
    setBanner({
      type: "success",
      text: "Parsed details added. Please review and save your profile.",
    });
    pushToast("success", "Details filled from resume.");
  };

  const keepManualResumeEntry = () => {
    setShowParsePreview(false);
  };

  const save = async () => {
    if (!validateAll()) {
      setBanner({ type: "error", text: "Please fix highlighted fields." });
      return;
    }

    setSaving(true);
    setBanner(null);

    const candidateId = routeId || recordId || null;
    const selfUpdatePayload = buildSelfUpdatePayload(form);
    const multipartConfig = { headers: { "Content-Type": "multipart/form-data" } };
    try {
      let response;

      // Candidate self-portal should save against /v1/candidate/me first.
      if (isCandidateSelfUser) {
        let resumeUploadData = null;
        let photoUploadData = null;
        try {
          response = await api.put("/v1/candidate/me", selfUpdatePayload);
        } catch (selfError) {
          const status = Number(selfError?.response?.status);
          if (status === 405) {
            response = await api.patch("/v1/candidate/me", selfUpdatePayload);
          } else if (status === 404) {
            const createPayload = buildPayload(form, croppedPhotoBlob, resumeFile);
            if (candidateId) {
              response = await api.put(`/v1/candidates/${candidateId}`, createPayload, multipartConfig);
            } else {
              response = await api.post("/v1/candidates", createPayload, multipartConfig);
            }

            const mapped = mapCandidate(unwrap(response) || {});
            const nextId = mapped.id || candidateId || null;
            const nextPhotoUrl = mapped.photoUrl || photoPreview || "";
            const nextResumeUrl = mapped.resumeUrl || resumeUrl || "";
            setForm(mapped.data);
            setOriginal(mapped.data);
            setRecordId(nextId);
            setPhotoPreview(nextPhotoUrl);
            setResumeUrl(nextResumeUrl);
            setLastUploadedResumeName(
              String(nextResumeUrl || "")
                .split("/")
                .pop() || "",
            );
            setOriginalPhotoPreview(nextPhotoUrl);
            setOriginalResumeUrl(nextResumeUrl);
            setCroppedPhotoBlob(null);
            clearResumeSelection();
            setParsedResumeDraft(null);
            setParseConflicts([]);
            setShowParsePreview(false);
            setMode("view");
            setCurrentStep(0);
            setCompleted(new Set(STEPS.map((_, index) => index)));
            setBanner({ type: "success", text: "Profile saved successfully." });
            if (!routeId && nextId) navigate(`/candidate/profile/${nextId}`, { replace: true });
            return;
          } else {
            throw selfError;
          }
        }

        if (resumeFile) {
          const resumePayload = new FormData();
          resumePayload.append("file", resumeFile);
          const resumeResponse = await api.post(
            "/v1/candidate/resume",
            resumePayload,
            multipartConfig,
          );
          resumeUploadData = unwrap(resumeResponse) || resumeResponse?.data || null;
        }

        if (croppedPhotoBlob) {
          const photoPayload = new FormData();
          photoPayload.append("file", croppedPhotoBlob, "profile-photo.jpg");
          const photoResponse = await api.post(
            "/v1/candidate/me/photo",
            photoPayload,
            multipartConfig,
          );
          photoUploadData = unwrap(photoResponse) || photoResponse?.data || null;
        }

        try {
          response = await api.get("/v1/candidate/me");
        } catch {
          // Keep last successful response if refresh fails
        }

        const mapped = mapCandidate(unwrap(response) || {});
        const uploadedPhotoUrl =
          photoUploadData?.photo_url || photoUploadData?.photoUrl || "";
        const uploadedResumeUrl =
          resumeUploadData?.resume_url || resumeUploadData?.resumeUrl || "";
        const nextPhotoUrl = mapped.photoUrl || uploadedPhotoUrl || photoPreview || "";
        const nextResumeUrl = mapped.resumeUrl || uploadedResumeUrl || resumeUrl || "";
        const nextId = mapped.id || candidateId || null;

        setForm(mapped.data);
        setOriginal(mapped.data);
        setRecordId(nextId);
        setPhotoPreview(nextPhotoUrl);
        setResumeUrl(nextResumeUrl);
        setLastUploadedResumeName(
          String(nextResumeUrl || "")
            .split("/")
            .pop() || "",
        );
        setOriginalPhotoPreview(nextPhotoUrl);
        setOriginalResumeUrl(nextResumeUrl);
        setCroppedPhotoBlob(null);
        clearResumeSelection();
        setParsedResumeDraft(null);
        setParseConflicts([]);
        setShowParsePreview(false);
        setMode("view");
        setCurrentStep(0);
        setCompleted(new Set(STEPS.map((_, index) => index)));
        setBanner({ type: "success", text: "Profile saved successfully." });
        if (!routeId && nextId) navigate(`/candidate/profile/${nextId}`, { replace: true });
        return;
      }

      const payload = buildPayload(form, croppedPhotoBlob, resumeFile);
      if (candidateId) {
        response = await api.put(`/v1/candidates/${candidateId}`, payload, multipartConfig);
      } else {
        response = await api.post("/v1/candidates", payload, multipartConfig);
      }

      const mapped = mapCandidate(unwrap(response) || {});
      const nextId = mapped.id || candidateId || null;
      const nextPhotoUrl = mapped.photoUrl || photoPreview || "";
      const nextResumeUrl = mapped.resumeUrl || resumeUrl || "";
      setForm(mapped.data);
      setOriginal(mapped.data);
      setRecordId(nextId);
      setPhotoPreview(nextPhotoUrl);
      setResumeUrl(nextResumeUrl);
      setLastUploadedResumeName(
        String(nextResumeUrl || "")
          .split("/")
          .pop() || "",
      );
      setOriginalPhotoPreview(nextPhotoUrl);
      setOriginalResumeUrl(nextResumeUrl);
      setCroppedPhotoBlob(null);
      clearResumeSelection();
      setParsedResumeDraft(null);
      setParseConflicts([]);
      setShowParsePreview(false);
      setMode("view");
      setCurrentStep(0);
      setCompleted(new Set(STEPS.map((_, index) => index)));
      setBanner({ type: "success", text: "Profile saved successfully." });
      if (!routeId && nextId) navigate(`/candidate/profile/${nextId}`, { replace: true });
    } catch (error) {
      console.error(error);
      setBanner({
        type: "error",
        text: getApiErrorMessage(error, "Failed to save profile"),
      });
    } finally {
      setSaving(false);
    }
  };

  const inputFor = (field) => {
    const required = REQUIRED.has(field.key);
    const err = errors[field.key];

    if (field.type === "add-more-education") {
      const rows = Array.isArray(form.additionalEducations)
        ? form.additionalEducations
        : [];
      return (
        <div className="cp-field cp-full" key={field.key}>
          <div className="cp-repeatable-header">
            <span className="cp-label">{field.label}</span>
            <button
              type="button"
              className="cp-btn cp-btn-secondary"
              onClick={() => addListItem("additionalEducations", EMPTY_EDUCATION)}
            >
              + Add More Education
            </button>
          </div>
          {rows.length === 0 ? (
            <p className="cp-hint">No additional education added.</p>
          ) : (
            <div className="cp-repeatable-list">
              {rows.map((row, index) => (
                <div className="cp-repeatable-card" key={`edu-${index}`}>
                  <div className="cp-repeatable-grid">
                    <label className="cp-field">
                      <span className="cp-label">Highest Degree</span>
                      <input
                        type="text"
                        className="cp-input"
                        value={row.highestDegree || ""}
                        onChange={(e) =>
                          updateListItem(
                            "additionalEducations",
                            index,
                            "highestDegree",
                            e.target.value,
                          )
                        }
                      />
                    </label>
                    <label className="cp-field">
                      <span className="cp-label">College Name</span>
                      <input
                        type="text"
                        className="cp-input"
                        value={row.collegeName || ""}
                        onChange={(e) =>
                          updateListItem(
                            "additionalEducations",
                            index,
                            "collegeName",
                            e.target.value,
                          )
                        }
                      />
                    </label>
                    <label className="cp-field">
                      <span className="cp-label">CGPA / %</span>
                      <input
                        type="text"
                        className="cp-input"
                        value={row.cgpaPercentage || ""}
                        onChange={(e) =>
                          updateListItem(
                            "additionalEducations",
                            index,
                            "cgpaPercentage",
                            e.target.value,
                          )
                        }
                      />
                    </label>
                  </div>
                  <div className="cp-repeatable-actions">
                    <button
                      type="button"
                      className="cp-btn cp-btn-ghost"
                      onClick={() => removeListItem("additionalEducations", index)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {err && <span className="cp-error">{err}</span>}
        </div>
      );
    }

    if (field.type === "add-more-certification") {
      const rows = Array.isArray(form.additionalCertifications)
        ? form.additionalCertifications
        : [];
      return (
        <div className="cp-field cp-full" key={field.key}>
          <div className="cp-repeatable-header">
            <span className="cp-label">{field.label}</span>
            <button
              type="button"
              className="cp-btn cp-btn-secondary"
              onClick={() =>
                addListItem("additionalCertifications", EMPTY_CERTIFICATION)
              }
            >
              + Add More Certification
            </button>
          </div>
          {rows.length === 0 ? (
            <p className="cp-hint">No additional certification added.</p>
          ) : (
            <div className="cp-repeatable-list">
              {rows.map((row, index) => (
                <div className="cp-repeatable-card" key={`cert-${index}`}>
                  <div className="cp-repeatable-grid">
                    <label className="cp-field">
                      <span className="cp-label">Certification Name</span>
                      <input
                        type="text"
                        className="cp-input"
                        value={row.certificationName || ""}
                        onChange={(e) =>
                          updateListItem(
                            "additionalCertifications",
                            index,
                            "certificationName",
                            e.target.value,
                          )
                        }
                      />
                    </label>
                    <label className="cp-field">
                      <span className="cp-label">Credential ID</span>
                      <input
                        type="text"
                        className="cp-input"
                        value={row.certificationCredentialId || ""}
                        onChange={(e) =>
                          updateListItem(
                            "additionalCertifications",
                            index,
                            "certificationCredentialId",
                            e.target.value,
                          )
                        }
                      />
                    </label>
                    <label className="cp-field">
                      <span className="cp-label">Credential Link</span>
                      <input
                        type="text"
                        className="cp-input"
                        value={row.certificationCredentialLink || ""}
                        onChange={(e) =>
                          updateListItem(
                            "additionalCertifications",
                            index,
                            "certificationCredentialLink",
                            e.target.value,
                          )
                        }
                      />
                    </label>
                  </div>
                  <div className="cp-repeatable-actions">
                    <button
                      type="button"
                      className="cp-btn cp-btn-ghost"
                      onClick={() => removeListItem("additionalCertifications", index)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {err && <span className="cp-error">{err}</span>}
        </div>
      );
    }

    if (field.type === "add-more-experience") {
      const rows = Array.isArray(form.additionalExperiences)
        ? form.additionalExperiences
        : [];
      return (
        <div className="cp-field cp-full" key={field.key}>
          <div className="cp-repeatable-header">
            <span className="cp-label">{field.label}</span>
            <button
              type="button"
              className="cp-btn cp-btn-secondary"
              onClick={() => addListItem("additionalExperiences", EMPTY_EXPERIENCE)}
            >
              + Add More Experience
            </button>
          </div>
          {rows.length === 0 ? (
            <p className="cp-hint">No additional experience added.</p>
          ) : (
            <div className="cp-repeatable-list">
              {rows.map((row, index) => (
                <div className="cp-repeatable-card" key={`exp-${index}`}>
                  <div className="cp-repeatable-grid">
                    <label className="cp-field">
                      <span className="cp-label">Company Worked For</span>
                      <input
                        type="text"
                        className="cp-input"
                        value={row.experienceCompany || ""}
                        onChange={(e) =>
                          updateListItem(
                            "additionalExperiences",
                            index,
                            "experienceCompany",
                            e.target.value,
                          )
                        }
                      />
                    </label>
                    <label className="cp-field">
                      <span className="cp-label">Role</span>
                      <input
                        type="text"
                        className="cp-input"
                        value={row.experienceRole || ""}
                        onChange={(e) =>
                          updateListItem(
                            "additionalExperiences",
                            index,
                            "experienceRole",
                            e.target.value,
                          )
                        }
                      />
                    </label>
                    <label className="cp-field">
                      <span className="cp-label">Project Done</span>
                      <input
                        type="text"
                        className="cp-input"
                        value={row.experienceProject || ""}
                        onChange={(e) =>
                          updateListItem(
                            "additionalExperiences",
                            index,
                            "experienceProject",
                            e.target.value,
                          )
                        }
                      />
                    </label>
                    <label className="cp-field">
                      <span className="cp-label">Skills Learnt</span>
                      <input
                        type="text"
                        className="cp-input"
                        value={row.experienceSkillsLearnt || ""}
                        onChange={(e) =>
                          updateListItem(
                            "additionalExperiences",
                            index,
                            "experienceSkillsLearnt",
                            e.target.value,
                          )
                        }
                      />
                    </label>
                    <label className="cp-field">
                      <span className="cp-label">Years</span>
                      <input
                        type="text"
                        className="cp-input"
                        value={row.experienceYears || ""}
                        onChange={(e) =>
                          updateListItem(
                            "additionalExperiences",
                            index,
                            "experienceYears",
                            e.target.value,
                          )
                        }
                      />
                    </label>
                    <label className="cp-field">
                      <span className="cp-label">CTC There</span>
                      <input
                        type="text"
                        className="cp-input"
                        value={row.experienceCtc || ""}
                        onChange={(e) =>
                          updateListItem(
                            "additionalExperiences",
                            index,
                            "experienceCtc",
                            e.target.value,
                          )
                        }
                      />
                    </label>
                  </div>
                  <div className="cp-repeatable-actions">
                    <button
                      type="button"
                      className="cp-btn cp-btn-ghost"
                      onClick={() => removeListItem("additionalExperiences", index)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {err && <span className="cp-error">{err}</span>}
        </div>
      );
    }

    if (field.type === "photo") {
      return (
        <div className="cp-field cp-full" key={field.key}>
          <span className="cp-label">{field.label}{required && <span className="cp-required">*</span>}</span>
          <div className="cp-photo-row">
            <img src={photoSrc} alt="Candidate" className="cp-photo" />
            <div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="cp-hidden"
                onChange={openCropper}
              />
              <button
                type="button"
                className="cp-btn cp-btn-secondary"
                onClick={() => {
                  if (!photoInputRef.current) return;
                  photoInputRef.current.value = "";
                  photoInputRef.current.click();
                }}
              >
                Upload & Crop
              </button>
              <p className="cp-hint">Optional. Output: 300x300.</p>
            </div>
          </div>
          {err && <span className="cp-error">{err}</span>}
        </div>
      );
    }

    if (field.type === "file") {
      const isRequired = field.key === "resume";
      const selectedResumeName = resumeClientFile?.name || resumeFile?.name || "";
      const uploadedResumeHref = resumeUrl ? toUrl(resumeUrl) : "";
      const isBusy = uploadingResume || parsingResume;
      return (
        <div className="cp-field cp-full" key={field.key}>
          <span className="cp-label">
            {field.label}
            {isRequired && <span className="cp-required">*</span>}
          </span>
          <input ref={resumeInputRef} type="file" accept=".pdf,.doc,.docx" className="cp-hidden" onChange={onResumeActionFilePicked} />
          <div className={`cp-resume-panel ${err ? "cp-input-error" : ""}`}>
            <div className="cp-resume-actions-row">
              <button
                type="button"
                className="cp-btn cp-btn-primary cp-resume-action-btn"
                onClick={() => openResumePicker("upload")}
                disabled={isBusy}
              >
                <FileUp size={16} />
                <span>{uploadingResume ? "Uploading..." : "Upload Resume"}</span>
              </button>
              <button
                type="button"
                className="cp-btn cp-btn-secondary cp-resume-action-btn"
                onClick={onParseResumeClick}
                disabled={isBusy}
              >
                <FileSearch size={16} />
                <span>{parsingResume ? "Parsing..." : "Parse Resume"}</span>
              </button>
            </div>

            <div className="cp-resume-meta">
              <FileText size={16} />
              <div>
                <p className="cp-resume-file-name">
                  {selectedResumeName
                    ? `Selected: ${selectedResumeName}`
                    : resumeUrl
                      ? "Resume uploaded"
                      : "No resume selected"}
                </p>
                <p className="cp-hint">Accepted formats: PDF, DOC, DOCX. Max size: 5 MB.</p>
                {uploadedResumeHref && (
                  <a href={uploadedResumeHref} target="_blank" rel="noreferrer" className="cp-resume-link">
                    View uploaded resume
                  </a>
                )}
              </div>
            </div>

            {uploadingResume && (
              <div className="cp-upload-progress-wrap">
                <div className="cp-upload-progress-bar">
                  <div className="cp-upload-progress-fill" style={{ width: `${resumeUploadProgress}%` }} />
                </div>
                <span>{resumeUploadProgress}%</span>
              </div>
            )}

            {parsingResume && (
              <div className="cp-resume-parse-state">
                <span className="cp-inline-loader" />
                <span>Parsing your resume...</span>
              </div>
            )}

            {!parsingResume && hasValue(resumeStatusText) && (
              <p className="cp-hint cp-resume-status">{resumeStatusText}</p>
            )}
          </div>
          {err && <span className="cp-error">{err}</span>}
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <label className={`cp-field ${field.full ? "cp-full" : ""}`} key={field.key}>
          <span className="cp-label">{field.label}{required && <span className="cp-required">*</span>}</span>
          <textarea
            className={`cp-input cp-textarea ${err ? "cp-input-error" : ""}`}
            rows={4}
            value={form[field.key] || ""}
            onChange={(e) => setField(field.key, e.target.value)}
            onBlur={(e) => setField(field.key, normalizeText(e.target.value))}
          />
          {field.hint && <span className="cp-hint">{field.hint}</span>}
          {err && <span className="cp-error">{err}</span>}
        </label>
      );
    }

    if (field.type === "checkbox") {
      return (
        <label className="cp-field cp-checkbox" key={field.key}>
          <span className="cp-label">{field.label}</span>
          <input type="checkbox" checked={Boolean(form[field.key])} onChange={(e) => setField(field.key, e.target.checked)} />
        </label>
      );
    }

    if (field.type === "select") {
      return (
        <label className="cp-field" key={field.key}>
          <span className="cp-label">{field.label}{required && <span className="cp-required">*</span>}</span>
          <select className={`cp-input ${err ? "cp-input-error" : ""}`} value={form[field.key] || ""} onChange={(e) => setField(field.key, e.target.value)}>
            {field.options.map((opt) => (
              <option key={opt || "empty"} value={opt}>{opt || "Select"}</option>
            ))}
          </select>
          {field.hint && <span className="cp-hint">{field.hint}</span>}
          {err && <span className="cp-error">{err}</span>}
        </label>
      );
    }

    return (
      <label className="cp-field" key={field.key}>
        <span className="cp-label">{field.label}{required && <span className="cp-required">*</span>}</span>
        <input
          type={field.type || "text"}
          className={`cp-input ${err ? "cp-input-error" : ""}`}
          value={form[field.key] || ""}
          onChange={(e) => setField(field.key, e.target.value)}
          onBlur={(e) => setField(field.key, normalizeText(e.target.value))}
        />
        {field.hint && <span className="cp-hint">{field.hint}</span>}
        {err && <span className="cp-error">{err}</span>}
      </label>
    );
  };

  if (loading) {
    return (
      <div className="cp-loading">
        <div className="cp-spinner" />
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="cp-page">
      {banner && <div className={`cp-banner ${banner.type === "error" ? "cp-banner-error" : "cp-banner-success"}`}>{banner.text}</div>}
      {toast && (
        <div className={`cp-toast ${toast.type === "error" ? "cp-toast-error" : "cp-toast-success"}`}>
          {toast.type === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toast.text}</span>
        </div>
      )}

      <section className="cp-header">
        <div className="cp-head-left">
          <img src={photoSrc} alt="Candidate" className="cp-head-photo" />
          <div>
            <h1>{fullName}</h1>
            <p>{form.designation || "Designation not added"}</p>
            <p>{form.experienceYears ? `${form.experienceYears} yrs experience` : "Experience not added"}</p>
          </div>
        </div>
        <div>
          {mode === "view" ? (
            <button type="button" className="cp-btn cp-btn-primary" onClick={() => { setMode("edit"); setCurrentStep(0); setErrors({}); setBanner(null); setForm(original); }}>
              Edit Profile
            </button>
          ) : (
            <button type="button" className="cp-btn cp-btn-ghost" onClick={() => {
              if (mode === "edit") {
                setForm(original);
                setPhotoPreview(originalPhotoPreview || "");
                setResumeUrl(originalResumeUrl || "");
                setCroppedPhotoBlob(null);
                clearResumeSelection();
                setLastUploadedResumeName(
                  String(originalResumeUrl || "")
                    .split("/")
                    .pop() || "",
                );
                setParsedResumeDraft(null);
                setParseConflicts([]);
                setShowParsePreview(false);
                setMode("view");
              } else {
                navigate(-1);
              }
            }}>
              {mode === "edit" ? "Cancel Edit" : "Back"}
            </button>
          )}
        </div>
      </section>

      {mode === "view" ? (
        <section className="cp-view">
          {STEP_FIELDS.map((group, idx) => (
            <div className="cp-view-card" key={STEPS[idx]}>
              <h2>{STEPS[idx]}</h2>
              <div className="cp-view-grid">
                {group
                  .filter(
                    (f) =>
                      !String(f.type || "").startsWith("add-more-") &&
                      f.type !== "photo" &&
                      f.type !== "file",
                  )
                  .map((f) => (
                  <div className={`cp-view-item ${f.full ? "cp-full" : ""}`} key={f.key}>
                    <span>{f.label}</span>
                    <strong>{f.key === "readyToRelocate" ? (form[f.key] ? "Yes" : "No") : form[f.key] || "-"}</strong>
                  </div>
                ))}
                {idx === 3 &&
                  Array.isArray(form.additionalEducations) &&
                  form.additionalEducations.length > 0 && (
                    <div className="cp-full">
                      <span className="cp-label">Additional Education</span>
                      <div className="cp-repeatable-list">
                        {form.additionalEducations.map((row, rowIndex) => (
                          <div className="cp-repeatable-card" key={`view-edu-${rowIndex}`}>
                            <div className="cp-view-grid">
                              <div className="cp-view-item">
                                <span>Highest Degree</span>
                                <strong>{row.highestDegree || "-"}</strong>
                              </div>
                              <div className="cp-view-item">
                                <span>College Name</span>
                                <strong>{row.collegeName || "-"}</strong>
                              </div>
                              <div className="cp-view-item">
                                <span>CGPA / %</span>
                                <strong>{row.cgpaPercentage || "-"}</strong>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                {idx === 5 &&
                  Array.isArray(form.additionalCertifications) &&
                  form.additionalCertifications.length > 0 && (
                    <div className="cp-full">
                      <span className="cp-label">Additional Certifications</span>
                      <div className="cp-repeatable-list">
                        {form.additionalCertifications.map((row, rowIndex) => (
                          <div className="cp-repeatable-card" key={`view-cert-${rowIndex}`}>
                            <div className="cp-view-grid">
                              <div className="cp-view-item">
                                <span>Certification Name</span>
                                <strong>{row.certificationName || "-"}</strong>
                              </div>
                              <div className="cp-view-item">
                                <span>Credential ID</span>
                                <strong>{row.certificationCredentialId || "-"}</strong>
                              </div>
                              <div className="cp-view-item">
                                <span>Credential Link</span>
                                <strong>{row.certificationCredentialLink || "-"}</strong>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                {idx === 6 &&
                  Array.isArray(form.additionalExperiences) &&
                  form.additionalExperiences.length > 0 && (
                    <div className="cp-full">
                      <span className="cp-label">Additional Experience</span>
                      <div className="cp-repeatable-list">
                        {form.additionalExperiences.map((row, rowIndex) => (
                          <div className="cp-repeatable-card" key={`view-exp-${rowIndex}`}>
                            <div className="cp-view-grid">
                              <div className="cp-view-item">
                                <span>Company Worked For</span>
                                <strong>{row.experienceCompany || "-"}</strong>
                              </div>
                              <div className="cp-view-item">
                                <span>Role</span>
                                <strong>{row.experienceRole || "-"}</strong>
                              </div>
                              <div className="cp-view-item">
                                <span>Project Done</span>
                                <strong>{row.experienceProject || "-"}</strong>
                              </div>
                              <div className="cp-view-item">
                                <span>Skills Learnt</span>
                                <strong>{row.experienceSkillsLearnt || "-"}</strong>
                              </div>
                              <div className="cp-view-item">
                                <span>Years</span>
                                <strong>{row.experienceYears || "-"}</strong>
                              </div>
                              <div className="cp-view-item">
                                <span>CTC There</span>
                                <strong>{row.experienceCtc || "-"}</strong>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </div>
          ))}
        </section>
      ) : (
        <section className="cp-form-wrap">
          <div className="cp-steps">
            {STEPS.map((step, i) => (
              <button key={step} type="button" className={`cp-step ${i === currentStep ? "active" : ""} ${completed.has(i) || i < currentStep ? "done" : ""}`} onClick={() => onJump(i)}>
                <span>{completed.has(i) || i < currentStep ? "OK" : i + 1}</span>
                <small>{step}</small>
              </button>
            ))}
          </div>

          <div className="cp-card">
            <h2>{`${currentStep + 1}. ${STEPS[currentStep]}`}</h2>
            <div className="cp-grid">{STEP_FIELDS[currentStep].map((field) => inputFor(field))}</div>

            <div className="cp-actions">
              <button type="button" className="cp-btn cp-btn-ghost" onClick={onPrev} disabled={currentStep === 0}>Previous</button>
              {currentStep < STEPS.length - 1 ? (
                <button type="button" className="cp-btn cp-btn-primary" onClick={onNext}>Next</button>
              ) : (
                <button type="button" className="cp-btn cp-btn-primary" onClick={save} disabled={saving}>{saving ? "Saving..." : mode === "edit" ? "Save Profile" : "Complete Profile"}</button>
              )}
            </div>
          </div>
        </section>
      )}

      {showCropper && (
        <div className="cp-crop-backdrop">
          <div className="cp-crop-modal">
            <h3>Crop Photo</h3>
            <p>Drag crop square and adjust size.</p>
            <div className="cp-crop-wrap">
              <img ref={cropImgRef} src={cropSource} alt="Crop source" className="cp-crop-image" onLoad={onCropImageLoad} draggable={false} />
              <div className="cp-crop-box" style={{ left: cropRect.x, top: cropRect.y, width: cropRect.size, height: cropRect.size }} onMouseDown={onCropDown} />
            </div>
            <input
              type="range"
              min={cropMinSize}
              max={cropMaxSize}
              value={Math.round(Math.min(Math.max(cropRect.size, cropMinSize), cropMaxSize))}
              onChange={onCropSize}
            />
            <div className="cp-actions">
              <button type="button" className="cp-btn cp-btn-ghost" onClick={closeCropper}>Cancel</button>
              <button type="button" className="cp-btn cp-btn-primary" onClick={applyCrop}>Apply Crop</button>
            </div>
          </div>
        </div>
      )}

      {showParsePreview && parsedResumeDraft && (
        <div className="cp-crop-backdrop">
          <div className="cp-parse-modal">
            <h3>
              <Sparkles size={18} />
              <span>We found these details from your resume.</span>
            </h3>
            <p>Review these details, then choose whether to auto-fill your profile.</p>

            <div className="cp-parse-preview-list">
              {resumePreviewRows.length > 0 ? (
                resumePreviewRows.map((item) => (
                  <div className="cp-parse-preview-item" key={`${item.label}-${item.value}`}>
                    <strong>{item.label}</strong>
                    <span>{item.value}</span>
                  </div>
                ))
              ) : (
                <p className="cp-hint">No details were extracted.</p>
              )}
            </div>

            {parseConflicts.length > 0 && (
              <div className="cp-parse-conflict-box">
                <p className="cp-parse-conflict-title">
                  Existing data detected in {parseConflicts.length} field{parseConflicts.length > 1 ? "s" : ""}.
                </p>
                <ul className="cp-parse-conflict-list">
                  {parseConflicts.map((conflict) => (
                    <li key={conflict.key}>
                      <strong>{conflict.label}:</strong> existing value will be replaced after confirmation.
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="cp-actions">
              <button type="button" className="cp-btn cp-btn-ghost" onClick={keepManualResumeEntry}>
                Edit Manually
              </button>
              <button type="button" className="cp-btn cp-btn-primary" onClick={acceptParsedResume}>
                Accept & Fill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

