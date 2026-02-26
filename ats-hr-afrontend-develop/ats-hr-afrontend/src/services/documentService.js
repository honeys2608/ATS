// src/services/documentService.js
import api from "../api/axios";

const normalize = (res) => {
  if (!res) return null;
  // prefer res.data.data (API wrapping), then res.data, then raw res
  return res?.data?.data ?? res?.data ?? res;
};

const inferFilenameFromDisposition = (disposition, fallback) => {
  if (!disposition) return fallback;
  // handle common variations of content-disposition
  const match = /filename\*?=(?:UTF-8'')?"?([^";\r\n]+)"?/i.exec(disposition);
  if (match && match[1]) return decodeURIComponent(match[1]);
  return fallback;
};

const documentService = {
  // List employee docs (GET /v1/documents/employees/{employee_id})
  listForEmployee: async (employeeId, params = {}) => {
    const res = await api.get(`/v1/documents/employees/${employeeId}`, {
      params,
    });
    return normalize(res);
  },

  // Upload (POST /v1/documents/employees/{employee_id})
  // config may include { onUploadProgress } to track progress
  uploadForEmployee: async (employeeId, category, formData, config = {}) => {
    const axiosConfig = {
      headers: { "Content-Type": "multipart/form-data" },
      ...config,
    };

    if (config.onUploadProgress) {
      axiosConfig.onUploadProgress = config.onUploadProgress;
    }

    formData.append("category", category);

    const res = await api.post(
      `/v1/documents/employees/${employeeId}`,
      formData,
      axiosConfig
    );

    return normalize(res);
  },

  // Download (GET /v1/documents/{document_id}/download)
  // Returns true after triggering browser download
  download: async (documentId) => {
    const res = await api.get(`/v1/documents/${documentId}/download`, {
      responseType: "blob",
      transformResponse: (r) => r, // 🔥 VERY IMPORTANT (stops JSON parsing)
    });

    const disposition =
      res.headers?.["content-disposition"] ||
      res.headers?.["Content-Disposition"] ||
      "";

    const filenameMatch = /filename\*?=(?:UTF-8'')?([^;\n]+)/i.exec(
      disposition
    );
    const filename = filenameMatch
      ? decodeURIComponent(filenameMatch[1])
      : `document_${documentId}`;

    const blob = new Blob([res.data], {
      type: res.headers["content-type"] || "application/octet-stream",
    });

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", filename); // 🔥 force correct filename
    document.body.appendChild(a);
    a.click();

    a.remove();
    window.URL.revokeObjectURL(url);

    return true;
  },

  // Delete (DELETE /v1/documents/{document_id})
  remove: async (documentId) => {
    const res = await api.delete(`/v1/documents/${documentId}`);
    return normalize(res);
  },

  // Document checklist (GET /v1/documents/employees/{employee_id}/checklist)
  checklist: async (employeeId) => {
    const res = await api.get(
      `/v1/documents/employees/${employeeId}/checklist`
    );
    return normalize(res);
  },

  // Alias used by some components/pages
  checklistForEmployee: async (employeeId) => {
    return documentService.checklist(employeeId);
  },
};

export default documentService;
