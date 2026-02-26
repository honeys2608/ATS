export const BULK_UPLOAD_LIMITS = {
  maxFileSizeBytes: 10 * 1024 * 1024,
  maxRows: 5000,
  allowedExtensions: [".xlsx"],
};

export function validateBulkUploadFile(file) {
  if (!file) {
    return { ok: false, message: "Please select a file." };
  }

  const lowerName = file.name.toLowerCase();
  const hasAllowedExt = BULK_UPLOAD_LIMITS.allowedExtensions.some((ext) =>
    lowerName.endsWith(ext),
  );
  if (!hasAllowedExt) {
    return { ok: false, message: "Only .xlsx files are allowed." };
  }

  if (file.size > BULK_UPLOAD_LIMITS.maxFileSizeBytes) {
    return { ok: false, message: "File size exceeds 10MB limit." };
  }

  return { ok: true, message: "" };
}
