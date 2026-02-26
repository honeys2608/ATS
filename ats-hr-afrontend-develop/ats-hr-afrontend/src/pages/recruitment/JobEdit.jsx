// src/pages/recruitment/JobEdit.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getJob,
  updateJob,
  uploadJobJD,
  assignRecruiters,
} from "../../services/jobService";
import JDUpload from "../../components/jobs/JDUpload";

export default function JobEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [job, setJob] = useState(null);
  const [jdFile, setJdFile] = useState(null);

  useEffect(() => {
    let mounted = true;
    getJob(id)
      .then((r) => {
        if (!mounted) return;
        const j = r.data ?? r.data?.data ?? null;
        setJob(j);
      })
      .catch(console.error)
      .finally(() => mounted && setLoading(false));
    return () => (mounted = false);
  }, [id]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (!job) return <div className="p-6 text-red-600">Job not found</div>;

  const [form, setForm] = useState({
    title: job.title || "",
    description: job.description || "",
    department: job.department || "",
    location: job.location || "",
    min_experience: job.min_experience ?? "",
    max_experience: job.max_experience ?? "",
    status: job.status || "draft",
    recruiters: job.recruiters?.map((r) => r.id || r) || [],
    sla_days: job.sla_days ?? 7,
  });

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateJob(id, {
        title: form.title,
        description: form.description,
        department: form.department,
        location: form.location,
        min_experience:
          form.min_experience === "" ? null : Number(form.min_experience),
        max_experience:
          form.max_experience === "" ? null : Number(form.max_experience),
        status: form.status,
        sla_days: form.sla_days,
      });
      if (jdFile) {
        const fd = new FormData();
        fd.append("file", jdFile);
        await uploadJobJD(id, fd);
      }
      if (form.recruiters?.length) {
        await assignRecruiters(id, form.recruiters);
      }
      navigate(`/recruitment/jobs/${id}`);
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.detail || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container">
      <h1 className="text-2xl font-semibold mb-4">Edit Job</h1>
      <form onSubmit={onSave} className="bg-white p-6 rounded shadow space-y-4">
        <input
          className="w-full p-2 border rounded"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
        <textarea
          className="w-full p-3 border rounded"
          rows={6}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            className="p-2 border rounded"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          />
          <input
            className="p-2 border rounded"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <input
            type="number"
            className="p-2 border rounded"
            value={form.min_experience}
            onChange={(e) =>
              setForm({ ...form, min_experience: e.target.value })
            }
          />
          <input
            type="number"
            className="p-2 border rounded"
            value={form.max_experience}
            onChange={(e) =>
              setForm({ ...form, max_experience: e.target.value })
            }
          />
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="p-2 border rounded"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <RecruiterAssign
            value={form.recruiters}
            onChange={(v) => setForm({ ...form, recruiters: v })}
          />
          <div>
            <label className="block text-sm font-medium mb-1">Upload JD</label>
            <JDUpload value={job.jd_url || null} onFile={(f) => setJdFile(f)} />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 border rounded"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
