// src/pages/CandidatesBulkActions.jsx
import React, { useEffect, useState } from "react";
import candidateService from "../services/candidateService";

export default function CandidatesBulkActions() {
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    loadCandidates();
  }, []);

  async function loadCandidates() {
    setLoading(true);
    try {
      const data = await candidateService.listCandidates({
        limit: 100,
      });
      const list = Array.isArray(data)
        ? data
        : data?.items ?? [];
      setCandidates(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function toggle(id) {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

 async function sendBulkEmail() {
  if (selectedIds.size === 0) {
    alert("Select at least one candidate");
    return;
  }

  const formData = new FormData();

  // MUST MATCH BACKEND NAMES EXACTLY
  formData.append("subject", subject.trim());
  formData.append("message_body", message.trim());

  // IMPORTANT: append candidate_ids MULTIPLE TIMES
  Array.from(selectedIds).forEach((id) => {
    formData.append("candidate_ids", id);
  });

  try {
    await api.post("/v1/candidates/email/send", formData);
    alert("Emails sent successfully");
  } catch (err) {
    console.error(err.response?.data || err);
    alert("Send email failed");
  }
}


  async function updateBulkStatus() {
    if (!status) return alert("Select status");

    try {
      await Promise.all(
        Array.from(selected).map((id) =>
          candidateService.updateStatus(id, { status })
        )
      );
      alert("Status updated");
      setStatus("");
      loadCandidates();
    } catch (err) {
      console.error(err);
      alert("Bulk status update failed");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        Bulk Candidate Actions
      </h1>

      <div className="bg-white rounded shadow p-4">
        {loading ? (
          "Loading..."
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th></th>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => {
                const id = c.id ?? c._id;
                return (
                  <tr key={id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(id)}
                        onChange={() => toggle(id)}
                      />
                    </td>
                    <td>{c.name || "-"}</td>
                    <td>{c.email}</td>
                    <td>{c.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white p-4 rounded shadow space-y-4">
        <h3 className="font-semibold">Bulk Email</h3>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="w-full p-2 border rounded"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Email body"
          rows={4}
          className="w-full p-2 border rounded"
        />
        <button
          onClick={sendBulkEmail}
          className="bg-indigo-600 text-white px-4 py-2 rounded"
        >
          Send Email
        </button>
      </div>

      <div className="bg-white p-4 rounded shadow space-y-3">
        <h3 className="font-semibold">Bulk Status Update</h3>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="">Select status</option>
          <option value="screening">Screening</option>
          <option value="shortlisted">Shortlisted</option>
          <option value="rejected">Rejected</option>
        </select>
        <button
          onClick={updateBulkStatus}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Update Status
        </button>
      </div>
    </div>
  );
}
