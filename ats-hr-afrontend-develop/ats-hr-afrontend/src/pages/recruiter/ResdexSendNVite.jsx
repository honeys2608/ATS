import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Send,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import api from "../../api/axios";
import { getAssignedJobs } from "../../services/jobService";

export default function ResdexSendNVite() {
  const defaultTemplate = `Dear {{name}},

Greetings from {{company}}!

We came across your profile and believe you could be a great fit for the position of {{job_title}} at our organization.

📌 Job Role: {{job_title}}
📍 Location: {{location}}

If you are interested, we would love for you to apply using the link below:

👉 Apply Here: {{apply_link}}

Our team will review your application and get in touch if your profile matches our requirements.

Best regards,
{{recruiter}}
{{company}}`;
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectedJobId, setSelectedJobId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobLocation, setJobLocation] = useState("");
  const [applyLink, setApplyLink] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [recruiterName, setRecruiterName] = useState("");
  const [message, setMessage] = useState(defaultTemplate);
  const [loading, setLoading] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [inviteHistory, setInviteHistory] = useState([]);
  const [loadingInvites, setLoadingInvites] = useState(false);

  const safeText = (value, fallback = "—") => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "object") {
      if (value.full_name) return String(value.full_name);
      if (value.name) return String(value.name);
      return JSON.stringify(value);
    }
    return String(value);
  };

  useEffect(() => {
    fetchCandidates();
    fetchJobs();
    fetchInviteHistory();
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setRecruiterName(parsed?.full_name || parsed?.name || parsed?.email || "");
        setCompanyName(parsed?.company_name || parsed?.company || "");
      } catch {
        setRecruiterName("");
        setCompanyName("");
      }
    }
  }, []);

  async function fetchCandidates(searchValue = "") {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/v1/candidates", {
        params: { search: searchValue || undefined },
      });
      const payload = res.data?.data ?? res.data ?? [];
      setCandidates(Array.isArray(payload) ? payload : []);
      setSelectedIds(new Set());
    } catch (err) {
      setError(
        safeText(
          err?.response?.data?.detail,
          "Failed to load candidates. Please try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function fetchJobs() {
    setLoadingJobs(true);
    try {
      const res = await getAssignedJobs();
      const payload =
        res.data?.jobs ?? res.data?.data ?? res.data ?? [];
      setJobs(Array.isArray(payload) ? payload : []);
      if (Array.isArray(payload) && payload.length > 0) {
        const first = payload[0];
        setJobTitle(first.title || first.job_title || "");
        setJobLocation(first.location || "");
        const linkId = first.job_id || first.id || "";
        if (linkId) {
          setApplyLink(`${window.location.origin}/careers/${linkId}`);
        }
      }
    } catch (err) {
      setJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  }

  async function fetchInviteHistory() {
    setLoadingInvites(true);
    try {
      const res = await api.get("/v1/resdex/invite");
      setInviteHistory(res.data?.results || []);
    } catch (err) {
      setInviteHistory([]);
    } finally {
      setLoadingInvites(false);
    }
  }

  const filteredCandidates = useMemo(() => {
    if (!query.trim()) return candidates;
    const q = query.toLowerCase();
    return candidates.filter((c) =>
      [c.full_name, c.name, c.email, c.phone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [candidates, query]);

  const allSelected =
    filteredCandidates.length > 0 &&
    filteredCandidates.every((c) => selectedIds.has(c.id ?? c._id));

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(
        new Set(filteredCandidates.map((c) => c.id ?? c._id)),
      );
    }
  }

  async function sendInvites() {
    if (selectedIds.size === 0) {
      setError("Please select at least one candidate.");
      return;
    }
    if (!selectedJobId) {
      setError("Please select a job.");
      return;
    }
    if (!applyLink) {
      setError("Apply link is required.");
      return;
    }

    setSending(true);
    setError("");
    setStatus(null);

    try {
      const payload = {
        candidate_ids: Array.from(selectedIds),
        job_id: selectedJobId,
        job_title: jobTitle,
        job_location: jobLocation,
        apply_link: applyLink,
        recruiter_name: recruiterName || "Recruiter",
        company_name: companyName || "Company",
        message_template: message || "",
      };

      const res = await api.post("/nvite/send-job-invite", payload);
      setStatus(res.data);
      setSelectedIds(new Set());
      setSending(false);
      fetchInviteHistory();
    } catch (err) {
      setError(
        safeText(
          err?.response?.data?.detail,
          "Failed to send job invites. Please try again.",
        ),
      );
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Send NVite</h2>
          <p className="text-gray-600 mt-1">
            Select candidates, choose a job, and send NVites in real time
          </p>
        </div>
        <button
          onClick={() => {
            fetchCandidates();
            fetchJobs();
          }}
          className="px-3 py-2 rounded-lg border text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
          <AlertCircle size={18} className="mt-0.5" />
          <span>{safeText(error, "")}</span>
        </div>
      )}

      {status && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle size={18} />
            Sent: {status.sent} · Failed: {status.failed}
          </div>
          {Array.isArray(status.details) && status.details.length > 0 && (
            <div className="text-sm text-green-800">
              {status.details.slice(0, 6).map((item, idx) => (
                <div key={`${item.candidate}-${idx}`}>
                  {safeText(item.candidate)}: {safeText(item.status)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-5 py-4 border-b">
            <div className="flex items-center gap-2 text-gray-700 font-semibold">
              <Search size={18} />
              Candidates
            </div>
            <div className="flex items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, email, phone"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <button
                onClick={() => fetchCandidates(query)}
                className="px-3 py-2 rounded-lg bg-gray-100 text-sm font-semibold"
              >
                Search
              </button>
            </div>
          </div>

          <div className="p-5">
            <div className="flex items-center justify-between mb-3 text-sm text-gray-600">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                />
                Select all ({filteredCandidates.length})
              </label>
              <span>Selected: {selectedIds.size}</span>
            </div>

            {loading ? (
              <div className="text-gray-600">Loading candidates...</div>
            ) : filteredCandidates.length === 0 ? (
              <div className="text-gray-600">No candidates found.</div>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {filteredCandidates.map((candidate) => (
                  <label
                    key={candidate.id}
                    className="flex items-center justify-between gap-3 p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(candidate.id ?? candidate._id)}
                        onChange={() => toggleSelect(candidate.id ?? candidate._id)}
                      />
                      <div>
                        <p className="font-semibold text-gray-900">
                          {safeText(candidate.full_name || candidate.name)}
                        </p>
                        <p className="text-xs text-gray-600">
                          {safeText(candidate.email)} · {safeText(candidate.phone)}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">
                      {safeText(candidate.status)}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-5 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">NVite Details</h3>
            <p className="text-sm text-gray-600">
              Choose a job and include a short message
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Job (optional)
            </label>
            <select
              value={selectedJobId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedJobId(nextId);
                const selectedJob = (Array.isArray(jobs) ? jobs : []).find(
                  (job) => job.id === nextId,
                );
                if (selectedJob) {
                  setJobTitle(selectedJob.title || selectedJob.job_title || "");
                  setJobLocation(selectedJob.location || "");
                  const linkId = selectedJob.job_id || selectedJob.id || "";
                  if (linkId) {
                    setApplyLink(`${window.location.origin}/careers/${linkId}`);
                  }
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Select job</option>
              {loadingJobs ? (
                <option>Loading jobs...</option>
              ) : (
                (Array.isArray(jobs) ? jobs : []).map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title || job.job_title || "Untitled Job"}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Recruiter Name
              </label>
              <input
                value={recruiterName}
                onChange={(e) => setRecruiterName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Company Name
              </label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Job Title
              </label>
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Job Location
              </label>
              <input
                value={jobLocation}
                onChange={(e) => setJobLocation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Apply Link
              </label>
              <input
                value={applyLink}
                onChange={(e) => setApplyLink(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Message Template
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Use {{name}}, {{job_title}}, {{company}}, {{location}}, {{apply_link}}, {{recruiter}}"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows="5"
            />
            <p className="text-xs text-gray-500 mt-1">
              Tip: Use {"{{name}}"} to auto-insert candidate name.
            </p>
          </div>

          <button
            onClick={sendInvites}
            disabled={sending || selectedIds.size === 0}
            className="w-full px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send size={16} />
            {sending ? "Sending..." : "Send NVite"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">NVite History</h3>
          <button
            onClick={fetchInviteHistory}
            className="px-3 py-2 rounded-lg border text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
        {loadingInvites ? (
          <div className="p-6 text-gray-600">Loading invites...</div>
        ) : inviteHistory.length === 0 ? (
          <div className="p-10 text-center text-gray-600">
            No NVites sent yet.
          </div>
        ) : (
          <div className="divide-y">
            {inviteHistory.map((invite) => (
              <div key={invite.id} className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">
                    {safeText(invite.candidate_name || "Candidate")}
                  </p>
                  <p className="text-sm text-gray-600">
                    {safeText(invite.job_title || "No job selected")}
                  </p>
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-semibold">Status:</span> {safeText(invite.status || "sent")}
                </div>
                <div className="text-sm text-gray-500">
                  {invite.sent_at ? new Date(invite.sent_at).toLocaleString() : "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
