/**
 * Job Posting Form - Create external job postings
 * Can be linked to an existing job or created standalone
 */
import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Check,
  AlertCircle,
  X,
  Plus,
  Calendar,
} from "lucide-react";
import axiosInstance from "../../api/axios";

const JobPostingForm = ({ userRole = "recruiter" }) => {
  const { jobId } = useParams();
  const [searchParams] = useSearchParams();
  const linkedJobId = jobId || searchParams.get("jobId");
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [fetchingJob, setFetchingJob] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    job_id: linkedJobId || "",
    title: "",
    client_display_name: "",
    jd_content: "",
    ctc: "",
    location: "",
    mode: "hybrid",
    experience: "",
    skills: [],
    last_date_to_apply: "",
    status: "draft",
  });

  // Skill input
  const [skillInput, setSkillInput] = useState("");

  // Available jobs for linking
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    fetchJobs();
    if (linkedJobId) {
      fetchJobDetails(linkedJobId);
    }
  }, [linkedJobId]);

  const fetchJobs = async () => {
    try {
      const response = await axiosInstance.get(
        "/v1/job-management/requirements",
      );
      setJobs(response.data.jobs || response.data || []);
    } catch (err) {
      console.error("Error fetching jobs:", err);
    }
  };

  const fetchJobDetails = async (id) => {
    setFetchingJob(true);
    try {
      const response = await axiosInstance.get(
        `/v1/job-management/requirements/${id}`,
      );
      const job = response.data;

      // Auto-fill from job
      setFormData((prev) => ({
        ...prev,
        job_id: id,
        title: job.title || job.job_title || "",
        client_display_name: job.client?.client_name || "",
        jd_content: job.jd_text || job.description || "",
        ctc: job.budget || "",
        location: job.location || "",
        mode: job.mode || "hybrid",
        experience: job.experience || "",
        skills: job.skills || [],
      }));
    } catch (err) {
      console.error("Error fetching job details:", err);
    } finally {
      setFetchingJob(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleJobSelect = (e) => {
    const selectedJobId = e.target.value;
    if (selectedJobId) {
      fetchJobDetails(selectedJobId);
    } else {
      setFormData((prev) => ({
        ...prev,
        job_id: "",
        title: "",
        client_display_name: "",
        jd_content: "",
        ctc: "",
        location: "",
        mode: "hybrid",
        experience: "",
        skills: [],
      }));
    }
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

  const handleSubmit = async (e, status = "draft") => {
    e.preventDefault();

    // Validation
    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }
    if (!formData.jd_content.trim()) {
      setError("Job description is required");
      return;
    }
    if (!formData.last_date_to_apply) {
      setError("Last date to apply is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        status,
        job_id: formData.job_id || null,
      };

      // If linked to a job, use that endpoint
      const endpoint = formData.job_id
        ? `/v1/job-management/requirements/${formData.job_id}/postings`
        : "/v1/job-management/postings";

      await axiosInstance.post(endpoint, payload);
      setSuccess(true);

      setTimeout(() => {
        navigate(
          formData.job_id
            ? `${userRole === "account_manager" ? "/am" : "/recruiter"}/jobs/${formData.job_id}`
            : `${userRole === "account_manager" ? "/am" : "/recruiter"}/jobs`,
        );
      }, 1500);
    } catch (err) {
      console.error("Error creating posting:", err);
      setError(
        err.response?.data?.detail ||
          "Failed to create posting. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Calculate minimum date (today)
  const today = new Date().toISOString().split("T")[0];

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
            Create Job Posting
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Create an external job posting for candidates
          </p>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg flex items-center gap-3">
          <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
          <span className="text-green-700 dark:text-green-300">
            Job posting created successfully! Redirecting...
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

      <form onSubmit={(e) => handleSubmit(e, "active")}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          {/* Link to Existing Job */}
          <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Link to Existing Job (Optional)
            </label>
            <select
              name="job_id"
              value={formData.job_id}
              onChange={handleJobSelect}
              disabled={!!linkedJobId}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 dark:disabled:bg-gray-600"
            >
              <option value="">-- Create standalone posting --</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title || job.job_title} -{" "}
                  {job.client?.client_name || "Unknown Client"}
                </option>
              ))}
            </select>
            {fetchingJob && (
              <p className="mt-2 text-sm text-indigo-600 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading job details...
              </p>
            )}
            {formData.job_id && !fetchingJob && (
              <p className="mt-2 text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                <Check className="w-4 h-4" />
                Fields auto-filled from linked job
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Posting Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                placeholder="e.g., Senior Software Engineer"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Client Display Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Company Display Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="client_display_name"
                value={formData.client_display_name}
                onChange={handleInputChange}
                required
                placeholder="e.g., Leading IT MNC or actual company name"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Location <span className="text-red-500">*</span>
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

            {/* Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Work Mode <span className="text-red-500">*</span>
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

            {/* CTC */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                CTC / Salary Range <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="ctc"
                value={formData.ctc}
                onChange={handleInputChange}
                required
                placeholder="e.g., ₹15-20 LPA or As per market standards"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Last Date to Apply */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Last Date to Apply <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  name="last_date_to_apply"
                  value={formData.last_date_to_apply}
                  onChange={handleInputChange}
                  required
                  min={today}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Skills */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Required Skills <span className="text-red-500">*</span>
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

          {/* JD Content */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Job Description <span className="text-red-500">*</span>
            </label>
            <textarea
              name="jd_content"
              value={formData.jd_content}
              onChange={handleInputChange}
              required
              rows={10}
              placeholder="Enter the job description that will be visible to candidates..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              This description will be visible to candidates. Remove any
              confidential information.
            </p>
          </div>

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
                  Publishing...
                </>
              ) : (
                "Publish Posting"
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default JobPostingForm;
