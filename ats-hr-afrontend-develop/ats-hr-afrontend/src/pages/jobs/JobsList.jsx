/**
 * Jobs List Page - Shared by AM and Recruiter dashboards
 * Shows all jobs/requirements with filtering and search
 */
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Filter,
  FileText,
  Users,
  MapPin,
  Briefcase,
  Clock,
  ChevronDown,
  Eye,
  Edit,
  UserPlus,
} from "lucide-react";
import axiosInstance from "../../api/axios";

// Status badge colors
const statusColors = {
  open: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  closed: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  on_hold: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
};

// Mode badge colors
const modeColors = {
  hybrid:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  remote: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300",
  onsite:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  contract: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300",
};

const JobsList = ({ userRole = "recruiter" }) => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [activeTab, setActiveTab] = useState("assigned"); // For recruiter: 'assigned' | 'all'

  // Clients for filter
  const [clients, setClients] = useState([]);

  // Pagination
  const [page, setPage] = useState(0);
  const [limit] = useState(20);

  // Fetch jobs
  const fetchJobs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("skip", page * limit);
      params.append("limit", limit);
      if (statusFilter) params.append("status", statusFilter);
      if (clientFilter) params.append("client_id", clientFilter);
      if (modeFilter) params.append("mode", modeFilter);

      const response = await axiosInstance.get(
        `/v1/job-management/requirements?${params}`,
      );
      setJobs(response.data.jobs || []);
      setTotal(response.data.total || 0);
    } catch (err) {
      console.error("Error fetching jobs:", err);
      setError("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  // Fetch clients for filter dropdown
  const fetchClients = async () => {
    try {
      const response = await axiosInstance.get("/v1/clients");
      setClients(response.data.clients || response.data || []);
    } catch (err) {
      console.error("Error fetching clients:", err);
    }
  };

  useEffect(() => {
    fetchJobs();
    fetchClients();
  }, [page, statusFilter, clientFilter, modeFilter]);

  // Filter jobs by search query
  const filteredJobs = useMemo(() => {
    if (!searchQuery) return jobs;
    const query = searchQuery.toLowerCase();
    return jobs.filter(
      (job) =>
        job.title?.toLowerCase().includes(query) ||
        job.job_title?.toLowerCase().includes(query) ||
        job.skills?.some((s) => s.toLowerCase().includes(query)) ||
        job.location?.toLowerCase().includes(query),
    );
  }, [jobs, searchQuery]);

  // For recruiter view - split into assigned and all
  const assignedJobs = useMemo(() => {
    if (userRole !== "recruiter") return [];
    return filteredJobs.filter((job) => job.is_assigned);
  }, [filteredJobs, userRole]);

  const allJobs = useMemo(() => {
    if (userRole !== "recruiter") return filteredJobs;
    return filteredJobs.filter((job) => !job.is_assigned);
  }, [filteredJobs, userRole]);

  const displayJobs =
    userRole === "recruiter"
      ? activeTab === "assigned"
        ? assignedJobs
        : allJobs
      : filteredJobs;

  const handleCreateJob = () => {
    navigate(
      userRole === "account_manager" ? "/am/jobs/new" : "/recruiter/jobs/new",
    );
  };

  const handleViewJob = (jobId) => {
    navigate(
      userRole === "account_manager"
        ? `/am/jobs/${jobId}`
        : `/recruiter/jobs/${jobId}`,
    );
  };

  const handleEditJob = (jobId) => {
    navigate(
      userRole === "account_manager"
        ? `/am/jobs/${jobId}/edit`
        : `/recruiter/jobs/${jobId}/edit`,
    );
  };

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {userRole === "account_manager" ? "Jobs / Requirements" : "Jobs"}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {total} total jobs
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleCreateJob}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create New Job
          </button>
          <button
            onClick={() =>
              navigate(
                userRole === "account_manager"
                  ? "/am/jobs/posting/new"
                  : "/recruiter/jobs/posting/new",
              )
            }
            className="flex items-center gap-2 px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Create Job Posting
          </button>
        </div>
      </div>

      {/* Tabs for Recruiter */}
      {userRole === "recruiter" && (
        <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab("assigned")}
            className={`pb-3 px-1 font-medium transition-colors ${
              activeTab === "assigned"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            My Assigned Jobs
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`pb-3 px-1 font-medium transition-colors ${
              activeTab === "all"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            All Jobs (Read-Only)
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by skill, role, client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            {/* Client Filter */}
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.client_name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="closed">Closed</option>
              <option value="on_hold">On Hold</option>
            </select>

            {/* Mode Filter */}
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Modes</option>
              <option value="hybrid">Hybrid</option>
              <option value="remote">Remote</option>
              <option value="onsite">On-site</option>
              <option value="contract">Contract</option>
            </select>
          </div>
        </div>

        {/* Client Filter Chips */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {clients.slice(0, 6).map((client) => (
            <button
              key={client.id}
              onClick={() =>
                setClientFilter(clientFilter === client.id ? "" : client.id)
              }
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                clientFilter === client.id
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              {client.client_name}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-500 dark:text-gray-400">
              Loading jobs...
            </p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : displayJobs.length === 0 ? (
          <div className="p-8 text-center">
            <Briefcase className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No jobs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    S#
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Job Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Mode
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Skills
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Exp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Positions
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {displayJobs.map((job, index) => (
                  <tr
                    key={job.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => handleViewJob(job.id)}
                  >
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {job.serial_number || index + 1}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {job.date_created
                        ? new Date(job.date_created).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {job.title || job.job_title}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {job.job_id}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {job.client?.client_name || job.company_name || "-"}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {job.mode && (
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${modeColors[job.mode] || "bg-gray-100 text-gray-800"}`}
                        >
                          {job.mode}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {(job.skills || []).slice(0, 3).map((skill, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 text-xs rounded"
                          >
                            {skill}
                          </span>
                        ))}
                        {(job.skills || []).length > 3 && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 text-xs rounded">
                            +{job.skills.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {job.experience ||
                        `${job.min_experience || 0}-${job.max_experience || 0} yrs`}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {job.location || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {job.no_of_positions || 1}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[job.status] || statusColors.open}`}
                      >
                        {job.status?.replace("_", " ") || "Open"}
                      </span>
                    </td>
                    <td
                      className="px-4 py-4 whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewJob(job.id)}
                          className="p-1 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(userRole === "account_manager" ||
                          job.is_assigned) && (
                          <button
                            onClick={() => handleEditJob(job.id)}
                            className="p-1 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {userRole === "account_manager" && (
                          <button
                            onClick={() =>
                              navigate(`/am/jobs/${job.id}/assign`)
                            }
                            className="p-1 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"
                            title="Assign Recruiter"
                          >
                            <UserPlus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing {page * limit + 1} to{" "}
              {Math.min((page + 1) * limit, total)} of {total} jobs
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={(page + 1) * limit >= total}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobsList;
