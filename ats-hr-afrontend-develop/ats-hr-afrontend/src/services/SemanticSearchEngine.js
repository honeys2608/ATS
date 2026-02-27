const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const QUERY_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "or",
  "for",
  "with",
  "in",
  "on",
  "of",
  "to",
  "the",
  "year",
  "years",
  "yr",
  "yrs",
]);

const ROLE_QUERY_TERMS = new Set([
  "engineer",
  "developer",
  "manager",
  "analyst",
  "consultant",
  "architect",
  "lead",
  "specialist",
  "designer",
  "administrator",
  "recruiter",
  "executive",
  "officer",
  "intern",
  "qa",
  "tester",
]);

const tokenize = (value) => {
  if (!value) return [];
  return normalize(value)
    .split(" ")
    .filter(Boolean)
    .filter((token) => !QUERY_STOP_WORDS.has(token));
};

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value
      .split(/,|;|\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const toStringValue = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    return value.name || value.title || value.skill || value.label || "";
  }
  return String(value);
};

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  const numeric = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isNaN(numeric) ? null : numeric;
};

const normalizeFilterTerms = (value) =>
  toArray(value)
    .map((item) => normalize(toStringValue(item)))
    .filter(Boolean);

const candidateId = (candidate) =>
  candidate.id ||
  candidate._id ||
  candidate.candidate_id ||
  candidate.candidateId ||
  candidate.public_id ||
  candidate.email;

const valueOr = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    return value;
  }
  return null;
};

const parseMaybeJson = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const extractParsedCandidateData = (candidate = {}) => {
  const parsedResume = valueOr(candidate.parsed_resume, candidate.parsedResume);
  const parsedResumeData = valueOr(
    parsedResume?.data,
    parsedResume?.parsed_data,
    parsedResume?.parsedData,
    parsedResume,
  );
  const parsed = valueOr(
    candidate.parsed_data_json,
    candidate.parsedDataJson,
    candidate.parsed_data,
    candidate.parsedData,
    candidate.resume_data,
    candidate.resumeData,
    parsedResumeData,
  );
  const normalized = parseMaybeJson(parsed) || {};
  return normalized && typeof normalized === "object" ? normalized : {};
};

const mergeListValues = (...values) =>
  values
    .flatMap((value) => toArray(value))
    .filter((item) => item !== null && item !== undefined);

const editDistance = (source, target, maxDistance = 2) => {
  const a = String(source || "");
  const b = String(target || "");
  if (!a || !b) return Number.MAX_SAFE_INTEGER;
  if (Math.abs(a.length - b.length) > maxDistance) return Number.MAX_SAFE_INTEGER;

  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = dp[0];
    dp[0] = i;
    let minRowValue = dp[0];
    for (let j = 1; j <= b.length; j += 1) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = Math.min(prev + 1, dp[j] + 1, dp[j - 1] + 1);
      }
      prev = temp;
      if (dp[j] < minRowValue) minRowValue = dp[j];
    }
    if (minRowValue > maxDistance) return Number.MAX_SAFE_INTEGER;
  }
  return dp[b.length];
};

const tokenMatchesText = (token, normalizedText, normalizedTextTokens = []) => {
  if (!token) return false;
  if (normalizedText.includes(token)) return true;
  if (token.length < 5) return false;

  const maxDistance = token.length >= 8 ? 2 : 1;
  return normalizedTextTokens.some((candidateToken) => {
    if (!candidateToken) return false;
    if (Math.abs(candidateToken.length - token.length) > maxDistance) return false;
    return editDistance(token, candidateToken, maxDistance) <= maxDistance;
  });
};

export class SemanticSearchEngine {
  buildCandidateText(candidate) {
    const parsed = extractParsedCandidateData(candidate);
    const workHistory = toArray(
      valueOr(
        candidate.work_history,
        candidate.employment_history,
        candidate.experience_history,
        parsed.work_history,
        parsed.work_experience,
        parsed.experience,
      ),
    );
    const firstWorkEntry = Array.isArray(workHistory) && workHistory.length > 0
      ? workHistory[0] || {}
      : {};
    const skills = mergeListValues(
      candidate.skills,
      parsed.skills,
      candidate.skill_set,
      candidate.top_skills,
    )
      .map((skill) => toStringValue(skill))
      .join(" ");
    const certs = mergeListValues(
      candidate.certifications,
      parsed.certifications,
      candidate.certifications_text,
      parsed.certifications_text,
    )
      .map((cert) => toStringValue(cert))
      .join(" ");
    const companies = [
      candidate.current_employer,
      candidate.current_company,
      candidate.previous_employers,
      parsed.current_employer,
      parsed.current_company,
      parsed.previous_employers,
      firstWorkEntry.company,
      firstWorkEntry.employer,
      firstWorkEntry.organization,
    ].join(" ");
    const education = [
      candidate.education,
      candidate.degree,
      candidate.major,
      candidate.institution,
      candidate.university,
      parsed.education,
      parsed.degree,
      parsed.major,
      parsed.institution,
      parsed.university,
    ].join(" ");

    return normalize(
      [
        candidate.full_name,
        candidate.name,
        candidate.email,
        candidate.job_title,
        candidate.current_role,
        candidate.designation,
        candidate.designation_title,
        candidate.title,
        candidate.professional_summary,
        candidate.summary,
        candidate.profile_headline,
        candidate.experience_years,
        candidate.total_experience,
        parsed.full_name,
        parsed.name,
        parsed.job_title,
        parsed.current_role,
        parsed.designation,
        parsed.title,
        parsed.professional_summary,
        parsed.summary,
        parsed.profile_headline,
        parsed.experience_years,
        parsed.total_experience,
        candidate.resume_text,
        parsed.resume_text,
        skills,
        certs,
        companies,
        education,
        candidate.current_location,
        candidate.preferred_location,
        candidate.location,
        candidate.city,
        parsed.current_location,
        parsed.preferred_location,
        parsed.location,
        parsed.city,
      ].join(" "),
    );
  }

  matchesArray(candidateValue, filters = []) {
    if (!filters || filters.length === 0) return true;
    const candidateText = normalize(candidateValue);
    return filters.some((filter) => candidateText.includes(normalize(filter)));
  }

  matchesList(candidateList, filters = []) {
    if (!filters || filters.length === 0) return true;
    const normalizedList = toArray(candidateList).map((item) =>
      normalize(toStringValue(item)),
    );
    return filters.some((filter) =>
      normalizedList.some((item) => item.includes(normalize(filter))),
    );
  }

  matchesRange(value, min, max) {
    if (min === "" && max === "") return true;
    if (value === null || value === undefined) return false;
    if (min !== "" && value < Number(min)) return false;
    if (max !== "" && value > Number(max)) return false;
    return true;
  }

  isActiveCertification(cert) {
    if (!cert) return false;
    const expiry = cert.expiry_date || cert.expiryDate;
    if (!expiry) return true;
    const date = new Date(expiry);
    return Number.isNaN(date.getTime()) ? true : date.getTime() > Date.now();
  }

  search(query, filters = {}, candidates = []) {
    const queryTokens = tokenize(query);
    const keywordTerms = normalizeFilterTerms(filters.keywords);
    const companyTerms = normalizeFilterTerms(filters.companies);
    const designationTerms = normalizeFilterTerms(filters.designations);
    const certificationTerms = normalizeFilterTerms(filters.certifications);
    const educationDegreeTerms = normalizeFilterTerms(filters.education?.degrees);
    const educationMajorTerms = normalizeFilterTerms(filters.education?.majors);
    const educationInstitutionTerms = normalizeFilterTerms(filters.education?.institutions);

    const hasExperienceFilter =
      filters.experience?.min !== "" || filters.experience?.max !== "";
    const hasSalaryFilter = filters.salary?.min !== "" || filters.salary?.max !== "";
    const hasCurrentLocationFilter = Boolean(
      String(filters.location?.current || "").trim(),
    );
    const hasPreferredLocationFilter = Boolean(
      String(filters.location?.preferred || "").trim(),
    );
    const hasRemoteFilter = Boolean(filters.location?.remote);
    const hasActiveSearchSignals =
      queryTokens.length > 0 ||
      keywordTerms.length > 0 ||
      hasExperienceFilter ||
      hasSalaryFilter ||
      hasCurrentLocationFilter ||
      hasPreferredLocationFilter ||
      hasRemoteFilter ||
      companyTerms.length > 0 ||
      designationTerms.length > 0 ||
      certificationTerms.length > 0 ||
      educationDegreeTerms.length > 0 ||
      educationMajorTerms.length > 0 ||
      educationInstitutionTerms.length > 0 ||
      Boolean(filters.activeCertsOnly);

    const results = [];

    for (const candidate of candidates) {
      const parsed = extractParsedCandidateData(candidate);
      const text = this.buildCandidateText(candidate);
      const workHistory = toArray(
        valueOr(
          candidate.work_history,
          candidate.employment_history,
          candidate.experience_history,
          parsed.work_history,
          parsed.work_experience,
          parsed.experience,
        ),
      );
      const firstWorkEntry = Array.isArray(workHistory) && workHistory.length > 0
        ? workHistory[0] || {}
        : {};
      const skills = mergeListValues(
        candidate.skills,
        parsed.skills,
        candidate.skill_set,
        candidate.top_skills,
      ).map((skill) => toStringValue(skill));
      const certs = mergeListValues(
        candidate.certifications,
        parsed.certifications,
        candidate.certifications_text,
        parsed.certifications_text,
      );
      const companies = mergeListValues(
        candidate.current_employer,
        candidate.current_company,
        candidate.previous_employers,
        parsed.current_employer,
        parsed.current_company,
        parsed.previous_employers,
        firstWorkEntry.company,
        firstWorkEntry.employer,
        firstWorkEntry.organization,
      );

      const experience = toNumber(valueOr(
        candidate.experience_years,
        candidate.experience,
        candidate.total_experience,
        candidate.relevant_experience_years,
        parsed.experience_years,
        parsed.experience,
        parsed.total_experience,
        parsed.relevant_experience_years,
        firstWorkEntry.total_experience,
        firstWorkEntry.experience,
      ));
      const salaryValue = toNumber(
        filters.salary?.type === "current"
          ? valueOr(
            candidate.current_ctc,
            candidate.current_salary,
            parsed.current_ctc,
            parsed.current_salary,
            firstWorkEntry.current_ctc,
            firstWorkEntry.salary,
          )
          : valueOr(
            candidate.expected_ctc,
            candidate.expected_salary,
            parsed.expected_ctc,
            parsed.expected_salary,
            firstWorkEntry.expected_ctc,
          ),
      );

      const candidateLocation = normalize(
        valueOr(
          candidate.current_location,
          candidate.location,
          candidate.city,
          parsed.current_location,
          parsed.location,
          parsed.city,
          "",
        ),
      );
      const preferredLocation = normalize(
        valueOr(candidate.preferred_location, parsed.preferred_location, ""),
      );
      const remoteFlag =
        candidate.remote ||
        candidate.remote_ready ||
        candidate.preferred_work_mode === "remote" ||
        parsed.remote ||
        parsed.remote_ready ||
        parsed.preferred_work_mode === "remote";
      const candidateRoleText = normalize(
        [
          candidate.job_title,
          candidate.current_role,
          candidate.designation,
          candidate.designation_title,
          candidate.title,
          parsed.job_title,
          parsed.current_role,
          parsed.designation,
          parsed.designation_title,
          parsed.title,
          firstWorkEntry.role,
          firstWorkEntry.designation,
          firstWorkEntry.title,
        ].join(" "),
      );
      const candidateEducationText = normalize(
        [
          candidate.education,
          candidate.degree,
          candidate.major,
          candidate.institution,
          candidate.university,
          parsed.education,
          parsed.degree,
          parsed.major,
          parsed.institution,
          parsed.university,
        ].join(" "),
      );
      const normalizedSkills = skills.map((skill) => normalize(skill));
      const normalizedCompanies = companies.map((company) =>
        normalize(toStringValue(company)),
      );
      const certNames = certs.map((cert) =>
        typeof cert === "string" ? cert : cert.name || "",
      );
      const normalizedCertNames = certNames.map((certName) => normalize(certName));
      const textTokens = tokenize(text);
      const roleTokens = tokenize(candidateRoleText);

      const matchedQueryTokens = queryTokens.filter((token) =>
        tokenMatchesText(token, text, textTokens),
      );
      const roleQueryTokens = queryTokens.filter((token) => ROLE_QUERY_TERMS.has(token));
      if (roleQueryTokens.length > 0) {
        const hasRoleMatch = roleQueryTokens.some((token) =>
          tokenMatchesText(token, candidateRoleText, roleTokens),
        );
        if (!hasRoleMatch) continue;
      }

      const minimumTokenMatches = queryTokens.length <= 2
        ? queryTokens.length
        : Math.min(queryTokens.length, Math.max(2, Math.ceil(queryTokens.length * 0.6)));
      const matchesQuery =
        queryTokens.length === 0 ||
        matchedQueryTokens.length >= minimumTokenMatches;

      if (!matchesQuery) continue;

      if (!this.matchesRange(experience, filters.experience?.min, filters.experience?.max)) {
        continue;
      }

      if (
        filters.location?.current &&
        !candidateLocation.includes(normalize(filters.location.current))
      ) {
        continue;
      }

      if (
        filters.location?.preferred &&
        !preferredLocation.includes(normalize(filters.location.preferred))
      ) {
        continue;
      }

      if (hasRemoteFilter && !remoteFlag) continue;

      if (!this.matchesRange(salaryValue, filters.salary?.min, filters.salary?.max)) {
        continue;
      }

      if (!this.matchesList(skills, keywordTerms)) continue;
      if (!this.matchesList(companies, companyTerms)) continue;
      if (!this.matchesArray(candidateRoleText, designationTerms)) {
        continue;
      }

      if (educationDegreeTerms.length) {
        if (!this.matchesArray(candidateEducationText, educationDegreeTerms)) continue;
      }
      if (educationMajorTerms.length) {
        if (!this.matchesArray(candidateEducationText, educationMajorTerms)) continue;
      }
      if (educationInstitutionTerms.length) {
        if (!this.matchesArray(candidateEducationText, educationInstitutionTerms)) continue;
      }

      if (certificationTerms.length) {
        if (!this.matchesList(certNames, certificationTerms)) continue;
      }

      if (filters.activeCertsOnly) {
        if (certs.length === 0) continue;
        const activeCerts = certs.filter((cert) => this.isActiveCertification(cert));
        if (activeCerts.length === 0) continue;
      }

      let weightedScore = 0;
      let weightedMax = 0;

      const addWeightedScore = (weight, ratio) => {
        if (!Number.isFinite(weight) || weight <= 0) return;
        const normalizedRatio = Number.isFinite(ratio)
          ? Math.max(0, Math.min(1, ratio))
          : 0;
        weightedMax += weight;
        weightedScore += normalizedRatio * weight;
      };

      if (queryTokens.length > 0) {
        const queryMatches = matchedQueryTokens.length;
        addWeightedScore(35, queryMatches / queryTokens.length);

        const querySkillMatches = queryTokens.filter((token) =>
          normalizedSkills.some((skill) => tokenMatchesText(token, skill, tokenize(skill))),
        ).length;
        addWeightedScore(15, querySkillMatches / queryTokens.length);
      }

      if (keywordTerms.length > 0) {
        const keywordMatches = keywordTerms.filter((term) =>
          normalizedSkills.some((skill) => skill.includes(term)) || text.includes(term),
        ).length;
        addWeightedScore(25, keywordMatches / keywordTerms.length);
      }

      if (designationTerms.length > 0) {
        const designationMatches = designationTerms.filter((term) =>
          candidateRoleText.includes(term),
        ).length;
        addWeightedScore(10, designationMatches / designationTerms.length);
      }

      if (companyTerms.length > 0) {
        const companyMatches = companyTerms.filter((term) =>
          normalizedCompanies.some((company) => company.includes(term)),
        ).length;
        addWeightedScore(8, companyMatches / companyTerms.length);
      }

      if (certificationTerms.length > 0) {
        const certificationMatches = certificationTerms.filter((term) =>
          normalizedCertNames.some((certName) => certName.includes(term)),
        ).length;
        addWeightedScore(8, certificationMatches / certificationTerms.length);
      }

      if (educationDegreeTerms.length > 0) {
        const degreeMatches = educationDegreeTerms.filter((term) =>
          candidateEducationText.includes(term),
        ).length;
        addWeightedScore(6, degreeMatches / educationDegreeTerms.length);
      }

      if (educationMajorTerms.length > 0) {
        const majorMatches = educationMajorTerms.filter((term) =>
          candidateEducationText.includes(term),
        ).length;
        addWeightedScore(5, majorMatches / educationMajorTerms.length);
      }

      if (educationInstitutionTerms.length > 0) {
        const institutionMatches = educationInstitutionTerms.filter((term) =>
          candidateEducationText.includes(term),
        ).length;
        addWeightedScore(6, institutionMatches / educationInstitutionTerms.length);
      }

      if (hasCurrentLocationFilter) {
        addWeightedScore(
          6,
          candidateLocation.includes(normalize(filters.location.current)) ? 1 : 0,
        );
      }
      if (hasPreferredLocationFilter) {
        addWeightedScore(
          5,
          preferredLocation.includes(normalize(filters.location.preferred)) ? 1 : 0,
        );
      }
      if (hasRemoteFilter) addWeightedScore(4, remoteFlag ? 1 : 0);
      if (hasExperienceFilter) addWeightedScore(5, experience !== null ? 1 : 0);
      if (hasSalaryFilter) addWeightedScore(4, salaryValue !== null ? 1 : 0);
      if (filters.activeCertsOnly) {
        const activeCertCount = certs.filter((cert) => this.isActiveCertification(cert)).length;
        addWeightedScore(3, activeCertCount > 0 ? 1 : 0);
      }

      const score = weightedMax > 0
        ? Math.min(100, Math.max(0, Math.round((weightedScore / weightedMax) * 100)))
        : 0;

      results.push({
        ...candidate,
        id: candidateId(candidate),
        semantic_score: hasActiveSearchSignals ? score : 0,
      });
    }

    return results;
  }
}
