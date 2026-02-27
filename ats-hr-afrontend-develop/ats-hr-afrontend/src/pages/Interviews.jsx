import React, { useEffect, useMemo, useState } from "react";
import axios from "../api/axios";
import { useAuth } from "../context/AuthContext";
import PaginatedCardGrid from "../components/common/PaginatedCardGrid";
import usePersistedPagination from "../hooks/usePersistedPagination";
import { useSearchParams } from "react-router-dom";

const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "--";

const formatDateTimeLocalMin = (date) => {
  const pad = (num) => String(num).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const normalizeId = (value) => String(value ?? "").trim();
const normalizeIdLower = (value) => normalizeId(value).toLowerCase();
const resolveJobId = (job) =>
  normalizeId(job?.id || job?.job_id || job?.requirement_id);
const resolveCandidateId = (candidate) =>
  normalizeId(
    candidate?.candidate_id ||
      candidate?.candidateId ||
      candidate?.id ||
      candidate?.candidate?.id ||
      candidate?.user_id,
  );

const statusBadgeClass = (status) => {
  const value = (status || "").toLowerCase();
  switch (value) {
    case "scheduled":
      return "bg-yellow-100 text-yellow-800";
    case "in_progress":
      return "bg-blue-100 text-blue-800";
    case "completed":
      return "bg-green-100 text-green-800";
    case "no_show":
      return "bg-red-100 text-red-800";
    case "cancelled":
      return "bg-gray-100 text-gray-800";
    case "rescheduled":
      return "bg-orange-100 text-orange-800";
    case "pending":
      return "bg-purple-100 text-purple-800";
    case "confirmed":
      return "bg-emerald-100 text-emerald-800";
    case "rejected":
      return "bg-rose-100 text-rose-800";
    case "on_hold":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

const formatStatus = (status) => {
  const value = (status || "").toLowerCase();
  switch (value) {
    case "scheduled":
      return "Scheduled";
    case "in_progress":
      return "In Progress";
    case "completed":
      return "Completed";
    case "no_show":
      return "No Show";
    case "cancelled":
      return "Cancelled";
    case "rescheduled":
      return "Rescheduled";
    case "pending":
      return "Pending";
    case "confirmed":
      return "Confirmed";
    case "rejected":
      return "Rejected";
    case "on_hold":
      return "On Hold";
    default:
      return status
        ? status
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ")
        : "Unknown";
  }
};

function Interviews() {
  const auth = useAuth?.() || {};
  const user = auth?.user || null;
  const role = (
    auth?.role ||
    user?.role ||
    localStorage.getItem("role") ||
    ""
  ).toLowerCase();
  const [searchParams] = useSearchParams();

  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [applicants, setApplicants] = useState([]);
  const [selectedCandidates, setSelectedCandidates] = useState(new Set());
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [loadedApplicantsJobId, setLoadedApplicantsJobId] = useState("");

  const [scheduleType, setScheduleType] = useState("ai_chat");
  const [scheduledAt, setScheduledAt] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [location, setLocation] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState("");

  const [interviews, setInterviews] = useState([]);
  const [loadingInterviews, setLoadingInterviews] = useState(false);
  const [error, setError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [interviewPagination, setInterviewPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
  });
  const {
    page,
    setPage,
    limit,
    setLimit,
    pageSizeOptions,
  } = usePersistedPagination("interviews:listing");

  const isRecruiter = role === "recruiter";
  const prefillCandidateId = (
    searchParams.get("candidate_id") ||
    searchParams.get("candidateId") ||
    ""
  ).trim();
  const prefillJobId = (
    searchParams.get("job_id") ||
    searchParams.get("jobId") ||
    ""
  ).trim();
  const prefillCandidateName = (
    searchParams.get("candidate_name") ||
    searchParams.get("candidateName") ||
    ""
  ).trim();
  const prefillJobTitle = (
    searchParams.get("job_title") ||
    searchParams.get("jobTitle") ||
    ""
  ).trim();
  const [prefillApplied, setPrefillApplied] = useState(false);
  const [lockedPrefillCandidateId, setLockedPrefillCandidateId] = useState("");

  const isManualMode = Boolean(prefillCandidateId || prefillJobId);
  const manualJobLocked = Boolean(prefillJobId);
  const manualCandidateLocked = Boolean(lockedPrefillCandidateId);
  const resolvedPrefillJobId = useMemo(() => {
    if (!prefillJobId) return "";
    const prefillKey = normalizeIdLower(prefillJobId);
    const matchedJob = jobs.find((job) => {
      return (
        normalizeIdLower(job?.id) === prefillKey ||
        normalizeIdLower(job?.job_id) === prefillKey
      );
    });
    return resolveJobId(matchedJob) || normalizeId(prefillJobId);
  }, [jobs, prefillJobId]);

  useEffect(() => {
    if (role === "candidate") return;
    loadJobs();
  }, [role]);

  useEffect(() => {
    if (role === "candidate") return;
    loadInterviews();
  }, [role, page, limit, refreshTick]);

  useEffect(() => {
    if (!selectedJob) {
      setApplicants([]);
      setSelectedCandidates(new Set());
      setLockedPrefillCandidateId("");
      setLoadedApplicantsJobId("");
      return;
    }
    loadApplicants(selectedJob);
  }, [selectedJob]);

  useEffect(() => {
    setPrefillApplied(false);
    setLockedPrefillCandidateId("");
  }, [prefillCandidateId, prefillJobId]);

  useEffect(() => {
    if (role === "candidate" || prefillApplied) return;
    if (!prefillCandidateId && !prefillJobId) return;

    if (!selectedJob && resolvedPrefillJobId) {
      setSelectedJob(resolvedPrefillJobId);
      return;
    }
    if (resolvedPrefillJobId && selectedJob !== resolvedPrefillJobId) {
      setSelectedJob(resolvedPrefillJobId);
      return;
    }

    if (!prefillCandidateId) {
      setPrefillApplied(true);
      return;
    }
    if (
      !selectedJob ||
      loadingApplicants ||
      normalizeIdLower(loadedApplicantsJobId) !== normalizeIdLower(selectedJob)
    ) {
      return;
    }

    const matchedCandidate = applicants.find(
      (candidate) =>
        normalizeIdLower(resolveCandidateId(candidate)) ===
        normalizeIdLower(prefillCandidateId),
    );
    if (!matchedCandidate) {
      setLockedPrefillCandidateId("");
      setScheduleError(
        "Prefilled candidate was not found in the selected job applicants.",
      );
      setPrefillApplied(true);
      return;
    }

    const matchedCandidateId = resolveCandidateId(matchedCandidate);
    if (!matchedCandidateId) {
      setLockedPrefillCandidateId("");
      setPrefillApplied(true);
      return;
    }

    setSelectedCandidates(new Set([matchedCandidateId]));
    setLockedPrefillCandidateId(matchedCandidateId);
    setPrefillApplied(true);
  }, [
    role,
    prefillApplied,
    prefillCandidateId,
    prefillJobId,
    resolvedPrefillJobId,
    selectedJob,
    loadingApplicants,
    loadedApplicantsJobId,
    applicants,
  ]);

  const loadJobs = async () => {
    try {
      const res = await axios.get("/v1/interviews/recruiter/jobs");
      setJobs(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load jobs:", err);
      setJobs([]);
    }
  };

  const loadApplicants = async (jobId) => {
    setLoadingApplicants(true);
    setScheduleError("");
    try {
      const res = await axios.get("/v1/interviews/recruiter/job-applicants", {
        params: { job_id: jobId },
      });
      const normalizedApplicants = (res.data?.results || [])
        .map((candidate) => {
          const candidateId = resolveCandidateId(candidate);
          return {
            ...candidate,
            candidate_id: candidateId || normalizeId(candidate?.candidate_id),
          };
        })
        .filter((candidate) => normalizeId(candidate?.candidate_id));
      setApplicants(normalizedApplicants);
    } catch (err) {
      setApplicants([]);
      setScheduleError(
        err?.response?.data?.detail ||
          "Failed to load applicants for this job.",
      );
    } finally {
      setLoadingApplicants(false);
      setLoadedApplicantsJobId(jobId);
    }
  };

  const loadInterviews = async () => {
    setLoadingInterviews(true);
    setError("");
    try {
      const res = await axios.get("/v1/interviews/recruiter/list", {
        params: { page, limit },
      });
      const payload = res.data || {};
      const list = Array.isArray(payload.data)
        ? payload.data
        : (payload.results || []);
      const totalRecords =
        payload.totalRecords ?? payload.count ?? (Array.isArray(list) ? list.length : 0);
      const totalPages =
        payload.totalPages ??
        Math.max(1, Math.ceil((totalRecords || 0) / Math.max(1, limit)));
      const currentPage = payload.currentPage ?? page;

      setInterviews(Array.isArray(list) ? list : []);
      setInterviewPagination({
        currentPage,
        totalPages,
        totalRecords,
      });
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Failed to load interviews. Please try again.",
      );
      setInterviews([]);
      setInterviewPagination({
        currentPage: 1,
        totalPages: 1,
        totalRecords: 0,
      });
    } finally {
      setLoadingInterviews(false);
    }
  };

  const toggleCandidate = (candidateId) => {
    if (manualCandidateLocked) return;
    setSelectedCandidates((prev) => {
      const next = new Set(prev);
      next.has(candidateId) ? next.delete(candidateId) : next.add(candidateId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (manualCandidateLocked) return;
    const applicantIds = applicants
      .map((candidate) => resolveCandidateId(candidate))
      .filter(Boolean);
    if (selectedCandidates.size === applicantIds.length) {
      setSelectedCandidates(new Set());
    } else {
      setSelectedCandidates(new Set(applicantIds));
    }
  };

  const handleSchedule = async () => {
    setScheduleError("");
    if (!selectedJob || selectedCandidates.size === 0 || !scheduledAt) {
      setScheduleError("Select job, candidates, and schedule time.");
      return;
    }
    if (!scheduleType) {
      setScheduleError("Select an interview type.");
      return;
    }
    const scheduledDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledDate.getTime())) {
      setScheduleError("Select a valid schedule date and time.");
      return;
    }
    if (scheduledDate < new Date()) {
      setScheduleError("Schedule time must be in the future.");
      return;
    }
    if (scheduleType === "video" && !meetingLink.trim()) {
      setScheduleError(
        "Online meeting link is required (Google Meet, Teams, Zoom, etc.).",
      );
      return;
    }
    if (scheduleType === "in_person" && !location.trim()) {
      setScheduleError("Location is required for in-person interviews.");
      return;
    }

    setScheduling(true);
    try {
      await axios.post("/v1/interviews/recruiter/schedule-bulk", {
        job_id: selectedJob,
        candidate_ids: Array.from(selectedCandidates),
        interview_type: scheduleType,
        scheduled_at: new Date(scheduledAt).toISOString(),
        meeting_link: scheduleType === "video" ? meetingLink.trim() : null,
        location: scheduleType === "in_person" ? location.trim() : null,
        contact_person:
          scheduleType === "in_person" ? contactPerson.trim() : null,
      });
      setSelectedCandidates(
        manualCandidateLocked
          ? new Set([lockedPrefillCandidateId])
          : new Set(),
      );
      setMeetingLink("");
      setLocation("");
      setContactPerson("");
      setScheduledAt("");
      await loadInterviews();
      await loadApplicants(selectedJob);
      setRefreshTick(Date.now());
    } catch (err) {
      setScheduleError(
        err?.response?.data?.detail ||
          "Failed to schedule interviews. Please try again.",
      );
    } finally {
      setScheduling(false);
    }
  };

  const scoreSorted = useMemo(() => {
    return [...interviews].sort(
      (a, b) => (b.overall_ai_score || 0) - (a.overall_ai_score || 0),
    );
  }, [interviews]);

  if (role === "candidate") {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow p-6">
          <h1 className="text-2xl font-bold mb-2">My Interviews</h1>
          <p className="text-gray-600">
            Visit your candidate dashboard to join interviews and submit
            feedback.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Interviews</h1>
          <p className="text-gray-600">
            Schedule, monitor, and track candidate interviews
          </p>
        </div>
        <button
          onClick={loadInterviews}
          className="px-4 py-2 rounded-lg border text-sm font-semibold text-gray-700 bg-white"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">
          {error}
        </div>
      )}

      {role !== "candidate" && (
        <div className="bg-white p-6 rounded-xl shadow space-y-4">
          <h2 className="text-xl font-semibold">Schedule Interviews</h2>
          {isManualMode && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
              Manual scheduling mode
              {(prefillCandidateName || prefillCandidateId) && (
                <span>
                  {" "}
                  for{" "}
                  <span className="font-semibold">
                    {prefillCandidateName || prefillCandidateId}
                  </span>
                </span>
              )}
              {(prefillJobTitle || prefillJobId) && (
                <span>
                  {" "}
                  on{" "}
                  <span className="font-semibold">
                    {prefillJobTitle || prefillJobId}
                  </span>
                </span>
              )}
              .
            </div>
          )}
          {manualCandidateLocked && (
            <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Candidate selection is auto-locked from workflow context.
            </div>
          )}
          {scheduleError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">
              {scheduleError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Job</label>
              <select
                value={selectedJob}
                onChange={(e) => setSelectedJob(e.target.value)}
                disabled={manualJobLocked}
                className={`w-full border rounded px-3 py-2 ${
                  manualJobLocked ? "bg-gray-50 text-gray-500" : ""
                }`}
              >
                <option value="">Select job</option>
                {jobs.map((job) => {
                  const jobValue = resolveJobId(job);
                  if (!jobValue) return null;
                  return (
                    <option key={jobValue} value={jobValue}>
                      {job.title || job.job_id || "Untitled Job"}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">
                Schedule Date & Time
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                min={formatDateTimeLocalMin(new Date())}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">
                Interview Type
              </label>
              <select
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="ai_chat">AI Chat Interview</option>
                <option value="video">Online Meeting (Meet/Teams/Zoom)</option>
                <option value="in_person">In-Person</option>
              </select>
            </div>
            {scheduleType === "video" && (
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Online Meeting Link
                </label>
                <input
                  type="url"
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  placeholder="https://meet.google.com/... or https://teams.microsoft.com/..."
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            )}
            {scheduleType === "in_person" && (
              <>
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Location
                  </label>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Contact Person
                  </label>
                  <input
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">Applicants</div>
              <div className="text-xs text-gray-500">
                Selected: {selectedCandidates.size}
              </div>
            </div>
            {loadingApplicants ? (
              <div className="text-sm text-gray-500">Loading applicants...</div>
            ) : applicants.length === 0 ? (
              <div className="text-sm text-gray-500">
                {selectedJob
                  ? "No applicants found for the selected job."
                  : "Select a job to view applicants."}
              </div>
            ) : (
              <div className="border rounded-lg divide-y">
                {!manualCandidateLocked && (
                  <div className="p-3 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedCandidates.size === applicants.length}
                      onChange={toggleSelectAll}
                    />
                    Select all ({applicants.length})
                  </div>
                )}
                {applicants.map((candidate) => {
                  const candidateId = resolveCandidateId(candidate);
                  if (!candidateId) return null;
                  return (
                    <label
                      key={candidateId}
                      className="p-3 flex items-center gap-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCandidates.has(candidateId)}
                        onChange={() => toggleCandidate(candidateId)}
                        disabled={role === "candidate" || manualCandidateLocked}
                      />
                      <div>
                        <div className="font-semibold">
                          {candidate.full_name || "Candidate"}
                        </div>
                        <div className="text-gray-500">
                          {candidate.email} | {candidate.phone}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSchedule}
              disabled={
                scheduling ||
                !selectedJob ||
                selectedCandidates.size === 0 ||
                !scheduledAt ||
                !scheduleType
              }
              className="px-5 py-2 rounded bg-emerald-600 text-white font-semibold disabled:opacity-60"
            >
              {scheduling ? "Scheduling..." : "Schedule Interview"}
            </button>
          </div>
        </div>
      )}

      {role !== "recruiter" && (
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-xl font-semibold mb-4">Interview Schedule</h2>
          <PaginatedCardGrid
            items={interviews}
            totalPages={interviewPagination.totalPages}
            currentPage={interviewPagination.currentPage}
            onPageChange={setPage}
            totalRecords={interviewPagination.totalRecords}
            pageSize={limit}
            onPageSizeChange={(nextLimit) => {
              setLimit(nextLimit);
              setPage(1);
            }}
            pageSizeOptions={pageSizeOptions}
            loading={loadingInterviews}
            error={error || null}
            onRetry={loadInterviews}
            emptyMessage="No interviews scheduled."
            renderCard={(iv) => (
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-gray-900">
                      {iv.candidate?.full_name || "Candidate"} | {iv.job?.title || "Job"}
                    </div>
                    <div className="text-sm text-gray-600">
                      {iv.mode?.replace(/_/g, " ")} • {formatDateTime(iv.scheduled_at)}
                    </div>
                    {iv.location ? (
                      <div className="text-sm text-gray-600">Location: {iv.location}</div>
                    ) : null}
                    {iv.contact_person ? (
                      <div className="text-sm text-gray-600">Contact: {iv.contact_person}</div>
                    ) : null}
                  </div>

                  <div className="text-sm text-right">
                    <span
                      className={`px-3 py-1 rounded-full font-medium ${statusBadgeClass(
                        iv.status || "scheduled",
                      )}`}
                    >
                      {formatStatus(iv.status || "scheduled")}
                    </span>
                    {iv.overall_ai_score !== null && iv.overall_ai_score !== undefined ? (
                      <div className="mt-2 text-gray-600">AI Score: {iv.overall_ai_score}</div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          />
        </div>
      )}

      {role === "account_manager" && (
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-xl font-semibold mb-4">Top AI Scores</h2>
          {scoreSorted.length === 0 ? (
            <div className="text-sm text-gray-500">No AI scores yet.</div>
          ) : (
            <div className="divide-y">
              {scoreSorted.slice(0, 5).map((iv) => (
                <div key={iv.id} className="py-3 flex justify-between text-sm">
                  <div>
                    {iv.candidate?.full_name || "Candidate"} |{" "}
                    {iv.job?.title || "Job"}
                  </div>
                  <div className="font-semibold">
                    {iv.overall_ai_score ?? "--"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Interviews;

