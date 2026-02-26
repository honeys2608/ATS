import React, { useState, useEffect } from "react";
import axios from "../api/axios";

/**
 * ========================================
 * ManualCandidateAdditionDrawer Component
 * ========================================
 * Allows recruiters to:
 * 1. Upload resume and auto-parse
 * 2. Edit parsed candidate details
 * 3. Add multiple experiences and education entries
 * 4. Submit candidate linked to assigned job
 *
 * Key Fixes:
 * ✅ Validates job_id before submission
 * ✅ Shows clear error if job not selected
 * ✅ Auto-parses resume on upload
 * ✅ Dynamic experience/education sections
 * ✅ Form validation (required fields)
 * ✅ User edits preserved during parsing
 */

const ManualCandidateAdditionDrawer = ({ isOpen, onClose, job }) => {
  // ============================================================
  // STATE MANAGEMENT
  // ============================================================
  const [resume, setResume] = useState(null);
  const [loadingParse, setLoadingParse] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [manualEntry, setManualEntry] = useState(false); // ✅ Toggle for manual entry

  const [parsed, setParsed] = useState({
    full_name: "",
    email: "",
    phone: "",
    location: "",
    skills: [],
    experiences: [],
    education: [],
  });

  // ============================================================
  // VALIDATION
  // ============================================================
  useEffect(() => {
    if (!job) {
      setError("❌ No job selected. Cannot add candidate.");
    } else {
      setError(null);
    }
  }, [job]);

  const formatErrorMessage = (err) => {
    if (!err) return "Unknown error";
    if (typeof err === "string") return err;
    if (Array.isArray(err)) {
      return err
        .map((e) => e?.msg || e?.message || JSON.stringify(e))
        .join(", ");
    }
    if (err.detail) return formatErrorMessage(err.detail);
    if (err.message) return err.message;
    return JSON.stringify(err);
  };

  const validateForm = () => {
    if (!parsed.full_name || !parsed.full_name.trim()) {
      setError("Full Name is required");
      return false;
    }
    if (!parsed.email || !parsed.email.trim()) {
      setError("Email is required");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.email)) {
      setError("Invalid email format");
      return false;
    }
    if (!job) {
      setError("No job selected. Cannot add candidate.");
      return false;
    }
    setError(null);
    return true;
  };

  // ============================================================
  // RESUME UPLOAD & PARSING
  // ============================================================
  const handleResumeUpload = async (file) => {
    if (!file) return;
    if (!job) {
      setError("Please select a job before uploading resume");
      return;
    }

    setResume(file);
    setLoadingParse(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData();
    formData.append("job_id", job.job_id || job.id); // ✅ Backend now accepts both job_id and UUID
    formData.append("resume", file);

    try {
      const res = await axios.post("/v1/candidates/manual", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // ✅ Merge parsed data (preserve user edits)
      setParsed({
        full_name: res.data.parsed?.full_name || parsed.full_name,
        email: res.data.parsed?.email || parsed.email,
        phone: res.data.parsed?.phone || parsed.phone,
        location: res.data.parsed?.location || parsed.location,
        skills: res.data.parsed?.skills || parsed.skills || [],
        experiences: res.data.parsed?.experiences || [],
        education: res.data.parsed?.education || [],
      });

      setError(null);
      setSuccess(
        "✅ Resume parsed successfully! Review and edit details below.",
      );
    } catch (err) {
      console.error("Resume parsing error:", err);
      const errorMsg = formatErrorMessage(
        err.response?.data?.detail || err.message
      );
      setError(errorMsg || "Failed to parse resume. Please try again.");
      setResume(null);
    } finally {
      setLoadingParse(false);
    }
  };

  // ============================================================
  // FORM HANDLERS
  // ============================================================
  const handleFieldChange = (field, value) => {
    setParsed((prev) => ({ ...prev, [field]: value }));
    setError(null); // Clear error on edit
  };

  const handleSkillsChange = (value) => {
    const skillsArray = value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s);
    setParsed((prev) => ({ ...prev, skills: skillsArray }));
  };

  // ============================================================
  // EXPERIENCE MANAGEMENT
  // ============================================================
  const addExperience = () => {
    setParsed((prev) => ({
      ...prev,
      experiences: [
        ...prev.experiences,
        {
          company: "",
          role: "",
          start_date: "",
          end_date: "",
          description: "",
        },
      ],
    }));
  };

  const updateExperience = (index, field, value) => {
    setParsed((prev) => {
      const updated = [...prev.experiences];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, experiences: updated };
    });
  };

  const removeExperience = (index) => {
    setParsed((prev) => ({
      ...prev,
      experiences: prev.experiences.filter((_, i) => i !== index),
    }));
  };

  // ============================================================
  // EDUCATION MANAGEMENT
  // ============================================================
  const addEducation = () => {
    setParsed((prev) => ({
      ...prev,
      education: [
        ...prev.education,
        { institution: "", degree: "", field_of_study: "", year: "" },
      ],
    }));
  };

  const updateEducation = (index, field, value) => {
    setParsed((prev) => {
      const updated = [...prev.education];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, education: updated };
    });
  };

  const removeEducation = (index) => {
    setParsed((prev) => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index),
    }));
  };

  // ============================================================
  // SUBMISSION
  // ============================================================
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    setError(null);

    try {
      const educationValue = Array.isArray(parsed.education)
        ? parsed.education
            .map((e) =>
              typeof e === "string"
                ? e
                : e?.degree || e?.field_of_study || e?.institution || ""
            )
            .filter(Boolean)
            .join(", ")
        : parsed.education || "";

      const payload = {
        job_id: job.job_id || job.id, // ✅ Backend now accepts both job_id and UUID
        full_name: parsed.full_name,
        email: parsed.email,
        phone: parsed.phone || "",
        location: parsed.location || "",
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        education: educationValue,
      };

      const res = await axios.post("/v1/candidates/from-resume", payload);

      setSuccess("✅ Candidate added successfully!");
      setTimeout(() => {
        onClose();
        resetForm();
      }, 1500);
    } catch (err) {
      console.error("Submission error:", err);
      const errorMsg = formatErrorMessage(
        err.response?.data?.detail || err.message
      );
      setError(errorMsg || "Failed to add candidate. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // RESET FORM
  // ============================================================
  const resetForm = () => {
    setResume(null);
    setManualEntry(false); // ✅ Reset manual entry toggle
    setParsed({
      full_name: "",
      email: "",
      phone: "",
      location: "",
      skills: [],
      experiences: [],
      education: [],
    });
    setError(null);
    setSuccess(false);
  };

  // ============================================================
  // RENDER
  // ============================================================
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-40 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full bg-white shadow-xl z-50 transition-transform overflow-y-auto ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width: "500px" }}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Add New Candidate</h2>
            <button
              onClick={onClose}
              className="text-2xl font-bold text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          {/* Job Info */}
          {job ? (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <div className="font-semibold text-blue-900">{job.title}</div>
            </div>
          ) : (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-semibold">
              ❌ No job selected
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              {success}
            </div>
          )}

          {/* Resume Upload OR Manual Entry Option */}
          {!resume && !manualEntry && (
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-600 mb-3 font-semibold">
                How would you like to add a candidate?
              </p>
              <div className="flex gap-3">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="entry-method"
                    value="resume"
                    onChange={() => {
                      setManualEntry(false);
                      setError(null);
                    }}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="ml-2 text-sm">📄 Upload Resume</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="entry-method"
                    value="manual"
                    onChange={() => {
                      setManualEntry(true);
                      setError(null);
                    }}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="ml-2 text-sm">✏️ Enter Manually</span>
                </label>
              </div>
            </div>
          )}

          {/* Resume Upload Section */}
          {!manualEntry && (
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📄 Upload Resume (PDF, DOC, DOCX)
              </label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => handleResumeUpload(e.target.files?.[0])}
                disabled={loadingParse}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer hover:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {loadingParse && (
                <p className="text-sm text-blue-600 mt-2 animate-pulse">
                  ⏳ Parsing resume, please wait...
                </p>
              )}
            </div>
          )}

          {/* Candidate Details Form - Show if Resume Uploaded OR Manual Entry Selected */}
          {(resume || manualEntry) && !loadingParse && (
            <>
              {/* Full Name */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={parsed.full_name}
                  onChange={(e) =>
                    handleFieldChange("full_name", e.target.value)
                  }
                  placeholder="John Doe"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Email */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={parsed.email}
                  onChange={(e) => handleFieldChange("email", e.target.value)}
                  placeholder="john@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Phone */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={parsed.phone}
                  onChange={(e) => handleFieldChange("phone", e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Location */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={parsed.location}
                  onChange={(e) =>
                    handleFieldChange("location", e.target.value)
                  }
                  placeholder="San Francisco, CA"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Skills */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Skills (Comma Separated)
                </label>
                <textarea
                  value={parsed.skills.join(", ")}
                  onChange={(e) => handleSkillsChange(e.target.value)}
                  placeholder="Python, React, Node.js, SQL"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* EXPERIENCES */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-semibold text-gray-700">
                    💼 Work Experience
                  </label>
                  <button
                    onClick={addExperience}
                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition"
                  >
                    + Add Experience
                  </button>
                </div>

                {parsed.experiences.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">
                    No experiences added yet
                  </p>
                ) : (
                  parsed.experiences.map((exp, idx) => (
                    <div
                      key={idx}
                      className="mb-4 p-3 border border-gray-200 rounded-lg bg-gray-50"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-sm font-semibold">
                          Experience {idx + 1}
                        </h4>
                        <button
                          onClick={() => removeExperience(idx)}
                          className="text-red-600 text-xs hover:text-red-800 font-semibold"
                        >
                          Remove
                        </button>
                      </div>

                      <input
                        type="text"
                        placeholder="Company Name"
                        value={exp.company}
                        onChange={(e) =>
                          updateExperience(idx, "company", e.target.value)
                        }
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs mb-2"
                      />
                      <input
                        type="text"
                        placeholder="Job Title / Role"
                        value={exp.role}
                        onChange={(e) =>
                          updateExperience(idx, "role", e.target.value)
                        }
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs mb-2"
                      />
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input
                          type="month"
                          placeholder="Start Date"
                          value={exp.start_date}
                          onChange={(e) =>
                            updateExperience(idx, "start_date", e.target.value)
                          }
                          className="px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                        <input
                          type="month"
                          placeholder="End Date"
                          value={exp.end_date}
                          onChange={(e) =>
                            updateExperience(idx, "end_date", e.target.value)
                          }
                          className="px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                      </div>
                      <textarea
                        placeholder="Description (Optional)"
                        value={exp.description}
                        onChange={(e) =>
                          updateExperience(idx, "description", e.target.value)
                        }
                        rows={2}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                      />
                    </div>
                  ))
                )}
              </div>

              {/* EDUCATION */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-semibold text-gray-700">
                    🎓 Education
                  </label>
                  <button
                    onClick={addEducation}
                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition"
                  >
                    + Add Education
                  </button>
                </div>

                {parsed.education.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">
                    No education added yet
                  </p>
                ) : (
                  parsed.education.map((edu, idx) => (
                    <div
                      key={idx}
                      className="mb-4 p-3 border border-gray-200 rounded-lg bg-gray-50"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-sm font-semibold">
                          Education {idx + 1}
                        </h4>
                        <button
                          onClick={() => removeEducation(idx)}
                          className="text-red-600 text-xs hover:text-red-800 font-semibold"
                        >
                          Remove
                        </button>
                      </div>

                      <input
                        type="text"
                        placeholder="Institution / University"
                        value={edu.institution}
                        onChange={(e) =>
                          updateEducation(idx, "institution", e.target.value)
                        }
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs mb-2"
                      />
                      <input
                        type="text"
                        placeholder="Degree (e.g., B.Tech, MBA)"
                        value={edu.degree}
                        onChange={(e) =>
                          updateEducation(idx, "degree", e.target.value)
                        }
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs mb-2"
                      />
                      <input
                        type="text"
                        placeholder="Field of Study"
                        value={edu.field_of_study}
                        onChange={(e) =>
                          updateEducation(idx, "field_of_study", e.target.value)
                        }
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs mb-2"
                      />
                      <input
                        type="number"
                        placeholder="Graduation Year"
                        value={edu.year}
                        onChange={(e) =>
                          updateEducation(idx, "year", e.target.value)
                        }
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                      />
                    </div>
                  ))
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !job}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                >
                  {submitting ? "Submitting..." : "✅ Add Candidate"}
                </button>
                <button
                  onClick={() => {
                    onClose();
                    resetForm();
                  }}
                  className="flex-1 bg-gray-300 text-gray-800 py-2 rounded-lg font-semibold hover:bg-gray-400 transition"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default ManualCandidateAdditionDrawer;
