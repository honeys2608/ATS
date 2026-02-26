
import React, { useState } from "react";
import api from "../../api/axios";

/**
 * SendToClientModal
 *
 * Props:
 * - open (boolean)
 * - onClose ()
 * - jobId (string)
 * - selectedApplications (array of application_ids)
 * - onSuccess ()
 */
export default function SendToClientModal({
  open,
  onClose,
  jobId,
  selectedApplications = [],
  onSuccess = () => {},
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSend = async () => {
    if (!jobId || selectedApplications.length === 0) {
      setError("No candidates selected");
      return;
    }

    try {
      setSending(true);
      setError("");

      await api.post("/v1/am/send-to-client", {
        job_id: jobId,
        application_ids: selectedApplications,
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
          "Failed to send profiles to client"
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6 z-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Send Profiles to Client
        </h2>

        <p className="text-sm text-gray-600 mb-4">
          You are about to send{" "}
          <span className="font-semibold">
            {selectedApplications.length}
          </span>{" "}
          candidate{selectedApplications.length > 1 ? "s" : ""} to
          the client.
        </p>

        {error && (
          <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 p-2 rounded">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
            disabled={sending}
          >
            Cancel
          </button>

          <button
            onClick={handleSend}
            disabled={sending}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send to Client"}
          </button>
        </div>
      </div>
    </div>
  );
}
