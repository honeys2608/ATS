import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import clientService from "../../services/clientService";

export default function CreateRequirementAdmin() {
  const { clientId } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: "",
    skills: "",
    location: "",
    budget: "",
    duration: "",
    sla: "",
  });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function submit() {
    try {
      await clientService.createClientRequirement(clientId, {
        ...form,
        skills: form.skills.split(",").map((s) => s.trim()),
      });

      alert("Requirement created successfully");
      navigate(`/clients/${clientId}/requirements`);
    } catch (err) {
      console.error("Requirement create failed", err);
      alert("Failed to create requirement");
    }
  }

  return (
    <div className="max-w-4xl mx-auto bg-white shadow p-6 rounded">
      <h1 className="text-2xl font-bold mb-6">Create Requirement</h1>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-semibold">Job Title</label>
          <input
            name="title"
            className="border p-2 w-full rounded"
            placeholder="e.g. Python Developer"
            value={form.title}
            onChange={handleChange}
          />
        </div>

        <div>
          <label className="text-sm font-semibold">Location</label>
          <input
            name="location"
            className="border p-2 w-full rounded"
            placeholder="e.g. Bangalore"
            value={form.location}
            onChange={handleChange}
          />
        </div>

        <div>
          <label className="text-sm font-semibold">Skills</label>
          <input
            name="skills"
            className="border p-2 w-full rounded"
            placeholder="e.g. Python, Django, AWS"
            value={form.skills}
            onChange={handleChange}
          />
        </div>

        <div>
          <label className="text-sm font-semibold">Budget</label>
          <input
            name="budget"
            className="border p-2 w-full rounded"
            placeholder="e.g. 12 LPA"
            value={form.budget}
            onChange={handleChange}
          />
        </div>

        <div>
          <label className="text-sm font-semibold">Duration</label>
          <input
            name="duration"
            className="border p-2 w-full rounded"
            placeholder="e.g. 6 Months"
            value={form.duration}
            onChange={handleChange}
          />
        </div>

        <div>
          <label className="text-sm font-semibold">SLA</label>
          <input
            name="sla"
            className="border p-2 w-full rounded"
            placeholder="e.g. 30 Days"
            value={form.sla}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={submit}
          className="bg-green-600 text-white px-5 py-2 rounded"
        >
          Save
        </button>

        <button
          onClick={() => navigate(-1)}
          className="bg-gray-300 px-5 py-2 rounded"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
