import React, { useState } from "react";
import { formatDate } from "../../utils/dateFormatter";
import { useNavigate } from "react-router-dom";
import { useAssignedJobs } from "../../hooks/useRequirements";
import ManualCandidateAdditionDrawer from "../../components/ManualCandidateAdditionDrawer";
import {
  analyzeJobForSmartSearch,
  encodeSmartSearchAnalysis,
} from "../../utils/smartConductSearch";
import {
  Briefcase,
  MapPin,
  Users,
  Eye,
  UserPlus,
  Search,
  X,
  Clock,
  Building,
  AlertCircle,
  DollarSign,
  IndianRupee,
  Calendar,
} from "lucide-react";

const AssignedJobs = () => {
  const navigate = useNavigate();
  const { jobs, loading, error } = useAssignedJobs();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailJob, setDetailJob] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
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

  const filteredJobs = jobs.filter((job) => {
    const term = searchTerm.toLowerCase();
    return (
      !term ||
      job.title?.toLowerCase().includes(term) ||
      job.location?.toLowerCase().includes(term) ||
      job.department?.toLowerCase().includes(term) ||
      (job.skills || []).some((s) =>
        (typeof s === "string" ? s : s?.name || "")
          .toLowerCase()
          .includes(term),
      )
    );
  });

  const getStatusBadge = (status) => {
    const styles = {
      active:
        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      open: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      closed: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
      on_hold:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      draft: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    };
    return (
      <span
        className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${styles[status] || styles.active}`}
      >
        {status || "Active"}
      </span>
    );
  };

  const getModeBadge = (mode) => {
    const styles = {
      hybrid:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      remote:
        "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
      onsite:
        "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    };
    return mode ? (
      <span
        className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${styles[mode] || styles.hybrid}`}
      >
        {mode}
      </span>
    ) : null;
  };

  const getClientDisplayName = (job) =>
    job?.client_name ||
    job?.client?.client_name ||
    job?.client_display_name ||
    job?.company_name ||
    "Client not specified";

  const getBudgetIcon = (budgetValue) => {
    const normalized = String(budgetValue || "").toUpperCase();
    if (normalized.includes("INR") || normalized.includes("₹")) {
      return IndianRupee;
    }
    return DollarSign;
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Assigned Jobs
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Jobs assigned to you by Account Managers
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by title, location, department, skills..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3" />
            <p className="text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}
        {analysisError && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6 flex items-center">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mr-3" />
            <p className="text-amber-800 dark:text-amber-300">{analysisError}</p>
          </div>
        )}

        {/* Empty State */}
        {filteredJobs.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
            <Briefcase className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-medium text-gray-900 dark:text-white">
              No assigned jobs
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Jobs assigned to you by Account Managers will appear here
            </p>
          </div>
        ) : (
          /* Jobs Grid - Compact Cards */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden"
              >
                {/* Card Header */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(job.status)}
                      {getModeBadge(job.mode)}
                    </div>
                    <span className="text-purple-200 text-xs">
                      ID: {job.job_id || job.id?.slice(0, 8)}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mt-1 line-clamp-1">
                    {job.title}
                  </h3>
                </div>

                {/* Card Body - Only Essential Info */}
                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Building className="w-4 h-4 text-purple-500 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300 truncate">
                      {getClientDisplayName(job)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-purple-500 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300 truncate">
                      {job.location || "Location not specified"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="w-4 h-4 text-purple-500 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">
                      {job.experience ||
                        `${job.min_experience || 0} - ${job.max_experience || "Any"} yrs`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-purple-500 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">
                      {job.no_of_positions || 1} position(s)
                    </span>
                  </div>

                  {(job.budget || job.salary_range) && (
                    <div className="flex items-center gap-2 text-sm">
                      {React.createElement(
                        getBudgetIcon(job.budget || job.salary_range),
                        { className: "w-4 h-4 text-green-500 flex-shrink-0" },
                      )}
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        {job.budget || job.salary_range}
                      </span>
                    </div>
                  )}

                  {/* Skills - Show only 3 */}
                  <div className="pt-2">
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(job.skills) ? job.skills : [])
                        .slice(0, 3)
                        .map((skill, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-full text-xs"
                          >
                            {typeof skill === "string"
                              ? skill
                              : skill?.name || skill}
                          </span>
                        ))}
                      {Array.isArray(job.skills) && job.skills.length > 3 && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded-full text-xs">
                          +{job.skills.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="px-4 pb-4 pt-0 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setDetailJob(job);
                      setShowDetailModal(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                  >
                    <Eye className="w-4 h-4" />
                    View Details
                  </button>
                  <button
                    onClick={() => navigateToJobWorkflow(job)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                  >
                    <Users className="w-4 h-4" />
                    Submissions
                  </button>
                </div>
                <div className="px-4 pb-4 flex gap-2">
                  <button
                    onClick={() => handleConductSearch(job)}
                    disabled={analyzingJobId === (job.id || job.job_id)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 border border-purple-500 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Search className="w-4 h-4" />
                    {analyzingJobId === (job.id || job.job_id)
                      ? "Analyzing JD..."
                      : "Smart Search"}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedJob(job);
                      setDrawerOpen(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                  >
                    <UserPlus className="w-4 h-4" />
                    Add Candidate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* View Details Modal */}
        {showDetailModal && detailJob && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-5 flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white">
                    {detailJob.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-purple-200 text-sm">
                      ID: {detailJob.job_id || detailJob.id?.slice(0, 8)}
                    </span>
                    {getStatusBadge(detailJob.status)}
                    {getModeBadge(detailJob.mode)}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setDetailJob(null);
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>

              {/* Modal Body - Scrollable */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Info Grid - ALL Job Creation Fields */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {/* Client */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Client
                    </span>
                    <p className="text-gray-900 dark:text-white mt-1 font-medium">
                      {getClientDisplayName(detailJob)}
                    </p>
                  </div>

                  {/* Client TA (Contact) */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Client TA (Contact)
                    </span>
                    <p className="text-gray-900 dark:text-white mt-1 font-medium">
                      {detailJob.client_ta || detailJob.client_contact || "—"}
                    </p>
                  </div>

                  {/* Mode */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Mode
                    </span>
                    <p className="text-gray-900 dark:text-white mt-1 font-medium capitalize">
                      {detailJob.mode || "—"}
                    </p>
                  </div>

                  {/* Experience */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Experience
                    </span>
                    <p className="text-gray-900 dark:text-white mt-1 font-medium">
                      {detailJob.experience ||
                        `${detailJob.min_experience || 0} - ${detailJob.max_experience || "Any"} years`}
                    </p>
                  </div>

                  {/* Location */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Location
                    </span>
                    <p className="text-gray-900 dark:text-white mt-1 font-medium">
                      {detailJob.location || "—"}
                    </p>
                  </div>

                  {/* Duration */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Duration
                    </span>
                    <p className="text-gray-900 dark:text-white mt-1 font-medium">
                      {detailJob.duration || "—"}
                    </p>
                  </div>

                  {/* No of Positions */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      No of Positions
                    </span>
                    <p className="text-gray-900 dark:text-white mt-1 font-semibold text-lg">
                      {detailJob.no_of_positions || 1}
                    </p>
                  </div>

                  {/* Budget / CTC */}
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <span className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">
                      Budget / CTC
                    </span>
                    <p className="text-green-700 dark:text-green-300 mt-1 font-semibold">
                      {detailJob.budget || detailJob.salary_range || "—"}
                    </p>
                  </div>

                  {/* Work Timings */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Work Timings
                    </span>
                    <p className="text-gray-900 dark:text-white mt-1 font-medium">
                      {detailJob.work_timings || "—"}
                    </p>
                  </div>

                  {/* Joining Preference */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Joining Preference
                    </span>
                    <p className="text-gray-900 dark:text-white mt-1 font-medium">
                      {detailJob.joining_preference || "—"}
                    </p>
                  </div>

                  {/* Posted Date */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Posted
                    </span>
                    <p className="text-gray-600 dark:text-gray-300 mt-1">
                      {formatDate(detailJob.created_at)}
                    </p>
                  </div>
                </div>

                {/* Skills */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 uppercase tracking-wide">
                    Skills Required
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {(Array.isArray(detailJob.skills)
                      ? detailJob.skills
                      : []
                    ).map((skill, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-full text-sm font-medium"
                      >
                        {typeof skill === "string"
                          ? skill
                          : skill?.name || skill}
                      </span>
                    ))}
                    {(!detailJob.skills || detailJob.skills.length === 0) && (
                      <span className="text-gray-400 italic">
                        No skills specified
                      </span>
                    )}
                  </div>
                </div>

                {/* Job Description */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 uppercase tracking-wide">
                    Job Description
                  </h4>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-5 rounded-lg">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {detailJob.description ||
                        detailJob.jd_text ||
                        "No description provided"}
                    </p>
                  </div>
                </div>

                {/* Notes from Account Manager */}
                {detailJob.am_notes && (
                  <div>
                    <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-3 uppercase tracking-wide">
                      📝 Notes from Account Manager
                    </h4>
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-5 rounded-lg">
                      <p className="text-amber-900 dark:text-amber-200 whitespace-pre-wrap leading-relaxed">
                        {detailJob.am_notes}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setDetailJob(null);
                  }}
                  className="px-5 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium"
                >
                  Close
                </button>
                <button
                  onClick={() => navigateToJobWorkflow(detailJob)}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 font-medium"
                >
                  <Users className="w-4 h-4" />
                  View Submissions
                </button>
                <button
                  onClick={() => {
                    setSelectedJob(detailJob);
                    setDrawerOpen(true);
                    setShowDetailModal(false);
                  }}
                  className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 font-medium"
                >
                  <UserPlus className="w-4 h-4" />
                  Add Candidate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Manual Candidate Addition Drawer */}
        <ManualCandidateAdditionDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          job={selectedJob}
        />
      </div>
    </div>
  );
};

export default AssignedJobs;

