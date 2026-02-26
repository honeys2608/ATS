import React, { useState } from "react";
import { uploadVendorDocument } from "../../services/vendorDocumentService";

/**
 * VendorDocumentUploader
 * - Upload compliance documents (GST, NDA, Insurance, etc.)
 * - Read-only after upload (approval handled by Admin)
 */
export default function VendorDocumentUploader({ onSuccess }) {
  const [documentType, setDocumentType] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!documentType) {
      setError("Please select a document type");
      return;
    }

    if (!file) {
      setError("Please select a file");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("document_type", documentType);
      formData.append("file", file);

      await uploadVendorDocument(formData);

      setSuccess("Document uploaded successfully");
      setDocumentType("");
      setFile(null);

      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      setError("Failed to upload document");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h3 className="text-md font-medium mb-3">Upload Compliance Document</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-2">
          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            className="border rounded p-2"
            required
          >
            <option value="">Select Document Type</option>
            <option value="GST">GST Certificate</option>
            <option value="NDA">NDA</option>
            <option value="Insurance">Insurance</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <input
            type="file"
            onChange={(e) => setFile(e.target.files[0])}
            className="border rounded p-2"
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded"
          disabled={loading}
        >
          {loading ? "Uploading..." : "Upload Document"}
        </button>
      </form>
    </div>
  );
}
