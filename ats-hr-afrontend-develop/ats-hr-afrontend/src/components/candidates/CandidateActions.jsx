// src/components/candidates/CandidateActions.jsx
import React, { useState } from "react";
import api from "../../api/axios";
import useCandidates from "../../hooks/useCandidates";
import { useAuth } from "../../context/AuthContext";

export default function CandidateActions({ candidate, onActionComplete = () => {} }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [forwardEmails, setForwardEmails] = useState("");
  const [forwardMsg, setForwardMsg] = useState("");

  const [newStatus, setNewStatus] = useState(candidate.status || "");
  const [statusReason, setStatusReason] = useState("");

  const [converting, setConverting] = useState(false);

  const id = candidate.candidate_id || candidate.id;
  const auth = useAuth?.() || {};
  const role = (auth?.role || localStorage.getItem("role") || "").toLowerCase();
  const canConvert = role === "admin" || role === "recruiter";

  // Try to use hook if available
  let hook = null;
  try { hook = useCandidates(); } catch (e) { hook = null; }

  async function uploadResume() {
    if (!file) return alert("Choose a file first");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // call resume upload endpoint
      const res = await api.post(`/v1/candidates/${id}/resume/upload`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Uploaded: " + (res.data.versionId || res.data.version_id || "ok"));
      setUploadOpen(false);
      setFile(null);
      onActionComplete();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.error?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function forwardCandidate() {
    if (!forwardEmails) return alert("Provide at least one email");
    try {
      const emails = forwardEmails.split(",").map((s) => s.trim()).filter(Boolean);
      const res = await api.post(`/v1/candidates/${id}/forward`, {
        toEmails: emails,
        message: forwardMsg,
        includeResume: true,
      });
      alert("Forwarded — logId: " + (res.data.emailLogId || res.data.email_log_id || "n/a"));
      setForwardOpen(false);
      setForwardEmails("");
      setForwardMsg("");
      onActionComplete();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.error?.message || "Forward failed");
    }
  }

  async function changeStatus() {
    if (!newStatus) return alert("Pick status");
    try {
      await api.put(`/v1/candidates/${id}/status`, {
        status: newStatus,
        reason: statusReason,
        changedBy: "frontend",
      });
      alert("Status updated");
      setStatusOpen(false);
      setStatusReason("");
      onActionComplete();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.error?.message || "Status change failed");
    }
  }

  async function doConvert(target) {
    if (!canConvert) return alert("You don't have permission to convert candidates.");
    const displayName = candidate?.first_name ? `${candidate.first_name} ${candidate.last_name || ""}` : candidate.email || "candidate";
    if (!window.confirm(`Convert ${displayName} to ${target}?`)) return;

    setConverting(true);
    try {
      // prefer hook.convertCandidate if present
      if (hook && typeof hook.convertCandidate === "function") {
        await hook.convertCandidate(id, target);
      } else {
        // fallback: try PATCH then fallback to POST (common backend patterns)
        try {
          await api.patch(`
/v1/employees/from-candidate/{candidate_id}`, { target });
        } catch (err) {
          const route = target === "employee" ? "/v1/employees" : "/v1/consultants";
          await api.post(route, { candidate_id: id });
        }
      }

      alert(`Converted to ${target}`);
      // allow parent to refresh list or UI
      onActionComplete();
    } catch (err) {
      console.error("Conversion failed", err);
      const msg = err?.response?.data?.message ?? err?.message ?? "Conversion failed";
      alert(String(msg));
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        className="text-sm px-2 py-1 bg-gray-200 rounded"
        onClick={() => (window.location = `/candidates/${id}`)}
      >
        Open
      </button>

      <button
        className="text-sm px-2 py-1 bg-green-600 text-white rounded"
        onClick={() => setUploadOpen(true)}
      >
        Upload
      </button>

      <button
        className="text-sm px-2 py-1 bg-indigo-600 text-white rounded"
        onClick={() => setForwardOpen(true)}
      >
        Forward
      </button>

      <button
        className="text-sm px-2 py-1 bg-yellow-500 rounded"
        onClick={() => setStatusOpen(true)}
      >
        Status
      </button>

      {/* Convert buttons (permissioned) */}
      {canConvert && (
        <>
          <button
            className="text-sm px-2 py-1 bg-blue-600 text-white rounded"
            onClick={() => doConvert("employee")}
            disabled={converting}
            title="Convert to Employee"
          >
            Convert → Employee
          </button>

          <button
            className="text-sm px-2 py-1 bg-purple-600 text-white rounded"
            onClick={() => doConvert("consultant")}
            disabled={converting}
            title="Convert to Consultant"
          >
            Convert → Consultant
          </button>
        </>
      )}

      {/* Upload Modal */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-40" onClick={() => setUploadOpen(false)} />
          <div className="bg-white p-4 rounded shadow z-10 w-96">
            <h3 className="font-semibold mb-2">Upload Resume</h3>
            <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0])} />
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1 border rounded" onClick={() => setUploadOpen(false)}>Cancel</button>
              <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={uploadResume} disabled={uploading}>
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forward Modal */}
      {forwardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-40" onClick={() => setForwardOpen(false)} />
          <div className="bg-white p-4 rounded shadow z-10 w-96">
            <h3 className="font-semibold mb-2">Forward Candidate</h3>
            <label className="text-xs text-gray-600">Emails (comma separated)</label>
            <input className="w-full border px-2 py-1 mt-1" value={forwardEmails} onChange={(e) => setForwardEmails(e.target.value)} />
            <label className="text-xs text-gray-600 mt-2">Message</label>
            <textarea className="w-full border px-2 py-1 mt-1" rows={4} value={forwardMsg} onChange={(e) => setForwardMsg(e.target.value)} />
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1 border rounded" onClick={() => setForwardOpen(false)}>Cancel</button>
              <button className="px-3 py-1 bg-indigo-600 text-white rounded" onClick={forwardCandidate}>Send</button>
            </div>
          </div>
        </div>
      )}

      {/* Status Modal */}
      {statusOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-40" onClick={() => setStatusOpen(false)} />
          <div className="bg-white p-4 rounded shadow z-10 w-96">
            <h3 className="font-semibold mb-2">Change Status</h3>
            <label className="text-xs">Status</label>
            <select className="w-full border px-2 py-1 mt-1" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
              <option value="">Select</option>
              <option value="new">New</option>
              <option value="screening">Screening</option>
              <option value="interview">Interview</option>
              <option value="offer">Offer</option>
              <option value="hired">Hired</option>
              <option value="rejected">Rejected</option>
            </select>

            <label className="text-xs mt-2">Reason (optional)</label>
            <input className="w-full border px-2 py-1 mt-1" value={statusReason} onChange={(e) => setStatusReason(e.target.value)} />

            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1 border rounded" onClick={() => setStatusOpen(false)}>Cancel</button>
              <button className="px-3 py-1 bg-yellow-500 rounded" onClick={changeStatus}>Update</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
