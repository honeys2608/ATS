const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "have",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "with",
  "will",
  "you",
  "your",
  "our",
  "their",
  "this",
  "these",
  "those",
  "must",
  "should",
  "can",
  "may",
  "role",
  "candidate",
  "candidates",
  "experience",
  "years",
  "year",
  "build",
  "strong",
  "working",
  "work",
  "knowledge",
  "good",
  "excellent",
  "using",
  "based",
]);

const IMPORTANT_PHRASES = [
  "machine learning",
  "deep learning",
  "search engine optimization",
  "search engine optimisation",
  "natural language processing",
  "computer vision",
  "data science",
  "data engineering",
  "full stack",
  "frontend development",
  "backend development",
];

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const toSkillArray = (skills) => {
  if (!skills) return [];
  if (Array.isArray(skills)) {
    return skills
      .map((skill) =>
        typeof skill === "string"
          ? skill
          : skill?.name || skill?.title || skill?.label || "",
      )
      .map((skill) => normalize(skill))
      .filter(Boolean);
  }
  if (typeof skills === "string") {
    return skills
      .split(/,|;|\n/)
      .map((skill) => normalize(skill))
      .filter(Boolean);
  }
  return [];
};

const tokenize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

const dedupePush = (target, value) => {
  const normalized = normalize(value);
  if (!normalized) return;
  if (target.includes(normalized)) return;
  target.push(normalized);
};

export function extractJobSearchKeywords(job, options = {}) {
  const maxKeywords = options.maxKeywords || 12;
  const maxQueryKeywords = options.maxQueryKeywords || 6;

  const title = String(job?.title || "").trim();
  const location = String(job?.location || "").trim();
  const jdText = [job?.description, job?.jd_text].filter(Boolean).join(" ");
  const combinedText = [title, jdText].filter(Boolean).join(" ");
  const lowerCombinedText = normalize(combinedText);

  const keywords = [];

  const skills = toSkillArray(job?.skills);
  skills.forEach((skill) => dedupePush(keywords, skill));

  IMPORTANT_PHRASES.forEach((phrase) => {
    if (lowerCombinedText.includes(phrase)) {
      dedupePush(keywords, phrase);
    }
  });

  const tokenCounts = new Map();
  tokenize(combinedText).forEach((token) => {
    const plainToken = token.replace(/[^a-z0-9]/g, "");
    if (!plainToken || plainToken.length < 3) return;
    if (STOP_WORDS.has(plainToken)) return;
    tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
  });

  const rankedTokens = [...tokenCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token);

  rankedTokens.forEach((token) => dedupePush(keywords, token));

  const finalKeywords = keywords.slice(0, maxKeywords);
  const query = [title, ...finalKeywords.slice(0, maxQueryKeywords), location]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    query,
    keywords: finalKeywords,
  };
}
