import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import clientService from "../../services/clientService";
import { FiEye } from "react-icons/fi";
import { FiDownload } from "react-icons/fi";

export default function ClientRequirements() {
  const [uploading, setUploading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await clientService.getRequirements();
    setJobs(res?.requirements || res || []);
  }

  async function handleExcelUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploading(true);
      await clientService.uploadRequirementsExcel(formData);
      alert("Requirements uploaded successfully!");
      load();
    } catch (err) {
      console.error(err);
      alert("Failed to upload file");
    } finally {
      setUploading(false);
    }
  }

  function downloadTemplate() {
    window.open("/templates/requirements_template_lowercase.xlsx", "_blank");
  }

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-800">
          My Requirements
        </h1>

        <div className="flex gap-3">
          {/* Create Manually */}
          <button
            onClick={() => navigate("/client/requirements/create")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            + New Requirement
          </button>

          <a
            href="/templates/requirements_template_lowercase.xlsx"
            download
            className="
    border border-emerald-600
    text-emerald-600
    hover:bg-emerald-50
    px-4 py-2 rounded-md
    text-sm font-medium
    inline-flex items-center gap-2
  "
          >
            <FiDownload size={16} />
            Download Template
          </a>
          {/* Upload Excel */}
          <label className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md text-sm font-medium cursor-pointer">
            Upload Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              hidden
              onChange={handleExcelUpload}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-gray-600 text-sm">
            <tr>
              <th className="p-2">S. No.</th> {/* ✅ Serial */}
              <th className="p-2">Requirement ID</th> {/* ✅ Req ID */}
              <th className="p-2">Job Title</th>
              <th>Created On</th> {/* ⭐ ADD */}
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {jobs.map((j, index) => (
              <tr key={j.id} className="border-t hover:bg-slate-50 transition">
                <td className="p-2 font-medium">{index + 1}</td> {/* S. No. */}
                <td className="p-2 text-gray-700">
                  {j.requirement_code || "—"}
                </td>
                <td className="p-2">{j.title}</td>
                <td className="text-sm text-gray-700">
                  {j.created_at
                    ? (() => {
                        const d = new Date(j.created_at);

                        const time = d
                          .toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })
                          .toUpperCase();

                        const date = d
                          .toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                          .toUpperCase();

                        return `${time} | ${date}`;
                      })()
                    : "-"}
                </td>
                <td>
                  {j.status === "NEW" && (
                    <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">
                      NEW
                    </span>
                  )}

                  {j.status === "APPROVED" && (
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                      APPROVED
                    </span>
                  )}

                  {j.status === "CONVERTED_TO_JOB" && (
                    <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                      CONVERTED TO JOB
                    </span>
                  )}
                </td>
                <td>
                  {j.job_id ? (
                    <button
                      onClick={() =>
                        navigate(`/client/jobs/${j.job_id}/submissions`)
                      }
                      className="inline-flex items-center gap-1 
             text-blue-600 text-sm font-medium
             hover:text-blue-700 hover:underline
             cursor-pointer"
                    >
                      <FiEye size={15} />
                      View Submissions
                    </button>
                  ) : (
                    <span className="text-gray-400 text-sm italic">
                      Job not created
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
