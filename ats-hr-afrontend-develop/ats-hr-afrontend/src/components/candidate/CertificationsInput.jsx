import React from "react";
import { FiPlus, FiTrash2, FiCheckCircle } from "react-icons/fi";
import { validateText, validateURL } from "../../utils/validators";

/* ================= CERTIFICATIONS INPUT COMPONENT ================= */

export function CertificationsInput({
  certifications,
  onChange,
  editable,
  errors,
}) {
  const addCertification = () => {
    onChange([
      ...certifications,
      {
        name: "",
        organization: "",
        issueDate: "",
        expiryDate: "",
        credentialId: "",
        credentialUrl: "",
      },
    ]);
  };

  const removeCertification = (index) => {
    onChange(certifications.filter((_, i) => i !== index));
  };

  const handleChange = (index, field, value) => {
    const updated = [...certifications];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const validateCertification = (cert, index) => {
    const newErrors = {};

    // Certification Name validation (required)
    const nameErr = validateText(cert.name, "Certification Name", 2, 100);
    if (nameErr) newErrors[`${index}.name`] = nameErr;

    // Organization validation (required)
    const orgErr = validateText(cert.organization, "Organization", 2, 100);
    if (orgErr) newErrors[`${index}.organization`] = orgErr;

    // Issue date validation (cannot be future)
    if (cert.issueDate) {
      const issueDate = new Date(cert.issueDate);
      if (issueDate > new Date()) {
        newErrors[`${index}.issueDate`] = "Issue date cannot be in the future";
      }
    }

    // Expiry date validation (must be after issue date)
    if (cert.issueDate && cert.expiryDate) {
      const issueDate = new Date(cert.issueDate);
      const expiryDate = new Date(cert.expiryDate);
      if (expiryDate <= issueDate) {
        newErrors[`${index}.expiryDate`] =
          "Expiry date must be after issue date";
      }
    }

    // Credential URL validation (optional but must be valid if provided)
    if (cert.credentialUrl) {
      const urlErr = validateURL(cert.credentialUrl, "Credential URL");
      if (urlErr) newErrors[`${index}.credentialUrl`] = urlErr;
    }

    return newErrors;
  };

  // Combine local validation with passed errors
  const allErrors = { ...errors };
  certifications.forEach((cert, index) => {
    const validationErrors = validateCertification(cert, index);
    Object.assign(allErrors, validationErrors);
  });

  const hasCertifications =
    certifications.length > 0 &&
    certifications.some(
      (c) => c.name.trim() !== "" || c.organization.trim() !== "",
    );

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-gray-800">
            Certifications
          </span>
          {hasCertifications && editable && (
            <FiCheckCircle
              className="w-5 h-5 text-green-500"
              title="Certifications added"
            />
          )}
        </div>
        {editable && (
          <button
            type="button"
            onClick={addCertification}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <FiPlus className="w-4 h-4" />
            Add Certification
          </button>
        )}
      </div>

      {certifications.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500 mb-2">No certifications added yet</p>
          {editable && (
            <button
              type="button"
              onClick={addCertification}
              className="text-purple-600 font-medium hover:text-purple-700"
            >
              + Add your first certification
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {certifications.map((cert, index) => (
            <div
              key={index}
              className="bg-gray-50 rounded-lg p-4 border border-gray-200 relative"
            >
              {editable && certifications.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCertification(index)}
                  className="absolute top-2 right-2 p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remove certification"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Certification Name (Required) */}
                <div>
                  <label className="text-sm font-semibold text-gray-800 block mb-2">
                    Certification Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={cert.name}
                    onChange={(e) =>
                      handleChange(index, "name", e.target.value)
                    }
                    disabled={!editable}
                    placeholder="e.g., AWS Certified Solutions Architect"
                    className={`w-full px-4 py-2.5 border-2 rounded-lg transition-all focus:outline-none font-medium ${
                      allErrors[`${index}.name`]
                        ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-300 focus:border-red-400"
                        : "border-gray-300 bg-white hover:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/30 focus:border-[#415A77]"
                    } ${!editable ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "text-gray-800"}`}
                  />
                  {allErrors[`${index}.name`] && (
                    <span className="text-red-600 text-xs mt-1.5 font-medium flex items-center gap-1">
                      <span>⚠</span> {allErrors[`${index}.name`]}
                    </span>
                  )}
                </div>

                {/* Issuing Organization (Required) */}
                <div>
                  <label className="text-sm font-semibold text-gray-800 block mb-2">
                    Issuing Organization <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={cert.organization}
                    onChange={(e) =>
                      handleChange(index, "organization", e.target.value)
                    }
                    disabled={!editable}
                    placeholder="e.g., Amazon Web Services"
                    className={`w-full px-4 py-2.5 border-2 rounded-lg transition-all focus:outline-none font-medium ${
                      allErrors[`${index}.organization`]
                        ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-300 focus:border-red-400"
                        : "border-gray-300 bg-white hover:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/30 focus:border-[#415A77]"
                    } ${!editable ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "text-gray-800"}`}
                  />
                  {allErrors[`${index}.organization`] && (
                    <span className="text-red-600 text-xs mt-1.5 font-medium flex items-center gap-1">
                      <span>⚠</span> {allErrors[`${index}.organization`]}
                    </span>
                  )}
                </div>

                {/* Issue Date (Month/Year) */}
                <div>
                  <label className="text-sm font-semibold text-gray-800 block mb-2">
                    Issue Date
                  </label>
                  <input
                    type="month"
                    value={cert.issueDate}
                    onChange={(e) =>
                      handleChange(index, "issueDate", e.target.value)
                    }
                    disabled={!editable}
                    className={`w-full px-4 py-2.5 border-2 rounded-lg transition-all focus:outline-none font-medium ${
                      allErrors[`${index}.issueDate`]
                        ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-300 focus:border-red-400"
                        : "border-gray-300 bg-white hover:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/30 focus:border-[#415A77]"
                    } ${!editable ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "text-gray-800"}`}
                  />
                  {allErrors[`${index}.issueDate`] && (
                    <span className="text-red-600 text-xs mt-1.5 font-medium flex items-center gap-1">
                      <span>⚠</span> {allErrors[`${index}.issueDate`]}
                    </span>
                  )}
                </div>

                {/* Expiry Date (Month/Year) */}
                <div>
                  <label className="text-sm font-semibold text-gray-800 block mb-2">
                    Expiry Date
                  </label>
                  <input
                    type="month"
                    value={cert.expiryDate}
                    onChange={(e) =>
                      handleChange(index, "expiryDate", e.target.value)
                    }
                    disabled={!editable}
                    className={`w-full px-4 py-2.5 border-2 rounded-lg transition-all focus:outline-none font-medium ${
                      allErrors[`${index}.expiryDate`]
                        ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-300 focus:border-red-400"
                        : "border-gray-300 bg-white hover:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/30 focus:border-[#415A77]"
                    } ${!editable ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "text-gray-800"}`}
                  />
                  {allErrors[`${index}.expiryDate`] && (
                    <span className="text-red-600 text-xs mt-1.5 font-medium flex items-center gap-1">
                      <span>⚠</span> {allErrors[`${index}.expiryDate`]}
                    </span>
                  )}
                </div>

                {/* Credential ID (Optional) */}
                <div>
                  <label className="text-sm font-semibold text-gray-800 block mb-2">
                    Credential ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={cert.credentialId}
                    onChange={(e) =>
                      handleChange(index, "credentialId", e.target.value)
                    }
                    disabled={!editable}
                    placeholder="e.g., AWS-12345678"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#415A77]/30 focus:border-[#415A77] font-medium text-gray-800 disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>

                {/* Credential URL (Optional) */}
                <div>
                  <label className="text-sm font-semibold text-gray-800 block mb-2">
                    Credential URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={cert.credentialUrl}
                    onChange={(e) =>
                      handleChange(index, "credentialUrl", e.target.value)
                    }
                    disabled={!editable}
                    placeholder="https://www.credly.com/badges/..."
                    className={`w-full px-4 py-2.5 border-2 rounded-lg transition-all focus:outline-none font-medium ${
                      allErrors[`${index}.credentialUrl`]
                        ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-300 focus:border-red-400"
                        : "border-gray-300 bg-white hover:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/30 focus:border-[#415A77]"
                    } ${!editable ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "text-gray-800"}`}
                  />
                  {allErrors[`${index}.credentialUrl`] && (
                    <span className="text-red-600 text-xs mt-1.5 font-medium flex items-center gap-1">
                      <span>⚠</span> {allErrors[`${index}.credentialUrl`]}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CertificationsInput;
