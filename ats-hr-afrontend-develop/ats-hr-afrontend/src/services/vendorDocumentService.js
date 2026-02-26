import api from "../api/axios";

/**
 * Helper to unwrap API responses
 * Supports:
 *  - res.data
 *  - res.data.data
 */
function unwrap(res) {
  return res?.data?.data ?? res?.data;
}

/* =========================
   Vendor Documents
   ========================= */

/**
 * uploadVendorDocument
 * - Vendor uploads compliance document
 * - multipart/form-data
 */
export async function uploadVendorDocument(formData) {
  if (!formData) throw new Error("formData is required");

  const res = await api.post("/v1/vendor/documents", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return unwrap(res);
}

/**
 * getVendorDocuments
 * - Returns documents uploaded by vendor
 */
export async function getVendorDocuments() {
  const res = await api.get("/v1/vendor/documents");
  return unwrap(res);
}
