import React, { useState } from "react";
import { uploadVendorCandidate } from "../../services/vendorService";

/**
 * VendorCandidateUpload
 * - Upload candidate profile + resume
 * - Intake source = vendor (handled by backend)
 */
export default function VendorCandidateUpload({ onSuccess }) {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    experience_years: "",
    billing_rate: "",
    skills: "",
  });

  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!resume) {
      setError("Resume is required");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("full_name", form.full_name);
      formData.append("email", form.email);
      formData.append("phone", form.phone);
      formData.append("experience_years", form.experience_years);
      formData.append("billing_rate", form.billing_rate);
      formData.append("skills", form.skills);

      formData.append("resume", resume);

      await uploadVendorCandidate(formData);

      setSuccess("Candidate uploaded successfully");
      setForm({
        full_name: "",
        email: "",
        phone: "",
        experience_years: "",
        billing_rate: "",
        skills: "",
      });
      setResume(null);

      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      setError("Failed to upload candidate");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h3 className="text-md font-medium mb-3">Upload New Candidate</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <input
            name="full_name"
            value={form.full_name}
            onChange={handleChange}
            placeholder="Full Name"
            required
            className="border rounded px-3 py-2 text-sm"
          />

          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Email"
            required
            className="border rounded px-3 py-2 text-sm"
          />

          <input
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="Phone"
            required
            className="border rounded px-3 py-2 text-sm"
          />

          <input
            name="experience_years"
            type="number"
            value={form.experience_years}
            onChange={handleChange}
            placeholder="Experience (years)"
            required
            className="border rounded px-3 py-2 text-sm"
          />

          <input
            name="billing_rate"
            type="number"
            value={form.billing_rate}
            onChange={handleChange}
            placeholder="Billing Rate"
            required
            className="border rounded px-3 py-2 text-sm"
          />

          <input
            name="skills"
            value={form.skills}
            onChange={handleChange}
            placeholder="Skills (comma separated)"
            className="border rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => setResume(e.target.files[0])}
            className="text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-60"
        >
          {loading ? "Uploading..." : "Upload Candidate"}
        </button>
      </form>
    </div>
  );
}
