
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../api/axios";
import {
  FiFileText,
  FiUpload,
  FiFilePlus,
  FiDownload,
  FiAlertCircle,
  FiCheckCircle,
} from "react-icons/fi";

const resumeValidation = {
  allowedTypes: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ],
  allowedExts: [".pdf", ".doc", ".docx", ".txt"],
  maxSize: 5 * 1024 * 1024,
  errorMessages: {
    invalidType: "Please upload PDF, DOC, DOCX, or TXT files only",
    tooLarge: "File size must be less than 5MB",
    uploadFailed: "Upload failed. Please try again",
  },
};

const excelValidation = {
  allowedExts: [".xlsx", ".csv"],
  maxSize: 10 * 1024 * 1024,
  maxRows: 5000,
};

const MAX_RESUME_BATCH_FILES = 50;
const BULK_UPLOAD_STATUS_POLL_MS = 1200;
const BULK_UPLOAD_STATUS_TIMEOUT_MS = 10 * 60 * 1000;

const uploadStages = {
  uploading: { message: "Uploading file...", progress: 25 },
  parsing: { message: "Parsing resume...", progress: 50 },
  validating: { message: "Validating data...", progress: 75 },
  complete: { message: "Resume parsed successfully!", progress: 100 },
  importing: { message: "Importing candidate...", progress: 90 },
};

const DEFAULT_EXCEL_SOURCE = "Excel Upload";
const ADDITIONAL_BLOCK_COUNT = 2; // Supports Education/Certification/Experience 2 and 3

const FIELD_OPTIONS = [
  { value: "", label: "-- Ignore --" },
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone Number" },
  { value: "noticePeriod", label: "Notice Period" },
  { value: "gender", label: "Gender" },
  { value: "dateOfBirth", label: "DOB (YYYY-MM-DD)" },
  { value: "currentAddress", label: "Current Address" },
  { value: "permanentAddress", label: "Permanent Address" },
  { value: "city", label: "City" },
  { value: "pincode", label: "Pincode" },
  { value: "readyToRelocate", label: "Ready To Relocate" },
  { value: "preferredLocation", label: "Preferred Location" },
  { value: "designation", label: "Designation" },
  { value: "currentCtc", label: "Current CTC" },
  { value: "expectedCtc", label: "Expected CTC" },
  { value: "highestDegree", label: "Highest Degree" },
  { value: "collegeName", label: "College Name" },
  { value: "cgpaPercentage", label: "CGPA / %" },
  { value: "skills", label: "Skills (comma separated)" },
  { value: "certificationName", label: "Certification Name" },
  { value: "certificationCredentialId", label: "Certification Credential ID" },
  { value: "certificationCredentialLink", label: "Certification Credential Link" },
  { value: "experienceCompany", label: "Experience Company" },
  { value: "experienceRole", label: "Experience Role" },
  { value: "experienceProject", label: "Experience Project" },
  { value: "experienceSkillsLearnt", label: "Experience Skills Learnt" },
  { value: "experienceYears", label: "Experience Years" },
  { value: "experienceCtc", label: "Experience CTC" },
  { value: "additionalEducation1HighestDegree", label: "Education 2 Highest Degree" },
  { value: "additionalEducation1CollegeName", label: "Education 2 College Name" },
  { value: "additionalEducation1CgpaPercentage", label: "Education 2 CGPA / %" },
  { value: "additionalEducation2HighestDegree", label: "Education 3 Highest Degree" },
  { value: "additionalEducation2CollegeName", label: "Education 3 College Name" },
  { value: "additionalEducation2CgpaPercentage", label: "Education 3 CGPA / %" },
  { value: "additionalCertification1Name", label: "Certification 2 Name" },
  { value: "additionalCertification1CredentialId", label: "Certification 2 Credential ID" },
  { value: "additionalCertification1CredentialLink", label: "Certification 2 Credential Link" },
  { value: "additionalCertification2Name", label: "Certification 3 Name" },
  { value: "additionalCertification2CredentialId", label: "Certification 3 Credential ID" },
  { value: "additionalCertification2CredentialLink", label: "Certification 3 Credential Link" },
  { value: "additionalExperience1Company", label: "Experience 2 Company" },
  { value: "additionalExperience1Role", label: "Experience 2 Role" },
  { value: "additionalExperience1Project", label: "Experience 2 Project" },
  { value: "additionalExperience1SkillsLearnt", label: "Experience 2 Skills Learnt" },
  { value: "additionalExperience1Years", label: "Experience 2 Years" },
  { value: "additionalExperience1Ctc", label: "Experience 2 CTC" },
  { value: "additionalExperience2Company", label: "Experience 3 Company" },
  { value: "additionalExperience2Role", label: "Experience 3 Role" },
  { value: "additionalExperience2Project", label: "Experience 3 Project" },
  { value: "additionalExperience2SkillsLearnt", label: "Experience 3 Skills Learnt" },
  { value: "additionalExperience2Years", label: "Experience 3 Years" },
  { value: "additionalExperience2Ctc", label: "Experience 3 CTC" },
  { value: "source", label: "Source" },
  { value: "appliedFor", label: "Applied For" },
];

const CANDIDATE_PROFILE_TEMPLATE_HEADERS = [
  "Name*",
  "Email*",
  "Phone Number*",
  "Notice Period",
  "Gender",
  "DOB",
  "Current Address",
  "Permanent Address",
  "City",
  "Pincode",
  "Ready To Relocate",
  "Preferred Location",
  "Designation*",
  "Current CTC",
  "Expected CTC",
  "Highest Degree",
  "College Name",
  "CGPA / %",
  "Skills*",
  "Certification Name",
  "Certification Credential ID",
  "Certification Credential Link",
  "Experience Company",
  "Experience Role",
  "Experience Project",
  "Experience Skills Learnt",
  "Experience Years*",
  "Experience CTC",
  "Education 2 Highest Degree",
  "Education 2 College Name",
  "Education 2 CGPA / %",
  "Education 3 Highest Degree",
  "Education 3 College Name",
  "Education 3 CGPA / %",
  "Certification 2 Name",
  "Certification 2 Credential ID",
  "Certification 2 Credential Link",
  "Certification 3 Name",
  "Certification 3 Credential ID",
  "Certification 3 Credential Link",
  "Experience 2 Company",
  "Experience 2 Role",
  "Experience 2 Project",
  "Experience 2 Skills Learnt",
  "Experience 2 Years",
  "Experience 2 CTC",
  "Experience 3 Company",
  "Experience 3 Role",
  "Experience 3 Project",
  "Experience 3 Skills Learnt",
  "Experience 3 Years",
  "Experience 3 CTC",
  "Source",
  "Applied For",
];

const BACKEND_BULK_TEMPLATE_HEADERS = [
  "Full Name*",
  "Email*",
  "Phone*",
  "Alternate Phone",
  "Date of Birth",
  "Gender",
  "Marital Status",
  "Current Company",
  "Current Job Title",
  "Total Experience (Years)",
  "Relevant Experience (Years)",
  "Current CTC",
  "Expected CTC",
  "Notice Period (Days)",
  "Current Location",
  "Preferred Location",
  "Skills",
  "Primary Skill",
  "Secondary Skill",
  "Qualification",
  "University/College",
  "Year of Graduation",
  "Certifications",
  "Resume URL",
  "LinkedIn URL",
  "GitHub URL",
  "Portfolio URL",
  "Address",
  "City",
  "State",
  "Country",
  "Pincode",
  "Willing to Relocate (Yes/No)",
  "Preferred Employment Type",
  "Availability to Join (Date)",
  "Last Working Day",
  "Recruiter Notes",
  "Source",
];

const normalizeHeader = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const titleCase = (value) =>
  String(value || "")
    .toLowerCase()
    .split(/\s+/)
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ""))
    .join(" ")
    .trim();

const normalizePhone = (value) => {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.startsWith("+")) return digits;
  return digits.length > 10 ? `+${digits}` : digits;
};

const normalizeSkills = (value) => {
  if (!value) return "";
  const list = Array.isArray(value)
    ? value
    : String(value)
        .split(/,|;|\n/)
        .map((skill) => skill.trim())
        .filter(Boolean);
  const unique = Array.from(new Set(list.map((item) => item.toLowerCase())));
  return unique.map((item) => item.trim()).filter(Boolean).join(", ");
};

const normalizeExperience = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(String(value).replace(/[^0-9.]/g, ""));
  if (Number.isNaN(num)) return "";
  return Math.round(num * 10) / 10;
};

const getFileExtension = (fileName = "") =>
  fileName.slice(fileName.lastIndexOf(".")).toLowerCase();

const validateResumeFile = (file) => {
  if (!file) return { valid: false, message: "No file selected" };
  const ext = getFileExtension(file.name);
  if (
    !resumeValidation.allowedTypes.includes(file.type) &&
    !resumeValidation.allowedExts.includes(ext)
  ) {
    return { valid: false, message: resumeValidation.errorMessages.invalidType };
  }
  if (file.size > resumeValidation.maxSize) {
    return { valid: false, message: resumeValidation.errorMessages.tooLarge };
  }
  return { valid: true };
};

const dedupeFiles = (files = []) => {
  const seen = new Set();
  return files.filter((file) => {
    if (!file) return false;
    const key = `${file.name || "file"}:${file.size || 0}:${file.lastModified || 0}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const validateResumeFiles = (files = []) => {
  const validFiles = [];
  const invalidEntries = [];

  files.forEach((file) => {
    const validation = validateResumeFile(file);
    if (validation.valid) {
      validFiles.push(file);
      return;
    }
    invalidEntries.push(`${file.name || "file"}: ${validation.message}`);
  });

  return { validFiles, invalidEntries };
};

const validateExcelFile = (file) => {
  if (!file) return { valid: false, message: "No file selected" };
  const ext = getFileExtension(file.name);
  if (!excelValidation.allowedExts.includes(ext)) {
    return { valid: false, message: "Please upload XLSX or CSV files only" };
  }
  if (file.size > excelValidation.maxSize) {
    return { valid: false, message: "File size must be less than 10MB" };
  }
  return { valid: true };
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const numberRegex = /^\d+(\.\d+)?$/;

const isValidUrl = (value) => {
  if (!value) return true;
  try {
    // eslint-disable-next-line no-new
    new URL(String(value).trim());
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

const parseBooleanFromText = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return false;
  return ["true", "yes", "y", "1"].includes(normalized);
};

const validateExcelRow = (row, rowNumber) => {
  const errors = [];
  const name = String(row.name || row.fullName || "").trim();
  const designation = String(row.designation || row.currentPosition || "").trim();
  const email = String(row.email || "").trim();
  const phone = String(row.phone || "").trim();
  const skills = splitCsv(row.skills);
  const experienceYears = String(
    row.experienceYears || row.totalExperience || "",
  ).trim();

  if (!name) errors.push(`Row ${rowNumber}: Missing name`);
  if (!email) errors.push(`Row ${rowNumber}: Missing email`);
  else if (!emailRegex.test(email))
    errors.push(`Row ${rowNumber}: Invalid email format`);
  else if (!email.toLowerCase().endsWith("@gmail.com"))
    errors.push(`Row ${rowNumber}: Only Gmail addresses are allowed`);
  if (!phone) errors.push(`Row ${rowNumber}: Missing phone`);
  else if (!/^\+?\d{10,15}$/.test(phone.replace(/\s/g, "")))
    errors.push(`Row ${rowNumber}: Invalid phone format`);
  if (!designation) errors.push(`Row ${rowNumber}: Missing designation`);
  if (skills.length === 0)
    errors.push(`Row ${rowNumber}: Missing skills (comma separated)`);
  if (!experienceYears) errors.push(`Row ${rowNumber}: Missing experience years`);
  else if (!numberRegex.test(experienceYears))
    errors.push(`Row ${rowNumber}: Experience years must be numeric`);

  const pincode = String(row.pincode || "").trim();
  if (pincode && !/^\d{6}$/.test(pincode)) {
    errors.push(`Row ${rowNumber}: Pincode must be 6 digits`);
  }

  const certLinks = [
    row.certificationCredentialLink,
    row.additionalCertification1CredentialLink,
    row.additionalCertification2CredentialLink,
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  certLinks.forEach((link) => {
    if (!isValidUrl(link)) {
      errors.push(`Row ${rowNumber}: Invalid certification URL`);
    }
  });

  const additionalYears = [
    row.additionalExperience1Years,
    row.additionalExperience2Years,
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  additionalYears.forEach((years) => {
    if (!numberRegex.test(years)) {
      errors.push(`Row ${rowNumber}: Additional experience years must be numeric`);
    }
  });

  if (row.dateOfBirth) {
    const date = new Date(String(row.dateOfBirth));
    if (Number.isNaN(date.getTime())) {
      errors.push(`Row ${rowNumber}: DOB must be a valid date`);
    }
  }

  return errors;
};

const detectDuplicates = (rows = []) => {
  const duplicates = [];
  const seen = new Set();

  rows.forEach((row, index) => {
    const email = String(row.email || "").trim().toLowerCase();
    const phone = String(row.phone || "").replace(/\D/g, "");
    if (!email && !phone) return;
    const key = `${email}|${phone}`;

    if (seen.has(key)) {
      duplicates.push({ row: index + 2, reason: "Duplicate in file", key });
    }

    seen.add(key);
  });

  return duplicates;
};

const autoMapField = (header) => {
  const normalized = normalizeHeader(header);
  if (!normalized) return "";

  const educationMatch = normalized.match(
    /^education\s*(\d+)\s*(highest degree|degree|college name|college|cgpa|percentage)$/,
  );
  if (educationMatch) {
    const blockNumber = Number(educationMatch[1]);
    if (blockNumber >= 2 && blockNumber <= ADDITIONAL_BLOCK_COUNT + 1) {
      const extraIndex = blockNumber - 1;
      const fieldType = educationMatch[2];
      if (fieldType.includes("degree")) {
        return `additionalEducation${extraIndex}HighestDegree`;
      }
      if (fieldType.includes("college")) {
        return `additionalEducation${extraIndex}CollegeName`;
      }
      return `additionalEducation${extraIndex}CgpaPercentage`;
    }
  }

  const certificationMatch = normalized.match(
    /^certification\s*(\d+)\s*(name|credential id|id|credential link|link|url)$/,
  );
  if (certificationMatch) {
    const blockNumber = Number(certificationMatch[1]);
    if (blockNumber >= 2 && blockNumber <= ADDITIONAL_BLOCK_COUNT + 1) {
      const extraIndex = blockNumber - 1;
      const fieldType = certificationMatch[2];
      if (fieldType === "name") return `additionalCertification${extraIndex}Name`;
      if (fieldType.includes("id")) {
        return `additionalCertification${extraIndex}CredentialId`;
      }
      return `additionalCertification${extraIndex}CredentialLink`;
    }
  }

  const experienceMatch = normalized.match(
    /^experience\s*(\d+)\s*(company|role|project|skills learnt|skills learned|skills|years|ctc)$/,
  );
  if (experienceMatch) {
    const blockNumber = Number(experienceMatch[1]);
    if (blockNumber >= 2 && blockNumber <= ADDITIONAL_BLOCK_COUNT + 1) {
      const extraIndex = blockNumber - 1;
      const fieldType = experienceMatch[2];
      if (fieldType === "company") return `additionalExperience${extraIndex}Company`;
      if (fieldType === "role") return `additionalExperience${extraIndex}Role`;
      if (fieldType === "project") return `additionalExperience${extraIndex}Project`;
      if (fieldType.includes("skills")) {
        return `additionalExperience${extraIndex}SkillsLearnt`;
      }
      if (fieldType === "years") return `additionalExperience${extraIndex}Years`;
      return `additionalExperience${extraIndex}Ctc`;
    }
  }

  if (normalized.includes("full") && normalized.includes("name")) return "name";
  if (normalized === "name") return "name";
  if (normalized.includes("email")) return "email";
  if (normalized.includes("phone") || normalized.includes("mobile")) return "phone";
  if (normalized === "notice period" || normalized.includes("notice")) return "noticePeriod";
  if (normalized === "gender") return "gender";
  if (normalized.includes("dob") || normalized.includes("date of birth")) {
    return "dateOfBirth";
  }
  if (normalized.includes("current address")) return "currentAddress";
  if (normalized.includes("permanent address")) return "permanentAddress";
  if (normalized === "city") return "city";
  if (normalized.includes("pincode") || normalized.includes("pin code")) {
    return "pincode";
  }
  if (normalized.includes("ready to relocate") || normalized.includes("willing to relocate")) {
    return "readyToRelocate";
  }
  if (normalized.includes("preferred location")) return "preferredLocation";
  if (
    normalized.includes("designation") ||
    normalized.includes("current position") ||
    normalized.includes("job title")
  ) {
    return "designation";
  }
  if (normalized.includes("current ctc")) return "currentCtc";
  if (normalized.includes("expected ctc")) return "expectedCtc";
  if (normalized.includes("highest degree")) return "highestDegree";
  if (normalized.includes("college")) return "collegeName";
  if (normalized.includes("cgpa") || normalized.includes("percentage")) {
    return "cgpaPercentage";
  }
  if (normalized.includes("skill")) return "skills";
  if (normalized === "certification name") return "certificationName";
  if (normalized.includes("certification credential id")) {
    return "certificationCredentialId";
  }
  if (
    normalized.includes("certification credential link") ||
    normalized.includes("certification credential url")
  ) {
    return "certificationCredentialLink";
  }
  if (normalized === "experience company") return "experienceCompany";
  if (normalized === "experience role") return "experienceRole";
  if (normalized === "experience project") return "experienceProject";
  if (
    normalized === "experience skills learnt" ||
    normalized === "experience skills learned"
  ) {
    return "experienceSkillsLearnt";
  }
  if (
    normalized === "experience years" ||
    normalized === "years" ||
    normalized === "total experience years" ||
    normalized === "total experience"
  ) {
    return "experienceYears";
  }
  if (normalized === "experience ctc") return "experienceCtc";
  if (normalized === "source") return "source";
  if (normalized === "applied for" || normalized === "applied role") {
    return "appliedFor";
  }
  return "";
};

const mapRowFromMapping = (row, mapping) => {
  const mapped = {};
  Object.entries(mapping).forEach(([column, fieldKey]) => {
    if (!fieldKey) return;
    mapped[fieldKey] = row[column];
  });
  return mapped;
};

const toPlainText = (value) => String(value || "").trim();

const normalizeNoticeDays = (value) => {
  const text = toPlainText(value);
  if (!text) return "";
  const match = text.match(/\d+/);
  return match ? match[0] : "";
};

const createProfileTemplateWorkbookFile = async () => {
  const XLSX = await import("xlsx");
  const sampleRow = [
    "Rehan N",
    "rehann786@gmail.com",
    "+918147852318",
    "30",
    "Male",
    "1998-08-10",
    "MG Road, Bengaluru",
    "Ballari, Karnataka",
    "Bengaluru",
    "560001",
    "Yes",
    "Bengaluru, Hyderabad",
    "SAP ABAP Consultant",
    "12.5",
    "16",
    "M.Tech in VLSI Design and Embedded Systems",
    "BITM, Ballari",
    "8.2",
    "ABAP, ALV, Adobe Forms, BAPI, BDC",
    "AWS Developer Associate",
    "AWS-12345",
    "https://example.com/cert/aws",
    "ABC Tech",
    "Senior Consultant",
    "Master Data Migration",
    "ABAP, BAPI, IDOC",
    "7",
    "12.5",
    "B.Tech",
    "VTU",
    "78%",
    "",
    "",
    "",
    "SAP Certified ABAP",
    "SAP-4455",
    "https://example.com/cert/sap-abap",
    "",
    "",
    "",
    "XYZ Systems",
    "ABAP Developer",
    "Custom transaction build",
    "SmartForms, WebDynpro",
    "3",
    "6.5",
    "",
    "",
    "",
    "",
    "",
    "",
    DEFAULT_EXCEL_SOURCE,
    "System Engineer",
  ];

  const worksheet = XLSX.utils.aoa_to_sheet([
    CANDIDATE_PROFILE_TEMPLATE_HEADERS,
    sampleRow,
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Candidates");
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

  return new File([bytes], "Candidate_Profile_Bulk_Template.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
};

const buildCertificationsText = (row = {}) => {
  const list = [
    {
      name: toPlainText(row.certificationName),
      id: toPlainText(row.certificationCredentialId),
      link: toPlainText(row.certificationCredentialLink),
    },
    ...Array.from({ length: ADDITIONAL_BLOCK_COUNT }, (_, index) => {
      const idx = index + 1;
      return {
        name: toPlainText(row[`additionalCertification${idx}Name`]),
        id: toPlainText(row[`additionalCertification${idx}CredentialId`]),
        link: toPlainText(row[`additionalCertification${idx}CredentialLink`]),
      };
    }),
  ].filter((item) => item.name || item.id || item.link);

  return list
    .map((item) => {
      const parts = [item.name, item.id ? `ID:${item.id}` : "", item.link]
        .filter(Boolean)
        .join(" | ");
      return parts.trim();
    })
    .filter(Boolean)
    .join("; ");
};

const buildRecruiterNotes = (row = {}) => {
  const parts = [];
  const appliedFor = toPlainText(row.appliedFor);
  const permanentAddress = toPlainText(row.permanentAddress);
  if (appliedFor) parts.push(`Applied For: ${appliedFor}`);
  if (permanentAddress) parts.push(`Permanent Address: ${permanentAddress}`);

  Array.from({ length: ADDITIONAL_BLOCK_COUNT }, (_, index) => index + 1).forEach(
    (idx) => {
      const edu = [
        toPlainText(row[`additionalEducation${idx}HighestDegree`]),
        toPlainText(row[`additionalEducation${idx}CollegeName`]),
        toPlainText(row[`additionalEducation${idx}CgpaPercentage`]),
      ]
        .filter(Boolean)
        .join(" | ");
      if (edu) parts.push(`Education ${idx + 1}: ${edu}`);

      const exp = [
        toPlainText(row[`additionalExperience${idx}Company`]),
        toPlainText(row[`additionalExperience${idx}Role`]),
        toPlainText(row[`additionalExperience${idx}Project`]),
        toPlainText(row[`additionalExperience${idx}SkillsLearnt`]),
        toPlainText(row[`additionalExperience${idx}Years`]),
        toPlainText(row[`additionalExperience${idx}Ctc`]),
      ]
        .filter(Boolean)
        .join(" | ");
      if (exp) parts.push(`Experience ${idx + 1}: ${exp}`);
    },
  );

  return parts.join(" || ");
};

const mapRowToBackendBulkTemplate = (row = {}) => {
  const skillsCsv = normalizeSkills(row.skills);
  const primarySkill = splitCsv(row.skills)[0] || "";
  const experienceCompany = toPlainText(row.experienceCompany);
  const location = toPlainText(row.city || row.preferredLocation);
  const relocate = parseBooleanFromText(row.readyToRelocate) ? "Yes" : "No";

  return {
    "Full Name*": titleCase(row.name || row.fullName || ""),
    "Email*": toPlainText(row.email).toLowerCase(),
    "Phone*": normalizePhone(row.phone),
    "Alternate Phone": "",
    "Date of Birth": toPlainText(row.dateOfBirth),
    Gender: toPlainText(row.gender),
    "Marital Status": "",
    "Current Company": experienceCompany,
    "Current Job Title": toPlainText(row.designation || row.currentPosition),
    "Total Experience (Years)": normalizeExperience(
      row.experienceYears || row.totalExperience,
    ),
    "Relevant Experience (Years)": "",
    "Current CTC": toPlainText(row.currentCtc),
    "Expected CTC": toPlainText(row.expectedCtc),
    "Notice Period (Days)": normalizeNoticeDays(row.noticePeriod),
    "Current Location": location,
    "Preferred Location": toPlainText(row.preferredLocation),
    "Skills": skillsCsv,
    "Primary Skill": primarySkill,
    "Secondary Skill": "",
    "Qualification": toPlainText(row.highestDegree),
    "University/College": toPlainText(row.collegeName),
    "Year of Graduation": "",
    "Certifications": buildCertificationsText(row),
    "Resume URL": "",
    "LinkedIn URL": "",
    "GitHub URL": "",
    "Portfolio URL": "",
    "Address": toPlainText(row.currentAddress),
    "City": toPlainText(row.city),
    "State": "",
    "Country": "",
    "Pincode": toPlainText(row.pincode),
    "Willing to Relocate (Yes/No)": relocate,
    "Preferred Employment Type": "",
    "Availability to Join (Date)": "",
    "Last Working Day": "",
    "Recruiter Notes": buildRecruiterNotes(row),
    "Source": toPlainText(row.source) || DEFAULT_EXCEL_SOURCE,
  };
};

const createBackendBulkUploadWorkbookFile = async (mappedRows = []) => {
  const XLSX = await import("xlsx");
  const rows = mappedRows.map((row) => {
    const backendRow = mapRowToBackendBulkTemplate(row);
    return BACKEND_BULK_TEMPLATE_HEADERS.map((header) => backendRow[header] ?? "");
  });
  const worksheet = XLSX.utils.aoa_to_sheet([BACKEND_BULK_TEMPLATE_HEADERS, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Candidates");
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

  return new File([bytes], `candidate_bulk_upload_${Date.now()}.xlsx`, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
};

const normalizeBackendUploadErrors = (errors = [], mappedRows = []) => {
  if (!Array.isArray(errors)) return [];
  return errors.map((error, index) => {
    const rowNumber = Number(error?.row) || index + 2;
    const sourceRow = mappedRows[rowNumber - 2] || {};
    return {
      row: rowNumber,
      field: error?.field || "Upload",
      message: error?.message || "Upload failed",
      fullName: sourceRow.name || sourceRow.fullName || "",
      email: sourceRow.email || "",
      phone: sourceRow.phone || "",
    };
  });
};

const appendIfPresent = (fd, key, value) => {
  if (value === null || value === undefined) return;
  const text = String(value).trim();
  if (!text) return;
  fd.append(key, text);
};

const buildCandidateFormDataFromRow = (row = {}) => {
  const fd = new FormData();
  const fullName = titleCase(row.name || row.fullName || "");
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ");

  const baseCertification =
    row.certificationName ||
    row.certificationCredentialId ||
    row.certificationCredentialLink
      ? [
          {
            name: toPlainText(row.certificationName),
            credential_id: toPlainText(row.certificationCredentialId),
            credential_url: toPlainText(row.certificationCredentialLink),
          },
        ]
      : [];

  const additionalCertifications = Array.from(
    { length: ADDITIONAL_BLOCK_COUNT },
    (_, index) => {
      const idx = index + 1;
      return {
        name: toPlainText(row[`additionalCertification${idx}Name`]),
        credential_id: toPlainText(
          row[`additionalCertification${idx}CredentialId`],
        ),
        credential_url: toPlainText(
          row[`additionalCertification${idx}CredentialLink`],
        ),
      };
    },
  ).filter((item) => item.name || item.credential_id || item.credential_url);

  const certifications = [...baseCertification, ...additionalCertifications];

  const baseExperience =
    row.experienceCompany ||
    row.experienceRole ||
    row.experienceProject ||
    row.experienceSkillsLearnt ||
    row.experienceYears ||
    row.experienceCtc
      ? [
          {
            company: toPlainText(row.experienceCompany),
            role: toPlainText(row.experienceRole),
            project_done: toPlainText(row.experienceProject),
            skills_learned: splitCsv(row.experienceSkillsLearnt),
            years: toPlainText(row.experienceYears),
            ctc: toPlainText(row.experienceCtc),
          },
        ]
      : [];

  const additionalExperiences = Array.from(
    { length: ADDITIONAL_BLOCK_COUNT },
    (_, index) => {
      const idx = index + 1;
      return {
        company: toPlainText(row[`additionalExperience${idx}Company`]),
        role: toPlainText(row[`additionalExperience${idx}Role`]),
        project_done: toPlainText(row[`additionalExperience${idx}Project`]),
        skills_learned: splitCsv(row[`additionalExperience${idx}SkillsLearnt`]),
        years: toPlainText(row[`additionalExperience${idx}Years`]),
        ctc: toPlainText(row[`additionalExperience${idx}Ctc`]),
      };
    },
  ).filter(
    (item) =>
      item.company ||
      item.role ||
      item.project_done ||
      item.skills_learned.length > 0 ||
      item.years ||
      item.ctc,
  );

  const workHistory = [...baseExperience, ...additionalExperiences];

  const baseEducation =
    row.highestDegree || row.collegeName || row.cgpaPercentage
      ? [
          {
            degree: toPlainText(row.highestDegree),
            college: toPlainText(row.collegeName),
            cgpa: toPlainText(row.cgpaPercentage),
            percentage: toPlainText(row.cgpaPercentage),
          },
        ]
      : [];

  const additionalEducations = Array.from(
    { length: ADDITIONAL_BLOCK_COUNT },
    (_, index) => {
      const idx = index + 1;
      return {
        degree: toPlainText(row[`additionalEducation${idx}HighestDegree`]),
        college: toPlainText(row[`additionalEducation${idx}CollegeName`]),
        cgpa: toPlainText(row[`additionalEducation${idx}CgpaPercentage`]),
        percentage: toPlainText(row[`additionalEducation${idx}CgpaPercentage`]),
      };
    },
  ).filter((item) => item.degree || item.college || item.cgpa || item.percentage);

  const educationHistory = [...baseEducation, ...additionalEducations];
  const skills = splitCsv(row.skills);
  const noticePeriod = toPlainText(row.noticePeriod);
  const designation = toPlainText(row.designation || row.currentPosition);
  const source = toPlainText(row.source) || DEFAULT_EXCEL_SOURCE;
  const appliedFor = toPlainText(row.appliedFor);
  const experienceYears = toPlainText(row.experienceYears || row.totalExperience);

  appendIfPresent(fd, "full_name", fullName);
  appendIfPresent(fd, "first_name", firstName);
  appendIfPresent(fd, "last_name", lastName);
  appendIfPresent(fd, "email", toPlainText(row.email).toLowerCase());
  appendIfPresent(fd, "phone", normalizePhone(row.phone));
  appendIfPresent(fd, "date_of_birth", toPlainText(row.dateOfBirth));
  appendIfPresent(fd, "dob", toPlainText(row.dateOfBirth));
  appendIfPresent(fd, "gender", toPlainText(row.gender));
  appendIfPresent(fd, "notice_period", noticePeriod);
  appendIfPresent(fd, "notice_period_days", normalizeNoticeDays(noticePeriod));
  appendIfPresent(fd, "current_address", toPlainText(row.currentAddress));
  appendIfPresent(fd, "permanent_address", toPlainText(row.permanentAddress));
  appendIfPresent(fd, "city", toPlainText(row.city));
  appendIfPresent(fd, "pincode", toPlainText(row.pincode));
  fd.append("willing_to_relocate", String(parseBooleanFromText(row.readyToRelocate)));
  fd.append("ready_to_relocate", String(parseBooleanFromText(row.readyToRelocate)));
  appendIfPresent(fd, "preferred_location", toPlainText(row.preferredLocation));
  appendIfPresent(fd, "current_designation", designation);
  appendIfPresent(fd, "current_role", designation);
  appendIfPresent(fd, "designation", designation);
  appendIfPresent(fd, "current_ctc", toPlainText(row.currentCtc));
  appendIfPresent(fd, "expected_ctc", toPlainText(row.expectedCtc));
  appendIfPresent(fd, "highest_degree", toPlainText(row.highestDegree));
  appendIfPresent(fd, "education", toPlainText(row.highestDegree));
  appendIfPresent(fd, "college", toPlainText(row.collegeName));
  appendIfPresent(fd, "institution", toPlainText(row.collegeName));
  appendIfPresent(fd, "cgpa", toPlainText(row.cgpaPercentage));
  appendIfPresent(fd, "percentage", toPlainText(row.cgpaPercentage));
  appendIfPresent(fd, "source", source);
  appendIfPresent(fd, "applied_for", appliedFor);
  appendIfPresent(fd, "applied_role", appliedFor);
  appendIfPresent(fd, "job_title", appliedFor);
  appendIfPresent(fd, "total_experience", experienceYears);
  appendIfPresent(fd, "experience_years", experienceYears);

  fd.append("skills", JSON.stringify(skills));
  fd.append("primary_skills", JSON.stringify(skills));
  fd.append("certifications", JSON.stringify(certifications));
  fd.append("work_history", JSON.stringify(workHistory));
  fd.append("education_history", JSON.stringify(educationHistory));

  return fd;
};

const normalizeApiError = (error, fallback = "Upload failed.") => {
  const detail = error?.response?.data?.detail;
  const message = error?.response?.data?.message;

  if (typeof detail === "string" && detail.trim()) return detail;
  if (typeof message === "string" && message.trim()) return message;
  if (detail && typeof detail === "object") {
    if (typeof detail.message === "string" && detail.message.trim()) {
      return detail.message;
    }
    const missing = Array.isArray(detail.missing)
      ? `Missing: ${detail.missing.join(", ")}`
      : "";
    const extra = Array.isArray(detail.extra)
      ? `Extra: ${detail.extra.join(", ")}`
      : "";
    const parts = [missing, extra].filter(Boolean);
    if (parts.length) return parts.join(" | ");
  }
  if (typeof error?.message === "string" && error.message.trim()) return error.message;
  return fallback;
};

const buildImportLogEntries = (mappedRows = [], uploadErrors = []) => {
  const statusByRow = new Map();
  uploadErrors.forEach((item) => {
    const rowNumber = Number(item.row);
    if (!rowNumber) return;
    const text = `${item.field || ""} ${item.message || ""}`.toLowerCase();
    if (text.includes("duplicate") || text.includes("already exists")) {
      statusByRow.set(rowNumber, "Duplicate");
      return;
    }
    if (!statusByRow.has(rowNumber)) statusByRow.set(rowNumber, "Failed");
  });

  return mappedRows.map((row, index) => ({
    type: "excel",
    name: row.name || row.fullName || "Unknown",
    email: row.email || "",
    status: statusByRow.get(index + 2) || "Imported",
  }));
};

const summarizeImportByErrors = (totalRows = 0, errors = []) => {
  const duplicateRows = new Set();
  const failedRows = new Set();

  errors.forEach((item) => {
    const rowNumber = Number(item?.row);
    if (!rowNumber) return;
    const text = `${item?.field || ""} ${item?.message || ""}`.toLowerCase();
    if (text.includes("duplicate") || text.includes("already exists")) {
      duplicateRows.add(rowNumber);
      return;
    }
    failedRows.add(rowNumber);
  });

  const successful = Math.max(
    0,
    Number(totalRows || 0) - duplicateRows.size - failedRows.size,
  );

  return {
    total: Number(totalRows || 0),
    successful,
    duplicates: duplicateRows.size,
    failed: failedRows.size,
  };
};

const buildErrorCsv = (errors = []) => {
  if (!errors.length) return "";
  const header = ["Row Number", "Error Type", "Details", "Full Name", "Email", "Phone"];
  const rows = errors.map((err) => [
    err.row,
    err.field || "Validation",
    err.message,
    err.fullName || "",
    err.email || "",
    err.phone || "",
  ]);
  return [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
};
export default function BulkImportSection({
  form = null,
  setForm = null,
  onImportComplete = null,
  onLog = null, // callback to bubble up admin log entries
}) {
  const isAdminMode = !form || typeof setForm !== "function";
  const resumeInputRef = useRef(null);
  const excelInputRef = useRef(null);

  const [resumeState, setResumeState] = useState({
    dragging: false,
    stage: null,
    progress: 0,
    message: "",
    error: "",
    warning: "",
    file: null,
    selectedFiles: [],
    parsedData: null,
    conflicts: [],
    showMergeModal: false,
    mergeOption: "merge",
    summary: null,
    results: [],
  });

  const [excelState, setExcelState] = useState({
    dragging: false,
    file: null,
    error: "",
    headers: [],
    rows: [],
    mapping: {},
    previewRows: [],
    validationErrors: [],
    duplicates: [],
    showMappingModal: false,
    summary: null,
    uploadErrors: [],
    uploading: false,
    progress: 0,
  });
  const [activeImportTab, setActiveImportTab] = useState("resume");
  const tabButtonRefs = useRef({});

  const importTabs = [
    {
      id: "resume",
      label: "Upload Resume",
      meta: "PDF, DOC, DOCX, TXT • Max 5MB",
      icon: FiFileText,
    },
    {
      id: "excel",
      label: "Upload Excel/CSV",
      meta: "XLSX, CSV • Max 10MB / 5000 rows",
      icon: FiFilePlus,
    },
  ];

  const resumePreviewFields = useMemo(() => {
    if (!resumeState.parsedData) return [];
    return resumeState.conflicts.map((conflict) => ({
      label: conflict.label,
      existing: conflict.existing,
      parsed: conflict.parsed,
      action: conflict.action,
    }));
  }, [resumeState.parsedData, resumeState.conflicts]);

  const updateResumeStage = (stageKey, options = {}) => {
    const stage = uploadStages[stageKey];
    if (!stage) return;
    const totalFiles = Number(options.totalFiles) > 0 ? Number(options.totalFiles) : 1;
    let message = stage.message;

    if (isAdminMode && totalFiles > 1) {
      if (stageKey === "uploading") {
        message = `Uploading ${totalFiles} resumes...`;
      } else if (stageKey === "parsing") {
        message = `Parsing ${totalFiles} resumes...`;
      } else if (stageKey === "importing") {
        message = `Importing ${totalFiles} candidates...`;
      } else if (stageKey === "complete") {
        message = `${totalFiles} resumes parsed successfully!`;
      }
    }

    setResumeState((prev) => ({
      ...prev,
      stage: stageKey,
      progress: stage.progress,
      message,
    }));
  };

  const focusImportTab = (tabId) => {
    setActiveImportTab(tabId);
    tabButtonRefs.current[tabId]?.focus();
  };

  const handleImportTabKeyDown = (event, currentTabId) => {
    const tabIds = importTabs.map((tab) => tab.id);
    const currentIndex = tabIds.indexOf(currentTabId);
    if (currentIndex === -1) return;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = (currentIndex + 1) % tabIds.length;
      focusImportTab(tabIds[nextIndex]);
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const prevIndex = (currentIndex - 1 + tabIds.length) % tabIds.length;
      focusImportTab(tabIds[prevIndex]);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusImportTab(tabIds[0]);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusImportTab(tabIds[tabIds.length - 1]);
    }
  };

  const normalizeParsedResume = (parsed = {}) => ({
    fullName: titleCase(parsed.full_name || parsed.fullName || ""),
    email: String(parsed.email || "").trim().toLowerCase(),
    phone: normalizePhone(parsed.phone || ""),
    skills: normalizeSkills(parsed.skills || ""),
    experience: normalizeExperience(parsed.experience_years || parsed.experience || ""),
    education: parsed.education || "",
    certifications: parsed.certifications || [],
    currentLocation: parsed.current_location || parsed.location || "",
    linkedinUrl: parsed.linkedin_url || parsed.linkedin || "",
    githubUrl: parsed.github_url || parsed.github || "",
    portfolioUrl: parsed.portfolio_url || parsed.portfolio || "",
    resumeUrl: parsed.resume_url || "",
  });

  const detectResumeConflicts = (parsed) => {
    if (isAdminMode) return [];
    const conflicts = [];
    const existingFields = [
      { key: "fullName", label: "Name", existing: form.fullName, parsed: parsed.fullName },
      { key: "email", label: "Email", existing: form.email, parsed: parsed.email },
      { key: "phone", label: "Phone", existing: form.phone, parsed: parsed.phone },
      { key: "skills", label: "Skills", existing: form.skills, parsed: parsed.skills },
      { key: "experience", label: "Experience", existing: form.experience, parsed: parsed.experience },
      { key: "education", label: "Education", existing: form.education, parsed: parsed.education },
      { key: "currentLocation", label: "Location", existing: form.currentLocation, parsed: parsed.currentLocation },
      { key: "linkedinUrl", label: "LinkedIn", existing: form.linkedinUrl, parsed: parsed.linkedinUrl },
      { key: "githubUrl", label: "GitHub", existing: form.githubUrl, parsed: parsed.githubUrl },
      { key: "portfolioUrl", label: "Portfolio", existing: form.portfolioUrl, parsed: parsed.portfolioUrl },
    ];

    existingFields.forEach((field) => {
      if (!field.parsed) return;
      if (!field.existing) return;
      if (String(field.existing).trim() === String(field.parsed).trim()) return;
      conflicts.push({
        ...field,
        action: "Keep existing",
      });
    });

    return conflicts;
  };

  const applyParsedResume = (parsed, mode) => {
    if (isAdminMode || !setForm) return;
    setForm((prev) => {
      const next = { ...prev };
      const mergeValue = (key, value) => {
        if (!value) return;
        if (mode === "overwrite") {
          next[key] = value;
          return;
        }
        if (!next[key]) {
          next[key] = value;
        }
      };

      mergeValue("fullName", parsed.fullName);
      mergeValue("email", parsed.email);
      mergeValue("phone", parsed.phone);
      if (parsed.skills) {
        const existingSkills = normalizeSkills(prev.skills);
        const combined = normalizeSkills(`${existingSkills}, ${parsed.skills}`);
        next.skills = mode === "overwrite" ? parsed.skills : combined;
      }
      if (parsed.experience !== "") {
        next.experience = mode === "overwrite" ? parsed.experience : prev.experience || parsed.experience;
      }
      mergeValue("education", parsed.education);
      mergeValue("currentLocation", parsed.currentLocation);
      mergeValue("linkedinUrl", parsed.linkedinUrl);
      mergeValue("githubUrl", parsed.githubUrl);
      mergeValue("portfolioUrl", parsed.portfolioUrl);

      if (parsed.certifications && parsed.certifications.length) {
        const existing = Array.isArray(prev.certifications) ? prev.certifications : [];
        const normalizedCerts = parsed.certifications.map((cert) => ({
          name: String(cert).trim(),
          organization: "",
          issueDate: "",
          expiryDate: "",
          credentialId: "",
          credentialUrl: "",
        }));
        next.certifications =
          mode === "overwrite" || existing.every((c) => !c.name)
            ? normalizedCerts
            : [...existing, ...normalizedCerts];
      }

      if (parsed.resumeUrl) {
        next.resumeUrl = parsed.resumeUrl;
      }

      return next;
    });
  };

  const handleResumeFiles = async (inputFiles = []) => {
    const allFiles = dedupeFiles(
      Array.isArray(inputFiles) ? inputFiles : Array.from(inputFiles || []),
    );
    const files = isAdminMode ? allFiles : allFiles.slice(0, 1);

    if (!files.length) {
      setResumeState((prev) => ({
        ...prev,
        error: "No file selected",
        warning: "",
        file: null,
        selectedFiles: [],
      }));
      return;
    }

    const { validFiles, invalidEntries } = validateResumeFiles(files);
    const hasBatchOverflow =
      isAdminMode && validFiles.length > MAX_RESUME_BATCH_FILES;
    const filesToProcess = hasBatchOverflow
      ? validFiles.slice(0, MAX_RESUME_BATCH_FILES)
      : validFiles;

    const warnings = [];
    if (invalidEntries.length > 0) {
      const preview = invalidEntries.slice(0, 2).join(" | ");
      const remaining = invalidEntries.length - 2;
      warnings.push(
        remaining > 0
          ? `Skipped ${invalidEntries.length} invalid files (${preview} +${remaining} more).`
          : `Skipped ${invalidEntries.length} invalid files (${preview}).`,
      );
    }
    if (hasBatchOverflow) {
      warnings.push(
        `Only first ${MAX_RESUME_BATCH_FILES} valid resumes were processed in this batch.`,
      );
    }

    if (!filesToProcess.length) {
      setResumeState((prev) => ({
        ...prev,
        error: resumeValidation.errorMessages.invalidType,
        warning: "",
        file: null,
        selectedFiles: [],
        stage: null,
        progress: 0,
        message: "",
      }));
      return;
    }

    const totalFiles = filesToProcess.length;
    const primaryFile = filesToProcess[0];

    setResumeState((prev) => ({
      ...prev,
      error: "",
      warning: warnings.join(" "),
      file: primaryFile,
      selectedFiles: filesToProcess,
      parsedData: null,
      conflicts: [],
      showMergeModal: false,
      summary: null,
      results: [],
    }));

    updateResumeStage("uploading", { totalFiles });

    try {
      updateResumeStage("parsing", { totalFiles });
      if (isAdminMode) {
        // Admin: import multiple resumes using async processing + polling
        const adminForm = new FormData();
        filesToProcess.forEach((resumeFile) => {
          adminForm.append("files", resumeFile);
        });
        adminForm.append("duplicate_option", "overwrite");
        updateResumeStage("importing", { totalFiles });
        const startRes = await api.post("/v1/candidates/bulk-resume-upload-async", adminForm, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const taskId = startRes?.data?.task_id;
        if (!taskId) {
          throw new Error("Async upload did not return task_id");
        }

        const startedAt = Date.now();
        let finalResult = null;
        while (Date.now() - startedAt < BULK_UPLOAD_STATUS_TIMEOUT_MS) {
          const statusRes = await api.get(`/v1/candidates/bulk-upload-status/${taskId}`);
          const task = statusRes?.data || {};
          const taskStatus = String(task.status || "").toLowerCase();
          const taskProgress = Number(task.progress || 0);

          if (taskStatus === "completed") {
            finalResult = task.result || {};
            break;
          }
          if (taskStatus === "failed") {
            throw new Error(task.error || "Bulk resume upload failed");
          }

          setResumeState((prev) => ({
            ...prev,
            stage: "importing",
            progress: Math.min(99, Math.max(prev.progress || 0, taskProgress || 1)),
            message:
              taskStatus === "pending"
                ? `Queued ${totalFiles} resumes for processing...`
                : `Importing ${totalFiles} candidates... (${Math.max(1, taskProgress)}%)`,
          }));

          await new Promise((resolve) => setTimeout(resolve, BULK_UPLOAD_STATUS_POLL_MS));
        }

        if (!finalResult) {
          throw new Error("Bulk upload status polling timed out");
        }

        updateResumeStage("complete", { totalFiles });
        setResumeState((prev) => ({
          ...prev,
          summary: {
            success: finalResult.success ?? 0,
            failed: finalResult.failed ?? 0,
            duplicates: finalResult.duplicates ?? 0,
            updated: finalResult.updated ?? 0,
            total_processed: finalResult.total_processed ?? totalFiles,
          },
          results: Array.isArray(finalResult.results) ? finalResult.results : [],
          parsedData: null,
          conflicts: [],
        }));
        if (typeof onImportComplete === "function") {
          onImportComplete();
        }
        if (typeof onLog === "function") {
          onLog(
            (Array.isArray(finalResult.results) ? finalResult.results : []).map((r) => ({
              type: "resume",
              name: r.name || "Unknown",
              email: r.email || "",
              status: r.status || "Processed",
              resume: r.resume || primaryFile.name,
            })),
          );
        }
      } else {
        const formData = new FormData();
        formData.append("file", primaryFile);
        const res = await api.post("/v1/candidate/resume/parse", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        updateResumeStage("validating", { totalFiles: 1 });
        const parsed = normalizeParsedResume({
          ...(res.data?.parsed || {}),
          resume_url: res.data?.resume_url,
        });

        const conflicts = detectResumeConflicts(parsed);

        if (conflicts.length > 0) {
          setResumeState((prev) => ({
            ...prev,
            parsedData: parsed,
            conflicts,
            showMergeModal: true,
            mergeOption: "merge",
          }));
        } else {
          applyParsedResume(parsed, "overwrite");
          updateResumeStage("complete");
          setResumeState((prev) => ({
            ...prev,
            parsedData: parsed,
          }));
        }
      }
    } catch (error) {
      setResumeState((prev) => ({
        ...prev,
        error:
          error?.response?.data?.detail ||
          error?.message ||
          resumeValidation.errorMessages.uploadFailed,
        stage: null,
        progress: 0,
        message: "",
      }));
    } finally {
      if (resumeInputRef.current) {
        resumeInputRef.current.value = "";
      }
    }
  };

  const handleResumeDrop = (event) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files || []);
    setResumeState((prev) => ({ ...prev, dragging: false }));
    if (files.length > 0) handleResumeFiles(files);
  };

  const handleExcelFile = async (file) => {
    const validation = validateExcelFile(file);
    if (!validation.valid) {
      setExcelState((prev) => ({
        ...prev,
        error: validation.message,
        file: null,
      }));
      return;
    }

    setExcelState((prev) => ({
      ...prev,
      error: "",
      file,
      summary: null,
      uploadErrors: [],
    }));

    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const [headerRow = [], ...dataRows] = rows;

      if (!headerRow.length) {
        setExcelState((prev) => ({
          ...prev,
          error: "No headers found in the file.",
        }));
        return;
      }

      if (dataRows.length > excelValidation.maxRows) {
        setExcelState((prev) => ({
          ...prev,
          error: `Row limit exceeded (max ${excelValidation.maxRows})`,
        }));
        return;
      }

      const rowObjects = dataRows.map((row) => {
        const obj = {};
        headerRow.forEach((header, idx) => {
          obj[header] = row[idx] ?? "";
        });
        return obj;
      });

      const mapping = {};
      headerRow.forEach((header) => {
        mapping[header] = autoMapField(header);
      });

      setExcelState((prev) => ({
        ...prev,
        headers: headerRow,
        rows: rowObjects,
        mapping,
        previewRows: rowObjects.slice(0, 3),
        showMappingModal: true,
      }));
    } catch (error) {
      setExcelState((prev) => ({
        ...prev,
        error: normalizeApiError(
          error,
          "Failed to read the file. Please upload a valid Excel/CSV file.",
        ),
      }));
    }
  };
  const handleExcelImport = async () => {
    const mapping = excelState.mapping;
    const mappedRows = excelState.rows.map((row) => mapRowFromMapping(row, mapping));
    if (mappedRows.length === 0) {
      setExcelState((prev) => ({
        ...prev,
        error: "No data rows found to import.",
      }));
      return;
    }

    const validationErrors = [];
    mappedRows.forEach((row, idx) => {
      const errors = validateExcelRow(row, idx + 2);
      if (errors.length) {
        errors.forEach((message) => {
          validationErrors.push({
            row: idx + 2,
            field: "Validation",
            message,
            fullName: row.name || row.fullName,
            email: row.email,
            phone: row.phone,
          });
        });
      }
    });

    const duplicates = detectDuplicates(mappedRows);

    const duplicateErrors = duplicates.map((item) => {
      const row = mappedRows[item.row - 2] || {};
      return {
        row: item.row,
        field: "Duplicate",
        message: item.reason || "Duplicate in file",
        fullName: row.name || row.fullName || "",
        email: row.email || "",
        phone: row.phone || "",
      };
    });
    const precheckErrors = [...validationErrors, ...duplicateErrors];

    setExcelState((prev) => ({
      ...prev,
      validationErrors,
      duplicates,
      summary: summarizeImportByErrors(mappedRows.length, precheckErrors),
      uploading: true,
      progress: 20,
      error: "",
    }));

    try {
      const workbookFile = await createBackendBulkUploadWorkbookFile(mappedRows);
      const formData = new FormData();
      formData.append("file", workbookFile);

      const response = await api.post("/v1/candidates/bulk-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (!event.total) return;
          const percent = Math.round((event.loaded / event.total) * 100);
          setExcelState((prev) => ({
            ...prev,
            progress: Math.max(prev.progress, Math.min(95, percent)),
          }));
        },
      });

      const backendErrors = normalizeBackendUploadErrors(
        response?.data?.errors || [],
        mappedRows,
      );
      const uniqueErrors = [];
      const seen = new Set();
      [...precheckErrors, ...backendErrors].forEach((item) => {
        const key = `${item.row}|${item.field}|${item.message}`;
        if (seen.has(key)) return;
        seen.add(key);
        uniqueErrors.push(item);
      });

      const summary = summarizeImportByErrors(mappedRows.length, uniqueErrors);

      setExcelState((prev) => ({
        ...prev,
        summary,
        uploadErrors: uniqueErrors,
        uploading: false,
        progress: 100,
        showMappingModal: false,
      }));

      if (typeof onImportComplete === "function") {
        onImportComplete();
      }
      if (typeof onLog === "function") {
        onLog(buildImportLogEntries(mappedRows, uniqueErrors));
      }
    } catch (error) {
      const backendErrors = normalizeBackendUploadErrors(
        error?.response?.data?.errors || [],
        mappedRows,
      );
      const fallbackRows = mappedRows
        .map((row, index) => ({ row, rowNumber: index + 2 }))
        .filter((item) => {
          return !precheckErrors.some((err) => Number(err.row) === item.rowNumber);
        })
        .map((item) => ({
          row: item.rowNumber,
          field: "Upload",
          message: normalizeApiError(error, "Upload failed."),
          fullName: item.row.name || item.row.fullName || "",
          email: item.row.email || "",
          phone: item.row.phone || "",
        }));

      const uniqueErrors = [];
      const seen = new Set();
      [...precheckErrors, ...backendErrors, ...fallbackRows].forEach((item) => {
        const key = `${item.row}|${item.field}|${item.message}`;
        if (seen.has(key)) return;
        seen.add(key);
        uniqueErrors.push(item);
      });
      const summary = summarizeImportByErrors(mappedRows.length, uniqueErrors);

      setExcelState((prev) => ({
        ...prev,
        summary,
        uploadErrors: uniqueErrors,
        uploading: false,
        progress: 100,
        showMappingModal: false,
        error: normalizeApiError(error, "Upload failed."),
      }));
    }
  };

  const downloadTemplate = async () => {
    try {
      const templateFile = await createProfileTemplateWorkbookFile();
      const url = URL.createObjectURL(templateFile);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Candidate_Profile_Bulk_Template.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      try {
        const fallbackFile = await createProfileTemplateWorkbookFile();
        const url = URL.createObjectURL(fallbackFile);
        const link = document.createElement("a");
        link.href = url;
        link.download = "Candidate_Profile_Bulk_Template.xlsx";
        link.click();
        URL.revokeObjectURL(url);
      } catch (fallbackError) {
        setExcelState((prev) => ({
          ...prev,
          error: normalizeApiError(fallbackError, "Failed to download template."),
        }));
      }
    }
  };

  return (
    <section className="bulk-import">
      <div className="bulk-import__tabs-header">
        <div
          className="bulk-import__tabs"
          role="tablist"
          aria-label="Resume and CSV upload tools"
        >
          {importTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeImportTab === tab.id;
            const isResumeTab = tab.id === "resume";
            const activityCount = isResumeTab
              ? resumeState.selectedFiles?.length || 0
              : excelState.rows?.length || 0;
            return (
              <button
                key={tab.id}
                ref={(node) => {
                  tabButtonRefs.current[tab.id] = node;
                }}
                type="button"
                id={`bulk-import-tab-${tab.id}`}
                role="tab"
                aria-selected={isActive}
                aria-controls={`bulk-import-panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                data-import-tab={tab.id}
                className={`bulk-import__tab ${
                  isActive ? "bulk-import__tab--active" : ""
                }`}
                onClick={() => setActiveImportTab(tab.id)}
                onKeyDown={(event) => handleImportTabKeyDown(event, tab.id)}
              >
                <span className="bulk-import__tab-icon" aria-hidden="true">
                  <Icon size={16} />
                </span>
                <span className="bulk-import__tab-content">
                  <span className="bulk-import__tab-label">{tab.label}</span>
                  <span className="bulk-import__tab-meta">{tab.meta}</span>
                </span>
                {activityCount > 0 && (
                  <span className="bulk-import__tab-badge" aria-label={`${activityCount} selected`}>
                    {activityCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div
        id={`bulk-import-panel-${activeImportTab}`}
        role="tabpanel"
        aria-labelledby={`bulk-import-tab-${activeImportTab}`}
        className="bulk-import__panel"
      >
        {activeImportTab === "resume" ? (
          <div className="bulk-import__card bulk-import__card--tabbed">
            <div className="bulk-import__card-header">
              <span className="bulk-import__card-icon">
                <FiFileText size={16} />
              </span>
              <div>
                <h4 className="bulk-import__title">Upload Resume</h4>
                <p className="bulk-import__subtitle">Parse candidate data from resume</p>
              </div>
            </div>

            <div
              className={`bulk-import__dropzone ${
                resumeState.dragging ? "bulk-import__dropzone--active" : ""
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setResumeState((prev) => ({ ...prev, dragging: true }));
              }}
              onDragLeave={() =>
                setResumeState((prev) => ({ ...prev, dragging: false }))
              }
              onDrop={handleResumeDrop}
              onClick={() => resumeInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Upload resume"
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  resumeInputRef.current?.click();
                }
              }}
            >
              <FiUpload className="text-slate-500" size={20} />
              <p className="bulk-import__dropzone-title">
                {isAdminMode
                  ? "Drag and drop resumes or click to upload"
                  : "Drag and drop or click to upload"}
              </p>
              <p className="bulk-import__dropzone-meta">
                {isAdminMode
                  ? "PDF, DOC, DOCX, TXT • Max 5MB each"
                  : "PDF, DOC, DOCX, TXT • Max 5MB"}
              </p>
              {isAdminMode && (
                <p className="bulk-import__dropzone-hint">
                  Upload multiple resumes at once. Matching email/phone will auto-update existing candidate details.
                </p>
              )}
              <input
                ref={resumeInputRef}
                type="file"
                multiple={isAdminMode}
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={(event) =>
                  handleResumeFiles(Array.from(event.target.files || []))
                }
              />
            </div>

            {isAdminMode && resumeState.selectedFiles?.length > 0 && (
              <div className="bulk-import__selection">
                <div className="bulk-import__selection-title">
                  Selected resumes: {resumeState.selectedFiles.length}
                </div>
                <div className="bulk-import__selection-list">
                  {resumeState.selectedFiles.slice(0, 4).map((selectedFile) => (
                    <span key={`${selectedFile.name}-${selectedFile.size}`} className="bulk-import__selection-chip">
                      {selectedFile.name}
                    </span>
                  ))}
                  {resumeState.selectedFiles.length > 4 && (
                    <span className="bulk-import__selection-chip bulk-import__selection-chip--muted">
                      +{resumeState.selectedFiles.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {resumeState.warning && (
              <div className="bulk-import__warning">
                <FiAlertCircle /> {resumeState.warning}
              </div>
            )}

            {resumeState.error && (
              <div className="bulk-import__error">
                <FiAlertCircle /> {resumeState.error}
              </div>
            )}

            {resumeState.stage && (
              <div className="bulk-import__progress" aria-live="polite">
                <div className="flex items-center justify-between">
                  <span>{resumeState.message}</span>
                  <span className="font-semibold">{resumeState.progress}%</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2">
                  <div
                    className="h-1.5 bg-blue-500 rounded-full transition-all"
                    style={{ width: `${resumeState.progress}%` }}
                  />
                </div>
              </div>
            )}

            {!isAdminMode && form?.resumeUrl && (
              <div className="bulk-import__subtitle">Current resume uploaded.</div>
            )}

            {isAdminMode && resumeState.summary && (
              <div className="bulk-import__summary">
                <div className="bulk-import__summary-title">
                  <FiCheckCircle /> Resume import complete
                </div>
                <div className="bulk-import__stats">
                  <div>Total: {resumeState.summary.total_processed}</div>
                  <div>Imported: {resumeState.summary.success + resumeState.summary.updated}</div>
                  <div>Duplicates: {resumeState.summary.duplicates}</div>
                  <div>Failed: {resumeState.summary.failed}</div>
                  <div>Updated: {resumeState.summary.updated}</div>
                </div>
                {resumeState.results?.length > 0 && (
                  <div className="mt-2 space-y-1 text-slate-700">
                    <div className="font-semibold text-slate-800">Import log</div>
                    <ul className="divide-y divide-emerald-100 rounded border border-emerald-100 bg-white">
                      {resumeState.results.map((item, idx) => (
                        <li key={idx} className="px-3 py-2 text-xs">
                          <div className="font-semibold">
                            {item.name || "Unknown"}{" "}
                            {item.email ? <span className="text-slate-500">({item.email})</span> : null}
                          </div>
                          <div className="text-slate-600">
                            {item.resume || "resume"} - {item.status || "Processed"}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bulk-import__card bulk-import__card--tabbed">
            <div className="bulk-import__card-header">
              <span className="bulk-import__card-icon bulk-import__card-icon--success">
                <FiFilePlus size={16} />
              </span>
              <div>
                <h4 className="bulk-import__title">Upload Excel/CSV</h4>
                <p className="bulk-import__subtitle">Import multiple candidates at once</p>
              </div>
            </div>

            <div
              className={`bulk-import__dropzone ${
                excelState.dragging ? "bulk-import__dropzone--active" : ""
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setExcelState((prev) => ({ ...prev, dragging: true }));
              }}
              onDragLeave={() =>
                setExcelState((prev) => ({ ...prev, dragging: false }))
              }
              onDrop={(event) => {
                event.preventDefault();
                setExcelState((prev) => ({ ...prev, dragging: false }));
                const file = event.dataTransfer.files?.[0];
                if (file) handleExcelFile(file);
              }}
              onClick={() => excelInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Upload Excel or CSV"
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  excelInputRef.current?.click();
                }
              }}
            >
              <FiUpload className="text-slate-500" size={20} />
              <p className="bulk-import__dropzone-title">
                Drag and drop or click to upload
              </p>
              <p className="bulk-import__dropzone-meta">XLSX, CSV • Max 10MB / 5000 rows</p>
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(event) => handleExcelFile(event.target.files?.[0])}
              />
            </div>

            <button type="button" onClick={downloadTemplate} className="bulk-import__link">
              <FiDownload /> Download Template
            </button>

            {excelState.error && (
              <div className="bulk-import__error">
                <FiAlertCircle /> {excelState.error}
              </div>
            )}

            {excelState.uploading && (
              <div className="bulk-import__progress" aria-live="polite">
                <div className="flex items-center justify-between">
                  <span>Uploading file...</span>
                  <span className="font-semibold">{excelState.progress}%</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2">
                  <div
                    className="h-1.5 bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${excelState.progress}%` }}
                  />
                </div>
              </div>
            )}

            {excelState.summary && (
              <div className="bulk-import__summary">
                <div className="bulk-import__summary-title">
                  <FiCheckCircle /> Upload complete
                </div>
                <div className="bulk-import__stats">
                  <div>Total Rows: {excelState.summary.total}</div>
                  <div>Imported: {excelState.summary.successful}</div>
                  <div>Duplicates: {excelState.summary.duplicates}</div>
                  <div>Failed: {excelState.summary.failed}</div>
                </div>
                {excelState.uploadErrors.length > 0 && (
                  <button
                    type="button"
                    className="bulk-import__link mt-2"
                    onClick={() => {
                      const csv = buildErrorCsv(excelState.uploadErrors);
                      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = "bulk_upload_errors.csv";
                      link.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download Error Report
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {resumeState.showMergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-3xl">
            <h4 className="text-lg font-semibold text-gray-900 mb-2">
              Data Conflict Detected
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              Existing profile has data. How would you like to proceed?
            </p>

            <div className="space-y-2 mb-4">
              {[
                { value: "overwrite", label: "Overwrite all fields" },
                { value: "merge", label: "Merge (keep existing, add new)" },
                { value: "cancel", label: "Cancel" },
              ].map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 text-sm text-gray-700"
                >
                  <input
                    type="radio"
                    name="mergeOption"
                    value={option.value}
                    checked={resumeState.mergeOption === option.value}
                    onChange={() =>
                      setResumeState((prev) => ({
                        ...prev,
                        mergeOption: option.value,
                      }))
                    }
                  />
                  {option.label}
                </label>
              ))}
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left font-semibold text-gray-600">
                      Field
                    </th>
                    <th className="p-2 text-left font-semibold text-gray-600">
                      Existing
                    </th>
                    <th className="p-2 text-left font-semibold text-gray-600">
                      Parsed
                    </th>
                    <th className="p-2 text-left font-semibold text-gray-600">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resumePreviewFields.map((field) => (
                    <tr key={field.label} className="border-t">
                      <td className="p-2 font-medium">{field.label}</td>
                      <td className="p-2 text-gray-600">
                        {field.existing || "—"}
                      </td>
                      <td className="p-2 text-gray-600">
                        {field.parsed || "—"}
                      </td>
                      <td className="p-2 text-gray-600">{field.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-200 text-gray-700"
                onClick={() =>
                  setResumeState((prev) => ({
                    ...prev,
                    showMergeModal: false,
                    parsedData: null,
                    conflicts: [],
                  }))
                }
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white"
                onClick={() => {
                  if (resumeState.mergeOption === "cancel") {
                    setResumeState((prev) => ({
                      ...prev,
                      showMergeModal: false,
                      parsedData: null,
                      conflicts: [],
                    }));
                    return;
                  }
                  applyParsedResume(resumeState.parsedData, resumeState.mergeOption);
                  updateResumeStage("complete");
                  setResumeState((prev) => ({
                    ...prev,
                    showMergeModal: false,
                  }));
                }}
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {excelState.showMappingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h4 className="text-lg font-semibold text-gray-900 mb-2">
              Map Excel Columns to Profile Fields
            </h4>
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left font-semibold">Excel Column</th>
                    <th className="p-2 text-left font-semibold">Profile Field</th>
                  </tr>
                </thead>
                <tbody>
                  {excelState.headers.map((header) => (
                    <tr key={header} className="border-t">
                      <td className="p-2 font-medium">{header}</td>
                      <td className="p-2">
                        <select
                          className="border border-gray-300 rounded px-2 py-1 text-xs"
                          value={excelState.mapping[header] || ""}
                          onChange={(event) =>
                            setExcelState((prev) => ({
                              ...prev,
                              mapping: {
                                ...prev.mapping,
                                [header]: event.target.value,
                              },
                            }))
                          }
                        >
                          {FIELD_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-xs text-gray-500 mb-2">
              Preview (first 3 rows):
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Email</th>
                    <th className="p-2 text-left">Phone</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {excelState.previewRows.map((row, idx) => {
                    const mapped = mapRowFromMapping(row, excelState.mapping);
                    const errors = validateExcelRow(mapped, idx + 2);
                    return (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{mapped.name || mapped.fullName || "--"}</td>
                        <td className="p-2">{mapped.email || "--"}</td>
                        <td className="p-2">{mapped.phone || "--"}</td>
                        <td className="p-2">
                          {errors.length === 0 ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-red-600">✗</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-200 text-gray-700"
                onClick={() =>
                  setExcelState((prev) => ({
                    ...prev,
                    showMappingModal: false,
                  }))
                }
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white"
                onClick={handleExcelImport}
              >
                Import {excelState.rows.length} Candidates
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
