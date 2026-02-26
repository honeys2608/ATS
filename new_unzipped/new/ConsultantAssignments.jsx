// src/pages/account-manager/ConsultantAssignments.jsx
import React, { useEffect, useState } from "react";
import api from "../../api/axios";

// ⚠️ PATH CHECK: folder ka naam "account-manager" hona chahiye
import AssignConsultantModal from "../../components/account-manager/AssignConsultantModal";

export default function ConsultantAssignments() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    loadCandidates();
  }, []);

  async function loadCandidates() {
    try {
      setLoading(true);

      const res = await api.get("/v1/am/ready-for-assignment");

      // ✅ SAFE RESPONSE HANDLING
      const data = res.data?.data || res.data || [];
      setCandidates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      alert("Failed to load candidates");
    } finally {
      setLoading(false);
    }
  }

  const handleDirectHire = async (application) => {
    const applicationId = application.application_id || application.id;
    if (!applicationId) return;

    const confirmDirectHire = window.confirm(
      "Record this candidate as a direct hire? They will be removed from the AM queue.",
    );

    if (!confirmDirectHire) {
      return;
    }

    const note = window.prompt("Optional note to attach to the direct hire record:");

    try {
      await api.post(`/v1/am/applications/${applicationId}/direct-hire`, {
        note: note || undefined,
      });
      alert("Direct hire recorded");
      loadCandidates();
    } catch (err) {
      console.error("Direct hire failed", err);
      alert("Failed to record direct hire: " + err.response?.data?.detail);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Ready for Assignment</h2>

      {loading && <p>Loading...</p>}

      {!loading && candidates.length === 0 && (
        <p className="text-gray-500">No candidates ready for assignment</p>
      )}

      {!loading && candidates.length > 0 && (
        <table className="w-full border">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border">Candidate</th>
              <th className="p-2 border">Email</th>
              <th className="p-2 border">Job</th>
              <th className="p-2 border">Client</th>
              <th className="p-2 border">Action</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c, idx) => (
              <tr key={c.application_id || idx}>
                <td className="p-2 border">{c.candidate_name}</td>
                <td className="p-2 border">{c.email}</td>
                <td className="p-2 border">{c.job_title}</td>
                <td className="p-2 border">{c.client_name}</td>
                <td className="p-2 border">
                  <div className="flex flex-col gap-2">
                    <button
                      className="px-3 py-1 bg-blue-600 text-white rounded"
                      onClick={() => setSelected(c)}
                    >
                      Assign
                    </button>
                    <button
                      className="px-3 py-1 bg-violet-600 text-white rounded"
                      onClick={() => handleDirectHire(c)}
                    >
                      Direct Hire
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected && (
        <AssignConsultantModal
          data={selected}
          onClose={() => setSelected(null)}
          onSuccess={() => {
            setSelected(null);
            loadCandidates();
          }}
        />
      )}
    </div>
  );
}
