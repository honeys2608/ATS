// src/pages/Jobs.jsx
import React, { useState, useEffect, useMemo } from "react";
import axios from "../api/axios";
import { ActivitySummary } from "../components/ActivityIndicator";
import PaginatedCardGrid from "../components/common/PaginatedCardGrid";
import usePersistedPagination from "../hooks/usePersistedPagination";

// Universal Title Case formatter (frontend)
function toTitleCase(value) {
  if (!value) return value;

  return value
    .trim()
    .split(/\s+/)
    .map((word) => {
      // keep already ALL CAPS words
      if (word === word.toUpperCase()) return word;

      const lw = word.toLowerCase();

      // acronyms: IT, HR, AI, ML, QA, etc.
      if (lw.length <= 3) return lw.toUpperCase();

      // special chars: R&D, UI/UX
      if (/[&\/-]/.test(lw)) return lw.toUpperCase();

      return lw.charAt(0).toUpperCase() + lw.slice(1);
    })
    .join(" ");
}

function StatusBadge({ status }) {
  const map = {
    active: "bg-green-100 text-green-800",
    draft: "bg-yellow-100 text-yellow-800",
    closed: "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${
        map[status] || map.draft
      }`}
    >
      {status}
    </span>
  );
}

/* tag input for skills */
function SkillInput({ skills, setSkills, suggestions = [], onSearch }) {
  const [value, setValue] = useState("");

  const filteredSuggestions = suggestions.filter(
    (s) =>
      value &&
      s.toLowerCase().includes(value.toLowerCase()) &&
      !skills.includes(s),
  );

  const addSkill = (v) => {
    const s = v.trim();
    if (!s) return;
    if (!skills.includes(s)) setSkills([...skills, s]);
    setValue("");
  };

  const handleKey = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkill(value.replace(",", ""));
    } else if (e.key === "Backspace" && !value && skills.length) {
      setSkills(skills.slice(0, -1));
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {skills.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setSkills(skills.filter((x) => x !== s))}
            className="flex items-center gap-2 bg-indigo-50 text-indigo-800 px-2 py-1 rounded-full text-sm hover:opacity-90 shadow-sm"
            title="Click to remove"
          >
            {s} <span className="text-xs">x</span>
          </button>
        ))}
      </div>
      <input
        type="text"
        placeholder="Type skill and press Enter (e.g. React)"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          onSearch?.(e.target.value); // Backend search call
        }}
        onKeyDown={handleKey}
        onBlur={() => value && addSkill(value)}
        className="w-full p-3 border rounded"
      />

      {filteredSuggestions.length > 0 && (
        <div className="border rounded mt-1 bg-white shadow max-h-40 overflow-y-auto z-10 relative">
          {filteredSuggestions.slice(0, 6).map((s) => (
            <div
              key={s}
              onMouseDown={() => addSkill(s)} // important (prevents blur issue)
              className="px-3 py-2 cursor-pointer hover:bg-indigo-50 text-sm"
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function Modal({ open, onClose, title, children, saving }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => {
          if (!saving) onClose();
        }}
      />

      {/* modal */}
      <div className="relative bg-white w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-black text-xl"
          >
            x
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(true);
  const [jobApplications, setJobApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [jobInsights, setJobInsights] = useState([]);
  const [insightStatusFilter, setInsightStatusFilter] = useState("all");
  const [insightDeptFilter, setInsightDeptFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [showDetailsId, setShowDetailsId] = useState(null);
  const [skillSuggestions, setSkillSuggestions] = useState([]);

  const [emailParser, setEmailParser] = useState({
    sender: "",
    subject: "",
    body: "",
  });
  const [parsingEmail, setParsingEmail] = useState(false);
  const [emailParseMsg, setEmailParseMsg] = useState("");
  const [emailParseError, setEmailParseError] = useState("");
  const [showEmailModal, setShowEmailModal] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    department: "",
    location: "",
    job_type: "",
    salary_range: "",
    min_experience: "",
    max_experience: "",
    status: "draft",
    sla_days: "",
  });
  const [skills, setSkills] = useState([]);

  const [saving, setSaving] = useState(false);

  // list controls
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [skillFilter, setSkillFilter] = useState(""); // free text filter for skills
  const {
    page,
    setPage,
    limit: pageSize,
    setLimit: setPageSize,
    pageSizeOptions,
  } = usePersistedPagination("jobs:listing");
  const searchSkills = async (q) => {
    if (!q || q.trim().length === 0) {
      setSkillSuggestions([]);
      return;
    }

    try {
      const res = await axios.get(`/v1/skills/search?q=${q}`);
      setSkillSuggestions(res.data?.results || []);
    } catch (e) {
      console.error("Skill search failed", e);
      setSkillSuggestions([]);
    }
  };

  useEffect(() => {
    loadJobs();
    loadCandidates();
    loadJobApplications();
  }, []);

  useEffect(() => {
    if (!jobs.length) {
      setJobInsights([]);
      return;
    }

    const stats = jobs.map((job) => {
      // Find job applications for this job using job_id instead of internal id
      const relatedApplications = (jobApplications || []).filter((app) => {
        return app.job_id && String(app.job_id) === String(job.job_id);
      });

      // Get the most recent application for this job
      const latestApplication =
        relatedApplications.length > 0 ? relatedApplications[0] : null;
      const latestCandidate = latestApplication
        ? {
            full_name: latestApplication.full_name,
            email: latestApplication.email,
            status: latestApplication.status,
            public_id: latestApplication.public_id,
          }
        : null;

      return {
        jobId: job.id,
        job_id: job.job_id,
        title: job.title,
        department: job.department,
        status: job.status,
        applicantsCount: relatedApplications.length,
        latestCandidate,
        // Use backend activity data instead of calculating from candidates
        lastActivity: job.last_activity_at,
        lastActivityType: job.last_activity_type,
        lastActivityRelative: job.last_activity_relative,
      };
    });

    setJobInsights(stats);
  }, [jobs, candidates, jobApplications]);

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      department: "",
      location: "",
      job_type: "",
      salary_range: "",
      min_experience: "",
      max_experience: "",
      apply_by: "",
      status: "draft",
      sla_days: "",
    });
    setSkills([]);
    setEditingJob(null);
  };

  const loadJobs = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await axios.get("/v1/jobs");

      const list =
        res.data?.data || // backend returns { data: [...] }
        res.data?.jobs || // some APIs use jobs
        res.data ||
        []; // fallback

      const normalized = (Array.isArray(list) ? list : []).map((j) => ({
        ...j,
        skills: Array.isArray(j.skills)
          ? j.skills
          : j.skills
            ? ("" + j.skills)
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
      }));

      setJobs(normalized);
    } catch (err) {
      console.error("Failed to load jobs", err);
      setError(err.message || "Failed to load");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCandidates = async () => {
    setCandidatesLoading(true);
    try {
      const res = await axios.get("/v1/candidates");
      const data = res.data?.data || res.data || [];
      setCandidates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load candidates", err);
      setCandidates([]);
    } finally {
      setCandidatesLoading(false);
    }
  };

  const loadJobApplications = async () => {
    setApplicationsLoading(true);
    try {
      const res = await axios.get("/v1/jobs/submissions");
      setJobApplications(res.data?.candidates || []);
    } catch (err) {
      console.error("Failed to load job applications", err);
      setJobApplications([]);
    } finally {
      setApplicationsLoading(false);
    }
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      alert("Title is required");
      return false;
    }
    if (!formData.description.trim()) {
      alert("Description is required");
      return false;
    }
    const min =
      formData.min_experience === "" ? null : Number(formData.min_experience);
    const max =
      formData.max_experience === "" ? null : Number(formData.max_experience);
    if (min != null && max != null && min > max) {
      alert("Min experience cannot be greater than Max experience.");
      return false;
    }
    if (min != null && min < 0) {
      alert("Min experience cannot be negative");
      return false;
    }
    if (max != null && max < 0) {
      alert("Max experience cannot be negative");
      return false;
    }
    // ensure skills stored as array
    if (!Array.isArray(skills)) {
      alert("Skills invalid");
      return false;
    }
    return true;
  };

  const handleCreateOrUpdate = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    const payload = {
      ...formData,
      skills,
      min_experience:
        formData.min_experience === "" ? null : Number(formData.min_experience),
      max_experience:
        formData.max_experience === "" ? null : Number(formData.max_experience),
      sla_days: formData.sla_days === "" ? null : Number(formData.sla_days),
    };

    try {
      setSaving(true);
      if (editingJob) {
        await axios.put(`/v1/jobs/${editingJob.id}`, payload);
        alert("Job updated");
      } else {
        await axios.post("/v1/jobs", payload);
        alert("Job created");
      }
      resetForm();
      setShowForm(false);
      await loadJobs();
    } catch (err) {
      console.error("Save job error", err);
      alert(err.response?.data?.detail || err.message || "Error saving job");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (job) => {
    setEditingJob(job);
    setFormData({
      title: job.title || "",
      description: job.description || "",
      department: job.department || "",
      location: job.location || "",
      job_type: job.job_type || "",
      salary_range: job.salary_range || "",
      min_experience: job.min_experience ?? "",
      max_experience: job.max_experience ?? "",
      apply_by: job.apply_by ? job.apply_by.slice(0, 10) : "",
      status: job.status || "draft",
    });
    setSkills(job.skills || []);
    setShowForm(true);
  };

  const handleCloseJob = async (job) => {
    if (!confirm(`Close job "${job.title}"? This will archive it.`)) return;
    try {
      await axios.post(`/v1/jobs/${job.id}/close`);
      await loadJobs();
    } catch (err) {
      console.error("Close job error", err);
      alert(err.response?.data?.detail || err.message || "Error closing job");
    }
  };

  const allSkills = useMemo(() => {
    const s = new Set();
    jobs.forEach((j) => (j.skills || []).forEach((k) => k && s.add(k)));
    return Array.from(s).sort();
  }, [jobs]);

  // filtered & searched
  const filtered = jobs.filter((j) => {
    if (statusFilter !== "all" && j.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (q) {
      const hay =
        `${j.title} ${j.description} ${j.department} ${j.location}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (skillFilter) {
      const qk = skillFilter.trim().toLowerCase();
      const found = (j.skills || []).some((s) => s.toLowerCase().includes(qk));
      if (!found) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages, setPage]);

  // Sort jobs by created_at (newest first)
  const sortedFiltered = [...filtered].sort((a, b) => {
    const dateA = new Date(b.created_at || 0);
    const dateB = new Date(a.created_at || 0);
    return dateA - dateB;
  });

  const statusOptions = useMemo(() => {
    const set = new Set(jobs.map((job) => job.status).filter(Boolean));
    return Array.from(set);
  }, [jobs]);

  const departmentOptions = useMemo(() => {
    const set = new Set(jobs.map((job) => job.department).filter(Boolean));
    return Array.from(set);
  }, [jobs]);

  const filteredInsights = useMemo(() => {
    return jobInsights.filter((insight) => {
      const statusMatch =
        insightStatusFilter === "all" ||
        !insightStatusFilter ||
        insight.status === insightStatusFilter;
      const deptMatch =
        insightDeptFilter === "all" ||
        !insightDeptFilter ||
        (insight.department || "").toLowerCase() ===
          insightDeptFilter.toLowerCase();
      return statusMatch && deptMatch;
    });
  }, [jobInsights, insightStatusFilter, insightDeptFilter]);

  const insightsLoading = loading || candidatesLoading;

  const handleParseEmailJob = async (event) => {
    event.preventDefault();
    setEmailParseMsg("");
    setEmailParseError("");

    if (!emailParser.subject.trim() || !emailParser.body.trim()) {
      setEmailParseError("Subject and body are required to parse a job.");
      return;
    }

    setParsingEmail(true);
    try {
      await axios.post("/v1/jobs/parse-email", {
        sender: emailParser.sender || undefined,
        subject: emailParser.subject,
        body: emailParser.body,
      });
      setEmailParseMsg("Job created from email successfully.");
      setEmailParser({ sender: "", subject: "", body: "" });
      await loadJobs();
    } catch (error) {
      console.error("Email parsing failed", error);
      setEmailParseError(
        error?.response?.data?.detail ||
          error?.message ||
          "Failed to parse job from email. Please confirm the format.",
      );
    } finally {
      setParsingEmail(false);
    }
  };

  return (
    <div className="w-full">
      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Jobs</h1>
          <p className="text-gray-600">Create and manage job postings</p>
        </div>

        <div className="flex gap-2 items-center">
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            + Create Job
          </button>
          <button
            onClick={() => setShowEmailModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            + Parse Email
          </button>
        </div>
      </div>

      {/* insights */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              Jobs & Applicants Overview
            </h2>
            <p className="text-sm text-gray-500">
              Track how many candidates are applying to each open role.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={insightStatusFilter}
              onChange={(e) => {
                setInsightStatusFilter(e.target.value);
              }}
              className="px-3 py-2 border rounded text-sm"
            >
              <option value="all">All Status</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status.toUpperCase()}
                </option>
              ))}
            </select>
            <select
              value={insightDeptFilter}
              onChange={(e) => {
                setInsightDeptFilter(e.target.value);
              }}
              className="px-3 py-2 border rounded text-sm"
            >
              <option value="all">All departments</option>
              {departmentOptions.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          {insightsLoading ? (
            <div className="py-6 text-center text-gray-500 text-sm">
              Loading job insights...
            </div>
          ) : filteredInsights.length === 0 ? (
            <div className="py-6 text-center text-gray-500 text-sm">
              No data available for the current filters.
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">
                    S. No.
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">
                    Job ID
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">
                    Job
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">
                    Department
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-2 text-center font-medium text-gray-500">
                    Applicants
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">
                    Latest Candidate
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">
                    Last Activity
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredInsights.map((insight, index) => (
                  <tr key={insight.jobId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-700">
                      {index + 1}
                    </td>

                    {/* ATS Job ID */}
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {insight.job_id ||
                        insight.job_code ||
                        insight.public_job_id ||
                        "--"}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {insight.title || "Untitled role"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {insight.department || "--"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={insight.status || "draft"} />
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-indigo-600">
                      {insight.applicantsCount}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {insight.latestCandidate ? (
                        <div>
                          <div className="font-medium">
                            {insight.latestCandidate.name ||
                              insight.latestCandidate.email ||
                              "Candidate"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {insight.latestCandidate.status?.replace(
                              /_/g,
                              " ",
                            ) || "status unknown"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">No applicants yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ActivitySummary
                        lastActivityAt={insight.lastActivity}
                        lastActivityType={insight.lastActivityType}
                        lastActivityRelative={insight.lastActivityRelative}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* email parse */}
      <Modal
        open={showEmailModal}
        saving={parsingEmail}
        onClose={() => {
          if (parsingEmail) return;
          setShowEmailModal(false);
          setEmailParser({ sender: "", subject: "", body: "" });
          setEmailParseError("");
          setEmailParseMsg("");
        }}
        title="Create Job from Email"
      >
        <form className="space-y-4" onSubmit={handleParseEmailJob}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">From</label>
              <input
                type="email"
                value={emailParser.sender}
                onChange={(e) =>
                  setEmailParser((prev) => ({
                    ...prev,
                    sender: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                placeholder="example@client.com"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Email subject *
              </label>
              <input
                type="text"
                value={emailParser.subject}
                onChange={(e) =>
                  setEmailParser((prev) => ({
                    ...prev,
                    subject: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                placeholder="Urgent hiring request - Senior React Developer"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">
              Email body *
            </label>
            <textarea
              value={emailParser.body}
              onChange={(e) =>
                setEmailParser((prev) => ({
                  ...prev,
                  body: e.target.value,
                }))
              }
              className="mt-1 w-full rounded border border-gray-300 px-3 py-3 h-48"
              placeholder="Paste the requirement email text here..."
              required
            />
          </div>

          {emailParseError && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {emailParseError}
            </div>
          )}

          {emailParseMsg && (
            <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-600">
              {emailParseMsg}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              disabled={parsingEmail}
              onClick={() => {
                setShowEmailModal(false);
                setEmailParser({ sender: "", subject: "", body: "" });
                setEmailParseError("");
                setEmailParseMsg("");
              }}
              className="px-4 py-2 border rounded"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={parsingEmail}
              className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-60"
            >
              {parsingEmail ? "Parsing..." : "Parse & Create Job"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create / Edit Form */}
      <Modal
        open={showForm}
        saving={saving}
        onClose={() => {
          resetForm();
          setShowForm(false);
        }}
        title={editingJob ? "Edit Job" : "Create Job"}
      >
        <form onSubmit={handleCreateOrUpdate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Job Title *
              </label>
              <input
                className="w-full p-3 border rounded"
                value={formData.title}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    title: e.target.value, // allow free typing
                  })
                }
                onBlur={(e) =>
                  setFormData({
                    ...formData,
                    title: toTitleCase(e.target.value), // format after typing
                  })
                }
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                className="w-full p-3 border rounded"
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Description *
            </label>
            <textarea
              rows={5}
              className="w-full p-3 border rounded"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              className="p-3 border rounded"
              placeholder="Department"
              value={formData.department}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  department: e.target.value,
                })
              }
              onBlur={(e) =>
                setFormData({
                  ...formData,
                  department: toTitleCase(e.target.value),
                })
              }
            />
            <input
              className="p-3 border rounded"
              placeholder="Location"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              onBlur={(e) =>
                setFormData({
                  ...formData,
                  location: toTitleCase(e.target.value),
                })
              }
            />

            <select
              className="p-3 border rounded"
              value={formData.job_type}
              onChange={(e) =>
                setFormData({ ...formData, job_type: e.target.value })
              }
            >
              <option value="">Job type</option>
              <option value="Full-time">Full-time</option>
              <option value="Remote">Remote</option>
              <option value="Hybrid">Hybrid</option>
            </select>

            <input
              className="p-3 border rounded"
              placeholder="Salary range"
              value={formData.salary_range}
              onChange={(e) =>
                setFormData({ ...formData, salary_range: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Last Date to Apply *
            </label>
            <input
              type="date"
              value={formData.apply_by}
              onChange={(e) =>
                setFormData((f) => ({ ...f, apply_by: e.target.value }))
              }
              className="mt-1 block w-full rounded-md border p-2"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="number"
              min="0"
              className="p-3 border rounded"
              placeholder="Min experience"
              value={formData.min_experience ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, min_experience: e.target.value })
              }
            />
            <input
              type="number"
              min="0"
              className="p-3 border rounded"
              placeholder="SLA days"
              value={formData.sla_days ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, sla_days: e.target.value })
              }
            />

            <input
              type="number"
              min="0"
              className="p-3 border rounded"
              placeholder="Max experience"
              value={formData.max_experience ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, max_experience: e.target.value })
              }
            />

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Skills</label>
              <SkillInput
                skills={skills}
                setSkills={setSkills}
                suggestions={skillSuggestions} // from backend
                onSearch={searchSkills} // connect API
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              className="px-4 py-2 border rounded"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded"
            >
              {saving ? "Saving..." : editingJob ? "Update Job" : "Create Job"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 mb-2">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <input
              placeholder="Search by title, dept, location or description"
              className="p-3 border rounded w-full"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <select
              className="p-3 border rounded"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div className="flex items-center gap-3 mt-3 md:mt-0">
            <input
              placeholder="Filter skills (type)"
              className="p-3 border rounded"
              value={skillFilter}
              onChange={(e) => {
                setSkillFilter(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Quick Filters</h3>
            <div className="text-sm text-gray-400">Tap a skill to filter</div>
          </div>

          <div className="flex flex-wrap gap-2">
            {allSkills.length === 0 ? (
              <div className="text-sm text-gray-500">
                No skills available yet.
              </div>
            ) : (
              allSkills.slice(0, 12).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSkillFilter(s);
                    setPage(1);
                  }}
                  className={`px-3 py-1 rounded-full text-sm border shadow-sm hover:shadow-md transition ${
                    skillFilter === s
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-700"
                  }`}
                >
                  {s}
                </button>
              ))
            )}

            {skillFilter && (
              <button
                onClick={() => {
                  setSkillFilter("");
                  setPage(1);
                }}
                className="px-3 py-1 rounded-full text-sm border bg-gray-50 text-gray-700"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Jobs list */}
      <PaginatedCardGrid
        items={sortedFiltered}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={(nextSize) => {
          setPageSize(nextSize);
          setPage(1);
        }}
        pageSizeOptions={pageSizeOptions}
        totalRecords={sortedFiltered.length}
        loading={loading}
        error={error ? `Error: ${error}` : null}
        onRetry={loadJobs}
        emptyMessage="No jobs found."
        renderCard={(job) => (
          <article className="bg-white p-5 rounded-lg shadow hover:shadow-md transition">
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">{job.title}</h3>
                  <StatusBadge status={job.status} />
                </div>
                <p className="text-sm text-gray-600 mt-2 line-clamp-3">
                  {job.description}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(job.skills || []).slice(0, 8).map((s, i) => (
                    <span
                      key={`${job.id}-skill-${i}`}
                      className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs"
                    >
                      {s}
                    </span>
                  ))}
                </div>

                <div className="mt-3 text-sm text-gray-700">
                  <span>
                    {job.department ? `${job.department} • ` : ""}
                    {job.location}
                  </span>
                  <span className="ml-3">
                    {job.min_experience != null ? `${job.min_experience} yrs` : "0"}
                    {job.max_experience ? ` - ${job.max_experience} yrs` : ""}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={() => handleEdit(job)}
                  className="text-sm px-3 py-1 bg-blue-600 text-white rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleCloseJob(job)}
                  disabled={job.status === "closed"}
                  className="text-sm px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
                >
                  {job.status === "closed" ? "Closed" : "Close"}
                </button>
                <button
                  onClick={() => setShowDetailsId(showDetailsId === job.id ? null : job.id)}
                  className="text-sm px-3 py-1 bg-white border rounded"
                >
                  Details
                </button>
              </div>
            </div>

            {showDetailsId === job.id && (
              <div className="mt-4 border-t pt-4 text-sm text-gray-700">
                <div>
                  <strong>Type:</strong> {job.job_type || "N/A"}
                </div>
                <div className="mt-2">
                  <strong>Salary:</strong> {job.salary_range || "N/A"}
                </div>
                <div className="mt-2">
                  <strong>Skills:</strong> {(job.skills || []).join(", ") || "N/A"}
                </div>
                <div className="mt-2">
                  <strong>Posted:</strong>{" "}
                  {job.created_at
                    ? new Date(job.created_at).toLocaleDateString()
                    : "N/A"}
                </div>
                <div className="mt-2">
                  <strong>SLA days:</strong> {job.sla_days ?? "N/A"}
                </div>
              </div>
            )}
          </article>
        )}
      />
    </div>
  );
}

