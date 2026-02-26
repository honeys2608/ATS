import api from "../api/axios";

/**
 * Helper to unwrap common API response shapes
 * Supports:
 *  - res.data
 *  - res.data.data
 */
function unwrap(res) {
  return res?.data?.data ?? res?.data;
}

/* =========================
   Vendor Candidates
   ========================= */

/**
 * uploadVendorCandidate
 * - Vendor uploads a candidate (multipart/form-data)
 * - Backend sets source=vendor and vendor_id from JWT
 */
export async function uploadVendorCandidate(formData) {
  if (!formData) throw new Error("formData is required");
  const res = await api.post("/v1/vendor/candidates", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return unwrap(res);
}

/**
 * getVendorCandidates
 * - Returns only candidates uploaded by this vendor
 */
export async function getVendorCandidates() {
  const res = await api.get("/v1/vendor/candidates");
  return unwrap(res);
}

/* =========================
   Vendor Dashboard
   ========================= */

/**
 * getVendorDashboard
 * - Read-only KPIs for vendor
 */
export async function getVendorDashboard() {
  const res = await api.get("/v1/vendor/dashboard");
  return unwrap(res);
}

/* =========================
   Vendor Profile
   ========================= */

/**
 * getVendorProfile
 * - Vendor company/profile details
 */
export async function getVendorProfile() {
  const res = await api.get("/v1/vendor/profile");
  return unwrap(res);
}

/**
 * updateVendorProfile
 * - Limited updates only (contact info, etc.)
 */
export async function updateVendorProfile(payload) {
  if (!payload) throw new Error("payload is required");
  const res = await api.put("/v1/vendor/profile", payload);
  return unwrap(res);
}

/* =========================
   ⭐ BGV MODULE (Vendor)
   ========================= */

/**
 * getAssignedBGVCandidates
 * - Returns candidates assigned to this vendor for BGV
 */
export async function getAssignedBGVCandidates() {
  const res = await api.get("/v1/vendor/bgv/assigned");
  return unwrap(res);
}

/**
 * submitBGVReport
 * - Vendor uploads BGV report + status
 * - multipart/form-data
 */
export async function submitBGVReport(candidateId, formData) {
  if (!candidateId) throw new Error("candidateId is required");
  if (!formData) throw new Error("formData is required");

  const res = await api.post(`/v1/vendor/bgv/${candidateId}/submit`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return unwrap(res);
}
