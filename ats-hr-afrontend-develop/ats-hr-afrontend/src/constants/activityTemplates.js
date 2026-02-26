export const TEMPLATES = {
  "admin.job_created": "{actor} created job {resource_name}",
  "admin.candidate_hired": "{actor} marked {resource_name} as hired",
  "admin.invoice_sent": "{actor} sent invoice to {metadata.client_name}",
  "admin.user_role_changed": "{actor} changed role for {resource_name}",

  "am.shortlisted": "{actor} shortlisted {resource_name} for {metadata.job_title}",
  "am.placed_on_hold": "{actor} placed {resource_name} on hold",
  "am.rejected": "{actor} rejected {resource_name}",
  "am.sent_to_client": "{actor} sent {resource_name} to {metadata.client_name}",
  "am.client_shortlisted": "{metadata.client_name} shortlisted {resource_name}",
  "am.interview_scheduling_ready": "{actor} marked {resource_name} ready for interview",
  "am.requirement_approved": "{actor} approved requirement {resource_name}",
  "am.requirement_activated": "{actor} converted requirement to job {resource_name}",
  "am.recruiter_assigned": "{actor} assigned recruiter {metadata.recruiter_name} to {resource_name}",
  "am.timesheet_approved": "{actor} approved timesheet",
  "am.timesheet_rejected": "{actor} rejected timesheet",

  "recruiter.candidate_added": "{actor} added candidate {resource_name}",
  "recruiter.submitted_to_am": "{actor} submitted {resource_name} for {metadata.job_title}",
  "recruiter.feedback_added": "{actor} added feedback for {resource_name}",
  "recruiter.interview_scheduled":
    "{actor} scheduled interview for {resource_name} on {metadata.date}",
  "recruiter.resume_uploaded": "{actor} uploaded resume for {resource_name}",

  "application.shortlisted": "You were shortlisted for {metadata.job_title}",
  "application.sent_to_client": "Your profile was shared with {metadata.client_name}",
  "application.selected": "Congratulations! You were selected for {metadata.job_title}",
  "application.hired": "Welcome! You have been hired for {metadata.job_title}",
  "application.client_rejected":
    "We have moved forward with other candidates for this role",
};

const ROLE_LABELS = {
  admin: "Admin",
  am: "AM",
  account_manager: "AM",
  recruiter: "Recruiter",
  candidate: "Candidate",
  system: "System",
};

export const getRoleLabel = (role) => {
  const key = String(role || "").trim().toLowerCase();
  return ROLE_LABELS[key] || (role ? String(role) : "System");
};

const tokenValue = (entry, token) => {
  if (token === "actor") return entry.actor_name || "System";
  if (token === "resource_name") return entry.resource_name || "record";
  if (token === "old_status") return entry.old_status || "";
  if (token === "new_status") return entry.new_status || "";

  if (token.startsWith("metadata.")) {
    const k = token.split(".")[1];
    return entry.metadata?.[k] ?? "";
  }
  return entry[token] ?? "";
};

export const renderTemplate = (entry = {}) => {
  const template = TEMPLATES[entry.action] || "{actor} performed {action} on {resource_name}";
  return template.replace(/\{([^}]+)\}/g, (_, token) => {
    const value = tokenValue(entry, token);
    return value === null || value === undefined || value === "" ? "--" : String(value);
  });
};

export const formatRelative = (value) => {
  if (!value) return "--";
  const raw = String(value).trim();
  const hasTimezone = /(?:[zZ]|[+-]\d{2}(?::?\d{2})?)$/.test(raw);
  const date = new Date(hasTimezone ? raw : `${raw}Z`);
  if (Number.isNaN(date.getTime())) return "--";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return date.toLocaleDateString();
};
