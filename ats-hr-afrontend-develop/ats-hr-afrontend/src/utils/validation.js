export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function validateEmail(value) {
  const email = normalizeEmail(value);
  if (!email) return "Email is required";
  if (email.length > 254) return "Enter a valid email address";
  if (email.includes(" ") || email.includes("..")) return "Enter a valid email address";
  if ((email.match(/@/g) || []).length !== 1) return "Enter a valid email address";
  const [local, domain] = email.split("@");
  if (!local || !domain || !domain.includes(".")) return "Enter a valid email address";
  if (!/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(email)) {
    return "Enter a valid email address";
  }
  return "";
}

export function validatePassword(value) {
  const pwd = String(value || "");
  if (!pwd) return "Password is required";
  if (pwd.length < 8 || pwd.length > 128) return "Password must be 8 to 128 characters";
  return "";
}

export function validateFirstName(value) {
  const name = String(value || "").trim();
  if (!name) return "First name is required";
  if (name.length < 2) return "First name must be at least 2 characters";
  return "";
}
