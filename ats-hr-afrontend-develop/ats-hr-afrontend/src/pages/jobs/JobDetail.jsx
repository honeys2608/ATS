/**
 * Job Detail Page - View complete job information
 * 2-column layout with tabs for assignments, candidates, and postings
 */
import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Edit,
  Users,
  FileText,
  MapPin,
  Briefcase,
  Clock,
  Calendar,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Plus,
  UserPlus,
  Send,
  ExternalLink,
  Eye,
  Loader2,
  AlertCircle,
} from "lucide-react";
import axiosInstance from "../../api/axios";
import CustomSendModal from "./CustomSendModal";

const JobDetail = ({ userRole = "recruiter" }) => {
  const { id: jobId } = useParams();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("recruiters");
  const [jdExpanded, setJdExpanded] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  // Related data
  const [assignments, setAssignments] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [postings, setPostings] = useState([]);

  useEffect(() => {
    fetchJobDetails();
  }, [jobId]);

  useEffect(() => {
    if (job) {
      fetchTabData();
    }
  }, [job, activeTab]);

  const fetchJobDetails = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(
        `/v1/job-management/requirements/${jobId}`,
      );
      setJob(response.data);
      setAssignments(response.data.assignments || []);
    } catch (err) {
      console.error("Error fetching job:", err);
      setError("Failed to load job details");
    } finally {
      setLoading(false);
    }
  };

  const fetchTabData = async () => {
    try {
      if (activeTab === "candidates") {
        const response = await axiosInstance.get(
          `/v1/job-management/requirements/${jobId}/candidates`,
        );
        setCandidates(response.data.candidates || []);
      } else if (activeTab === "postings") {
        const response = await axiosInstance.get(
          `/v1/job-management/requirements/${jobId}/postings`,
        );
        setPostings(response.data || []);
      }
    } catch (err) {
      console.error("Error fetching tab data:", err);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      open: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
      in_progress:
        "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      closed: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
      on_hold:
        "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
      draft:
        "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    };
    return (
      <span
        className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status] || styles.open}`}
      >
        {(status || "open").replace("_", " ").toUpperCase()}
      </span>
    );
  };

  const getModeBadge = (mode) => {
    const styles = {
      hybrid:
        "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
      remote: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
      onsite:
        "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
      contract: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
    };
    return (
      <span
        className={`px-2 py-0.5 rounded text-xs font-medium ${styles[mode] || styles.hybrid}`}
      >
        {(mode || "hybrid").toUpperCase()}
      </span>
    );
  };

  const handleOpenSendModal = (candidate = null) => {
    setSelectedCandidate(candidate);
    setShowSendModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg p-6 flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
          <p className="text-red-700 dark:text-red-300">
            {error || "Job not found"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {job.title || job.job_title}
              </h1>
              {getStatusBadge(job.status)}
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              {job.serial_number ? `#${job.serial_number} • ` : ""}
              {job.client?.client_name || "No Client"} • Created{" "}
              {new Date(
                job.date_created || job.created_at,
              ).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          {userRole === "account_manager" && (
            <>
              <Link
                to={`${userRole === "account_manager" ? "/am" : "/recruiter"}/jobs/${jobId}/edit`}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit Job
              </Link>
              <button
                onClick={() => navigate(`/am/jobs/${jobId}/assign`)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Assign Recruiter
              </button>
            </>
          )}
          {userRole === "recruiter" && (
            <button
              onClick={() => handleOpenSendModal()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Send className="w-4 h-4" />
              Customize & Send
            </button>
          )}
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Job Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Job Info Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Job Information
            </h2>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Briefcase className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Mode
                  </p>
                  <p className="text-gray-900 dark:text-white">
                    {getModeBadge(job.mode)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Location
                  </p>
                  <p className="text-gray-900 dark:text-white">
                    {job.location || "Not specified"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Experience
                  </p>
                  <p className="text-gray-900 dark:text-white">
                    {job.experience || "Not specified"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <DollarSign className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Budget / CTC
                  </p>
                  <p className="text-gray-900 dark:text-white">
                    {job.budget || "Not specified"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No of Positions
                  </p>
                  <p className="text-gray-900 dark:text-white">
                    {job.no_of_positions || 1}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Duration
                  </p>
                  <p className="text-gray-900 dark:text-white">
                    {job.duration || "Permanent"}
                  </p>
                </div>
              </div>

              {job.work_timings && (
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Work Timings
                    </p>
                    <p className="text-gray-900 dark:text-white">
                      {job.work_timings}
                    </p>
                  </div>
                </div>
              )}

              {job.joining_preference && (
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Joining Preference
                    </p>
                    <p className="text-gray-900 dark:text-white">
                      {job.joining_preference}
                    </p>
                  </div>
                </div>
              )}

              {job.client_ta && (
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Client TA
                    </p>
                    <p className="text-gray-900 dark:text-white">
                      {job.client_ta}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Skills */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                Required Skills
              </p>
              <div className="flex flex-wrap gap-2">
                {(job.skills || []).map((skill, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 rounded text-sm"
                  >
                    {skill}
                  </span>
                ))}
                {(!job.skills || job.skills.length === 0) && (
                  <span className="text-gray-400">No skills specified</span>
                )}
              </div>
            </div>
          </div>

          {/* JD Section (Expandable) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
            <button
              onClick={() => setJdExpanded(!jdExpanded)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-gray-400" />
                <span className="font-medium text-gray-900 dark:text-white">
                  Job Description
                </span>
              </div>
              {jdExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            {jdExpanded && (
              <div className="p-4 pt-0 border-t border-gray-200 dark:border-gray-700">
                <div className="prose dark:prose-invert max-w-none text-sm">
                  <pre className="whitespace-pre-wrap font-sans text-gray-700 dark:text-gray-300">
                    {job.jd_text ||
                      job.description ||
                      "No job description available"}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Notes for Recruiter (if assigned) */}
          {userRole === "recruiter" && job.notes_for_recruiter && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">
                Notes from AM
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {job.notes_for_recruiter}
              </p>
            </div>
          )}
        </div>

        {/* Right Column - Tabs */}
        <div className="lg:col-span-2">
          {/* Tab Navigation */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab("recruiters")}
                className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
                  activeTab === "recruiters"
                    ? "text-indigo-600 border-b-2 border-indigo-600"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                }`}
              >
                <Users className="w-4 h-4 inline-block mr-2" />
                Assigned Recruiters ({assignments.length})
              </button>
              <button
                onClick={() => setActiveTab("candidates")}
                className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
                  activeTab === "candidates"
                    ? "text-indigo-600 border-b-2 border-indigo-600"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                }`}
              >
                <Users className="w-4 h-4 inline-block mr-2" />
                Candidates Pipeline ({candidates.length})
              </button>
              <button
                onClick={() => setActiveTab("postings")}
                className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
                  activeTab === "postings"
                    ? "text-indigo-600 border-b-2 border-indigo-600"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                }`}
              >
                <ExternalLink className="w-4 h-4 inline-block mr-2" />
                Job Postings ({postings.length})
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {/* Assigned Recruiters Tab */}
              {activeTab === "recruiters" && (
                <div>
                  {assignments.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-gray-400">
                        No recruiters assigned yet
                      </p>
                      {userRole === "account_manager" && (
                        <button
                          onClick={() => navigate(`/am/jobs/${jobId}/assign`)}
                          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                          <Plus className="w-4 h-4" />
                          Assign Recruiter
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {assignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
                              <span className="text-indigo-600 dark:text-indigo-300 font-medium">
                                {assignment.recruiter?.full_name?.charAt(0) ||
                                  "R"}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {assignment.recruiter?.full_name ||
                                  "Unknown Recruiter"}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Assigned{" "}
                                {new Date(
                                  assignment.assigned_at ||
                                    assignment.created_at,
                                ).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              assignment.status === "active"
                                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {assignment.status || "Active"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Candidates Pipeline Tab */}
              {activeTab === "candidates" && (
                <div>
                  {candidates.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-gray-400">
                        No candidates in pipeline yet
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                              Candidate
                            </th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                              Status
                            </th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                              Submitted By
                            </th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {candidates.map((candidate) => (
                            <tr
                              key={candidate.id}
                              className="border-b border-gray-200 dark:border-gray-700"
                            >
                              <td className="py-3 px-4">
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {candidate.name}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {candidate.email}
                                </p>
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded text-xs">
                                  {candidate.status || "Submitted"}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                                {candidate.submitted_by || "Unknown"}
                              </td>
                              <td className="py-3 px-4">
                                <button className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400">
                                  <Eye className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Job Postings Tab */}
              {activeTab === "postings" && (
                <div>
                  <div className="flex justify-end mb-4">
                    <Link
                      to={`${userRole === "account_manager" ? "/am" : "/recruiter"}/jobs/${jobId}/posting/new`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                      <Plus className="w-4 h-4" />
                      Create Posting
                    </Link>
                  </div>

                  {postings.length === 0 ? (
                    <div className="text-center py-8">
                      <ExternalLink className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-gray-400">
                        No job postings created yet
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {postings.map((posting) => (
                        <div
                          key={posting.id}
                          className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {posting.title}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {posting.client_display_name} • Expires{" "}
                              {new Date(
                                posting.last_date_to_apply,
                              ).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                posting.status === "active"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                  : posting.status === "expired"
                                    ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                    : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                              }`}
                            >
                              {posting.status || "Draft"}
                            </span>
                            <button className="text-gray-400 hover:text-gray-600">
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Custom Send Modal */}
      {showSendModal && (
        <CustomSendModal
          job={job}
          candidate={selectedCandidate}
          onClose={() => setShowSendModal(false)}
        />
      )}
    </div>
  );
};

export default JobDetail;
