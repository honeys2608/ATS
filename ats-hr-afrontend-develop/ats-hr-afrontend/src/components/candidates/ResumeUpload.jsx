// src/components/candidates/ResumeUpload.jsx
import React, { useState } from "react";
import axios from "../../api/axios";

/**
 * ResumeUpload
 *
 * Props:
 *  - scope: "portal" | "admin"   (default: portal)
 *  - candidateId?: string        (required for admin scope)
 *  - onUpload?: (payload) => void
 *
 * Backend APIs:
 *  - Portal  : POST /v1/candidate/resume
 *  - Admin   : POST /v1/candidates/{candidate_id}/resume/upload
 *
 * FormData key (STANDARDIZED): "file"
 */
export default function ResumeUpload({
  scope = "portal",
  candidateId,
  onUpload,
}) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function handleUpload(e) {
    e?.preventDefault?.();
    if (!file) return alert("Please select a resume file");

    if (scope === "admin" && !candidateId) {
      return alert("candidateId is required for admin resume upload");
    }

    const formData = new FormData();
    formData.append("file", file); // ✅ SINGLE STANDARD KEY

    let endpoint =
      scope === "admin"
        ? `/v1/candidates/${candidateId}/resume/upload`
        : `/v1/candidate/resume`;

    setUploading(true);
    setProgress(0);

    try {
      const res = await axios.post(endpoint, formData, {
        onUploadProgress: (ev) => {
          if (ev.total) {
            setProgress(Math.round((ev.loaded * 100) / ev.total));
          }
        },
      });

      const payload = res.data?.data ?? res.data;

      alert(
        scope === "admin"
          ? "Resume uploaded successfully"
          : "Resume uploaded & parsing started"
      );

      onUpload && onUpload(payload);
    } catch (err) {
      console.error("Resume upload failed:", err);
      alert(
        err?.response?.data?.message ||
          "Resume upload failed"
      );
    } finally {
      setUploading(false);
      setProgress(0);
      setFile(null);
    }
  }

  return (
    <form onSubmit={handleUpload} className="space-y-2">
      <input
        type="file"
        accept=".pdf,.doc,.docx"
        disabled={uploading}
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      {uploading && (
        <div className="text-sm text-gray-600">
          Uploading… {progress}%
        </div>
      )}

      <button
        type="submit"
        disabled={uploading || !file}
        className="bg-indigo-600 text-white px-4 py-1 rounded disabled:opacity-60"
      >
        {uploading ? "Uploading…" : "Upload Resume"}
      </button>
    </form>
  );
}
