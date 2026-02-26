const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value) => {
  if (!value) return [];
  return normalize(value).split(" ").filter(Boolean);
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

export class SemanticSearchEngine {
  buildCandidateText(candidate) {
    const skills = toArray(candidate.skills)
      .map((skill) => toStringValue(skill))
      .join(" ");
    const certs = toArray(candidate.certifications)
      .map((cert) => toStringValue(cert))
      .join(" ");
    const companies = [
      candidate.current_employer,
      candidate.current_company,
      candidate.previous_employers,
    ].join(" ");
    const education = [
      candidate.education,
      candidate.degree,
      candidate.major,
      candidate.institution,
      candidate.university,
    ].join(" ");

    return normalize(
      [
        candidate.full_name,
        candidate.name,
        candidate.email,
        candidate.job_title,
        candidate.current_role,
        skills,
        certs,
        companies,
        education,
        candidate.current_location,
        candidate.preferred_location,
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
    const normalizedList = candidateList.map((item) => normalize(toStringValue(item)));
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
      const text = this.buildCandidateText(candidate);
      const skills = toArray(candidate.skills).map((skill) => toStringValue(skill));
      const certs = toArray(candidate.certifications);
      const companies = toArray(
        candidate.current_employer || candidate.current_company || candidate.previous_employers,
      );

      const experience = toNumber(
        candidate.experience_years || candidate.experience || candidate.total_experience,
      );
      const salaryValue = toNumber(
        filters.salary?.type === "current"
          ? candidate.current_ctc || candidate.current_salary
          : candidate.expected_ctc || candidate.expected_salary,
      );

      const candidateLocation = normalize(
        candidate.current_location || candidate.location || "",
      );
      const preferredLocation = normalize(candidate.preferred_location || "");
      const remoteFlag =
        candidate.remote ||
        candidate.remote_ready ||
        candidate.preferred_work_mode === "remote";
      const candidateRoleText = normalize(
        [candidate.job_title, candidate.current_role, candidate.designation].join(" "),
      );
      const candidateEducationText = normalize(
        [
          candidate.education,
          candidate.degree,
          candidate.major,
          candidate.institution,
          candidate.university,
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

      const matchesQuery =
        queryTokens.length === 0 ||
        queryTokens.some((token) => text.includes(token));

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

      if (filters.activeCertsOnly && certs.length > 0) {
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
        const queryMatches = queryTokens.filter((token) => text.includes(token)).length;
        addWeightedScore(35, queryMatches / queryTokens.length);

        const querySkillMatches = queryTokens.filter((token) =>
          normalizedSkills.some((skill) => skill.includes(token)),
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
