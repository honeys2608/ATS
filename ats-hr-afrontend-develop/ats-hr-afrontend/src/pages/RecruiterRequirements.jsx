import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import workflowService from "../services/workflowService";
import { Briefcase, MapPin, Users, ChevronRight } from "lucide-react";

const RequirementsList = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("assigned");
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchRequirements = async (scope) => {
    setLoading(true);
    setError("");
    try {
      const data = await workflowService.getRecruiterRequirements(scope);
      setRequirements(data.requirements || []);
    } catch (err) {
      setError("Failed to fetch requirements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequirements(activeTab);
  }, [activeTab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Requirements</h1>
            <p className="text-gray-600 mt-2">
              Manage assigned requirements and view all open requirements.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className={`px-4 py-2 rounded ${
                activeTab === "assigned"
                  ? "bg-blue-600 text-white"
                  : "bg-white border"
              }`}
              onClick={() => setActiveTab("assigned")}
            >
              My Assigned
            </button>
            <button
              className={`px-4 py-2 rounded ${
                activeTab === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-white border"
              }`}
              onClick={() => setActiveTab("all")}
            >
              All Requirements
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {requirements.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Briefcase className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">
              No requirements
            </h3>
            <p className="text-gray-600 mt-2">
              {activeTab === "assigned"
                ? "No assigned requirements yet."
                : "No open requirements available."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {requirements.map((req) => (
              <div
                key={req.id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900">
                        {req.title}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Req ID: {req.requirement_code || req.id}
                      </p>
                    </div>
                    <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      {req.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 text-gray-400 mr-2" />
                      <div>
                        <p className="text-xs text-gray-600">Positions</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {req.positions_count || 1}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                      <div>
                        <p className="text-xs text-gray-600">Location</p>
                        <p className="text-sm font-medium text-gray-900">
                          {req.location_details?.city || "Any"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Briefcase className="h-4 w-4 text-gray-400 mr-2" />
                      <div>
                        <p className="text-xs text-gray-600">Experience</p>
                        <p className="text-sm font-medium text-gray-900">
                          {req.experience_min || 0}+ yrs
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Required Skills
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(req.skills_mandatory || []).slice(0, 6).map((skill, idx) => (
                        <span
                          key={idx}
                          className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-end pt-4 border-t">
                    <div className="flex items-center text-sm text-gray-600">
                      Client: <strong className="ml-1">{req.client_name || "—"}</strong>
                    </div>
                    {activeTab === "assigned" ? (
                      <button
                        onClick={() => navigate(`/recruiter/requirements/${req.id}`)}
                        className="flex items-center text-blue-600 hover:text-blue-700"
                      >
                        Find Matching Candidates
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">Read-only</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RequirementsList;
