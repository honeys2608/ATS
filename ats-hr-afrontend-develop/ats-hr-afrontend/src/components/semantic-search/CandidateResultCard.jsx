import React, { useEffect, useState } from "react";
import "./CandidateResultCard.css";
import { toApiAssetUrl } from "../../utils/candidateProfileUtils";

const getValue = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    return value;
  }
  return null;
};

const toDisplayText = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text === "0") return null;
  if (text.toLowerCase() === "n/a") return null;
  if (text === "—" || text === "--") return null;
  return text;
};

const toNumericScore = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(100, Math.max(0, Math.round(parsed)));
};

const deriveNameFromEmail = (email) => {
  if (!email || typeof email !== "string" || !email.includes("@")) return "";
  const local = email.split("@")[0] || "";
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatSalary = (value) => {
  if (!value) return null;
  const number = Number(String(value).replace(/[^0-9.]/g, ""));
  if (Number.isNaN(number)) return value;
  return number.toLocaleString("en-IN");
};

const getInitials = (value) =>
  String(value || "")
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const IconMail = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4 5h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7a2 2 0 012-2zm0 2l8 5 8-5H4zm16 10V9l-8 5-8-5v8h16z"
      fill="currentColor"
    />
  </svg>
);

const IconPhone = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M6.6 10.8a15.6 15.6 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11.4 11.4 0 003.6.6 1 1 0 011 1v3.4a1 1 0 01-1 1A18 18 0 013 5a1 1 0 011-1h3.4a1 1 0 011 1 11.4 11.4 0 00.6 3.6 1 1 0 01-.24 1z"
      fill="currentColor"
    />
  </svg>
);

const IconBriefcase = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M9 3h6a2 2 0 012 2v2h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2h3V5a2 2 0 012-2zm0 4h6V5H9v2zm12 4H3v7h18v-7z"
      fill="currentColor"
    />
  </svg>
);

const IconTag = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M20.6 13.3l-7.3 7.3a2 2 0 01-2.8 0l-8.1-8.1A2 2 0 012 11.1V4a2 2 0 012-2h7.1a2 2 0 011.4.6l8.1 8.1a2 2 0 010 2.8zM7.5 7A1.5 1.5 0 109 8.5 1.5 1.5 0 007.5 7z"
      fill="currentColor"
    />
  </svg>
);

const IconLocation = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 2a7 7 0 00-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 00-7-7zm0 9a2 2 0 110-4 2 2 0 010 4z"
      fill="currentColor"
    />
  </svg>
);

const IconWallet = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M20 6H6a2 2 0 00-2 2v8a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2zm0 2v2h-4a2 2 0 100 4h4v2H6V8h14z"
      fill="currentColor"
    />
  </svg>
);

export default function CandidateResultCard({
  candidate,
  selected,
  onSelect,
  onViewDetails,
}) {
  const candidateId = getValue(candidate.id, candidate._id, candidate.candidate_id);
  const name = getValue(candidate.full_name, candidate.name) ||
    deriveNameFromEmail(candidate.email) ||
    "Candidate";
  const email = getValue(candidate.email);
  const phone = getValue(candidate.phone, candidate.mobile, candidate.phone_number);
  const location = toDisplayText(getValue(
    candidate.current_location,
    candidate.location,
    candidate.city,
  ));
  const experienceRaw = getValue(candidate.experience_years, candidate.experience);
  const hasExperience =
    experienceRaw !== null &&
    experienceRaw !== undefined &&
    String(experienceRaw).trim() !== "";
  const experienceLabel = hasExperience
    ? `${String(experienceRaw).trim()} years experience`
    : null;
  const skills = Array.isArray(candidate.skills)
    ? candidate.skills
    : typeof candidate.skills === "string"
      ? candidate.skills.split(/,|;/).map((s) => s.trim()).filter(Boolean)
      : [];
  const displaySkills = skills.slice(0, 3);
  const rawSalary = getValue(
    candidate.expected_ctc,
    candidate.expected_salary,
    candidate.current_ctc,
  );
  const numericSalary = Number(String(rawSalary ?? "").replace(/[^0-9.]/g, ""));
  const salary = Number.isFinite(numericSalary) && numericSalary > 0
    ? rawSalary
    : null;
  const matchScore = toNumericScore(getValue(
    candidate.semantic_score,
    candidate.match_score,
    candidate.relevance_score,
  ));
  const photoUrl = toApiAssetUrl(getValue(
    candidate.photo_url,
    candidate.photoUrl,
    candidate.avatar_url,
    candidate.avatarUrl,
    candidate.profile_picture,
    candidate.profilePicture,
    candidate.photo,
    candidate.image_url,
    candidate.imageUrl,
  ));
  const initials = getInitials(name) || "CA";
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);

  useEffect(() => {
    setPhotoLoadFailed(false);
  }, [photoUrl, candidateId]);

  return (
    <div className={`candidate-result-card ${selected ? "selected" : ""}`}>
      <div className="card-header">
        <input
          type="checkbox"
          className="card-checkbox"
          checked={selected}
          onChange={() => onSelect(candidateId)}
          aria-label={`Select ${name}`}
        />
        <div className="card-avatar">
          {photoUrl && !photoLoadFailed ? (
            <img
              src={photoUrl}
              alt={`${name} profile`}
              className="avatar-image"
              loading="lazy"
              onError={() => setPhotoLoadFailed(true)}
            />
          ) : (
            <div className="avatar-placeholder">{initials}</div>
          )}
        </div>
        <div className="card-info">
          <div className="card-title-row">
            <h3 className="card-name">{name}</h3>
            {matchScore !== null && matchScore > 0 && (
              <span className="match-badge">{matchScore}% Match</span>
            )}
          </div>
          <div className="card-contact">
            {email && (
              <span className="contact-link">
                <span className="contact-icon">
                  <IconMail />
                </span>
                {email}
              </span>
            )}
            {phone && (
              <span className="contact-link">
                <span className="contact-icon">
                  <IconPhone />
                </span>
                {phone}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="card-body">
        {experienceLabel && (
          <div className="card-detail-row">
            <span className="detail-icon">
              <IconBriefcase />
            </span>
            <span>{experienceLabel}</span>
          </div>
        )}
        {displaySkills.length > 0 && (
          <div className="card-detail-row">
            <span className="detail-icon">
              <IconTag />
            </span>
            <span>{displaySkills.join(", ")}</span>
          </div>
        )}
        {location && (
          <div className="card-detail-row">
            <span className="detail-icon">
              <IconLocation />
            </span>
            <span>{location}</span>
          </div>
        )}
        {salary && (
          <div className="card-detail-row">
            <span className="detail-icon">
              <IconWallet />
            </span>
            <span>INR {formatSalary(salary)} LPA</span>
          </div>
        )}
      </div>

      <div className="card-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={() => onViewDetails(candidate)}
        >
          View Details
        </button>
      </div>
    </div>
  );
}
