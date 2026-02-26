/**
 * Job/Requirement Management Page
 * Create, edit, list, and manage job postings
 */

import React, { useState, useEffect } from "react";
import axios from "../../api/axios";
import { useNavigate } from "react-router-dom";

function JobCard({ job, onEdit, onDelete, onViewDetails }) {
  return (
    <div className="bg-white border rounded-lg p-4 hover:shadow-lg transition">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h3 className="font-bold text-gray-900">{job.title}</h3>
          <p className="text-sm text-gray-600">
            {job.location || "Location TBD"}
          </p>
        </div>
        <span
          className={`px-3 py-1 text-xs rounded-full font-medium ${
            job.status === "active"
              ? "bg-green-100 text-green-700"
              : job.status === "draft"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-gray-100 text-gray-700"
          }`}
        >
          {job.status || "draft"}
        </span>
      </div>

      <div className="text-sm text-gray-600 mb-3">
        <p>📅 Created: {new Date(job.created_at).toLocaleDateString()}</p>
        <p>💼 Skills: {job.skills?.join(", ") || "Not specified"}</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onViewDetails(job.id)}
          className="flex-1 bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-2 rounded text-sm font-medium"
        >
          View
        </button>
        <button
          onClick={() => onEdit(job.id)}
          className="flex-1 bg-yellow-50 text-yellow-600 hover:bg-yellow-100 px-3 py-2 rounded text-sm font-medium"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(job.id)}
          className="flex-1 bg-red-50 text-red-600 hover:bg-red-100 px-3 py-2 rounded text-sm font-medium"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function JobFormModal({ isOpen, job, onClose, onSave }) {
  const [formData, setFormData] = useState({
    title: "",
    location: "",
    description: "",
    skills: "",
    experience: 0,
    salary: "",
    status: "draft",
    ...job,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      if (!formData.title?.trim()) {
        setError("Job title is required");
        return;
      }

      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save job");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
          <h2 className="text-xl font-bold">
            {job ? "Edit Job" : "Create New Job"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Job Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
              placeholder="e.g., Senior Software Engineer"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleChange("location", e.target.value)}
                placeholder="e.g., Bangalore, India"
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Experience (years)
              </label>
              <input
                type="number"
                value={formData.experience}
                onChange={(e) =>
                  handleChange("experience", parseInt(e.target.value) || 0)
                }
                placeholder="0"
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Salary Range (CTC)
            </label>
            <input
              type="text"
              value={formData.salary}
              onChange={(e) => handleChange("salary", e.target.value)}
              placeholder="e.g., 10-15 LPA"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Required Skills (comma-separated)
            </label>
            <textarea
              value={formData.skills}
              onChange={(e) => handleChange("skills", e.target.value)}
              placeholder="Python, React, AWS, SQL"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 h-20"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Job Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Enter job description, responsibilities, and requirements..."
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 h-32"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => handleChange("status", e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t p-6 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Job"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function JobManagement() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/v1/jobs");
      setJobs(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch (err) {
      console.error("Failed to load jobs:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateJob = () => {
    setSelectedJob(null);
    setIsModalOpen(true);
  };

  const handleEditJob = (jobId) => {
    const job = jobs.find((j) => j.id === jobId);
    setSelectedJob(job);
    setIsModalOpen(true);
  };

  const handleDeleteJob = async (jobId) => {
    if (window.confirm("Are you sure you want to delete this job?")) {
      try {
        await axios.delete(`/v1/jobs/${jobId}`);
        setJobs(jobs.filter((j) => j.id !== jobId));
      } catch (err) {
        alert("Failed to delete job: " + err.message);
      }
    }
  };

  const handleSaveJob = async (formData) => {
    try {
      if (selectedJob?.id) {
        await axios.put(`/v1/jobs/${selectedJob.id}`, formData);
        setJobs(
          jobs.map((j) =>
            j.id === selectedJob.id ? { ...j, ...formData } : j,
          ),
        );
      } else {
        const res = await axios.post("/v1/jobs", formData);
        setJobs([...jobs, res.data]);
      }
    } catch (err) {
      throw new Error(err.response?.data?.detail || "Failed to save job");
    }
  };

  const handleViewDetails = (jobId) => {
    navigate(`/jobs/${jobId}`);
  };

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.location?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="p-6 text-center">Loading jobs...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Job Management</h1>
        <p className="text-gray-600 mt-1">Create and manage job postings</p>
      </div>

      {/* CONTROLS */}
      <div className="bg-white p-4 rounded-lg shadow mb-6 space-y-4">
        <div className="flex gap-4">
          <button
            onClick={handleCreateJob}
            className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700"
          >
            ➕ Create New Job
          </button>
        </div>

        <div className="flex gap-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title or location..."
            className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* JOBS GRID */}
      {filteredJobs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onEdit={handleEditJob}
              onDelete={handleDeleteJob}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white p-12 rounded-lg text-center">
          <p className="text-gray-600 text-lg">No jobs found</p>
          <p className="text-gray-400 text-sm mt-2">
            Create your first job posting to get started
          </p>
        </div>
      )}

      {/* MODAL */}
      <JobFormModal
        isOpen={isModalOpen}
        job={selectedJob}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveJob}
      />
    </div>
  );
}
