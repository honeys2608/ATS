import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/axios";

export default function VendorBGVSubmit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState("clear");
  const [remarks, setRemarks] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return alert("Please upload report file");

    const formData = new FormData();
    formData.append("status", status);
    formData.append("remarks", remarks);
    formData.append("file", file);

    try {
      setLoading(true);
      await api.post(`/v1/vendor/bgv/${id}/submit`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Report submitted successfully");
      navigate("/vendor/bgv-assigned");
    } catch (err) {
      console.error(err);
      alert("Failed to submit report");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl bg-white p-6 rounded shadow">
      <h1 className="text-xl font-bold mb-4">Submit BGV Report</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label>Status*</label>
          <select
            className="w-full border p-2 rounded"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="clear">Clear</option>
            <option value="red_flag">Red Flag</option>
            <option value="insufficient">Insufficient</option>
          </select>
        </div>

        <div>
          <label>Remarks</label>
          <textarea
            className="w-full border p-2 rounded"
            rows="3"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>

        <div>
          <label>Upload Report*</label>
          <input
            type="file"
            className="w-full"
            onChange={(e) => setFile(e.target.files[0])}
          />
        </div>

        <button
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          {loading ? "Submitting..." : "Submit Report"}
        </button>
      </form>
    </div>
  );
}
