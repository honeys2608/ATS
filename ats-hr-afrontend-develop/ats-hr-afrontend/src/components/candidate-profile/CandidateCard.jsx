import React, { useMemo, useState } from "react";
import { Mail, MapPin, Phone, Upload, FileSpreadsheet, Circle } from "lucide-react";
import { formatStatus } from "../../utils/formatStatus";

const pick = (...values) => {
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

const toSkills = (skills) => {
  if (Array.isArray(skills)) {
    return skills
      .map((skill) => (typeof skill === "string" ? skill : skill?.name))
      .filter(Boolean);
  }
  if (typeof skills === "string") {
    return skills.split(/,|;/).map((skill) => skill.trim()).filter(Boolean);
  }
  return [];
};

const toInitials = (name = "") =>
  String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

const normalizeSource = (value = "") => String(value || "").trim().toLowerCase();

const sourceBadgeClass = (source = "") => {
  const normalized = normalizeSource(source);
  if (normalized.includes("excel")) return "candidate-card-premium__source-badge--excel";
  if (normalized.includes("bulk")) return "candidate-card-premium__source-badge--bulk";
  return "candidate-card-premium__source-badge--default";
};

const NoticeClassByValue = (notice = "") => {
  const normalized = String(notice || "").trim().toLowerCase();
  if (!normalized || normalized === "n/a" || normalized === "na") {
    return "candidate-card-premium__notice--unknown";
  }
  if (normalized.includes("immediate") || normalized === "0" || normalized.includes("0 day")) {
    return "candidate-card-premium__notice--immediate";
  }

  const daysMatch = normalized.match(/\d+/);
  const days = daysMatch ? Number(daysMatch[0]) : NaN;
  if (Number.isFinite(days)) {
    if (days <= 15) return "candidate-card-premium__notice--short";
    if (days <= 45) return "candidate-card-premium__notice--medium";
    return "candidate-card-premium__notice--long";
  }

  return "candidate-card-premium__notice--unknown";
};

const skillVariantClass = (index) => {
  const variants = [
    "candidate-card-premium__skill--blue",
    "candidate-card-premium__skill--teal",
    "candidate-card-premium__skill--violet",
    "candidate-card-premium__skill--indigo",
  ];
  return variants[index % variants.length];
};

const INITIAL_STATUSES = new Set(["", "new", "applied", "sourced", "verified"]);
const RECRUITER_ACTION_STATUSES = new Set([
  "called",
  "feedback_added",
  "hold_revisit",
  "rejected_by_recruiter",
  "sent_to_am",
  "shortlisted",
]);
const AM_ACTION_STATUSES = new Set([
  "am_viewed",
  "am_shortlisted",
  "am_hold",
  "am_rejected",
  "sent_to_client",
]);
const CLIENT_ACTION_STATUSES = new Set([
  "client_viewed",
  "client_shortlisted",
  "client_hold",
  "client_rejected",
]);
const POST_AM_VISIBLE_STATUSES = new Set([
  "sent_to_am",
  "am_viewed",
  "am_shortlisted",
  "am_hold",
  "am_rejected",
  "sent_to_client",
  "client_viewed",
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
]);

export default function CandidateCard({
  candidate,
  profile,
  workflowMeta,
  selectable = false,
  selected = false,
  onSelect,
  onViewDetails,
}) {
  const [activeTagKey, setActiveTagKey] = useState("");
  const id = profile?.id || candidate?.id || candidate?._id || candidate?.candidate_id;
  const name = pick(profile?.name, candidate?.full_name, candidate?.name, "Unknown");
  const designation = pick(
    profile?.designation,
    profile?.currentRole,
    candidate?.current_designation,
    candidate?.designation,
    candidate?.current_role,
    "Not specified",
  );
  const assignedRole = pick(
    workflowMeta?.roleName,
    candidate?.assignment_role,
    candidate?.requirement_title,
    candidate?.job_title,
    candidate?.applied_role,
    candidate?.applied_for,
    candidate?.requirement?.title,
    candidate?.job?.title,
    profile?.jobTitle,
    profile?.jobTitle,
    designation,
  );
  const exp = pick(profile?.totalExperience, candidate?.experience_years, candidate?.total_experience, "N/A");
  const notice = pick(profile?.noticePeriod, "N/A");
  const phone = pick(profile?.phone, candidate?.phone, candidate?.phone_number, "N/A");
  const email = pick(profile?.email, candidate?.email, "N/A");
  const location = pick(profile?.location, profile?.city, candidate?.location, "N/A");
  const source = pick(candidate?.source, "Portal");
  const skills = toSkills(profile?.skills);
  const visibleSkills = skills.slice(0, 4);
  const moreSkills = Math.max(0, skills.length - visibleSkills.length);
  const avatarUrl = pick(
    profile?.avatarUrl,
    profile?.photoUrl,
    candidate?.avatar_url,
    candidate?.photo_url,
    candidate?.profile_photo,
  );
  const recruiterName = pick(workflowMeta?.recruiterName, candidate?.recruiter_name);
  const amName = pick(
    workflowMeta?.amName,
    candidate?.assigned_by_name,
    candidate?.assigned_by,
    candidate?.submitted_to_am_name,
    candidate?.am_name,
    profile?.accountManager?.name,
    candidate?.am_name,
    candidate?.account_manager_name,
    candidate?.accountManagerName,
    candidate?.account_manager?.name,
    candidate?.account_manager?.am_name,
    candidate?.am?.name,
    candidate?.am?.am_name,
    candidate?.submission?.account_manager_name,
    candidate?.submission?.account_manager?.name,
    candidate?.requirement?.account_manager_name,
    candidate?.requirement?.account_manager?.name,
    candidate?.job?.account_manager_name,
    candidate?.job?.account_manager?.name,
  );
  const clientName = pick(
    workflowMeta?.clientName,
    candidate?.client_name,
    candidate?.client_display_name,
    candidate?.clientName,
    candidate?.company_name,
    candidate?.companyName,
    candidate?.client?.name,
    candidate?.client?.client_name,
    candidate?.client?.company_name,
    candidate?.submission?.client_name,
    candidate?.submission?.client?.name,
    candidate?.submission?.client?.client_name,
    candidate?.submission?.client?.company_name,
    candidate?.requirement?.client_name,
    candidate?.requirement?.client?.name,
    candidate?.requirement?.client?.client_name,
    candidate?.requirement?.client?.company_name,
    candidate?.job?.client_name,
    candidate?.job?.clientName,
    candidate?.job?.client?.name,
    candidate?.job?.client?.client_name,
    candidate?.job?.client?.company_name,
  );
  const actedBy = pick(
    workflowMeta?.actedBy,
    candidate?.updated_by_name,
    candidate?.submitted_by_name,
    candidate?.recruiter_name,
  );
  const normalizedStatus = String(
    workflowMeta?.statusRaw || profile?.status || candidate?.status || "",
  )
    .trim()
    .toLowerCase();

  const hasMeaningfulStatus = !INITIAL_STATUSES.has(normalizedStatus);
  const hasRecruiterAction = RECRUITER_ACTION_STATUSES.has(normalizedStatus);
  const hasAmAction = AM_ACTION_STATUSES.has(normalizedStatus);
  const hasClientAction = CLIENT_ACTION_STATUSES.has(normalizedStatus);

  const showActionTag = POST_AM_VISIBLE_STATUSES.has(normalizedStatus);
  const actionTags = showActionTag
    ? [
        {
          key: "status",
          className:
            hasClientAction
              ? "candidate-card-premium__action-tag--client"
              : hasAmAction
                ? "candidate-card-premium__action-tag--am"
                : hasRecruiterAction
                  ? "candidate-card-premium__action-tag--recruiter"
                  : "candidate-card-premium__action-tag--status",
          label: formatStatus(normalizedStatus),
          detailTitle:
            hasClientAction
              ? "Client Action"
              : hasAmAction
                ? "Account Manager Action"
                : hasRecruiterAction
                  ? "Recruiter Action"
                  : "Status Update",
        },
      ]
    : [];

  const activeTag = useMemo(
    () => actionTags.find((tag) => tag.key === activeTagKey) || null,
    [actionTags, activeTagKey],
  );

  return (
    <div className="candidate-card--premium">
      <div className="candidate-card-premium__header">
        <div className="candidate-card-premium__header-left">
          {selectable && (
            <label className="candidate-card-premium__select">
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onSelect?.(id)}
                aria-label={`Select ${name}`}
              />
            </label>
          )}

          <div className="candidate-card-premium__avatar-shell">
            <div className="candidate-card-premium__avatar-ring">
              {avatarUrl ? (
                <img src={avatarUrl} alt={name} className="candidate-card-premium__avatar-image" />
              ) : (
                <span className="candidate-card-premium__avatar-initials">{toInitials(name)}</span>
              )}
            </div>
          </div>

          <div className="candidate-card-premium__identity">
            <h3 className="candidate-card-premium__name">{name}</h3>
            <p className="candidate-card-premium__role">{designation}</p>
            <span className="candidate-card-premium__experience-badge">{exp}</span>
          </div>
        </div>

        <div className="candidate-card-premium__header-right">
          <span
            className={`candidate-card-premium__source-badge ${sourceBadgeClass(source)}`}
            title={source}
          >
            <span className="candidate-card-premium__source-icon">
              {sourceBadgeClass(source).includes("--excel") ? <FileSpreadsheet /> : <Upload />}
            </span>
            <span className="candidate-card-premium__source-text">{source || "Portal"}</span>
          </span>

          {actionTags.length > 0 && (
            <div className="candidate-card-premium__action-tags candidate-card-premium__action-tags--header">
              {actionTags.map((tag) => (
                <button
                  key={tag.key}
                  type="button"
                  className={`candidate-card-premium__action-tag ${tag.className} ${
                    activeTagKey === tag.key ? "candidate-card-premium__action-tag--active" : ""
                  }`}
                  onClick={() =>
                    setActiveTagKey((prev) => (prev === tag.key ? "" : tag.key))
                  }
                >
                  {tag.label}
                </button>
              ))}
            </div>
          )}

          {activeTag && (
            <div className="candidate-card-premium__action-detail">
              <div className="candidate-card-premium__action-detail-title">
                {activeTag.detailTitle}
              </div>
              <div className="candidate-card-premium__action-detail-line">
                Client: {clientName || "N/A"}
              </div>
              <div className="candidate-card-premium__action-detail-line">
                Role: {assignedRole || "N/A"}
              </div>
              <div className="candidate-card-premium__action-detail-line">
                Account Manager: {amName || "N/A"}
              </div>
              <div className="candidate-card-premium__action-detail-line">
                Recruiter: {recruiterName || "N/A"}
              </div>
              <div className="candidate-card-premium__action-detail-line">
                Used by Recruiter: {recruiterName || actedBy || "N/A"}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="candidate-card-premium__content">
        <span className={`candidate-card-premium__notice ${NoticeClassByValue(notice)}`}>
          <span className="candidate-card-premium__notice-icon">
            <Circle size={10} fill="currentColor" />
          </span>
          {notice}
        </span>

        <div className="candidate-card-premium__contact-row">
          <a href={`tel:${phone}`} className="candidate-card-premium__contact-item">
            <span className="candidate-card-premium__contact-icon">
              <Phone />
            </span>
            <span className="candidate-card-premium__contact-text">{phone}</span>
          </a>
          <a href={`mailto:${email}`} className="candidate-card-premium__contact-item">
            <span className="candidate-card-premium__contact-icon">
              <Mail />
            </span>
            <span className="candidate-card-premium__contact-text candidate-card-premium__contact-text--email">
              {email}
            </span>
          </a>
        </div>

        <div className="candidate-card-premium__contact-row">
          <span className="candidate-card-premium__contact-item candidate-card-premium__contact-item--muted">
            <span className="candidate-card-premium__contact-icon">
              <MapPin />
            </span>
            <span className="candidate-card-premium__contact-text">{location}</span>
          </span>
        </div>

        <div className="candidate-card-premium__skills">
          {visibleSkills.length > 0 ? (
            <>
              {visibleSkills.map((skill, index) => (
                <span
                  key={`${id}-${skill}-${index}`}
                  className={`candidate-card-premium__skill-chip ${skillVariantClass(index)}`}
                >
                  {skill}
                </span>
              ))}
              {moreSkills > 0 && (
                <span className="candidate-card-premium__skill-more">+{moreSkills} more</span>
              )}
            </>
          ) : (
            <span className="candidate-card-premium__skill-empty">No skills added</span>
          )}
        </div>

        <div className="candidate-card-premium__footer">
          <button
            type="button"
            className="candidate-card-premium__view-btn"
            onClick={() => onViewDetails?.(candidate)}
          >
            View Profile
          </button>
        </div>
      </div>
    </div>
  );
}
