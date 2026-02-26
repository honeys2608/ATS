import React, { useEffect, useMemo, useRef, useState } from "react";
import CallFeedbackHistory from "../call-feedback/CallFeedbackHistory";
import { formatStatus } from "../../utils/formatStatus";
import { toApiAssetUrl } from "../../utils/candidateProfileUtils";
import "../../pages/CandidateProfileAdmin.css";

const hasValue = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
};

const pickFirst = (...values) => {
  for (const value of values) {
    if (hasValue(value)) return value;
  }
  return null;
};

const renderValue = (value, fallback = "N/A") => {
  if (!hasValue(value)) return fallback;
  if (Array.isArray(value)) return value.length ? value.join(", ") : fallback;
  return value;
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

const formatDateTime = (value) => {
  const date = asDate(value);
  return date ? date.toLocaleString("en-US") : "N/A";
};

const normalizeList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value
      .split(/,|;|\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const toYesNo = (value) => {
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (typeof value === "number") {
    if (value === 1) return "Yes";
    if (value === 0) return "No";
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["yes", "y", "true", "1"].includes(normalized)) return "Yes";
    if (["no", "n", "false", "0"].includes(normalized)) return "No";
    return value.trim();
  }
  return value;
};

const normalizeCurrencyDisplay = (value) =>
  value === "N/A" || !hasValue(value) ? null : value;

const toSafeOpenUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("blob:") || raw.startsWith("data:")) return raw;
  return encodeURI(raw);
};

const Section = ({ id, title, children, actions = null }) => (
  <section id={id} className="candidate-detail__section">
    <div className="candidate-detail__section-header">
      <h3>{title}</h3>
      {actions}
    </div>
    <div className="candidate-detail__section-body">{children}</div>
  </section>
);

const FieldGrid = ({ fields }) => (
  <div className="candidate-detail__grid">
    {fields.map((field) => (
      <div key={field.label} className="candidate-detail__field">
        <div className="candidate-detail__field-label">{field.label}</div>
        <div className="candidate-detail__field-value">
          {renderValue(field.value)}
        </div>
      </div>
    ))}
  </div>
);

const EmptyState = ({ label }) => (
  <div className="candidate-detail__empty">{label}</div>
);

const DEFAULT_STATUS_OPTIONS = [
  "new",
  "applied",
  "sourced",
  "called",
  "feedback_added",
  "hold_revisit",
  "rejected_by_recruiter",
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
  "rejected",
];

const EMPTY_STATUS_OPTIONS = [];

export default function CandidateDetail({
  candidate,
  profile,
  loading,
  onClose,
  onPreviewResume,
  onScheduleInterview,
  onShortlist,
  onAddNote,
  onSendEmail,
  onOpenFullProfile,
  onOpenFeedback,
  onMessageAm,
  onMessageCandidate,
  customQuickActions,
  onSendToAM,
  onUpdateStatus,
  workflowStatusOptions = EMPTY_STATUS_OPTIONS,
  hideQuickActions = false,
  hideStatusControls = false,
  hideSendToAMAction = false,
  hideScheduleInterviewAction = false,
  hideOpenFullProfileAction = false,
}) {
  const contentRef = useRef(null);
  const [search, setSearch] = useState("");
  const [showFeedbackHistoryModal, setShowFeedbackHistoryModal] =
    useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: "", text: "" });

  const sections = useMemo(
    () => [
      { id: "notice", label: "Notice Period" },
      { id: "personal", label: "Personal Information" },
      { id: "professional", label: "Professional Information" },
      { id: "education", label: "Education Details" },
      { id: "skills", label: "Skills" },
      { id: "certifications", label: "Certifications" },
      { id: "experience", label: "Experience" },
    ],
    [],
  );

  const filteredSections = useMemo(() => {
    if (!search.trim()) return sections;
    return sections.filter((section) =>
      section.label.toLowerCase().includes(search.trim().toLowerCase()),
    );
  }, [search, sections]);

  useEffect(() => {
    const handler = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!candidate || !profile) return null;

  const candidateId =
    candidate?.id || candidate?._id || candidate?.candidate_id || "";
  const currentStatus = String(profile?.status || candidate?.status || "")
    .toLowerCase()
    .trim();

  const resolvedStatusOptions = useMemo(() => {
    const seen = new Set();
    const source = workflowStatusOptions.length
      ? workflowStatusOptions
      : DEFAULT_STATUS_OPTIONS.map((status) => ({
          value: status,
          label: formatStatus(status),
        }));

    return source
      .map((option) => {
        if (typeof option === "string") {
          return { value: option.toLowerCase(), label: formatStatus(option) };
        }
        const value = String(option?.value || "")
          .toLowerCase()
          .trim();
        if (!value) return null;
        return { value, label: option.label || formatStatus(value) };
      })
      .filter((option) => {
        if (!option || seen.has(option.value)) return false;
        seen.add(option.value);
        return true;
      });
  }, [workflowStatusOptions]);

  useEffect(() => {
    const nextStatus = currentStatus || resolvedStatusOptions[0]?.value || "";
    setSelectedStatus((prev) => (prev === nextStatus ? prev : nextStatus));
    setStatusMessage((prev) =>
      prev.type || prev.text ? { type: "", text: "" } : prev,
    );
  }, [candidateId, currentStatus, resolvedStatusOptions]);

  const noticePeriodFields = [{ label: "Notice Period", value: profile.noticePeriod }];
  const personalFields = [
    { label: "Name", value: profile.name },
    { label: "Gender", value: profile.gender },
    {
      label: "DOB",
      value: hasValue(profile.dateOfBirth) ? formatDate(profile.dateOfBirth) : null,
    },
    { label: "Phone Number", value: profile.phone },
    { label: "Email", value: profile.email },
    {
      label: "Current Address",
      value: pickFirst(profile.currentAddress, candidate.current_address),
    },
    {
      label: "Permanent Address",
      value: pickFirst(profile.permanentAddress, candidate.permanent_address),
    },
    { label: "City", value: pickFirst(profile.city, candidate.city) },
    { label: "Pincode", value: pickFirst(profile.pincode, candidate.pincode) },
    {
      label: "Ready to Relocate",
      value: toYesNo(
        pickFirst(
          profile.readyToRelocate,
          profile.willingToRelocate,
          candidate.ready_to_relocate,
          candidate.willing_to_relocate,
          candidate.readyToRelocate,
          candidate.willingToRelocate,
          candidate.open_to_relocate,
          candidate.openToRelocate,
        ),
      ),
    },
    {
      label: "Preferred Location",
      value: pickFirst(profile.preferredLocation, candidate.preferred_location),
    },
  ];
  const professionalFields = [
    {
      label: "Designation",
      value: pickFirst(
        profile.designation,
        profile.currentRole,
        candidate.current_designation,
        candidate.currentDesignation,
        candidate.current_job_title,
        candidate.currentJobTitle,
        candidate.designation,
        candidate.current_role,
        candidate.currentRole,
        candidate.role,
        profile.workHistory?.[0]?.role,
        profile.workHistory?.[0]?.designation,
        profile.workHistory?.[0]?.title,
        candidate.work_history?.[0]?.role,
        candidate.work_history?.[0]?.designation,
        candidate.work_history?.[0]?.title,
      ),
    },
    {
      label: "Current CTC",
      value: normalizeCurrencyDisplay(
        pickFirst(
          profile.currentCtcDisplay,
          candidate.current_ctc,
          candidate.currentCtc,
          candidate.current_salary,
          candidate.currentSalary,
          candidate.currentCTC,
          candidate.ctc,
          profile.workHistory?.[0]?.current_ctc,
          profile.workHistory?.[0]?.ctc,
          profile.workHistory?.[0]?.salary,
          profile.workHistory?.[0]?.compensation,
          candidate.work_history?.[0]?.current_ctc,
          candidate.work_history?.[0]?.ctc,
          candidate.work_history?.[0]?.salary,
          candidate.work_history?.[0]?.compensation,
        ),
      ),
    },
    {
      label: "Expected CTC",
      value: normalizeCurrencyDisplay(
        pickFirst(
          profile.expectedCtcDisplay,
          candidate.expected_ctc,
          candidate.expectedCtc,
          candidate.expected_salary,
          candidate.expectedSalary,
          candidate.expectedCTC,
          candidate.salary_expectation,
          candidate.salaryExpectation,
        ),
      ),
    },
  ];

  const educationHistory = normalizeList(
    pickFirst(
      profile.educationHistory,
      candidate.education_history,
      candidate.educationHistory,
      candidate.education_details,
      candidate.educationDetails,
    ),
  );
  const fallbackEducation =
    hasValue(profile.education?.degree) ||
    hasValue(profile.education?.college) ||
    hasValue(profile.education?.institution)
      ? [profile.education]
      : [];
  const educationEntries = educationHistory.length
    ? educationHistory
    : fallbackEducation;

  const skillTags = (
    Array.isArray(profile.skills) ? profile.skills : normalizeList(candidate.skills)
  )
    .map((skill) =>
      typeof skill === "string"
        ? skill
        : skill?.name || skill?.skill || skill?.title || "",
    )
    .filter(Boolean);

  const certificationEntries = (
    Array.isArray(profile.certifications)
      ? profile.certifications
      : normalizeList(candidate.certifications)
  ).filter(Boolean);

  const experienceEntries = normalizeList(
    pickFirst(
      profile.workHistory,
      candidate.work_history,
      candidate.workHistory,
      candidate.employment_history,
      candidate.experience_history,
    ),
  );

  const handleStatusUpdate = async () => {
    if (!onUpdateStatus || !selectedStatus || statusUpdating) return;
    setStatusUpdating(true);
    setStatusMessage({ type: "", text: "" });
    try {
      const result = await onUpdateStatus(candidate, selectedStatus);
      if (result && result.ok === false) {
        setStatusMessage({
          type: "error",
          text: result.message || "Failed to update status",
        });
      } else {
        setStatusMessage({
          type: "success",
          text: `Status updated to ${formatStatus(selectedStatus)}`,
        });
      }
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: error?.message || "Failed to update status",
      });
    } finally {
      setStatusUpdating(false);
    }
  };

  const scrollToSection = (id) => {
    if (!contentRef.current) return;
    const target = contentRef.current.querySelector(`#${id}`);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const jobTitle =
    candidate.job_title ||
    profile.jobTitle ||
    candidate.applied_role ||
    candidate.applied_for ||
    "Not specified";
  const accountManagerName =
    candidate.account_manager_name ||
    profile.accountManager?.name ||
    candidate.account_manager?.name ||
    candidate.account_manager?.am_name ||
    null;
  const resolvedResumeUrl = toSafeOpenUrl(
    toApiAssetUrl(
    pickFirst(
      profile.resumeUrl,
      candidate.resume_url,
      candidate.resumeUrl,
      candidate.resume_path,
      candidate.resumePath,
      candidate.parsed_resume?.resume_url,
      candidate.parsed_resume?.resumeUrl,
      candidate.parsed_resume?.data?.resume_url,
      candidate.parsed_resume?.data?.resumeUrl,
      candidate.parsed_data_json?.resume_url,
      candidate.parsed_data_json?.resumeUrl,
      candidate.parsedDataJson?.resume_url,
      candidate.parsedDataJson?.resumeUrl,
    ),
    ),
  );

  return (
    <div
      className="candidate-detail-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="candidate-detail-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="candidate-detail">
        <div className="candidate-detail__header">
          <button type="button" className="candidate-detail__back" onClick={onClose}>
            Back to cards
          </button>
          <div className="candidate-detail__header-main">
            <h2 id="candidate-detail-title">{profile.name || "Candidate"}</h2>
            <div className="candidate-detail__header-meta">
              <span className="candidate-status-badge candidate-status-badge--neutral">
                {formatStatus(profile.status) || "Unknown"}
              </span>
              <span className="candidate-detail__job">Applied for: {jobTitle}</span>
              {accountManagerName && (
                <span className="candidate-detail__job">AM: {accountManagerName}</span>
              )}
            </div>
          </div>
          <div className="candidate-detail__header-actions">
            <button
              type="button"
              className="candidate-card__btn candidate-card__btn--ghost"
              onClick={() => resolvedResumeUrl && window.open(resolvedResumeUrl, "_blank")}
              disabled={!resolvedResumeUrl}
            >
              Download Resume
            </button>
            <button
              type="button"
              className="candidate-card__btn candidate-card__btn--ghost"
              onClick={() => {
                if (!resolvedResumeUrl) return;
                if (typeof onPreviewResume === "function") {
                  onPreviewResume(resolvedResumeUrl, candidate);
                  return;
                }
                window.open(resolvedResumeUrl, "_blank");
              }}
              disabled={!resolvedResumeUrl}
            >
              Preview Resume
            </button>
          </div>
        </div>

        <div className="candidate-detail__body">
          <aside className="candidate-detail__nav">
            <div className="candidate-detail__nav-search">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search sections"
              />
            </div>
            <div className="candidate-detail__nav-list">
              {filteredSections.map((section) => (
                <button key={section.id} type="button" onClick={() => scrollToSection(section.id)}>
                  {section.label}
                </button>
              ))}
            </div>
          </aside>

          <main className="candidate-detail__content" ref={contentRef}>
            {loading && <div className="candidate-detail__loading">Loading...</div>}

            <Section id="notice" title="Notice Period">
              <FieldGrid fields={noticePeriodFields} />
            </Section>

            <Section id="personal" title="Personal Information">
              <FieldGrid fields={personalFields} />
            </Section>

            <Section id="professional" title="Professional Information">
              <FieldGrid fields={professionalFields} />
            </Section>

            <Section
              id="education"
              title="Education Details"
              actions={
                onOpenFullProfile && !hideOpenFullProfileAction && (
                  <button
                    type="button"
                    className="candidate-card__btn candidate-card__btn--ghost"
                    onClick={() => onOpenFullProfile(candidate, profile)}
                  >
                    Add Education
                  </button>
                )
              }
            >
              {educationEntries.length === 0 ? (
                <EmptyState label="No education details available" />
              ) : (
                <div className="candidate-detail__cards">
                  {educationEntries.map((edu, index) => (
                    <div key={edu.id || index} className="candidate-detail__card">
                      <div className="candidate-detail__card-title">
                        Highest Degree: {renderValue(edu.degree || edu.title)}
                      </div>
                      <div className="candidate-detail__card-text">
                        College Name:{" "}
                        {renderValue(
                          edu.college || edu.institution || edu.university || profile.education?.college,
                        )}
                      </div>
                      <div className="candidate-detail__card-meta">
                        {renderValue(
                          edu.cgpa
                            ? `CGPA: ${edu.cgpa}`
                            : edu.percentage
                              ? `%: ${edu.percentage}`
                              : null,
                          "CGPA/%: N/A",
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section id="skills" title="Skills">
              {skillTags.length === 0 ? (
                <EmptyState label="No skills available" />
              ) : (
                <div className="candidate-detail__chip-row">
                  {skillTags.map((skill, index) => (
                    <span key={`${skill}-${index}`} className="candidate-detail__chip">
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </Section>

            <Section
              id="certifications"
              title="Certifications"
              actions={
                onOpenFullProfile && !hideOpenFullProfileAction && (
                  <button
                    type="button"
                    className="candidate-card__btn candidate-card__btn--ghost"
                    onClick={() => onOpenFullProfile(candidate, profile)}
                  >
                    Add Certification
                  </button>
                )
              }
            >
              {certificationEntries.length === 0 ? (
                <EmptyState label="No certifications available" />
              ) : (
                <div className="candidate-detail__cards">
                  {certificationEntries.map((cert, index) => {
                    const credentialId =
                      cert.credentialId || cert.credential_id || cert.id || null;
                    const credentialUrl =
                      cert.credentialUrl || cert.credential_url || cert.url || null;
                    return (
                      <div key={index} className="candidate-detail__card">
                        <div className="candidate-detail__card-title">
                          {renderValue(cert.name || cert.title)}
                        </div>
                        <div className="candidate-detail__card-text">
                          Credential ID: {renderValue(credentialId)}
                        </div>
                        <div className="candidate-detail__card-text">
                          Credential Link:{" "}
                          {credentialUrl ? (
                            <a href={credentialUrl} target="_blank" rel="noreferrer">
                              Open Link
                            </a>
                          ) : (
                            "N/A"
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            <Section id="experience" title="Experience">
              {experienceEntries.length === 0 ? (
                <EmptyState label="No experience details available" />
              ) : (
                <div className="candidate-detail__cards">
                  {experienceEntries.map((exp, index) => {
                    if (typeof exp === "string") {
                      return (
                        <div key={index} className="candidate-detail__card">
                          <div className="candidate-detail__card-text">{exp}</div>
                        </div>
                      );
                    }
                    const skillsLearnt = normalizeList(
                      pickFirst(
                        exp.skills_learned,
                        exp.skillsLearnt,
                        exp.skills,
                        exp.technologies,
                        exp.tech_stack,
                        exp.stack,
                      ),
                    );
                    return (
                      <div key={exp.id || index} className="candidate-detail__card">
                        <div className="candidate-detail__card-title">
                          Company Worked For:{" "}
                          {renderValue(exp.company || exp.company_name || exp.employer)}
                        </div>
                        <div className="candidate-detail__card-text">
                          Role: {renderValue(exp.role || exp.designation || exp.title)}
                        </div>
                        <div className="candidate-detail__card-text">
                          Project Done:{" "}
                          {renderValue(
                            pickFirst(exp.project_done, exp.project, exp.project_name, exp.projects),
                          )}
                        </div>
                        <div className="candidate-detail__card-text">
                          Skills Learnt: {renderValue(skillsLearnt)}
                        </div>
                        <div className="candidate-detail__card-meta">
                          Years: {renderValue(pickFirst(exp.years, exp.duration_years, exp.total_years, exp.duration))}
                        </div>
                        <div className="candidate-detail__card-meta">
                          CTC: {renderValue(pickFirst(exp.ctc, exp.current_ctc, exp.salary, exp.compensation, exp.package))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          </main>

          <aside className="candidate-detail__aside">
            {!hideQuickActions && (
              <div className="candidate-detail__aside-card">
                <div className="candidate-detail__aside-title">Quick Actions</div>
                {customQuickActions ? (
                  customQuickActions.map((action, index) => (
                    <button
                      key={index}
                      type="button"
                      className={`candidate-card__btn ${action.variant === "primary" ? "candidate-card__btn--primary" : action.variant === "success" ? "candidate-card__btn--success" : action.variant === "warning" ? "candidate-card__btn--warning" : action.variant === "danger" ? "candidate-card__btn--danger" : "candidate-card__btn--ghost"}`}
                      onClick={() => action.onClick(candidate, profile)}
                      disabled={action.disabled}
                    >
                      {action.label}
                    </button>
                  ))
                ) : (
                  <>
                    <button
                      type="button"
                      className="candidate-card__btn candidate-card__btn--primary"
                      onClick={() => onOpenFeedback && onOpenFeedback(candidate)}
                    >
                      Call Feedback
                    </button>
                    <button
                      type="button"
                      className="candidate-card__btn candidate-card__btn--ghost"
                      onClick={() => setShowFeedbackHistoryModal(true)}
                    >
                      View Callback History
                    </button>
                    {!hideStatusControls && (
                      <div className="candidate-detail__status-controls">
                        <select
                          className="candidate-detail__status-select"
                          value={selectedStatus}
                          onChange={(event) => {
                            setSelectedStatus(event.target.value);
                            setStatusMessage({ type: "", text: "" });
                          }}
                        >
                          {resolvedStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="candidate-card__btn candidate-card__btn--ghost"
                          onClick={handleStatusUpdate}
                          disabled={
                            !onUpdateStatus ||
                            statusUpdating ||
                            !selectedStatus ||
                            selectedStatus === currentStatus
                          }
                        >
                          {statusUpdating ? "Updating..." : "Update Status"}
                        </button>
                        {statusMessage.text && (
                          <div
                            className={`candidate-detail__status-message ${
                              statusMessage.type === "error"
                                ? "candidate-detail__status-message--error"
                                : "candidate-detail__status-message--success"
                            }`}
                          >
                            {statusMessage.text}
                          </div>
                        )}
                      </div>
                    )}
                    {!hideSendToAMAction && (
                      <button
                        type="button"
                        className="candidate-card__btn candidate-card__btn--success"
                        onClick={() => onSendToAM && onSendToAM(candidate, profile)}
                      >
                        Send to Account Manager
                      </button>
                    )}
                    {!hideScheduleInterviewAction && (
                      <button
                        type="button"
                        className="candidate-card__btn candidate-card__btn--ghost"
                        onClick={() => onScheduleInterview && onScheduleInterview(candidate, profile)}
                      >
                        Schedule Interview
                      </button>
                    )}
                    {onAddNote && (
                      <button
                        type="button"
                        className="candidate-card__btn candidate-card__btn--ghost"
                        onClick={() => onAddNote(candidate)}
                      >
                        Add Note
                      </button>
                    )}
                    {onSendEmail && (
                      <button
                        type="button"
                        className="candidate-card__btn candidate-card__btn--ghost"
                        onClick={() => onSendEmail(profile)}
                      >
                        Send Email
                      </button>
                    )}
                    {onMessageAm && (
                      <button
                        type="button"
                        className="candidate-card__btn candidate-card__btn--ghost"
                        onClick={() => onMessageAm(candidate)}
                      >
                        Message AM
                      </button>
                    )}
                    {onMessageCandidate && (
                      <button
                        type="button"
                        className="candidate-card__btn candidate-card__btn--ghost"
                        onClick={() => onMessageCandidate(candidate)}
                      >
                        Message Candidate
                      </button>
                    )}
                    {!hideOpenFullProfileAction && (
                      <button
                        type="button"
                        className="candidate-card__btn candidate-card__btn--ghost"
                        onClick={() => onOpenFullProfile && onOpenFullProfile(candidate, profile)}
                      >
                        Open Full Profile
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            <div className="candidate-detail__aside-card">
              <div className="candidate-detail__aside-title">Activity Feed</div>
              <div className="candidate-detail__activity-item">
                Viewed {formatDateTime(candidate.updated_at || candidate.last_updated)}
              </div>
              <div className="candidate-detail__activity-item">
                Status {formatStatus(renderValue(profile.status, "Unknown"))}
              </div>
              <div className="candidate-detail__activity-item">
                Applied {renderValue(profile.appliedDate, "N/A")}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {showFeedbackHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                Call Feedback History
              </h2>
              <button
                onClick={() => setShowFeedbackHistoryModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-light"
              >
                x
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
              <CallFeedbackHistory
                candidateId={candidateId}
                onAddNew={() => {
                  setShowFeedbackHistoryModal(false);
                  onOpenFeedback && onOpenFeedback(candidate);
                }}
                onFeedbackSelect={(feedback) => {
                  setShowFeedbackHistoryModal(false);
                  onOpenFeedback && onOpenFeedback(candidate, feedback);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
