const FEATURE_NAME_REGEX = /^[A-Za-z0-9 ]+$/;

export const normalizeText = (value) => String(value ?? "").trim();

export const validateFeatureName = (
  value,
  label = "Feature name",
  {
    pattern = FEATURE_NAME_REGEX,
    patternMessage = `${label} can only contain letters, numbers, and spaces.`,
  } = {},
) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return `${label} cannot be empty.`;
  }
  if (!pattern.test(normalized)) {
    return patternMessage;
  }
  return "";
};

export const validateDescription = (
  value,
  { minLength = 20, required = false, label = "Description" } = {},
) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return required ? `${label} cannot be empty.` : "";
  }
  if (normalized.length < minLength) {
    return `${label} must be at least ${minLength} characters.`;
  }
  return "";
};

export const isDuplicateNameInGroup = ({
  list = [],
  name,
  groupValue,
  nameKey = "name",
  groupKey = "group",
}) => {
  const normalizedName = normalizeText(name).toLowerCase();
  if (!normalizedName) return false;

  return list.some((item) => {
    const existingName = normalizeText(item?.[nameKey]).toLowerCase();
    const existingGroup = item?.[groupKey] ?? null;
    const normalizedGroup = groupValue ?? null;
    return existingName === normalizedName && existingGroup === normalizedGroup;
  });
};
