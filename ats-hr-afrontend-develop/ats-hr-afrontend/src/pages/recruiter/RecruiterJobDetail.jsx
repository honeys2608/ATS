import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ManualCandidateAdditionDrawer from "../../components/ManualCandidateAdditionDrawer";
import { getAssignedJobs } from "../../services/jobService";
import {
  analyzeJobForSmartSearch,
  encodeSmartSearchAnalysis,
} from "../../utils/smartConductSearch";

const getStatusConfig = (status) => {
  switch ((status || "").toLowerCase()) {
    case "active":
      return {
        label: "Active",
        className: "bg-green-100 text-green-800",
      };
    case "closed":
      return {
        label: "Closed",
        className: "bg-red-100 text-red-800",
      };
    case "on_hold":
    case "on hold":
      return {
        label: "On Hold",
        className: "bg-yellow-100 text-yellow-800",
      };
    case "draft":
      return {
        label: "Draft",
        className: "bg-gray-100 text-gray-700",
      };
    default:
      return {
        label: "Active", // frontend default
        className: "bg-green-100 text-green-800",
      };
  }
};

export default function RecruiterJobDetail() {
  const renderExperience = (min, max) => {
    if (
      min === null ||
      min === undefined ||
      max === null ||
      max === undefined
    ) {
      return "Not specified";
    }
    return `${min} - ${max} yrs`;
  };

  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [assignedJobs, setAssignedJobs] = useState([]);
  const [selectedJobForModal, setSelectedJobForModal] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [analyzingJobId, setAnalyzingJobId] = useState("");
  const [analysisError, setAnalysisError] = useState("");

  const navigateToJobWorkflow = (job) => {
    if (!job) return;
    const params = new URLSearchParams();
    params.set("jobId", job.id || job.job_id);
    if (job.title) params.set("jobTitle", job.title);
    params.set("tab", "sent_to_am");
    navigate(`/recruiter/candidate-workflow?${params.toString()}`);
  };

  useEffect(() => {
    loadAssignedJobs();
  }, []);

  async function loadAssignedJobs() {
    try {
      const res = await getAssignedJobs();
      const jobs = res?.data?.jobs || [];
      setAssignedJobs(jobs);
    } catch (err) {
      console.error("Failed to load assigned jobs", err);
    } finally {
      setLoading(false);
    }
  }

  const handleConductSearch = async (job) => {
    const effectiveJobId = job?.id || job?.job_id || "";
    if (!effectiveJobId) return;

    setAnalysisError("");
    setAnalyzingJobId(effectiveJobId);

    const params = new URLSearchParams();
    try {
      const { analysis, query, keywords } = analyzeJobForSmartSearch(job);
      const encodedAnalysis = encodeSmartSearchAnalysis(analysis);

      if (query) params.set("q", query);
      if (keywords.length) params.set("keywords", keywords.join(","));
      if (job?.job_id || job?.id) params.set("job_id", job.job_id || job.id);
      if (job?.title) params.set("job_title", job.title);
      if (encodedAnalysis) params.set("analysis", encodedAnalysis);
      params.set("auto_search", "1");

      navigate(`/recruiter/resdex/advanced-search?${params.toString()}`);
    } catch (error) {
      setAnalysisError("Unable to analyze this JD. Please try manual search.");
    } finally {
      setAnalyzingJobId("");
    }
  };

  if (loading)
    return <div className="p-6 text-center">Loading job details...</div>;
  if (assignedJobs.length === 0)
    return (
      <div className="p-6 text-center text-gray-600">
        No assigned jobs found
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Assigned Jobs</h1>
          <p className="text-gray-600 mt-2">
            Jobs assigned to you by Account Managers
          </p>
          {analysisError && (
            <p className="text-amber-700 mt-2 text-sm">{analysisError}</p>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full">
            <thead className="bg-purple-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Job Title
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Experience
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Account Manager
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {assignedJobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    <div>{job.title}</div>
                    <div className="text-xs text-gray-500">
                      ID: {job.job_id}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {job.location || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {job.department || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {renderExperience(job.min_experience, job.max_experience)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {job.account_manager?.name ||
                      job.account_manager?.am_name ||
                      "—"}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {(() => {
                      const status = getStatusConfig(job.status);
                      return (
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedJobForModal(job)}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => navigateToJobWorkflow(job)}
                        className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 transition"
                      >
                        View Submissions
                      </button>

                      <button
                        onClick={() => handleConductSearch(job)}
                        disabled={analyzingJobId === (job.id || job.job_id)}
                        className="px-3 py-1 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {analyzingJobId === (job.id || job.job_id)
                          ? "Analyzing JD..."
                          : "Smart Search"}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedJob(job);
                          setDrawerOpen(true);
                        }}
                        className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition"
                      >
                        + Add New Candidate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Job Details Modal */}
      {selectedJobForModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-600 to-emerald-500 p-6 text-white flex justify-between items-center sticky top-0">
              <h2 className="text-2xl font-bold">
                {selectedJobForModal.title}
              </h2>
              <button
                onClick={() => setSelectedJobForModal(null)}
                className="text-2xl font-bold hover:text-gray-200 transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Role & Location */}
              <div className="border-b pb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Role Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase">
                      Role
                    </p>
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedJobForModal.title}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase">
                      Location
                    </p>
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedJobForModal.location || "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Experience & CTC */}
              <div className="border-b pb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Experience & Compensation
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase">
                      Experience
                    </p>
                    <p className="text-lg font-semibold text-gray-900">
                      {renderExperience(
                        selectedJobForModal.min_experience,
                        selectedJobForModal.max_experience,
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase">
                      CTC
                    </p>
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedJobForModal.salary_range || "Not specified"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Job Description */}
              <div className="border-b pb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Job Description
                </h3>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {selectedJobForModal.description ||
                    "No description available"}
                </p>
              </div>

              {/* Skills */}
              <div className="border-b pb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-3">
                  Required Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(selectedJobForModal.skills || []).length > 0 ? (
                    (selectedJobForModal.skills || []).map((skill, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold"
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    <p className="text-gray-500">No skills specified</p>
                  )}
                </div>
              </div>

              {/* Additional Info */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Additional Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="text-xs font-semibold text-gray-500 uppercase">
                      Department
                    </p>
                    <p className="text-gray-900 font-semibold">
                      {selectedJobForModal.department || "N/A"}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="text-xs font-semibold text-gray-500 uppercase">
                      Status
                    </p>
                    <p className="text-gray-900 font-semibold">
                      {selectedJobForModal.status || "N/A"}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded col-span-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase">
                      Account Manager
                    </p>
                    <p className="text-gray-900 font-semibold">
                      {selectedJobForModal.account_manager?.name ||
                        selectedJobForModal.account_manager?.am_name ||
                        "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setSelectedJobForModal(null)}
                className="w-full px-4 py-3 bg-purple-600 text-white font-semibold rounded hover:bg-purple-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Candidate Addition Drawer */}
      {drawerOpen && (
        <ManualCandidateAdditionDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          job={selectedJob}
        />
      )}
    </div>
  );
}
