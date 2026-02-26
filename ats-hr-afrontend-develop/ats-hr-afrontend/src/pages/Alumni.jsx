import React, { useState, useEffect } from "react";
import { formatDate } from "../utils/dateFormatter";
import axios from "../api/axios";

function Alumni() {
  const [alumni, setAlumni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlumni, setSelectedAlumni] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateData, setUpdateData] = useState({
    current_company: "",
    current_designation: "",
    linkedin_url: "",
    engagement_score: "",
  });

  useEffect(() => {
    loadAlumni();
  }, []);

  const loadAlumni = async () => {
    try {
      const response = await axios.get("/v1/alumni");
      setAlumni(response.data || []);
      setLoading(false);
    } catch (error) {
      console.error("Error loading alumni:", error);
      setLoading(false);
    }
  };

  const handleUpdate = (alumniRecord) => {
    setSelectedAlumni(alumniRecord);
    setUpdateData({
      current_company: alumniRecord.current_company || "",
      current_designation: alumniRecord.current_designation || "",
      linkedin_url: alumniRecord.linkedin_url || "",
      engagement_score: alumniRecord.engagement_score || "",
    });
    setShowUpdateModal(true);
  };

  const submitUpdate = async () => {
    try {
      await axios.put(`/v1/alumni/${selectedAlumni.id}/update`, updateData);
      setShowUpdateModal(false);
      loadAlumni();
    } catch (error) {
      console.error("Error updating alumni:", error);
    }
  };

  const trackReferral = async (alumniId) => {
    try {
      await axios.post(`/v1/alumni/${alumniId}/referral`);
      loadAlumni();
    } catch (error) {
      console.error("Error tracking referral:", error);
    }
  };

  const getEngagementBadge = (score) => {
    if (!score)
      return { color: "bg-gray-100 text-gray-600", label: "Not Rated" };
    if (score >= 80)
      return { color: "bg-green-100 text-green-800", label: "Highly Engaged" };
    if (score >= 60)
      return { color: "bg-blue-100 text-blue-800", label: "Active" };
    if (score >= 40)
      return { color: "bg-yellow-100 text-yellow-800", label: "Moderate" };
    return { color: "bg-red-100 text-red-800", label: "Low Engagement" };
  };

  if (loading) {
    return <div className="text-center py-12">Loading alumni...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Alumni Network</h1>
        <div className="bg-white px-6 py-3 rounded-lg shadow">
          <div className="text-sm text-gray-500">Total Alumni</div>
          <div className="text-2xl font-bold text-indigo-600">
            {alumni.length}
          </div>
        </div>
      </div>

      {alumni.length === 0 ? (
        <div className="bg-white p-12 rounded-lg shadow text-center">
          <p className="text-gray-500 text-lg">No alumni records found</p>
          <p className="text-gray-400 mt-2">
            Alumni are created when employees exit the organization
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {alumni.map((alumniRecord) => {
            const badge = getEngagementBadge(alumniRecord.engagement_score);
            return (
              <div
                key={alumniRecord.id}
                className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                      {alumniRecord.employee?.full_name || "Unknown"}
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Last Designation:</span>
                        <span className="ml-2 font-semibold">
                          {alumniRecord.last_designation || "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Tenure:</span>
                        <span className="ml-2 font-semibold">
                          {alumniRecord.tenure_years || 0} years
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Exit Date:</span>
                        <span className="ml-2 font-semibold">
                          {alumniRecord.exit_date
                            ? formatDate(alumniRecord.exit_date)
                            : "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Referrals Made:</span>
                        <span className="ml-2 font-semibold">
                          {alumniRecord.referrals_made || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                    {alumniRecord.is_eligible_for_rehire && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                        Eligible for Rehire
                      </span>
                    )}
                  </div>
                </div>

                {alumniRecord.current_company && (
                  <div className="bg-indigo-50 p-4 rounded-lg mb-4">
                    <h4 className="font-semibold text-indigo-900 mb-2">
                      Current Position
                    </h4>
                    <div className="text-sm">
                      <div className="mb-1">
                        <span className="text-gray-600">Company:</span>
                        <span className="ml-2 font-semibold">
                          {alumniRecord.current_company}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Designation:</span>
                        <span className="ml-2 font-semibold">
                          {alumniRecord.current_designation || "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => handleUpdate(alumniRecord)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition"
                  >
                    Update Info
                  </button>
                  <button
                    onClick={() => trackReferral(alumniRecord.id)}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
                  >
                    Track Referral
                  </button>
                  {alumniRecord.linkedin_url && (
                    <a
                      href={alumniRecord.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                    >
                      LinkedIn Profile
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showUpdateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">
              Update Alumni Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Current Company
                </label>
                <input
                  type="text"
                  value={updateData.current_company}
                  onChange={(e) =>
                    setUpdateData({
                      ...updateData,
                      current_company: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Current Designation
                </label>
                <input
                  type="text"
                  value={updateData.current_designation}
                  onChange={(e) =>
                    setUpdateData({
                      ...updateData,
                      current_designation: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">
                  LinkedIn URL
                </label>
                <input
                  type="text"
                  value={updateData.linkedin_url}
                  onChange={(e) =>
                    setUpdateData({
                      ...updateData,
                      linkedin_url: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Engagement Score (0-100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={updateData.engagement_score}
                  onChange={(e) =>
                    setUpdateData({
                      ...updateData,
                      engagement_score: parseFloat(e.target.value),
                    })
                  }
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={submitUpdate}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
              >
                Update
              </button>
              <button
                onClick={() => setShowUpdateModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Alumni;
