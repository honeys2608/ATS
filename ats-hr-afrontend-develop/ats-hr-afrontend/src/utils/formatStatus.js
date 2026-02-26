export const formatStatus = (value, overrides = {}) => {
  if (value === null || value === undefined || value === "") return "—";

  const raw = String(value);
  const normalized = raw.toLowerCase();

  if (overrides[normalized]) return overrides[normalized];

  const withSpaces = raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();

  if (!withSpaces) return "—";

  const acronyms = new Set(["am", "hr", "ai", "qa", "ui", "ux", "id"]);
  const lowerWords = new Set(["to", "and", "or", "of", "in", "on", "for", "by"]);

  return withSpaces
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (acronyms.has(word)) return word.toUpperCase();
      if (index > 0 && lowerWords.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
};
