/**
 * Job Creation Form - For creating new job requirements
 * Supports manual entry and JD import/parsing
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Upload,
  FileText,
  X,
  Plus,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";
import axiosInstance from "../../api/axios";

const JobCreateForm = ({ userRole = "recruiter" }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("manual"); // 'manual' | 'import'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    date_created: new Date().toISOString().split("T")[0],
    client_id: "",
    client_ta: "",
    job_title: "",
    mode: "hybrid",
    skills: [],
    jd_text: "",
    experience: "",
    location: "",
    duration: "",
    no_of_positions: 1,
    budget: "",
    work_timings: "",
    joining_preference: "",
    recruiter_ids: [],
    am_notes: [],
  });

  // Skill input
  const [skillInput, setSkillInput] = useState("");

  // JD file upload
  const [jdFile, setJdFile] = useState(null);
  const [jdText, setJdText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsedFields, setParsedFields] = useState({});

  // Dropdown data
  const [clients, setClients] = useState([]);
  const [recruiters, setRecruiters] = useState([]);

  useEffect(() => {
    fetchClients();
    if (userRole === "account_manager") {
      fetchRecruiters();
    }
  }, [userRole]);

  const fetchClients = async () => {
    try {
      const response = await axiosInstance.get("/v1/clients");
      setClients(response.data.clients || response.data || []);
    } catch (err) {
      console.error("Error fetching clients:", err);
    }
  };

  const fetchRecruiters = async () => {
    try {
      const response = await axiosInstance.get("/v1/users?role=recruiter");
      setRecruiters(response.data.users || response.data || []);
    } catch (err) {
      console.error("Error fetching recruiters:", err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        skills: [...prev.skills, skillInput.trim()],
      }));
      setSkillInput("");
    }
  };

  const handleRemoveSkill = (skillToRemove) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((skill) => skill !== skillToRemove),
    }));
  };

  const handleSkillKeyPress = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddSkill();
    }
  };

  const handleRecruiterToggle = (recruiterId) => {
    setFormData((prev) => {
      const ids = prev.recruiter_ids.includes(recruiterId)
        ? prev.recruiter_ids.filter((id) => id !== recruiterId)
        : [...prev.recruiter_ids, recruiterId];
      return { ...prev, recruiter_ids: ids };
    });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
      ];
      if (!validTypes.includes(file.type)) {
        setError("Please upload a PDF or DOCX file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("File size must be less than 5MB");
        return;
      }
      setJdFile(file);
      setError(null);
    }
  };

  const handleParseJD = async () => {
    if (!jdFile && !jdText.trim()) {
      setError("Please upload a file or paste JD text");
      return;
    }

    setParsing(true);
    setError(null);

    try {
      let response;
      if (jdFile) {
        const formDataUpload = new FormData();
        formDataUpload.append("file", jdFile);
        response = await axiosInstance.post(
          "/v1/job-management/parse-jd",
          formDataUpload,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        );
      } else {
        response = await axiosInstance.post(
          "/v1/job-management/parse-jd-text",
          { text: jdText },
        );
      }

      const parsed = response.data;
      setParsedFields(parsed);

      // Auto-fill form with parsed data
      setFormData((prev) => ({
        ...prev,
        job_title: parsed.job_title || prev.job_title,
        skills: parsed.skills || prev.skills,
        experience: parsed.experience || prev.experience,
        location: parsed.location || prev.location,
        mode: parsed.mode || prev.mode,
        jd_text: parsed.jd_text || jdText || prev.jd_text,
      }));
    } catch (err) {
      console.error("Error parsing JD:", err);
      setError("Failed to parse JD. Please try again or enter manually.");
    } finally {
      setParsing(false);
    }
  };

  const handleSubmit = async (e, status = "open") => {
    e.preventDefault();

    // Validation
    if (!formData.job_title.trim()) {
      setError("Job title is required");
      return;
    }
    if (!formData.jd_text.trim()) {
      setError("Job description is required");
      return;
    }
    if (formData.skills.length === 0) {
      setError("At least one skill is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        status,
      };

      const response = await axiosInstance.post(
        "/v1/job-management/requirements",
        payload,
      );
      setSuccess(true);

      setTimeout(() => {
        navigate(
          userRole === "account_manager" ? "/am/jobs" : "/recruiter/jobs",
        );
      }, 1500);
    } catch (err) {
      console.error("Error creating job:", err);
      setError(
        err.response?.data?.detail || "Failed to create job. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Create New Job
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Add a new job requirement
          </p>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg flex items-center gap-3">
          <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
          <span className="text-green-700 dark:text-green-300">
            Job created successfully! Redirecting...
          </span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <span className="text-red-700 dark:text-red-300">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4 text-red-600 dark:text-red-400" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("manual")}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === "manual"
              ? "text-indigo-600 border-b-2 border-indigo-600"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          Manual Entry
        </button>
        <button
          onClick={() => setActiveTab("import")}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === "import"
              ? "text-indigo-600 border-b-2 border-indigo-600"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          Import from JD
        </button>
      </div>

      <form onSubmit={(e) => handleSubmit(e, "open")}>
        {/* Import Tab Content */}
        {activeTab === "import" && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Upload or Paste JD
            </h2>

            {/* File Upload */}
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center mb-4">
              {jdFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="w-8 h-8 text-indigo-600" />
                  <span className="text-gray-900 dark:text-white">
                    {jdFile.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setJdFile(null)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    Drag & drop a JD file or click to upload
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    PDF, DOCX • Max 5MB
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </>
              )}
            </div>

            <div className="text-center text-gray-500 dark:text-gray-400 my-4">
              OR
            </div>

            {/* Paste JD Text */}
            <textarea
              placeholder="Paste raw JD text here..."
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              rows={8}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />

            <button
              type="button"
              onClick={handleParseJD}
              disabled={parsing || (!jdFile && !jdText.trim())}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {parsing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Parsing JD...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Parse JD
                </>
              )}
            </button>

            {/* Parsed Fields Indicator */}
            {Object.keys(parsedFields).length > 0 && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Fields auto-filled from JD. Review and edit below.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Form Fields */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date Created */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="date_created"
                value={formData.date_created}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Client */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Client <span className="text-red-500">*</span>
              </label>
              <select
                name="client_id"
                value={formData.client_id}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select Client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.client_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Client TA */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Client TA (Contact)
              </label>
              <input
                type="text"
                name="client_ta"
                value={formData.client_ta}
                onChange={handleInputChange}
                placeholder="Client's HR/TA contact name"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Job Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Job Title <span className="text-red-500">*</span>
                {parsedFields.job_title && (
                  <span className="ml-2 text-xs text-green-600">
                    Auto-filled
                  </span>
                )}
              </label>
              <input
                type="text"
                name="job_title"
                value={formData.job_title}
                onChange={handleInputChange}
                required
                placeholder="e.g., Senior SAP FICO Consultant"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Mode <span className="text-red-500">*</span>
              </label>
              <select
                name="mode"
                value={formData.mode}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="hybrid">Hybrid</option>
                <option value="remote">Remote</option>
                <option value="onsite">On-site</option>
                <option value="contract">Contract</option>
              </select>
            </div>

            {/* Experience */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Experience <span className="text-red-500">*</span>
                {parsedFields.experience && (
                  <span className="ml-2 text-xs text-green-600">
                    Auto-filled
                  </span>
                )}
              </label>
              <input
                type="text"
                name="experience"
                value={formData.experience}
                onChange={handleInputChange}
                required
                placeholder="e.g., 5-8 years"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Location <span className="text-red-500">*</span>
                {parsedFields.location && (
                  <span className="ml-2 text-xs text-green-600">
                    Auto-filled
                  </span>
                )}
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                required
                placeholder="e.g., Bengaluru, India"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Duration
              </label>
              <input
                type="text"
                name="duration"
                value={formData.duration}
                onChange={handleInputChange}
                placeholder="e.g., 6 months, Full-time permanent"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* No of Positions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                No of Positions <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="no_of_positions"
                value={formData.no_of_positions}
                onChange={handleInputChange}
                required
                min="1"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Budget */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Budget / CTC <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="budget"
                value={formData.budget}
                onChange={handleInputChange}
                required
                placeholder="e.g., ₹15-20 LPA"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Work Timings */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Work Timings
              </label>
              <input
                type="text"
                name="work_timings"
                value={formData.work_timings}
                onChange={handleInputChange}
                placeholder="e.g., 5:30 AM - 2:30 PM (Australian Shift)"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Joining Preference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Joining Preference
              </label>
              <input
                type="text"
                name="joining_preference"
                value={formData.joining_preference}
                onChange={handleInputChange}
                placeholder="e.g., Immediate joiners only"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Skills */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Skills <span className="text-red-500">*</span>
              {parsedFields.skills && (
                <span className="ml-2 text-xs text-green-600">Auto-filled</span>
              )}
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.skills.map((skill, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 rounded-full text-sm"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(skill)}
                    className="hover:text-indigo-900 dark:hover:text-indigo-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyPress={handleSkillKeyPress}
                placeholder="Type a skill and press Enter"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddSkill}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* JD Text */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Job Description <span className="text-red-500">*</span>
            </label>
            <textarea
              name="jd_text"
              value={formData.jd_text}
              onChange={handleInputChange}
              required
              rows={10}
              placeholder="Enter the full job description..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Recruiter Assignment (AM Only) */}
          {userRole === "account_manager" && recruiters.length > 0 && (
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Assign Recruiters
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {recruiters.map((recruiter) => (
                  <label
                    key={recruiter.id}
                    className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                      formData.recruiter_ids.includes(recruiter.id)
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                        : "border-gray-300 dark:border-gray-600 hover:border-indigo-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.recruiter_ids.includes(recruiter.id)}
                      onChange={() => handleRecruiterToggle(recruiter.id)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-900 dark:text-white">
                      {recruiter.full_name || recruiter.email}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Notes for Recruiter (AM Only) */}
          {userRole === "account_manager" && (
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes for Recruiter (Internal)
              </label>
              <textarea
                name="notes_for_recruiter"
                value={formData.notes_for_recruiter || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    notes_for_recruiter: e.target.value,
                  }))
                }
                rows={3}
                placeholder="Private instructions for assigned recruiters..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* Submit Buttons */}
          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e, "draft")}
              disabled={loading}
              className="px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors disabled:opacity-50"
            >
              Save as Draft
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Publish Job"
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default JobCreateForm;
