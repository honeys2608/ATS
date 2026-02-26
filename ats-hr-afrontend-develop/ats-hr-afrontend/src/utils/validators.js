// src/utils/validators.js
/**
 * Comprehensive Input Validation Utilities (Market-Standard)
 * Following industry best practices and OWASP guidelines
 * Use these validators across all forms for consistency
 */

// =============== STRING VALIDATORS ===============

/**
 * Validate name fields (First Name, Last Name, Full Name)
 * - Market standard: Allow letters, spaces, hyphens, apostrophes, periods
 */
export const validateName = (name, fieldName = "Name") => {
  if (!name || !name.trim()) return `${fieldName} is required`;

  const trimmed = name.trim();

  if (trimmed.length < 2) return `${fieldName} must be at least 2 characters`;
  if (trimmed.length > 100) return `${fieldName} cannot exceed 100 characters`;

  // Standard: Allow letters (including Unicode), spaces, hyphens, apostrophes, periods
  if (!/^[\p{L}\s'-\.]+$/u.test(trimmed)) {
    return `${fieldName} can only contain letters, spaces, hyphens, apostrophes, and periods`;
  }

  return null;
};

/**
 * Validate email (RFC 5322 simplified but practical)
 * - Market standard: RFC 5322 compliant validation
 */
export const validateEmail = (email) => {
  if (!email || !email.trim()) return "Email is required";

  const trimmed = email.trim().toLowerCase();

  // Practical RFC 5322 regex
  const regex =
    /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

  if (!regex.test(trimmed)) return "Invalid email format";
  if (trimmed.length > 255) return "Email is too long (max 255 characters)";

  return null;
};

/**
 * Validate phone number (International format support)
 * - Market standard: Support international formats with +country code
 * - Special handling for India (+91)
 */
export const validatePhone = (phone) => {
  if (!phone || !phone.trim()) return "Phone number is required";

  const cleaned = phone.replace(/\D/g, "");

  // Check length (10-15 digits is international standard)
  if (cleaned.length < 10) return "Phone must be at least 10 digits";
  if (cleaned.length > 15) return "Phone number is invalid (too long)";

  // For Indian numbers, validate specific format
  if (
    phone.includes("+91") ||
    (cleaned.length === 12 && cleaned.startsWith("91"))
  ) {
    if (!/^(?:\+91|91)?[6-9]\d{9}$/.test(phone.replace(/\s/g, ""))) {
      return "Invalid Indian phone number";
    }
  }

  return null;
};

/**
 * Validate department
 * - Market standard: Allow alphanumeric, spaces, ampersand, hyphens, parentheses
 */
export const validateDepartment = (dept) => {
  if (!dept || !dept.trim()) return "Department is required";

  const trimmed = dept.trim();

  if (trimmed.length < 2) return "Department must be at least 2 characters";
  if (trimmed.length > 100) return "Department cannot exceed 100 characters";

  if (!/^[a-zA-Z0-9\s&\-()]+$/.test(trimmed)) {
    return "Department contains invalid characters";
  }

  return null;
};

/**
 * Generic text validation
 * - Market standard: Configurable length requirements
 */
export const validateText = (
  text,
  fieldName = "Text",
  minLength = 1,
  maxLength = 1000,
) => {
  if (minLength > 0 && (!text || !text.trim())) {
    return `${fieldName} is required`;
  }

  if (text && text.trim().length < minLength) {
    return `${fieldName} must be at least ${minLength} characters`;
  }

  if (text && text.trim().length > maxLength) {
    return `${fieldName} cannot exceed ${maxLength} characters`;
  }

  // XSS prevention: Basic check for suspicious content
  if (text && /<script|javascript:|onerror|onload/i.test(text)) {
    return `${fieldName} contains invalid content`;
  }

  return null;
};

/**
 * Validate username
 * - Market standard: alphanumeric, underscore, hyphen (common in SaaS)
 */
export const validateUsername = (username) => {
  if (!username || !username.trim()) return "Username is required";

  const trimmed = username.trim();

  if (trimmed.length < 3) return "Username must be at least 3 characters";
  if (trimmed.length > 50) return "Username cannot exceed 50 characters";

  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return "Username can only contain letters, numbers, underscores, and hyphens";
  }

  // Cannot start with number
  if (/^\d/.test(trimmed)) {
    return "Username cannot start with a number";
  }

  return null;
};

/**
 * Validate password
 * - Market standard: NIST SP 800-63B password guidelines
 */
export const validatePassword = (password) => {
  if (!password) return "Password is required";

  // Minimum 8 characters
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }

  // Maximum reasonable length
  if (password.length > 128) {
    return "Password is too long";
  }

  // Must contain uppercase
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }

  // Must contain lowercase
  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }

  // Must contain number
  if (!/\d/.test(password)) {
    return "Password must contain at least one number";
  }

  // Must contain special character
  if (!/[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return "Password must contain at least one special character (@$!%*?&)";
  }

  return null;
};

// =============== NUMBER VALIDATORS ===============

/**
 * Generic number validation
 * - Market standard: Comprehensive range and type checking
 */
export const validateNumber = (value, fieldName = "Value", options = {}) => {
  const {
    min = 0,
    max = 999999999,
    integer = false,
    required = true,
    decimals = null, // for decimal precision
  } = options;

  if (required && (value === "" || value === null || value === undefined)) {
    return `${fieldName} is required`;
  }

  if (!required && (value === "" || value === null || value === undefined)) {
    return null;
  }

  const num = Number(value);

  if (isNaN(num)) {
    return `${fieldName} must be a valid number`;
  }

  if (integer && !Number.isInteger(num)) {
    return `${fieldName} must be a whole number`;
  }

  if (decimals !== null && !Number.isInteger(num * Math.pow(10, decimals))) {
    return `${fieldName} can have at most ${decimals} decimal places`;
  }

  if (num < min) {
    return `${fieldName} cannot be less than ${min}`;
  }

  if (num > max) {
    return `${fieldName} cannot exceed ${max}`;
  }

  return null;
};

/**
 * Validate years of experience
 * - Market standard: 0-70 years
 */
export const validateExperience = (value) => {
  return validateNumber(value, "Experience", {
    min: 0,
    max: 70,
    integer: true,
    required: true,
  });
};

/**
 * Validate salary
 * - Market standard: Reasonable range for most markets
 */
export const validateSalary = (value, fieldName = "Salary") => {
  return validateNumber(value, fieldName, {
    min: 0,
    max: 100000000, // 100 million (covers most global salaries)
    required: true,
  });
};

/**
 * Validate hourly/daily rate
 */
export const validateRate = (value, fieldName = "Rate") => {
  return validateNumber(value, fieldName, {
    min: 0,
    max: 50000,
    decimals: 2,
    required: true,
  });
};

/**
 * Validate percentage
 */
export const validatePercentage = (value, fieldName = "Percentage") => {
  return validateNumber(value, fieldName, { min: 0, max: 100, decimals: 2 });
};

/**
 * Validate age
 * - Market standard: 18-80 for most employment scenarios
 */
export const validateAge = (value) => {
  return validateNumber(value, "Age", { min: 18, max: 80, integer: true });
};

// =============== DATE VALIDATORS ===============

/**
 * Validate date format
 */
export const validateDate = (dateString, fieldName = "Date") => {
  if (!dateString) return `${fieldName} is required`;

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return `${fieldName} must be a valid date`;
  }

  return null;
};

/**
 * Validate future date
 */
export const validateFutureDate = (dateString, fieldName = "Date") => {
  const dateError = validateDate(dateString, fieldName);
  if (dateError) return dateError;

  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (date < today) {
    return `${fieldName} must be in the future`;
  }

  return null;
};

/**
 * Validate past date
 */
export const validatePastDate = (dateString, fieldName = "Date") => {
  const dateError = validateDate(dateString, fieldName);
  if (dateError) return dateError;

  const date = new Date(dateString);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (date > today) {
    return `${fieldName} must be in the past`;
  }

  return null;
};

/**
 * Validate date range
 */
export const validateDateRange = (
  startDate,
  endDate,
  fieldName = "Date Range",
) => {
  if (!startDate) return `Start ${fieldName} is required`;
  if (!endDate) return `End ${fieldName} is required`;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start > end) {
    return `Start ${fieldName} cannot be after end ${fieldName}`;
  }

  return null;
};

// =============== URL VALIDATORS ===============

/**
 * Validate URL
 * - Market standard: Full URL validation with common protocols
 */
export const validateURL = (url, fieldName = "URL") => {
  if (!url) return null; // optional field
  if (!url.trim()) return null;

  try {
    const urlObj = new URL(url.trim());

    // Only allow http and https
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return `${fieldName} must start with http:// or https://`;
    }

    if (url.length > 2048) return `${fieldName} is too long`;

    return null;
  } catch {
    return `${fieldName} is not a valid URL`;
  }
};

/**
 * Validate LinkedIn URL
 */
export const validateLinkedInURL = (url) => {
  if (!url || !url.trim()) return null; // optional

  try {
    const urlObj = new URL(url.trim());
    if (urlObj.hostname.includes("linkedin.com")) {
      return null;
    }
    return "Must be a valid LinkedIn URL (linkedin.com)";
  } catch {
    return "Invalid LinkedIn URL format";
  }
};

/**
 * Validate GitHub URL
 */
export const validateGitHubURL = (url) => {
  if (!url || !url.trim()) return null; // optional

  try {
    const urlObj = new URL(url.trim());
    if (urlObj.hostname.includes("github.com")) {
      return null;
    }
    return "Must be a valid GitHub URL (github.com)";
  } catch {
    return "Invalid GitHub URL format";
  }
};

// =============== ARRAY VALIDATORS ===============

/**
 * Validate array
 */
export const validateArray = (arr, fieldName = "Items", minLength = 1) => {
  if (!Array.isArray(arr)) return `${fieldName} must be an array`;
  if (arr.length < minLength)
    return `At least ${minLength} ${fieldName} required`;
  return null;
};

/**
 * Validate skills
 * - Market standard: 1-100 skills, 2-50 characters each
 */
export const validateSkills = (skills) => {
  let skillArray = Array.isArray(skills)
    ? skills
    : skills
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s);

  if (skillArray.length === 0) return "At least one skill is required";
  if (skillArray.length > 100) return "Cannot have more than 100 skills";

  for (let skill of skillArray) {
    if (skill.length < 2) return "Each skill must be at least 2 characters";
    if (skill.length > 50) return "Each skill cannot exceed 50 characters";
  }

  return null;
};

// =============== COMPLEX VALIDATORS ===============

/**
 * Validate experience range
 */
export const validateMinMaxExperience = (minExp, maxExp) => {
  const minError = validateExperience(minExp);
  if (minError) return minError;

  const maxError = validateExperience(maxExp);
  if (maxError) return maxError;

  const minNum = Number(minExp);
  const maxNum = Number(maxExp);

  if (minNum > maxNum) {
    return "Minimum experience cannot be greater than maximum experience";
  }

  return null;
};

/**
 * Validate salary range
 */
export const validateSalaryRange = (minSalary, maxSalary) => {
  const minError = validateSalary(minSalary, "Minimum salary");
  if (minError) return minError;

  const maxError = validateSalary(maxSalary, "Maximum salary");
  if (maxError) return maxError;

  const minNum = Number(minSalary);
  const maxNum = Number(maxSalary);

  if (minNum > maxNum) {
    return "Minimum salary cannot be greater than maximum salary";
  }

  return null;
};

// =============== FORM-LEVEL VALIDATORS ===============

/**
 * Validate candidate profile form
 */
export const validateCandidateProfileForm = (form) => {
  const errors = {};

  const nameError = validateName(form.fullName, "Full Name");
  if (nameError) errors.fullName = nameError;

  const emailError = validateEmail(form.email);
  if (emailError) errors.email = emailError;

  const phoneError = validatePhone(form.phone);
  if (phoneError) errors.phone = phoneError;

  if (form.currentLocation) {
    const locError = validateText(form.currentLocation, "Location", 2, 100);
    if (locError) errors.currentLocation = locError;
  }

  if (form.linkedinUrl) {
    const urlError = validateLinkedInURL(form.linkedinUrl);
    if (urlError) errors.linkedinUrl = urlError;
  }

  if (form.githubUrl) {
    const urlError = validateGitHubURL(form.githubUrl);
    if (urlError) errors.githubUrl = urlError;
  }

  if (form.portfolioUrl) {
    const urlError = validateURL(form.portfolioUrl, "Portfolio URL");
    if (urlError) errors.portfolioUrl = urlError;
  }

  if (form.experience) {
    const expError = validateExperience(form.experience);
    if (expError) errors.experience = expError;
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

/**
 * Validate job form
 */
export const validateJobForm = (form) => {
  const errors = {};

  const titleError = validateText(form.title, "Title", 5, 200);
  if (titleError) errors.title = titleError;

  const descError = validateText(form.description, "Description", 10, 5000);
  if (descError) errors.description = descError;

  if (form.department) {
    const deptError = validateDepartment(form.department);
    if (deptError) errors.department = deptError;
  }

  if (form.location) {
    const locError = validateText(form.location, "Location", 2, 100);
    if (locError) errors.location = locError;
  }

  if (form.min_experience !== "" || form.max_experience !== "") {
    const rangeError = validateMinMaxExperience(
      form.min_experience || 0,
      form.max_experience || 0,
    );
    if (rangeError) errors.experience = rangeError;
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

// =============== HELPER FUNCTIONS ===============

/**
 * Sanitize text input
 */
export const sanitizeText = (text) => {
  if (typeof text !== "string") return "";
  return text.trim().replace(/<[^>]*>/g, ""); // Remove HTML tags
};

/**
 * Sanitize number input
 */
export const sanitizeNumber = (value) => {
  const num = Number(value);
  return isNaN(num) ? 0 : num;
};

/**
 * Sanitize email
 */
export const sanitizeEmail = (email) => {
  return email.trim().toLowerCase();
};

/**
 * Check if form has any errors
 */
export const hasErrors = (errors) => {
  if (!errors) return false;
  return Object.keys(errors).length > 0;
};

/**
 * Get first error message
 */
export const getFirstError = (errors) => {
  if (!errors || typeof errors !== "object") return null;
  const keys = Object.keys(errors);
  return keys.length > 0 ? errors[keys[0]] : null;
};

// =============== EDUCATION VALIDATION & DEGREES ===============

/**
 * Valid education degrees - Market standard Indian education system
 */
export const VALID_DEGREES = [
  { value: "10th", label: "10th Standard" },
  { value: "12th", label: "12th Standard" },
  { value: "diploma", label: "Diploma" },
  { value: "ba", label: "B.A (Bachelor of Arts)" },
  { value: "bsc", label: "B.Sc (Bachelor of Science)" },
  { value: "bcom", label: "B.Com (Bachelor of Commerce)" },
  { value: "be", label: "B.E (Bachelor of Engineering)" },
  { value: "btech", label: "B.Tech (Bachelor of Technology)" },
  { value: "bca", label: "B.C.A (Bachelor of Computer Applications)" },
  { value: "bba", label: "B.B.A (Bachelor of Business Administration)" },
  { value: "ma", label: "M.A (Master of Arts)" },
  { value: "msc", label: "M.Sc (Master of Science)" },
  { value: "mcom", label: "M.Com (Master of Commerce)" },
  { value: "me", label: "M.E (Master of Engineering)" },
  { value: "mtech", label: "M.Tech (Master of Technology)" },
  { value: "mba", label: "M.B.A (Master of Business Administration)" },
  { value: "mca", label: "M.C.A (Master of Computer Applications)" },
  { value: "phd", label: "Ph.D (Doctor of Philosophy)" },
  { value: "other", label: "Other" },
];

/**
 * Validate education field - must be from predefined list
 */
export const validateEducation = (education) => {
  if (!education || !education.trim()) return "Education is required";

  const isValid = VALID_DEGREES.some(
    (deg) => deg.value.toLowerCase() === education.toLowerCase(),
  );

  if (!isValid) {
    return "Please select a valid education degree";
  }

  return null;
};

// =============== NOTICE PERIOD VALIDATION ===============

/**
 * Valid notice periods
 */
export const NOTICE_PERIODS = [
  { value: "0", label: "Immediately" },
  { value: "15", label: "15 Days" },
  { value: "30", label: "30 Days" },
  { value: "60", label: "60 Days" },
  { value: "90", label: "90 Days" },
  { value: "custom", label: "Custom (Enter manually)" },
];

/**
 * Validate notice period
 */
export const validateNoticePeriod = (value) => {
  if (!value || value.toString().trim() === "")
    return "Notice period is required";

  const numValue = parseInt(value);
  if (isNaN(numValue) || numValue < 0)
    return "Notice period must be 0 or more days";
  if (numValue > 365) return "Notice period cannot exceed 365 days";

  return null;
};

// =============== LANGUAGES VALIDATION ===============

/**
 * Popular professional languages
 */
export const PROFESSIONAL_LANGUAGES = [
  { value: "english", label: "English" },
  { value: "hindi", label: "Hindi" },
  { value: "spanish", label: "Spanish" },
  { value: "french", label: "French" },
  { value: "german", label: "German" },
  { value: "chinese", label: "Chinese (Mandarin)" },
  { value: "japanese", label: "Japanese" },
  { value: "korean", label: "Korean" },
  { value: "portuguese", label: "Portuguese" },
  { value: "russian", label: "Russian" },
  { value: "arabic", label: "Arabic" },
  { value: "italian", label: "Italian" },
  { value: "dutch", label: "Dutch" },
  { value: "turkish", label: "Turkish" },
  { value: "bengali", label: "Bengali" },
  { value: "telugu", label: "Telugu" },
  { value: "marathi", label: "Marathi" },
  { value: "tamil", label: "Tamil" },
  { value: "kannada", label: "Kannada" },
  { value: "gujarati", label: "Gujarati" },
  { value: "malayalam", label: "Malayalam" },
  { value: "punjabi", label: "Punjabi" },
  { value: "other", label: "Other" },
];

/**
 * Validate language - must be from list or custom string
 */
export const validateLanguage = (lang) => {
  if (!lang || !lang.trim()) return "Language is required";

  const trimmed = lang.trim();
  if (trimmed.length < 2) return "Language name must be at least 2 characters";
  if (trimmed.length > 50) return "Language name is too long";

  if (!/^[a-zA-Z\s&\-()]+$/.test(trimmed)) {
    return "Language contains invalid characters";
  }

  return null;
};

// =============== READY TO RELOCATE VALIDATION ===============

/**
 * Ready to relocate options
 */
export const RELOCATION_OPTIONS = [
  { value: "yes", label: "Yes, I'm ready to relocate" },
  { value: "no", label: "No, not open to relocation" },
  { value: "open", label: "Open to discussion" },
];

// =============== CTC VALIDATION (Alphanumeric with format support) ===============

/**
 * Validate CTC - Allows formats like "5L", "1Cr", "25K" or plain numbers
 * Returns numeric value for storage
 */
export const validateCTC = (value) => {
  if (!value || value.toString().trim() === "") return null; // Optional field

  const input = value.toString().trim().toUpperCase();

  // Check if it's a valid format: number followed by optional L/Cr/K suffix
  if (!/^\d+(\.\d+)?\s*([LCrK]|Cr)?$/.test(input)) {
    return "Invalid CTC format. Use formats like: 5L, 1Cr, 25K, or plain number";
  }

  return null;
};

// =============== EXPORT ALL VALIDATORS FOR BULK VALIDATION ===============
