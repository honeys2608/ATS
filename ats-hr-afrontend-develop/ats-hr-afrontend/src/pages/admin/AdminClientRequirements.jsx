import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import clientService from "../../services/clientService";

export default function AdminClientRequirements() {
  const { clientId } = useParams();
  const [jobs, setJobs] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await clientService.getClientRequirements(clientId);
      setJobs(res || []);
    } catch (err) {
      console.error("Failed to load client requirements", err);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Client Requirements</h1>

        <button
          onClick={() => navigate(`/clients/${clientId}/requirements/create`)}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          + New Requirement
        </button>
      </div>

      <div className="bg-white rounded shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">S. No.</th> {/* ✅ Serial */}
              <th className="p-2">Requirement ID</th> {/* ✅ Req ID */}
              <th className="p-2">Job Title</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>

          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td className="p-4 text-center text-gray-500" colSpan={3}>
                  No requirements found
                </td>
              </tr>
            ) : (
              jobs.map((j, index) => (
                <tr key={j.requirement_code} className="border-t">
                  <td className="p-2 text-center font-medium">{index + 1}</td>

                  <td className="p-2 text-gray-700">
                    {j.requirement_code || "—"}
                  </td>
                  <td className="p-2">{j.title}</td>
                  <td>{j.status || "N/A"}</td>
                  <td className="text-sm text-gray-700">
                    {j.created_at
                      ? (() => {
                          const dt = new Date(j.created_at);

                          const time = dt
                            .toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })
                            .toUpperCase();

                          const date = dt
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
