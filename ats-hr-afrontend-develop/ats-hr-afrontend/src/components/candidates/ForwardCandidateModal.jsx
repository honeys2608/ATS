// src/components/candidates/ForwardCandidateModal.jsx
import React, { useState } from "react";
import candidateService from "../../services/candidateService";

export default function ForwardCandidateModal({
  open,
  onClose,
  candidateId,
}) {
  const [toUserId, setToUserId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleForward = async () => {
    if (!toUserId) return alert("Target user ID required");

    setLoading(true);
    try {
      await candidateService.forwardProfile(candidateId, {
        to_user_id: toUserId,
        message,
      });
      alert("Candidate forwarded successfully");
      onClose();
    } catch (err) {
      console.error(err);
      alert("Forwarding failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-lg w-full max-w-md p-4">
        <h3 className="text-lg font-semibold mb-3">
          Forward Candidate
        </h3>

        <label className="text-sm">Forward to User ID</label>
        <input
          value={toUserId}
          onChange={(e) => setToUserId(e.target.value)}
          className="w-full p-2 border rounded mb-3"
          placeholder="Internal user ID"
        />

        <label className="text-sm">Message (optional)</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full p-2 border rounded mb-4"
          rows={3}
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1 border rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleForward}
            disabled={loading}
            className="px-3 py-1 bg-indigo-600 text-white rounded"
          >
            {loading ? "Forwarding..." : "Forward"}
          </button>
        </div>
      </div>
    </div>
  );
}
