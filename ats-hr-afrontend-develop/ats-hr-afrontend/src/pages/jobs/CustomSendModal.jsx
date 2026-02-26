/**
 * Custom Send Modal - Customize & Send job details to candidate
 * Allows field selection, preview, copy to clipboard, and save as template
 */
import React, { useState, useEffect } from "react";
import {
  X,
  Copy,
  FileText,
  Save,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import axiosInstance from "../../api/axios";

const AVAILABLE_FIELDS = [
  { key: "job_title", label: "Job Title", default: true },
  { key: "client_name", label: "Client Name", default: true },
  { key: "location", label: "Location", default: true },
  { key: "mode", label: "Work Mode", default: true },
  { key: "experience", label: "Experience", default: true },
  { key: "skills", label: "Required Skills", default: true },
  { key: "budget", label: "CTC / Budget", default: true },
  { key: "duration", label: "Duration", default: false },
  { key: "work_timings", label: "Work Timings", default: false },
  { key: "joining_preference", label: "Joining Preference", default: false },
  { key: "no_of_positions", label: "No of Positions", default: false },
  { key: "jd_text", label: "Job Description", default: true },
];

const CustomSendModal = ({ job, candidate = null, onClose }) => {
  const [selectedFields, setSelectedFields] = useState(
    AVAILABLE_FIELDS.filter((f) => f.default).map((f) => f.key),
  );
  const [templateName, setTemplateName] = useState("");
  const [templates, setTemplates] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await axiosInstance.get(
        `/v1/job-management/requirements/${job.id}/templates`,
      );
      setTemplates(response.data || []);
    } catch (err) {
      console.error("Error fetching templates:", err);
    }
  };

  const handleFieldToggle = (fieldKey) => {
    setSelectedFields((prev) =>
      prev.includes(fieldKey)
        ? prev.filter((k) => k !== fieldKey)
        : [...prev, fieldKey],
    );
  };

  const handleSelectAll = () => {
    setSelectedFields(AVAILABLE_FIELDS.map((f) => f.key));
  };

  const handleDeselectAll = () => {
    setSelectedFields([]);
  };

  const handleApplyTemplate = (template) => {
    setSelectedFields(template.visible_fields || []);
    setShowTemplates(false);
  };

  const generatePreviewText = () => {
    const lines = [];

    if (selectedFields.includes("job_title")) {
      lines.push(`📋 *Job Title:* ${job.title || job.job_title || "N/A"}`);
    }
    if (selectedFields.includes("client_name")) {
      lines.push(`🏢 *Company:* ${job.client?.client_name || "Confidential"}`);
    }
    if (selectedFields.includes("location")) {
      lines.push(`📍 *Location:* ${job.location || "N/A"}`);
    }
    if (selectedFields.includes("mode")) {
      lines.push(
        `💼 *Work Mode:* ${(job.mode || "hybrid").charAt(0).toUpperCase() + (job.mode || "hybrid").slice(1)}`,
      );
    }
    if (selectedFields.includes("experience")) {
      lines.push(`📅 *Experience:* ${job.experience || "N/A"}`);
    }
    if (selectedFields.includes("skills")) {
      const skills = Array.isArray(job.skills)
        ? job.skills.join(", ")
        : job.skills || "N/A";
      lines.push(`🔧 *Skills:* ${skills}`);
    }
    if (selectedFields.includes("budget")) {
      lines.push(`💰 *CTC:* ${job.budget || "As per market standards"}`);
    }
    if (selectedFields.includes("duration")) {
      lines.push(`⏳ *Duration:* ${job.duration || "Permanent"}`);
    }
    if (selectedFields.includes("work_timings")) {
      lines.push(`🕐 *Work Timings:* ${job.work_timings || "Standard"}`);
    }
    if (selectedFields.includes("joining_preference")) {
      lines.push(`📆 *Joining:* ${job.joining_preference || "Flexible"}`);
    }
    if (selectedFields.includes("no_of_positions")) {
      lines.push(`👥 *Positions:* ${job.no_of_positions || 1}`);
    }
    if (selectedFields.includes("jd_text")) {
      lines.push("");
      lines.push("*Job Description:*");
      lines.push(
        job.jd_text || job.description || "Please contact for detailed JD",
      );
    }

    return lines.join("\n");
  };

  const handleCopyToClipboard = async () => {
    const text = generatePreviewText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;

    setSaving(true);
    try {
      await axiosInstance.post(
        `/v1/job-management/requirements/${job.id}/templates`,
        {
          template_name: templateName.trim(),
          visible_fields: selectedFields,
        },
      );
      setSaveSuccess(true);
      setTemplateName("");
      fetchTemplates();
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error("Error saving template:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePDF = () => {
    // Create printable content
    const printContent = `
      <html>
        <head>
          <title>Job Details - ${job.title || job.job_title}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }
            h1 { color: #4F46E5; margin-bottom: 20px; }
            .field { margin-bottom: 12px; }
            .label { font-weight: bold; color: #374151; }
            .value { color: #1F2937; }
            .jd { margin-top: 20px; padding: 15px; background: #F9FAFB; border-radius: 8px; white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <h1>${job.title || job.job_title}</h1>
          ${selectedFields.includes("client_name") ? `<div class="field"><span class="label">Company:</span> <span class="value">${job.client?.client_name || "Confidential"}</span></div>` : ""}
          ${selectedFields.includes("location") ? `<div class="field"><span class="label">Location:</span> <span class="value">${job.location || "N/A"}</span></div>` : ""}
          ${selectedFields.includes("mode") ? `<div class="field"><span class="label">Work Mode:</span> <span class="value">${job.mode || "Hybrid"}</span></div>` : ""}
          ${selectedFields.includes("experience") ? `<div class="field"><span class="label">Experience:</span> <span class="value">${job.experience || "N/A"}</span></div>` : ""}
          ${selectedFields.includes("skills") ? `<div class="field"><span class="label">Skills:</span> <span class="value">${Array.isArray(job.skills) ? job.skills.join(", ") : job.skills}</span></div>` : ""}
          ${selectedFields.includes("budget") ? `<div class="field"><span class="label">CTC:</span> <span class="value">${job.budget || "As per market"}</span></div>` : ""}
          ${selectedFields.includes("duration") ? `<div class="field"><span class="label">Duration:</span> <span class="value">${job.duration || "Permanent"}</span></div>` : ""}
          ${selectedFields.includes("work_timings") ? `<div class="field"><span class="label">Work Timings:</span> <span class="value">${job.work_timings || "Standard"}</span></div>` : ""}
          ${selectedFields.includes("joining_preference") ? `<div class="field"><span class="label">Joining:</span> <span class="value">${job.joining_preference || "Flexible"}</span></div>` : ""}
          ${selectedFields.includes("no_of_positions") ? `<div class="field"><span class="label">Positions:</span> <span class="value">${job.no_of_positions || 1}</span></div>` : ""}
          ${selectedFields.includes("jd_text") ? `<div class="jd"><strong>Job Description:</strong><br/>${job.jd_text || job.description || "N/A"}</div>` : ""}
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Customize & Send to Candidate
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select fields to include in the job summary
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col md:flex-row max-h-[calc(90vh-140px)] overflow-hidden">
          {/* Left - Field Selection */}
          <div className="w-full md:w-1/2 p-4 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
            {/* Saved Templates */}
            {templates.length > 0 && (
              <div className="mb-4">
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="flex items-center justify-between w-full p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-left"
                >
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Saved Templates ({templates.length})
                  </span>
                  {showTemplates ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                {showTemplates && (
                  <div className="mt-2 space-y-2">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleApplyTemplate(template)}
                        className="w-full p-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                      >
                        {template.template_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={handleSelectAll}
                className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
              >
                Select All
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={handleDeselectAll}
                className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
              >
                Deselect All
              </button>
            </div>

            {/* Field Checkboxes */}
            <div className="space-y-2">
              {AVAILABLE_FIELDS.map((field) => (
                <label
                  key={field.key}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedFields.includes(field.key)
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                      : "border-gray-200 dark:border-gray-600 hover:border-indigo-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(field.key)}
                    onChange={() => handleFieldToggle(field.key)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {field.label}
                  </span>
                </label>
              ))}
            </div>

            {/* Save Template */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  onClick={handleSaveTemplate}
                  disabled={!templateName.trim() || saving}
                  className="flex items-center gap-1 px-3 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50"
                >
                  {saveSuccess ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right - Preview */}
          <div className="w-full md:w-1/2 p-4 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Preview
            </h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 min-h-[300px]">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans">
                {generatePreviewText() || "Select fields to generate preview"}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleGeneratePDF}
            className="flex items-center gap-2 px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
          >
            <FileText className="w-4 h-4" />
            Generate PDF
          </button>
          <button
            onClick={handleCopyToClipboard}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy to Clipboard
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomSendModal;
