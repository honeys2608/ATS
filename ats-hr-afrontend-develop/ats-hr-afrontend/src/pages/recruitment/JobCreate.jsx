// src/pages/recruitment/JobCreate.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createJob,
  uploadJobJD,    // <- use the actual exported name from jobService.js
  assignRecruiters
} from "../../services/jobService";
import axios from "../../api/axios";

export default function JobCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    description: "",
    skills: "",
    min_experience: 0,
    max_experience: 0,
    location: "",
    department: "",
    company_name: "",
    status: "open",
    sla_days: 7,
    recruiters: []
  });
  const [jdFile, setJdFile] = useState(null);
  const [recruiterOptions, setRecruiterOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    axios
      .get("/v1/users?role=recruiter")
      .then((res) => {
        if (!mounted) return;
        setRecruiterOptions(res.data || []);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleChange = (key) => (e) => {
    const value =
      e.target.type === "number" ? Number(e.target.value) : e.target.value;
    setForm((s) => ({ ...s, [key]: value }));
  };

  const handleMultiSelect = (e) => {
    const selected = [...e.target.selectedOptions].map((o) => o.value);
    setForm((s) => ({ ...s, recruiters: selected }));
  };

  const handleFile = (e) => {
    setJdFile(e.target.files?.[0] ?? null);
  };

  const onSubmit = async (ev) => {
    ev.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = {
        title: form.title,
        description: form.description,
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        min_experience: form.min_experience,
        max_experience: form.max_experience,
        location: form.location,
        department: form.department,
        company_name: form.company_name,
        status: form.status,
        sla_days: form.sla_days
      };

      const res = await createJob(payload);
      const jobId = res.data?.id || res.data?.public_id || res.data?.job_id || res.data?.uuid;

      if (jdFile && jobId) {
        const fd = new FormData();
        fd.append("file", jdFile);
        // <-- changed to uploadJobJD
        await uploadJobJD(jobId, fd);
      }

      if (form.recruiters?.length && jobId) {
        await assignRecruiters(jobId, form.recruiters);
      }

      if (jobId) {
        navigate(`/recruitment/jobs/${jobId}`);
      } else {
        navigate("/recruitment/jobs");
      }
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to create job. Check console for details."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <h1>Create Job</h1>
      <form onSubmit={onSubmit} className="job-form">
        <label>
          Title
          <input value={form.title} onChange={handleChange("title")} required />
        </label>

        <label>
          Description
          <textarea
            value={form.description}
            onChange={handleChange("description")}
            required
          />
        </label>

        <label>
          Skills (comma separated)
          <input value={form.skills} onChange={handleChange("skills")} />
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          <label>
            Min Exp (yrs)
            <input
              type="number"
              min={0}
              value={form.min_experience}
              onChange={handleChange("min_experience")}
            />
          </label>
          <label>
            Max Exp (yrs)
            <input
              type="number"
              min={0}
              value={form.max_experience}
              onChange={handleChange("max_experience")}
            />
          </label>
        </div>

        <label>
          Location
          <input value={form.location} onChange={handleChange("location")} />
        </label>

        <label>
          Department
          <input value={form.department} onChange={handleChange("department")} />
        </label>

        <label>
          Company Name
          <input
            value={form.company_name}
            onChange={handleChange("company_name")}
          />
        </label>

        <label>
          Status
          <select value={form.status} onChange={handleChange("status")}>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="draft">Draft</option>
          </select>
        </label>

        <label>
          SLA (days)
          <input
            type="number"
            min={0}
            value={form.sla_days}
            onChange={handleChange("sla_days")}
          />
        </label>

        <label>
          Assign Recruiters (multi)
          <select multiple value={form.recruiters} onChange={handleMultiSelect}>
            {recruiterOptions.map((r) => (
              <option key={r.id || r.user_id} value={r.id || r.user_id}>
                {r.name || r.full_name || r.email}
              </option>
            ))}
          </select>
        </label>

        <label>
          Upload JD (optional)
          <input type="file" onChange={handleFile} accept=".pdf,.doc,.docx" />
        </label>

        {error && <div className="error">{error}</div>}

        <div style={{ marginTop: 12 }}>
          <button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Job"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/recruitment/jobs")}
            style={{ marginLeft: 8 }}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
