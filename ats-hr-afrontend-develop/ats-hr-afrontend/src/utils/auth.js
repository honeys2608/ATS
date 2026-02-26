// src/utils/auth.js
export function getCandidateToken() {
  // Check common keys used in this project
  return (
    localStorage.getItem("candidate_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    null
  );
}

export function getAuthHeader() {
  const t = getCandidateToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export function saveCandidateToken(token) {
  // prefer candidate_token so it doesn't conflict with admin token
  localStorage.setItem("candidate_token", token);
}

export function removeCandidateToken() {
  localStorage.removeItem("candidate_token");
}
