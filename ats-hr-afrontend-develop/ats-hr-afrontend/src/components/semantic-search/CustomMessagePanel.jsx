import React, { useEffect, useMemo, useState } from "react";
import "./CustomMessagePanel.css";

const buildTemplates = () => ({
  am: [
    {
      id: "shortlist_notification",
      name: "Candidate Shortlist Notification",
      subject: "Candidate Shortlisted - {candidateName}",
      body:
        "Hi,\n\nI'd like to bring {candidateName} to your attention for the {position} role.\n\nKey Highlights:\n- {experience} years of experience\n- Strong skills in: {skills}\n- Current CTC: {currentCTC}\n- Expected CTC: {expectedCTC}\n- Notice Period: {noticePeriod}\n\nMatch Score: {matchScore}%\n\nPlease review the profile and let me know if you'd like to proceed.\n\nBest regards",
    },
    {
      id: "interview_scheduled",
      name: "Interview Scheduled - AM Notification",
      subject: "Interview Scheduled - {candidateName}",
      body:
        "Hi,\n\nInterview has been scheduled with {candidateName}.\n\nDetails:\n- Date & Time: {interviewDate}\n- Mode: {interviewMode}\n- Interviewer: {interviewer}\n\nCandidate Summary:\n{summary}\n\nBest regards",
    },
  ],
  candidate: [
    {
      id: "initial_contact",
      name: "Initial Contact Email",
      subject: "Exciting Opportunity for {candidateName}",
      body:
        "Dear {candidateName},\n\nI came across your profile and was impressed by your experience in {skills}. We have an exciting opportunity for a {position} role at {companyName} that aligns well with your background.\n\nKey Details:\n- Position: {position}\n- Location: {location}\n- Experience Required: {experienceRange} years\n\nWould you be interested in learning more? Please let me know your availability for a quick call.\n\nBest regards",
    },
    {
      id: "interview_invitation",
      name: "Interview Invitation",
      subject: "Interview Invitation - {position}",
      body:
        "Dear {candidateName},\n\nWe're pleased to invite you for an interview.\n\nDate: {interviewDate}\nTime: {interviewTime}\nMode: {interviewMode}\nDuration: {duration} minutes\nInterviewer: {interviewer}\n\nMeeting Link: {meetingLink}\n\nPlease confirm your availability. If the timing doesn't work, feel free to suggest alternative slots.\n\nBest regards",
    },
    {
      id: "follow_up",
      name: "Follow-up Email",
      subject: "Following Up - {position} Opportunity",
      body:
        "Dear {candidateName},\n\nI wanted to follow up on my previous email regarding the {position} opportunity.\n\nWould you have a few minutes this week for a quick chat?\n\nBest regards",
    },
  ],
});

const safe = (value, fallback = "") => (value ? value : fallback);

const resolveSkills = (candidate = {}) => {
  if (Array.isArray(candidate.skills)) {
    return candidate.skills.slice(0, 3).join(", ");
  }
  return candidate.skills || "";
};

const replacePlaceholders = (text, candidate = {}) => {
  return text
    .replace(/{candidateName}/g, safe(candidate.name || candidate.full_name))
    .replace(/{position}/g, safe(candidate.job_title || candidate.applied_for, "[Position]"))
    .replace(/{companyName}/g, safe(candidate.company || candidate.current_company, "[Company]"))
    .replace(/{experience}/g, safe(candidate.experience_years || candidate.experience, "N/A"))
    .replace(/{experienceRange}/g, "3-7")
    .replace(/{skills}/g, safe(resolveSkills(candidate), ""))
    .replace(/{currentCTC}/g, safe(candidate.current_ctc || candidate.current_salary, "N/A"))
    .replace(/{expectedCTC}/g, safe(candidate.expected_ctc || candidate.expected_salary, "N/A"))
    .replace(/{noticePeriod}/g, safe(candidate.notice_period, "N/A"))
    .replace(/{matchScore}/g, safe(candidate.match_score || candidate.semantic_score, "N/A"))
    .replace(/{location}/g, safe(candidate.current_location || candidate.location, ""))
    .replace(/{summary}/g, safe(candidate.summary || candidate.career_summary, ""))
    .replace(/{interviewDate}/g, "[Date]")
    .replace(/{interviewTime}/g, "[Time]")
    .replace(/{interviewMode}/g, "[Mode]")
    .replace(/{interviewer}/g, "[Interviewer]")
    .replace(/{duration}/g, "30")
    .replace(/{meetingLink}/g, "[Meeting Link]");
};

export default function CustomMessagePanel({ candidate, recipient, onClose, onSend }) {
  const templates = useMemo(() => buildTemplates(), []);
  const currentTemplates = templates[recipient] || [];
  const accountManagerEmail =
    candidate?.account_manager_email ||
    candidate?.account_manager?.email ||
    candidate?.account_manager?.am_email ||
    "";
  const initialTo = recipient === "am" ? accountManagerEmail : candidate?.email || "";
  const modeAllowsEmail = (mode) => mode === "email" || mode === "both";

  const [message, setMessage] = useState({
    to: initialTo,
    cc: "",
    subject: "",
    body: "",
    attachments: [],
    template: "",
    deliveryMode: recipient === "am" ? "both" : "email",
  });

  useEffect(() => {
    setMessage((prev) => ({
      ...prev,
      to: recipient === "am" ? accountManagerEmail : candidate?.email || "",
      deliveryMode: recipient === "am" ? "both" : "email",
    }));
  }, [candidate, recipient, accountManagerEmail]);

  const handleTemplateSelect = (templateId) => {
    const template = currentTemplates.find((item) => item.id === templateId);
    if (!template) return;
    setMessage((prev) => ({
      ...prev,
      subject: replacePlaceholders(template.subject, candidate),
      body: replacePlaceholders(template.body, candidate),
      template: templateId,
    }));
  };

  const handleSend = async () => {
    if (!onSend) {
      onClose();
      return;
    }
    await onSend({
      ...message,
      recipient,
    });
    onClose();
  };

  return (
    <div className="custom-message-modal-overlay" onClick={onClose}>
      <div
        className="custom-message-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="message-header">
          <h2>{recipient === "am" ? "Send to Account Manager" : "Send to Candidate"}</h2>
          <button className="close-btn" onClick={onClose}>
            ?
          </button>
        </div>

        <div className="message-form">
          <div className="form-group">
            <label>Send Via</label>
            <select
              value={message.deliveryMode}
              onChange={(event) =>
                setMessage((prev) => ({
                  ...prev,
                  deliveryMode: event.target.value,
                }))
              }
              className="template-select"
            >
              <option value="email">Email</option>
              <option value="portal_note">Portal Note</option>
              <option value="both">Email + Portal Note</option>
            </select>
          </div>

          {modeAllowsEmail(message.deliveryMode) && (
            <div className="form-group">
            <label>Email Template</label>
            <select
              value={message.template}
              onChange={(event) => handleTemplateSelect(event.target.value)}
              className="template-select"
            >
              <option value="">Select a template...</option>
              {currentTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
          )}

          {modeAllowsEmail(message.deliveryMode) && (
            <div className="form-group">
            <label>To</label>
            <input
              type="email"
              value={message.to}
              onChange={(event) =>
                setMessage((prev) => ({ ...prev, to: event.target.value }))
              }
              placeholder={
                recipient === "am"
                  ? "account.manager@company.com"
                  : candidate?.email
              }
              required
            />
          </div>
          )}

          {modeAllowsEmail(message.deliveryMode) && (
            <div className="form-group">
            <label>CC (optional)</label>
            <input
              type="email"
              value={message.cc}
              onChange={(event) =>
                setMessage((prev) => ({ ...prev, cc: event.target.value }))
              }
              placeholder="cc@company.com"
            />
          </div>
          )}

          <div className="form-group">
            <label>Subject</label>
            <input
              type="text"
              value={message.subject}
              onChange={(event) =>
                setMessage((prev) => ({ ...prev, subject: event.target.value }))
              }
              placeholder="Email subject"
              required
            />
          </div>

          <div className="form-group">
            <label>Message</label>
            <textarea
              value={message.body}
              onChange={(event) =>
                setMessage((prev) => ({ ...prev, body: event.target.value }))
              }
              placeholder="Type your message here..."
              rows="10"
              required
            />
          </div>

          <div className="form-group">
            <label>Attachments</label>
            <div className="attachment-section">
              <button
                type="button"
                className="btn-attach"
                onClick={() => document.getElementById("file-input").click()}
              >
                Attach Files
              </button>
              <input
                id="file-input"
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={(event) => {
                  const files = Array.from(event.target.files || []);
                  setMessage((prev) => ({
                    ...prev,
                    attachments: [...prev.attachments, ...files],
                  }));
                }}
              />
              {message.attachments.length > 0 && (
                <div className="attachments-list">
                  {message.attachments.map((file, idx) => (
                    <div key={idx} className="attachment-item">
                      <span>{file.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setMessage((prev) => ({
                            ...prev,
                            attachments: prev.attachments.filter((_, i) => i !== idx),
                          }))
                        }
                      >
                        ?
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="quick-insert">
            <button
              type="button"
              className="btn-insert"
              onClick={() =>
                setMessage((prev) => ({
                  ...prev,
                  body: `${prev.body}\n\nCandidate Profile: ${window.location.origin}/candidates/${candidate?.id || ""}`,
                }))
              }
            >
              Insert Profile Link
            </button>
            <button
              type="button"
              className="btn-insert"
              onClick={() =>
                setMessage((prev) => ({
                  ...prev,
                  body: `${prev.body}\n\nResume: ${candidate?.resume_url || ""}`,
                }))
              }
            >
              Insert Resume Link
            </button>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn-send" onClick={handleSend}>
              Send Message
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
