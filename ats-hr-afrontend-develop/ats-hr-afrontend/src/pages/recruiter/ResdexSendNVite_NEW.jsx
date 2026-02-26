import React, { useState } from "react";
import {
  Send,
  ArrowRight,
  CheckCircle,
  Clock,
  MessageSquare,
  X,
  Eye,
  Reply,
  Users,
  Briefcase,
  AlertCircle,
} from "lucide-react";

export default function ResdexSendNVite() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [nViteMessage, setNViteMessage] = useState(
    "Hi {{name}}, We have an exciting opportunity for you!",
  );
  const [nviteHistory, setNviteHistory] = useState([
    {
      id: 1,
      candidateName: "Raj Kumar",
      jobTitle: "React Developer",
      status: "Viewed",
      sentDate: "2026-01-22",
      views: 1,
      responses: 0,
    },
    {
      id: 2,
      candidateName: "Priya Singh",
      jobTitle: "Senior Java Developer",
      status: "Responded",
      sentDate: "2026-01-20",
      views: 2,
      responses: 1,
    },
  ]);

  const mockCandidates = [
    { id: 1, name: "Raj Kumar", experience: 5, location: "Bangalore" },
    { id: 2, name: "Priya Singh", experience: 7, location: "Pune" },
    { id: 3, name: "Amit Patel", experience: 4, location: "Mumbai" },
    { id: 4, name: "Sarah Williams", experience: 6, location: "Delhi" },
  ];

  const mockJobs = [
    { id: 1, title: "React Developer", location: "Bangalore" },
    { id: 2, title: "Senior Java Developer", location: "Pune" },
    { id: 3, title: "Full Stack Engineer", location: "Mumbai" },
    { id: 4, title: "DevOps Engineer", location: "Bangalore" },
  ];

  const handleSelectCandidate = (id) => {
    setSelectedCandidates((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSelectAll = () => {
    if (selectedCandidates.length === mockCandidates.length) {
      setSelectedCandidates([]);
    } else {
      setSelectedCandidates(mockCandidates.map((c) => c.id));
    }
  };

  const handleSelectJob = (id) => {
    setSelectedJob(id);
    setCurrentStep(3);
  };

  const handleSendNVite = () => {
    if (!selectedJob || selectedCandidates.length === 0) {
      alert("Please select a job and candidates");
      return;
    }
    alert(`NVite sent to ${selectedCandidates.length} candidates!`);
    setCurrentStep(1);
    setSelectedCandidates([]);
    setSelectedJob(null);
    setNViteMessage("Hi {{name}}, We have an exciting opportunity for you!");
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Sent":
        return "bg-blue-100 text-blue-800";
      case "Viewed":
        return "bg-yellow-100 text-yellow-800";
      case "Responded":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const selectedJobObj = mockJobs.find((j) => j.id === selectedJob);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* LEFT PANEL - STEPS */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm p-6 sticky top-6">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Send NVite</h2>

            <div className="space-y-4">
              {[
                { step: 1, title: "Select Candidates", icon: "👥" },
                { step: 2, title: "Select Job", icon: "💼" },
                { step: 3, title: "Message", icon: "💬" },
                { step: 4, title: "Confirm", icon: "✓" },
              ].map((item) => (
                <div
                  key={item.step}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                    currentStep === item.step
                      ? "border-purple-600 bg-purple-50"
                      : currentStep > item.step
                        ? "border-green-600 bg-green-50"
                        : "border-gray-200 bg-gray-50"
                  }`}
                  onClick={() =>
                    currentStep >= item.step && setCurrentStep(item.step)
                  }
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{item.icon}</span>
                    <div>
                      <p className="text-xs text-gray-600">Step {item.step}</p>
                      <p className="font-semibold text-gray-900">
                        {item.title}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-semibold text-blue-900 mb-2">
                Selected Candidates
              </p>
              <p className="text-2xl font-bold text-blue-600">
                {selectedCandidates.length}
              </p>
            </div>

            {selectedJobObj && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-semibold text-green-900 mb-2">
                  Selected Job
                </p>
                <p className="font-bold text-green-700">
                  {selectedJobObj.title}
                </p>
                <p className="text-xs text-green-600">
                  {selectedJobObj.location}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL - CONTENT */}
        <div className="lg:col-span-3">
          {/* STEP 1: SELECT CANDIDATES */}
          {currentStep === 1 && (
            <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Select Candidates
                </h3>
                <p className="text-gray-600">
                  Choose candidates to send NVites to
                </p>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      selectedCandidates.length === mockCandidates.length
                    }
                    onChange={handleSelectAll}
                    className="w-5 h-5"
                  />
                  <span className="font-semibold text-gray-900">
                    Select All ({mockCandidates.length})
                  </span>
                </label>
              </div>

              <div className="space-y-3">
                {mockCandidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 transition"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCandidates.includes(candidate.id)}
                      onChange={() => handleSelectCandidate(candidate.id)}
                      className="w-5 h-5"
                    />
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">
                        {candidate.name}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {candidate.experience} yrs · {candidate.location}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setCurrentStep(2)}
                disabled={selectedCandidates.length === 0}
                className="w-full px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                Next <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* STEP 2: SELECT JOB */}
          {currentStep === 2 && (
            <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Select Job
                </h3>
                <p className="text-gray-600">
                  Choose which job you want to send NVites for
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {mockJobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => handleSelectJob(job.id)}
                    className={`p-4 rounded-lg border-2 transition text-left ${
                      selectedJob === job.id
                        ? "border-purple-600 bg-purple-50"
                        : "border-gray-200 hover:border-purple-400"
                    }`}
                  >
                    <h4 className="font-semibold text-gray-900">{job.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{job.location}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: MESSAGE */}
          {currentStep === 3 && (
            <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Customize Message
                </h3>
                <p className="text-gray-600">
                  Edit the NVite message ({{ name }} will be replaced with
                  candidate name)
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  NVite Message
                </label>
                <textarea
                  value={nViteMessage}
                  onChange={(e) => setNViteMessage(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Available variables: {{ name }}, {{ job_title }},{" "}
                  {{ company }}
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Preview
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {nViteMessage.replace("{{name}}", "Raj Kumar")}
                </p>
              </div>

              <button
                onClick={() => setCurrentStep(4)}
                className="w-full px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition flex items-center justify-center gap-2"
              >
                Review <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* STEP 4: CONFIRM */}
          {currentStep === 4 && (
            <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Review & Send
                </h3>
                <p className="text-gray-600">
                  Confirm details before sending NVites
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="text-sm font-semibold text-blue-900 mb-2">
                    Candidates ({selectedCandidates.length})
                  </p>
                  <div className="space-y-1">
                    {mockCandidates
                      .filter((c) => selectedCandidates.includes(c.id))
                      .map((c) => (
                        <p key={c.id} className="text-sm text-blue-800">
                          • {c.name}
                        </p>
                      ))}
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                  <p className="text-sm font-semibold text-green-900 mb-2">
                    Job
                  </p>
                  <p className="text-sm text-green-800">
                    {selectedJobObj?.title}
                  </p>
                  <p className="text-xs text-green-700">
                    {selectedJobObj?.location}
                  </p>
                </div>

                <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
                  <p className="text-sm font-semibold text-purple-900 mb-2">
                    Message Preview
                  </p>
                  <p className="text-sm text-purple-800 whitespace-pre-wrap">
                    {nViteMessage.replace("{{name}}", "Raj Kumar")}
                  </p>
                </div>
              </div>

              <button
                onClick={handleSendNVite}
                className="w-full px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2"
              >
                <Send size={16} />
                Send NVites
              </button>
            </div>
          )}
        </div>
      </div>

      {/* NVITE HISTORY */}
      {nviteHistory.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Recent NVites
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4 font-semibold text-gray-700">
                    Candidate
                  </th>
                  <th className="text-left py-2 px-4 font-semibold text-gray-700">
                    Job
                  </th>
                  <th className="text-left py-2 px-4 font-semibold text-gray-700">
                    Date
                  </th>
                  <th className="text-left py-2 px-4 font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="text-left py-2 px-4 font-semibold text-gray-700">
                    Views
                  </th>
                  <th className="text-left py-2 px-4 font-semibold text-gray-700">
                    Responses
                  </th>
                </tr>
              </thead>
              <tbody>
                {nviteHistory.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">{item.candidateName}</td>
                    <td className="py-3 px-4">{item.jobTitle}</td>
                    <td className="py-3 px-4">{item.sentDate}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                          item.status,
                        )}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Eye size={14} />
                        {item.views}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Reply size={14} />
                        {item.responses}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
