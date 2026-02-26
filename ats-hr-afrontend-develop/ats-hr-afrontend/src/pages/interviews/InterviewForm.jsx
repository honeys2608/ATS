import React, { useState, useEffect } from "react";
import DateTimePicker from "../../components/interviews/DateTimePicker";

const DEFAULT_FORM = {
  job: "",
  candidate: "",
  datetime: "",
  type: "Phone Interview",
  meetingLink: "",
  address: "",
  notes: "",
};

export default function InterviewForm({
  jobs = [],
  candidates = [],
  onSubmit,
  initialData,
}) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});

  /* ============================
     LOAD INITIAL DATA (SAFE)
  ============================ */
  useEffect(() => {
    if (initialData) {
      setForm({ ...DEFAULT_FORM, ...initialData });
    }
  }, [initialData]);

  /* ============================
     HANDLE CHANGE
  ============================ */
  const handleChange = (field, value) => {
    setForm((prev) => {
      // Reset candidate when job changes
      if (field === "job") {
        return { ...prev, job: value, candidate: "" };
      }

      // Clear conditional fields when type changes
      if (field === "type") {
        return {
          ...prev,
          type: value,
          meetingLink: "",
          address: "",
        };
      }

      return { ...prev, [field]: value };
    });
  };

  /* ============================
     VALIDATION
  ============================ */
  const validate = () => {
    const errs = {};

    if (!form.job) errs.job = "Job is required";
    if (!form.candidate) errs.candidate = "Candidate is required";
    if (!form.datetime) errs.datetime = "Date & Time is required";

    if (form.type === "Video Interview" && !form.meetingLink) {
      errs.meetingLink = "Meeting link is required";
    }

    if (form.type === "In-Person Interview" && !form.address) {
      errs.address = "Interview address is required";
    }

    return errs;
  };

  /* ============================
     SUBMIT
  ============================ */
  const handleSubmit = (e) => {
    e.preventDefault();

    const errs = validate();
    setErrors(errs);

    if (Object.keys(errs).length === 0) {
      onSubmit({
        ...form,
        datetime: new Date(form.datetime).toISOString(), // ✅ ISO FORMAT
      });
    }
  };

  /* ============================
     FILTERED CANDIDATES
  ============================ */
  const filteredCandidates = candidates.filter((c) => c.jobId === form.job);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg mx-auto">
      {/* JOB */}
      <div>
        <label className="block font-medium">Job *</label>
        <select
          value={form.job}
          onChange={(e) => handleChange("job", e.target.value)}
          className="border rounded px-2 py-1 w-full"
        >
          <option value="">Select Job</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
        </select>
        {errors.job && <p className="text-red-500 text-xs">{errors.job}</p>}
      </div>

      {/* CANDIDATE */}
      <div>
        <label className="block font-medium">Candidate *</label>
        <select
          value={form.candidate}
          onChange={(e) => handleChange("candidate", e.target.value)}
          className="border rounded px-2 py-1 w-full"
          disabled={!form.job}
        >
          <option value="">Select Candidate</option>
          {filteredCandidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {errors.candidate && (
          <p className="text-red-500 text-xs">{errors.candidate}</p>
        )}
      </div>

      {/* DATE TIME */}
      <div>
        <label className="block font-medium">Schedule Date & Time *</label>
        <DateTimePicker
          value={form.datetime}
          onChange={(val) => handleChange("datetime", val)}
        />
        {errors.datetime && (
          <p className="text-red-500 text-xs">{errors.datetime}</p>
        )}
      </div>

      {/* TYPE */}
      <div>
        <label className="block font-medium">Interview Type *</label>
        <select
          value={form.type}
          onChange={(e) => handleChange("type", e.target.value)}
          className="border rounded px-2 py-1 w-full"
        >
          <option>Phone Interview</option>
          <option>Video Interview</option>
          <option>In-Person Interview</option>
        </select>
      </div>

      {/* VIDEO LINK */}
      {form.type === "Video Interview" && (
        <div>
          <label className="block font-medium">Meeting Link *</label>
          <input
            type="url"
            value={form.meetingLink}
            onChange={(e) => handleChange("meetingLink", e.target.value)}
            className="border rounded px-2 py-1 w-full"
          />
          {errors.meetingLink && (
            <p className="text-red-500 text-xs">{errors.meetingLink}</p>
          )}
        </div>
      )}

      {/* ADDRESS */}
      {form.type === "In-Person Interview" && (
        <div>
          <label className="block font-medium">Interview Address *</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => handleChange("address", e.target.value)}
            className="border rounded px-2 py-1 w-full"
          />
          {errors.address && (
            <p className="text-red-500 text-xs">{errors.address}</p>
          )}
        </div>
      )}

      {/* NOTES */}
      <div>
        <label className="block font-medium">Notes / Instructions</label>
        <textarea
          value={form.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          className="border rounded px-2 py-1 w-full"
        />
      </div>

      {/* SUBMIT */}
      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        Schedule Interview
      </button>
    </form>
  );
}
