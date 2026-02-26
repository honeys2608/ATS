// src/components/candidates/CandidatesUploadExcel.jsx

import React, { useState } from "react";
import api from "../../api/axios";

export function CandidatesUploadExcel() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState([]);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setMessage("");
    setError("");
    setValidationErrors([]);
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const response = await api.get("/v1/bulk/template/download", {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "Bulk_Upload_Template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.parentChild.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Failed to download template");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select an Excel or CSV file.");
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");
    setValidationErrors([]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await api.post("/v1/bulk/upload", formData);

      setMessage(res?.data?.message || "Candidates uploaded successfully!");
      setFile(null);
    } catch (err) {
      console.error(err);

      // Handle validation errors with row details
      if (err?.response?.status === 422 && err?.response?.data?.detail) {
        const errorData = err.response.data.detail;
        if (typeof errorData === "object" && errorData.details) {
          setValidationErrors(errorData.details);
          setShowErrorModal(true);
          setError(
            `Validation failed: ${errorData.invalid_rows} of ${errorData.total_rows} rows have errors`,
          );
        } else {
          setError(errorData);
        }
      } else {
        setError(
          err?.response?.data?.error?.message ||
            err?.response?.data?.message ||
            err?.response?.data?.detail ||
            "Upload failed",
        );
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
      <div className="flex gap-3 flex-wrap items-center">
        <button
          onClick={handleDownloadTemplate}
          disabled={downloadingTemplate}
          className={`px-4 py-2 rounded text-sm font-medium flex gap-2 items-center ${
            downloadingTemplate
              ? "bg-gray-300 text-gray-600"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          📥 {downloadingTemplate ? "Downloading..." : "Download Template"}
        </button>
        <span className="text-xs text-gray-500">
          Includes validation rules & examples
        </span>
      </div>

      <div className="border-t border-gray-300 pt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Upload Excel (.xlsx / .csv)
        </label>

        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          className="block w-full border p-3 rounded bg-white"
        />

        {file && (
          <p className="text-xs text-gray-600 mt-2">
            Selected: <strong>{file.name}</strong>
          </p>
        )}

        <button
          onClick={handleUpload}
          disabled={uploading || !file}
          className={`mt-3 px-4 py-2 rounded text-white font-medium ${
            uploading || !file
              ? "bg-gray-400"
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {uploading ? "Uploading..." : "Upload File"}
        </button>
      </div>

      {message && (
        <div className="bg-green-50 border border-green-200 p-3 rounded">
          <p className="text-green-700 text-sm font-medium">✓ {message}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 p-3 rounded">
          <p className="text-red-700 text-sm font-medium">✗ {error}</p>
        </div>
      )}

      {/* Error Details Modal */}
      {showErrorModal && validationErrors.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl max-h-96 overflow-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-red-600">
                Validation Errors Found
              </h3>
              <button
                onClick={() => setShowErrorModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Please fix the following errors in your Excel file and try again:
            </p>

            <div className="space-y-4">
              {validationErrors.map((err, idx) => (
                <div
                  key={idx}
                  className="border-l-4 border-red-500 pl-4 py-2 bg-red-50 rounded"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-gray-800">
                        Row {err.row}
                      </p>
                      <p className="text-sm text-gray-600">
                        Email: {err.email}
                      </p>
                      {err.name && (
                        <p className="text-sm text-gray-600">
                          Name: {err.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                    {err.errors.map((error, errorIdx) => (
                      <li key={errorIdx}>{error}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-6 bg-blue-50 border border-blue-200 rounded p-4">
              <p className="text-sm font-semibold text-blue-900 mb-2">
                📋 Validation Requirements:
              </p>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>
                  ✓ <strong>Full Name:</strong> Must start with CAPITAL letter
                  (e.g., "John Doe")
                </li>
                <li>
                  ✓ <strong>Email:</strong> Valid format (e.g.,
                  john.doe@example.com)
                </li>
                <li>
                  ✓ <strong>Phone:</strong> 10-15 digits (e.g., 9876543210 or
                  +91 9876543210)
                </li>
                <li>
                  ✓ <strong>Experience:</strong> Valid number between 0-100
                </li>
                <li>
                  ✓ <strong>Skills:</strong> Comma-separated, max 20 skills
                </li>
              </ul>
            </div>

            <button
              onClick={() => setShowErrorModal(false)}
              className="mt-6 w-full bg-gray-500 hover:bg-gray-600 text-white py-2 rounded font-medium"
            >
              Close & Fix
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
