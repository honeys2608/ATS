import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import {
  sanitizeEmail,
  sanitizeText,
  validateEmail,
  validateGitHubURL,
  validateLinkedInURL,
  validateName,
  validateNumber,
  validatePhone,
  validateURL,
} from "../../utils/validators";

const emptyForm = {
  fullName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  currentLocation: "",
  city: "",
  pincode: "",
  currentAddress: "",
  permanentAddress: "",
  source: "",
  referral: "",
  skills: "",
  experience: "",
  education: "",
  currentEmployer: "",
  previousEmployers: "",
  noticePeriod: "",
  expectedCtc: "",
  preferredLocation: "",
  languagesKnown: "",
  linkedinUrl: "",
  githubUrl: "",
  portfolioUrl: "",
};

const mapCandidateToForm = (candidate) => ({
  fullName: candidate?.full_name || "",
  email: candidate?.email || "",
  phone: candidate?.phone || "",
  dateOfBirth: candidate?.date_of_birth || "",
  currentLocation: candidate?.current_location || "",
  city: candidate?.city || "",
  pincode: candidate?.pincode || "",
  currentAddress: candidate?.current_address || "",
  permanentAddress: candidate?.permanent_address || "",
  source: candidate?.source || "",
  referral: candidate?.referral || "",
  skills: Array.isArray(candidate?.skills)
    ? candidate.skills.join(", ")
    : candidate?.skills || "",
  experience: candidate?.experience ?? "",
  education: candidate?.education || "",
  currentEmployer: candidate?.current_employer || "",
  previousEmployers: candidate?.previous_employers || "",
  noticePeriod: candidate?.notice_period || "",
  expectedCtc: candidate?.expected_ctc ?? "",
  preferredLocation: candidate?.preferred_location || "",
  languagesKnown: candidate?.languages_known || "",
  linkedinUrl: candidate?.linkedin_url || "",
  githubUrl: candidate?.github_url || "",
  portfolioUrl: candidate?.portfolio_url || "",
});

const buildUpdatePayload = (form) => ({
  fullName: sanitizeText(form.fullName),
  email: sanitizeEmail(form.email),
  phone: sanitizeText(form.phone),
  dateOfBirth: form.dateOfBirth || null,
  currentLocation: sanitizeText(form.currentLocation),
  city: sanitizeText(form.city),
  pincode: sanitizeText(form.pincode),
  currentAddress: sanitizeText(form.currentAddress),
  permanentAddress: sanitizeText(form.permanentAddress),
  source: sanitizeText(form.source),
  referral: sanitizeText(form.referral),
  skills: form.skills
    ? form.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [],
  experience:
    form.experience === "" || form.experience === null
      ? null
      : Number(form.experience),
  education: sanitizeText(form.education),
  currentEmployer: sanitizeText(form.currentEmployer),
  previousEmployers: sanitizeText(form.previousEmployers),
  noticePeriod: sanitizeText(form.noticePeriod),
  expectedCtc:
    form.expectedCtc === "" || form.expectedCtc === null
      ? null
      : Number(form.expectedCtc),
  preferredLocation: sanitizeText(form.preferredLocation),
  languagesKnown: sanitizeText(form.languagesKnown),
  linkedinUrl: sanitizeText(form.linkedinUrl),
  githubUrl: sanitizeText(form.githubUrl),
  portfolioUrl: sanitizeText(form.portfolioUrl),
});

const validateForm = (form) => {
  const errors = {};

  const nameErr = validateName(form.fullName, "Full Name");
  if (nameErr) errors.fullName = nameErr;

  const emailErr = validateEmail(form.email);
  if (emailErr) errors.email = emailErr;

  const phoneErr = validatePhone(form.phone);
  if (phoneErr) errors.phone = phoneErr;

  if (form.experience !== "" && form.experience !== null) {
    const expErr = validateNumber(form.experience, "Experience", {
      min: 0,
      max: 70,
      integer: false,
      required: false,
    });
    if (expErr) errors.experience = expErr;
  }

  if (form.expectedCtc !== "" && form.expectedCtc !== null) {
    const ctcErr = validateNumber(form.expectedCtc, "Expected CTC", {
      min: 0,
      max: 100000000,
      integer: false,
      required: false,
    });
    if (ctcErr) errors.expectedCtc = ctcErr;
  }

  if (form.linkedinUrl) {
    const linkedErr = validateLinkedInURL(form.linkedinUrl);
    if (linkedErr) errors.linkedinUrl = linkedErr;
  }

  if (form.githubUrl) {
    const githubErr = validateGitHubURL(form.githubUrl);
    if (githubErr) errors.githubUrl = githubErr;
  }

  if (form.portfolioUrl) {
    const portfolioErr = validateURL(form.portfolioUrl, "Portfolio URL");
    if (portfolioErr) errors.portfolioUrl = portfolioErr;
  }

  return errors;
};

export default function CandidatePublicProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [candidate, setCandidate] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [originalForm, setOriginalForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [banner, setBanner] = useState(null);

  const loadProfile = useCallback(() => {
    setLoading(true);
    api
      .get("/v1/candidate/me")
      .then((res) => {
        const data = res?.data?.data;
        setCandidate(data);
        const mapped = mapCandidateToForm(data);
        setForm(mapped);
        setOriginalForm(mapped);
      })
      .catch(() => setBanner({ type: "error", text: "Failed to load profile" }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleChange = (field) => (event) => {
    const value = event?.target?.value ?? "";
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const resetChanges = () => {
    setForm(originalForm);
    setErrors({});
    setIsEditing(false);
    setBanner(null);
  };

  const saveProfile = async () => {
    const nextErrors = validateForm(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setBanner({
        type: "error",
        text: "Please fix the highlighted errors before saving.",
      });
      return;
    }

    setSaving(true);
    setBanner(null);

    try {
      const payload = buildUpdatePayload(form);
      const res = await api.put("/v1/candidate/me", payload);
      const updated = res?.data?.data;
      if (updated) {
        setCandidate(updated);
        const mapped = mapCandidateToForm(updated);
        setForm(mapped);
        setOriginalForm(mapped);
      } else {
        loadProfile();
      }
      setIsEditing(false);
      setBanner({ type: "success", text: "Profile updated successfully." });
    } catch (err) {
      const message =
        err?.response?.data?.detail || "Failed to update profile.";
      setBanner({ type: "error", text: message });
    } finally {
      setSaving(false);
    }
  };

  const displaySkills = useMemo(() => {
    if (!candidate) return "-";
    if (Array.isArray(candidate.skills)) {
      return candidate.skills.length ? candidate.skills.join(", ") : "-";
    }
    return candidate.skills || "-";
  }, [candidate]);

  if (loading) {
    return <h2 className="p-6 text-center text-lg">Loading Profile...</h2>;
  }

  if (!candidate) {
    return <h2 className="p-6 text-center text-lg">No profile found</h2>;
  }

  return (
    <div className="max-w-5xl mx-auto p-8 bg-gray-50 min-h-screen">
      {banner && (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 text-sm font-medium ${
            banner.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {banner.text}
        </div>
      )}

      <div className="bg-white shadow rounded-xl p-6 border border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="flex items-center gap-6">
          <img
            src={
              candidate.photo_url
                ? `http://localhost:8000/${candidate.photo_url}`
                : "https://ui-avatars.com/api/?name=Candidate&background=EDE9FE&color=3730A3"
            }
            className="w-24 h-24 rounded-full object-cover border-4 border-indigo-200"
            alt="Profile"
          />

          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-1">
              {candidate.full_name}
            </h1>
            <p className="text-gray-600">{candidate.email}</p>
            <p className="text-gray-600">
              {candidate.phone || "Phone not added"}
            </p>

            <span className="inline-block mt-3 px-3 py-1 text-sm rounded-full bg-green-100 text-green-700">
              Status: {candidate.status || "Active"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isEditing && (
            <button
              onClick={() => {
                setIsEditing(true);
                setBanner(null);
              }}
              className="px-4 py-2 rounded-md bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
            >
              Edit Profile
            </button>
          )}
          {isEditing && (
            <>
              <button
                onClick={saveProfile}
                disabled={saving}
                className={`px-4 py-2 rounded-md font-semibold transition ${
                  saving
                    ? "bg-indigo-300 text-white cursor-not-allowed"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={resetChanges}
                className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <Section title="Basic Information" color="indigo">
          <FieldRow label="Date of Birth">
            {isEditing ? (
              <Input
                type="date"
                value={form.dateOfBirth}
                onChange={handleChange("dateOfBirth")}
              />
            ) : (
              <Value>{candidate.date_of_birth}</Value>
            )}
          </FieldRow>
          <FieldRow label="Current Location">
            {isEditing ? (
              <Input
                value={form.currentLocation}
                onChange={handleChange("currentLocation")}
                placeholder="Current location"
              />
            ) : (
              <Value>{candidate.current_location}</Value>
            )}
          </FieldRow>
          <FieldRow label="City">
            {isEditing ? (
              <Input
                value={form.city}
                onChange={handleChange("city")}
                placeholder="City"
              />
            ) : (
              <Value>{candidate.city}</Value>
            )}
          </FieldRow>
          <FieldRow label="Pincode">
            {isEditing ? (
              <Input
                value={form.pincode}
                onChange={handleChange("pincode")}
                placeholder="Pincode"
              />
            ) : (
              <Value>{candidate.pincode}</Value>
            )}
          </FieldRow>
          <FieldRow label="Current Address">
            {isEditing ? (
              <Textarea
                value={form.currentAddress}
                onChange={handleChange("currentAddress")}
              />
            ) : (
              <Value>{candidate.current_address}</Value>
            )}
          </FieldRow>
          <FieldRow label="Permanent Address">
            {isEditing ? (
              <Textarea
                value={form.permanentAddress}
                onChange={handleChange("permanentAddress")}
              />
            ) : (
              <Value>{candidate.permanent_address}</Value>
            )}
          </FieldRow>
        </Section>

        <Section title="Application Information" color="yellow">
          <FieldRow label="Source">
            {isEditing ? (
              <Input
                value={form.source}
                onChange={handleChange("source")}
                placeholder="Source"
              />
            ) : (
              <Value>{candidate.source}</Value>
            )}
          </FieldRow>
          <FieldRow label="Referral">
            {isEditing ? (
              <Input
                value={form.referral}
                onChange={handleChange("referral")}
                placeholder="Referral"
              />
            ) : (
              <Value>{candidate.referral}</Value>
            )}
          </FieldRow>
        </Section>

        <Section title="Professional Information" color="blue">
          <FieldRow label="Skills">
            {isEditing ? (
              <Input
                value={form.skills}
                onChange={handleChange("skills")}
                placeholder="Comma-separated skills"
              />
            ) : (
              <Value>{displaySkills}</Value>
            )}
          </FieldRow>
          <FieldRow label="Experience (years)">
            {isEditing ? (
              <>
                <Input
                  type="number"
                  value={form.experience}
                  onChange={handleChange("experience")}
                  placeholder="e.g. 3"
                />
                {errors.experience && (
                  <ErrorText>{errors.experience}</ErrorText>
                )}
              </>
            ) : (
              <Value>{candidate.experience}</Value>
            )}
          </FieldRow>
          <FieldRow label="Education">
            {isEditing ? (
              <Input
                value={form.education}
                onChange={handleChange("education")}
                placeholder="Education"
              />
            ) : (
              <Value>{candidate.education}</Value>
            )}
          </FieldRow>
          <FieldRow label="Current Employer">
            {isEditing ? (
              <Input
                value={form.currentEmployer}
                onChange={handleChange("currentEmployer")}
                placeholder="Current employer"
              />
            ) : (
              <Value>{candidate.current_employer}</Value>
            )}
          </FieldRow>
          <FieldRow label="Previous Employers">
            {isEditing ? (
              <Textarea
                value={form.previousEmployers}
                onChange={handleChange("previousEmployers")}
              />
            ) : (
              <Value>{candidate.previous_employers}</Value>
            )}
          </FieldRow>
          <FieldRow label="Notice Period">
            {isEditing ? (
              <Input
                value={form.noticePeriod}
                onChange={handleChange("noticePeriod")}
                placeholder="Notice period"
              />
            ) : (
              <Value>{candidate.notice_period}</Value>
            )}
          </FieldRow>
        </Section>

        <Section title="Other Details" color="pink">
          <FieldRow label="Expected CTC">
            {isEditing ? (
              <>
                <Input
                  type="number"
                  value={form.expectedCtc}
                  onChange={handleChange("expectedCtc")}
                  placeholder="Expected CTC"
                />
                {errors.expectedCtc && (
                  <ErrorText>{errors.expectedCtc}</ErrorText>
                )}
              </>
            ) : (
              <Value>{candidate.expected_ctc}</Value>
            )}
          </FieldRow>
          <FieldRow label="Preferred Location">
            {isEditing ? (
              <Input
                value={form.preferredLocation}
                onChange={handleChange("preferredLocation")}
                placeholder="Preferred location"
              />
            ) : (
              <Value>{candidate.preferred_location}</Value>
            )}
          </FieldRow>
          <FieldRow label="Languages Known">
            {isEditing ? (
              <Input
                value={form.languagesKnown}
                onChange={handleChange("languagesKnown")}
                placeholder="Languages"
              />
            ) : (
              <Value>{candidate.languages_known}</Value>
            )}
          </FieldRow>
          <FieldRow label="LinkedIn">
            {isEditing ? (
              <>
                <Input
                  value={form.linkedinUrl}
                  onChange={handleChange("linkedinUrl")}
                  placeholder="LinkedIn profile"
                />
                {errors.linkedinUrl && (
                  <ErrorText>{errors.linkedinUrl}</ErrorText>
                )}
              </>
            ) : candidate.linkedin_url ? (
              <a
                href={candidate.linkedin_url}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline"
              >
                Open
              </a>
            ) : (
              <Value>-</Value>
            )}
          </FieldRow>
          <FieldRow label="GitHub">
            {isEditing ? (
              <>
                <Input
                  value={form.githubUrl}
                  onChange={handleChange("githubUrl")}
                  placeholder="GitHub profile"
                />
                {errors.githubUrl && (
                  <ErrorText>{errors.githubUrl}</ErrorText>
                )}
              </>
            ) : candidate.github_url ? (
              <a
                href={candidate.github_url}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline"
              >
                Open
              </a>
            ) : (
              <Value>-</Value>
            )}
          </FieldRow>
          <FieldRow label="Portfolio">
            {isEditing ? (
              <>
                <Input
                  value={form.portfolioUrl}
                  onChange={handleChange("portfolioUrl")}
                  placeholder="Portfolio URL"
                />
                {errors.portfolioUrl && (
                  <ErrorText>{errors.portfolioUrl}</ErrorText>
                )}
              </>
            ) : candidate.portfolio_url ? (
              <a
                href={candidate.portfolio_url}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline"
              >
                Open
              </a>
            ) : (
              <Value>-</Value>
            )}
          </FieldRow>
        </Section>
      </div>

      <div className="bg-white shadow rounded-xl p-6 border border-gray-100 mt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Resume</h3>

        {candidate.resume_url ? (
          <a
            href={`http://localhost:8000/${candidate.resume_url}`}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 underline"
          >
            View Resume
          </a>
        ) : (
          <p className="text-gray-500">No resume uploaded</p>
        )}
      </div>

      {isEditing && (
        <div className="mt-6 bg-white shadow rounded-xl p-6 border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldRow label="Full Name" required>
              <>
                <Input
                  value={form.fullName}
                  onChange={handleChange("fullName")}
                  placeholder="Full name"
                />
                {errors.fullName && <ErrorText>{errors.fullName}</ErrorText>}
              </>
            </FieldRow>
            <FieldRow label="Email" required>
              <>
                <Input
                  type="email"
                  value={form.email}
                  onChange={handleChange("email")}
                  placeholder="Email"
                />
                {errors.email && <ErrorText>{errors.email}</ErrorText>}
              </>
            </FieldRow>
            <FieldRow label="Phone" required>
              <>
                <Input
                  value={form.phone}
                  onChange={handleChange("phone")}
                  placeholder="Phone"
                />
                {errors.phone && <ErrorText>{errors.phone}</ErrorText>}
              </>
            </FieldRow>
          </div>
        </div>
      )}
    </div>
  );
}

const Section = ({ title, color, children }) => {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    yellow: "bg-yellow-50 text-yellow-700",
    pink: "bg-pink-50 text-pink-700",
  };

  return (
    <div className="bg-white shadow rounded-xl p-6 border border-gray-100">
      <div
        className={`px-3 py-1 rounded-md text-sm font-semibold mb-3 ${colors[color]}`}
      >
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
};

const FieldRow = ({ label, required, children }) => (
  <div>
    <p className="text-gray-700 font-medium mb-1">
      {label}
      {required && <span className="text-red-500"> *</span>}
    </p>
    {children}
  </div>
);

const Value = ({ children }) => (
  <p className="text-gray-700">{children || "-"}</p>
);

const Input = (props) => (
  <input
    {...props}
    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
  />
);

const Textarea = (props) => (
  <textarea
    {...props}
    rows={3}
    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
  />
);

const ErrorText = ({ children }) => (
  <p className="mt-1 text-xs text-red-600">{children}</p>
);
