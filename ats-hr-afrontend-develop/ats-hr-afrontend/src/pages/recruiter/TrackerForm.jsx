import React, { useState, useEffect } from "react";

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

const STATUS_OPTIONS = [
  "New",
  "In Progress",
  "Submitted",
  "Interview",
  "Offered",
  "Joined",
  "Closed",
];

export default function TrackerForm({ isAdmin, onSubmit }) {
  const [formData, setFormData] = useState({
    recruiterName: "",
    status: "",
    comment: "",
    month: new Date()
      .toLocaleString("default", { month: "short" })
      .toUpperCase(),
    date: new Date().toISOString().split("T")[0],
    clients: "",
    reqJrId: "",
    spocHm: "",
    clientTaBu: "",
    amName: "",
    skills: [],
    candidateName: "",
    contactNumber: "",
    emailId: "",
    currentCompany: "",
    designation: "",
    experienceInField: "",
    totalExperience: "",
    relevantExperience: "",
    currentCtc: "",
    expectedCtc: "",
    noticePeriod: "",
    qualification: "",
    currentLocation: "",
    preferredLocation: "",
    certifications: [],
    vendors: "",
  });

  const [skillInput, setSkillInput] = useState("");
  const [certInput, setCertInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        skills: [...prev.skills, skillInput.trim()],
      }));
      setSkillInput("");
    }
  };

  const handleRemoveSkill = (skill) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skill),
    }));
  };

  const handleAddCert = () => {
    if (
      certInput.trim() &&
      !formData.certifications.includes(certInput.trim())
    ) {
      setFormData((prev) => ({
        ...prev,
        certifications: [...prev.certifications, certInput.trim()],
      }));
      setCertInput("");
    }
  };

  const handleRemoveCert = (cert) => {
    setFormData((prev) => ({
      ...prev,
      certifications: prev.certifications.filter((c) => c !== cert),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic validation
    const requiredFields = [
      "recruiterName",
      "status",
      "month",
      "date",
      "clients",
      "candidateName",
      "contactNumber",
      "emailId",
    ];

    const missingFields = requiredFields.filter((field) => !formData[field]);

    if (missingFields.length > 0) {
      alert(`Please fill in required fields: ${missingFields.join(", ")}`);
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.emailId)) {
      alert("Please enter a valid email address");
      return;
    }

    // Phone validation (Indian format)
    const phoneRegex = /^(\+91)?[6-9]\d{9}$/;
    if (!phoneRegex.test(formData.contactNumber.replace(/\s+/g, ""))) {
      alert("Please enter a valid Indian phone number");
      return;
    }

    setLoading(true);

    try {
      if (onSubmit) {
        await onSubmit(formData);
      }

      // Reset form
      setFormData({
        recruiterName: "",
        status: "",
        comment: "",
        month: new Date()
          .toLocaleString("default", { month: "short" })
          .toUpperCase(),
        date: new Date().toISOString().split("T")[0],
        clients: "",
        reqJrId: "",
        spocHm: "",
        clientTaBu: "",
        amName: "",
        skills: [],
        candidateName: "",
        contactNumber: "",
        emailId: "",
        currentCompany: "",
        designation: "",
        experienceInField: "",
        totalExperience: "",
        relevantExperience: "",
        currentCtc: "",
        expectedCtc: "",
        noticePeriod: "",
        qualification: "",
        currentLocation: "",
        preferredLocation: "",
        certifications: [],
        vendors: "",
      });

      alert("Entry added successfully!");
    } catch (error) {
      alert("Error adding entry. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-6">Add New Tracker Entry</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* BASIC TRACKING INFO */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium mb-4 text-gray-800">
            Basic Tracking Info
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recruiter Name *
              </label>
              <input
                type="text"
                value={formData.recruiterName}
                onChange={(e) =>
                  handleInputChange("recruiterName", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status *
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange("status", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Status</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Comment
              </label>
              <textarea
                value={formData.comment}
                onChange={(e) => handleInputChange("comment", e.target.value)}
                rows={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* REQUIREMENT / CLIENT INFO */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium mb-4 text-gray-800">
            Requirement / Client Info
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Month *
              </label>
              <select
                value={formData.month}
                onChange={(e) => handleInputChange("month", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {MONTHS.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange("date", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Clients *
              </label>
              <input
                type="text"
                value={formData.clients}
                onChange={(e) => handleInputChange("clients", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Req / JR ID
              </label>
              <input
                type="text"
                value={formData.reqJrId}
                onChange={(e) => handleInputChange("reqJrId", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SPOC / HM
              </label>
              <input
                type="text"
                value={formData.spocHm}
                onChange={(e) => handleInputChange("spocHm", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client TA / BU
              </label>
              <input
                type="text"
                value={formData.clientTaBu}
                onChange={(e) =>
                  handleInputChange("clientTaBu", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                AM Name
              </label>
              <input
                type="text"
                value={formData.amName}
                onChange={(e) => handleInputChange("amName", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* SKILL + CANDIDATE INFO */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium mb-4 text-gray-800">
            Skill + Candidate Info
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Skills
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyPress={(e) =>
                    e.key === "Enter" && (e.preventDefault(), handleAddSkill())
                  }
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add skill"
                />
                <button
                  type="button"
                  onClick={handleAddSkill}
                  className="px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-md hover:from-blue-700 hover:to-blue-800 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 shadow-sm transition-all duration-200 font-medium"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {formData.skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      className="text-blue-600 hover:text-blue-800 hover:bg-blue-200 rounded-full w-4 h-4 flex items-center justify-center transition-all duration-150"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Candidate Name *
              </label>
              <input
                type="text"
                value={formData.candidateName}
                onChange={(e) =>
                  handleInputChange("candidateName", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Number *
              </label>
              <input
                type="tel"
                value={formData.contactNumber}
                onChange={(e) =>
                  handleInputChange("contactNumber", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="9876543210"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email ID *
              </label>
              <input
                type="email"
                value={formData.emailId}
                onChange={(e) => handleInputChange("emailId", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
        </div>

        {/* EXPERIENCE DETAILS */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium mb-4 text-gray-800">
            Experience Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Company
              </label>
              <input
                type="text"
                value={formData.currentCompany}
                onChange={(e) =>
                  handleInputChange("currentCompany", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Designation
              </label>
              <input
                type="text"
                value={formData.designation}
                onChange={(e) =>
                  handleInputChange("designation", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Experience in Field
              </label>
              <input
                type="number"
                value={formData.experienceInField}
                onChange={(e) =>
                  handleInputChange("experienceInField", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.5"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Experience
              </label>
              <input
                type="number"
                value={formData.totalExperience}
                onChange={(e) =>
                  handleInputChange("totalExperience", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.5"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Relevant Experience
              </label>
              <input
                type="number"
                value={formData.relevantExperience}
                onChange={(e) =>
                  handleInputChange("relevantExperience", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.5"
              />
            </div>
          </div>
        </div>

        {/* COMPENSATION DETAILS */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium mb-4 text-gray-800">
            Compensation Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current CTC
              </label>
              <input
                type="number"
                value={formData.currentCtc}
                onChange={(e) =>
                  handleInputChange("currentCtc", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected CTC
              </label>
              <input
                type="number"
                value={formData.expectedCtc}
                onChange={(e) =>
                  handleInputChange("expectedCtc", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
              />
            </div>
          </div>
        </div>

        {/* NOTICE & EDUCATION */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium mb-4 text-gray-800">
            Notice & Education
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notice Period (LWD)
              </label>
              <input
                type="date"
                value={formData.noticePeriod}
                onChange={(e) =>
                  handleInputChange("noticePeriod", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Qualification
              </label>
              <input
                type="text"
                value={formData.qualification}
                onChange={(e) =>
                  handleInputChange("qualification", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Location
              </label>
              <input
                type="text"
                value={formData.currentLocation}
                onChange={(e) =>
                  handleInputChange("currentLocation", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preferred Location
              </label>
              <input
                type="text"
                value={formData.preferredLocation}
                onChange={(e) =>
                  handleInputChange("preferredLocation", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* CERTIFICATION + VENDOR */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium mb-4 text-gray-800">
            Certification + Vendor
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Certifications
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={certInput}
                  onChange={(e) => setCertInput(e.target.value)}
                  onKeyPress={(e) =>
                    e.key === "Enter" && (e.preventDefault(), handleAddCert())
                  }
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add certification"
                />
                <button
                  type="button"
                  onClick={handleAddCert}
                  className="px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-md hover:from-blue-700 hover:to-blue-800 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 shadow-sm transition-all duration-200 font-medium"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {formData.certifications.map((cert) => (
                  <span
                    key={cert}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs"
                  >
                    {cert}
                    <button
                      type="button"
                      onClick={() => handleRemoveCert(cert)}
                      className="text-green-600 hover:text-green-800 hover:bg-green-200 rounded-full w-4 h-4 flex items-center justify-center transition-all duration-150"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendors
              </label>
              <input
                type="text"
                value={formData.vendors}
                onChange={(e) => handleInputChange("vendors", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* FORM ACTIONS */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-md hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 shadow-sm transition-all duration-200"
          >
            {loading ? "Adding..." : "Add To Tracker"}
          </button>
        </div>
      </form>
    </div>
  );
}
