import React, { useEffect, useState } from "react";
import VendorDocumentUploader
 from "../../components/vendor/VendorDocumentUploader";
import { getVendorDocuments } from "../../services/vendorDocumentService";

/**
 * VendorDocuments
 * - Upload & view vendor compliance documents
 * - Read-only status tracking
 */
export default function VendorDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    try {
      setLoading(true);
      setError("");
      const res = await getVendorDocuments();
      setDocuments(res || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load documents");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-800">
          Compliance Documents
        </h1>
        <p className="text-sm text-gray-500">
          Upload required documents for compliance and payments.
        </p>
      </div>

      {/* Upload */}
      <div className="bg-white rounded-lg shadow p-4">
        <VendorDocumentUploader onSuccess={loadDocuments} />
      </div>

      {/* Document List */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-md font-medium mb-4">Uploaded Documents</h2>

        {loading && (
          <p className="text-sm text-gray-500">Loading documents...</p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && documents.length === 0 && (
          <p className="text-sm text-gray-500">No documents uploaded yet.</p>
        )}

        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="border rounded-md p-3 flex justify-between items-center"
            >
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {doc.document_type}
                </p>
                <p className="text-xs text-gray-500">
                  Uploaded on {new Date(doc.created_at).toLocaleDateString()}
                </p>
              </div>

              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  doc.status === "approved"
                    ? "bg-green-100 text-green-700"
                    : doc.status === "rejected"
                    ? "bg-red-100 text-red-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {doc.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
