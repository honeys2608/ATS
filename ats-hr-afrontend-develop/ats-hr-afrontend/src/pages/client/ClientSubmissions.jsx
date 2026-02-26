import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import clientService from "../../services/clientService";

/* ================= DECISION CONFIG ================= */
const decisionConfig = {
  hired: {
    label: "Hire",
    icon: "✓",
    color: "green",
    description: "Send offer letters to selected candidates",
  },
  rejected: {
    label: "Reject",
    icon: "✕",
    color: "red",
    description: "Mark selected candidates as rejected",
  },
  shortlisted: {
    label: "Hold",
    icon: "⏸",
    color: "amber",
    description: "Keep candidates in pending review",
  },
};

export default function ClientSubmissions() {
  const { jobId } = useParams();
  const [apps, setApps] = useState([]);
  const [selected, setSelected] = useState([]);
  const [confirmModal, setConfirmModal] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, [jobId]);

  async function load() {
    if (!jobId) return;
    try {
      const res = await clientService.getSubmissions(jobId);
      setApps(res.submissions || []);
      setSelected([]);
      setError("");
    } catch (err) {
      setError("Failed to load submissions");
      console.error(err);
    }
  }

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (selected.length === apps.length) setSelected([]);
    else setSelected(apps.map((a) => a.application_id));
  };

  const openConfirmation = (decision) => {
    if (selected.length === 0) return;
    setConfirmModal({ decision, step: "confirm" });
    setError("");
  };

  const handleConfirmDecision = async () => {
    if (!confirmModal) return;

    setProcessing(true);
    setError("");

    try {
      const { decision } = confirmModal;
      const failed = [];

      for (const id of selected) {
        try {
          await clientService.submitFinalDecision({
            application_id: id,
            decision,
          });
        } catch (err) {
          failed.push(id);
          console.error("Failed to update:", id, err);
        }
      }

      if (failed.length === 0) {
        setConfirmModal({ ...confirmModal, step: "success" });
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await load();
      } else if (failed.length < selected.length) {
        setError(
          `Updated ${selected.length - failed.length}/${selected.length} candidates. ${failed.length} failed.`,
        );
        await load();
      } else {
        throw new Error("All updates failed");
      }
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to update candidates");
      console.error(err);
    } finally {
      setProcessing(false);
      if (confirmModal?.step === "success") {
        setConfirmModal(null);
      }
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-gray-100 text-gray-700",
      hired: "bg-green-100 text-green-700",
      rejected: "bg-red-100 text-red-700",
      shortlisted: "bg-amber-100 text-amber-700",
    };
    return styles[status] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="space-y-6">
      {/* ================= PAGE HEADER ================= */}
      <div>
        <h2 className="text-3xl font-bold mb-2 text-gray-900">
          Candidate Submissions
        </h2>
        <p className="text-gray-600">
          Review and make final hiring decisions on candidates sent by
          recruiters
        </p>
      </div>

      {/* ================= ERROR MESSAGE ================= */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="font-medium">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* ================= ACTION BAR ================= */}
      {selected.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-900 font-medium mb-3">
            {selected.length} candidate{selected.length !== 1 ? "s" : ""}{" "}
            selected
          </p>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(decisionConfig).map(([key, config]) => (
              <button
                key={key}
                onClick={() => openConfirmation(key)}
                disabled={processing}
                className={`px-4 py-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-${config.color}-600 hover:bg-${config.color}-700`}
              >
                {config.icon} {config.label} ({selected.length})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ================= TABLE ================= */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-3 text-left">
                <input
                  type="checkbox"
                  checked={selected.length === apps.length && apps.length > 0}
                  onChange={toggleSelectAll}
                  className="cursor-pointer"
                />
              </th>
              <th className="p-3 text-left font-semibold text-gray-900">
                Candidate
              </th>
              <th className="p-3 text-left font-semibold text-gray-900">
                Sent On
              </th>
              <th className="p-3 text-left font-semibold text-gray-900">
                Status
              </th>
            </tr>
          </thead>

          <tbody>
            {apps.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center p-8">
                  <div className="flex justify-center mb-3">
                    <span className="text-4xl">📋</span>
                  </div>
                  <p className="text-gray-500 font-medium">
                    No submissions yet
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    Candidates sent by recruiters will appear here
                  </p>
                </td>
              </tr>
            ) : (
              apps.map((a) => (
                <tr
                  key={a.application_id}
                  className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                    selected.includes(a.application_id) ? "bg-blue-50" : ""
                  }`}
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(a.application_id)}
                      onChange={() => toggleSelect(a.application_id)}
                      className="cursor-pointer"
                    />
                  </td>

                  <td className="p-3">
                    <p className="font-medium text-gray-900">
                      {a.candidate_name}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      {a.candidate_email}
                    </p>
                  </td>

                  <td className="p-3 text-gray-600">
                    {a.sent_to_client_at
                      ? new Date(a.sent_to_client_at).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-"}
                  </td>

                  <td className="p-3">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusBadge(
                        a.status,
                      )}`}
                    >
                      {a.status?.charAt(0).toUpperCase() + a.status?.slice(1) ||
                        "Pending"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ================= CONFIRMATION MODAL ================= */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-6 w-full max-w-md">
            {confirmModal.step === "confirm" && (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Confirm {decisionConfig[confirmModal.decision].label}
                </h3>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-blue-900">
                    <span className="font-semibold">{selected.length}</span>{" "}
                    candidate
                    {selected.length !== 1 ? "s" : ""} will be marked as{" "}
                    <span className="font-semibold">
                      {decisionConfig[
                        confirmModal.decision
                      ].label.toLowerCase()}
                    </span>
                    .
                  </p>
                  <p className="text-blue-800 text-sm mt-2">
                    {decisionConfig[confirmModal.decision].description}
                  </p>
                </div>

                <p className="text-gray-600 text-sm mb-4">
                  This action cannot be undone. Do you want to continue?
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={handleConfirmDecision}
                    disabled={processing}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-${decisionConfig[confirmModal.decision].color}-600 hover:bg-${decisionConfig[confirmModal.decision].color}-700`}
                  >
                    {processing ? "Processing..." : "Confirm"}
                  </button>
                  <button
                    onClick={() => setConfirmModal(null)}
                    disabled={processing}
                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {confirmModal.step === "success" && (
              <div className="text-center">
                <div className="text-5xl mb-4">✓</div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  {selected.length} Candidates Updated
                </h3>
                <p className="text-gray-600">
                  Decision recorded successfully. Refreshing...
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
