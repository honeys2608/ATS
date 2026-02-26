from typing import List, Dict, Any, Optional
from datetime import datetime
import os
import re

try:
    from sentence_transformers import SentenceTransformer
    import numpy as np
    _MODEL_LOADED = True
except ImportError:
    _MODEL_LOADED = False

# Singleton for embedding model
_embedding_model = None

def get_embedding_model():
    global _embedding_model
    if not _MODEL_LOADED:
        return None
    if _embedding_model is None:
        try:
            # Using a small, fast model suitable for local deployment
            _embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        except Exception as e:
            print(f"Error loading embedding model: {e}")
            return None
    return _embedding_model


# ============================================================
# CANDIDATE EMBEDDING (REQUIRED BY candidates.py)
# ============================================================

def generate_embedding(text: str) -> List[float]:
    """Generate embedding for a given text string."""
    model = get_embedding_model()
    if not model or not text:
        # Fallback to dummy vector if model fails to load
        return [0.0] * 384
    
    embedding = model.encode(text)
    return embedding.tolist()

def generate_candidate_embedding(candidate_data: Dict[str, Any]) -> List[float]:
    """
    Generate a rich candidate embedding by combining various profile sections.
    """
    name = candidate_data.get('name', '')
    skills = " ".join(candidate_data.get('skills', [])) if isinstance(candidate_data.get('skills'), list) else str(candidate_data.get('skills', ''))
    experience = str(candidate_data.get('experience', ''))
    bio = candidate_data.get('internal_notes', '') or ''
    
    # Composite text for embedding
    text = f"Candidate: {name}. Skills: {skills}. Experience: {experience}. Notes: {bio}"
    return generate_embedding(text)


# ============================================================
# JOB EMBEDDING (REQUIRED BY jobs.py)
# ============================================================

def generate_job_embedding(job_data: Dict[str, Any]) -> List[float]:
    """Generate job embedding for semantic matching."""
    text = f"Job Title: {job_data.get('title', '')}. Description: {job_data.get('description', '')}. Skills: {job_data.get('skills', '')}"
    return generate_embedding(text)


# ============================================================
# CANDIDATE – JOB FIT SCORING
# ============================================================

def calculate_fit_score(candidate: dict, job: dict) -> float:
    candidate_skills = set(s.lower() for s in candidate.get("skills", []))
    job_skills = set(s.lower() for s in job.get("skills", []))

    if not job_skills:
        return 0.0

    matched = candidate_skills.intersection(job_skills)
    return round((len(matched) / len(job_skills)) * 100, 2)


def generate_fit_explanation(candidate: dict, job: dict) -> str:
    candidate_skills = set(s.lower() for s in candidate.get("skills", []))
    job_skills = set(s.lower() for s in job.get("skills", []))

    matched = candidate_skills.intersection(job_skills)
    missing = job_skills - candidate_skills

    if missing:
        return f"Candidate matches {len(matched)} skills. Missing: {', '.join(missing)}"
    return "Candidate matches all required skills."


# ============================================================
# FAISS INDEX PLACEHOLDER
# ============================================================

def add_to_faiss_index(vector: List[float], metadata: dict | None = None):
    return {
        "status": "added",
        "vector_length": len(vector),
        "metadata": metadata or {}
    }


# ============================================================
# RESUME PARSER
# ============================================================

def parse_resume(text: str) -> Dict[str, Any]:
    """
    Extract key information from resume text
    """
    if not text:
        return {}
    
    # ---- SKILLS EXTRACTION ----
    skills_pattern = r'\b(Python|Java|JavaScript|React|Redux|HTML|CSS|TypeScript|Node|FastAPI|Django|SQL|MongoDB|AWS|Docker|Kubernetes|Git|GitHub|Postman|VS Code|Agile|Scrum|REST APIs|JWT|PostgreSQL|MySQL|Express|Tailwind CSS)\b'
    skills = list(set(re.findall(skills_pattern, text, re.IGNORECASE)))
    
    # ---- NAME EXTRACTION ----
    # Usually at the beginning of resume
    lines = text.split('\n')
    full_name = None
    phone_pattern_check = r'(?:\+91|91)?[-.\s]?(\d{10}|\d{3}[-.\s]?\d{3}[-.\s]?\d{4})'
    for line in lines[:5]:  # Check first 5 lines
        line = line.strip()
        # Skip lines that are phone numbers, email addresses, or URLs
        if line and len(line.split()) >= 2 and len(line) < 50:
            # Exclude if line is mostly digits (phone number)
            if not re.search(phone_pattern_check, line) and not re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', line):
                full_name = line
                break
    
    # ---- EMAIL EXTRACTION ----
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    emails = re.findall(email_pattern, text)
    email = emails[0] if emails else None
    
    # ---- PHONE EXTRACTION ----
    phone_pattern = r'(?:\+91|91)?[-.\s]?(\d{10}|\d{3}[-.\s]?\d{3}[-.\s]?\d{4})'
    phones = re.findall(phone_pattern, text)
    phone = phones[0] if phones else None
    
    # ---- EXPERIENCE EXTRACTION (years) ----
    exp_pattern = r'(\d+)\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp)'
    exp_matches = re.findall(exp_pattern, text, re.IGNORECASE)
    experience_years = None
    if exp_matches:
        experience_years = int(exp_matches[0])
    else:
        # Try to extract from work history dates
        date_pattern = r'(\d{4})\s*[-–]\s*(?:Present|Current|\d{4})'
        date_matches = re.findall(date_pattern, text)
        if date_matches:
            try:
                latest_start = int(date_matches[0])
                experience_years = 2024 - latest_start
            except:
                pass
    
    # ---- EDUCATION EXTRACTION ----
    education = None
    edu_keywords = ['bachelor', 'master', 'degree', 'b.tech', 'm.tech', 'bsc', 'msc', 'mba', 'ca', 'b.e.', 'b.a.', 'm.a.']
    edu_pattern = r'(?:' + '|'.join(edu_keywords) + r')[^.\n]*(?:in|–|-|,)[^.\n]*'
    edu_matches = re.findall(edu_pattern, text, re.IGNORECASE)
    if edu_matches:
        education = edu_matches[0].strip()
    
    # ---- LINKEDIN/GITHUB/PORTFOLIO EXTRACTION ----
    linkedin_match = re.search(r'linkedin\.com/in/([^\s/]+)', text, re.IGNORECASE)
    linkedin_url = f"https://linkedin.com/in/{linkedin_match.group(1)}" if linkedin_match else None
    
    github_match = re.search(r'github\.com/([^\s/]+)', text, re.IGNORECASE)
    github_url = f"https://github.com/{github_match.group(1)}" if github_match else None
    
    portfolio_match = re.search(r'(https?://[^\s]+(?:portfolio|personal|website)[^\s]*)', text, re.IGNORECASE)
    portfolio_url = portfolio_match.group(1) if portfolio_match else None
    
    # ---- LOCATION EXTRACTION ----
    # Look for city names or location indicators
    location_keywords = ['bangalore', 'bengaluru', 'hyderabad', 'mumbai', 'delhi', 'pune', 'goa', 'remote', 'london', 'san francisco', 'new york', 'austin', 'texas']
    current_location = None
    for keyword in location_keywords:
        if keyword.lower() in text.lower():
            current_location = keyword.title()
            break
    
    return {
        "full_name": full_name,
        "email": email,
        "phone": phone,
        "skills": [s.lower() for s in skills],
        "experience_years": experience_years,
        "education": education,
        "current_location": current_location,
        "linkedin_url": linkedin_url,
        "github_url": github_url,
        "portfolio_url": portfolio_url,
        "raw_text": text[:1000]
    }


def parse_job_description(text: str) -> Dict[str, Any]:
    """
    Extract structured fields from a Job Description text.
    """
    if not text:
        return {}

    # 1. Skills extraction (Mandatory vs Good to Have)
    skills_pattern = r'\b(Python|Java|JavaScript|React|Angular|Vue|Node|Express|FastAPI|Django|Flask|SQL|PostgreSQL|MongoDB|AWS|Azure|GCP|Docker|Kubernetes|TypeScript|Redux|Tailwind|Bootstrap|HTML|CSS|Git|Scrum|Agile|Machine Learning|AI|Data Science|NLP|Computer Vision)\b'
    all_found_skills = list(set(re.findall(skills_pattern, text, re.IGNORECASE)))
    
    # Simple heuristic: skills early in the JD or mentioned with "mandatory/required" are mandatory
    mandatory = []
    good_to_have = []
    
    lines = text.split('\n')
    for skill in all_found_skills:
        skill_lower = skill.lower()
        is_mandatory = False
        for line in lines:
            if skill_lower in line.lower():
                if any(k in line.lower() for k in ["mandatory", "required", "must have", "essential", "minimum"]):
                    is_mandatory = True
                    break
        if is_mandatory:
            mandatory.append(skill)
        else:
            good_to_have.append(skill)

    # 2. Experience Extraction
    exp_pattern = r'(\d+)\s*(?:-|to)\s*(\d+)\s*(?:years|yrs)'
    exp_matches = re.search(exp_pattern, text, re.IGNORECASE)
    exp_min = 0
    exp_max = None
    if exp_matches:
        exp_min = int(exp_matches.group(1))
        exp_max = int(exp_matches.group(2))
    else:
        single_exp_pattern = r'(\d+)\+?\s*(?:years?|yrs?)'
        single_match = re.search(single_exp_pattern, text, re.IGNORECASE)
        if single_match:
            exp_min = int(single_match.group(1))

    # 3. CTC/Salary Extraction (INR/LPA)
    ctc_pattern = r'(\d+)\s*(?:-|to)\s*(\d+)\s*(?:LPA|L|lakhs)'
    ctc_matches = re.search(ctc_pattern, text, re.IGNORECASE)
    ctc_min = None
    ctc_max = None
    if ctc_matches:
        ctc_min = float(ctc_matches.group(1))
        ctc_max = float(ctc_matches.group(2))

    # 4. Work Mode
    work_mode = "On-site"
    if "remote" in text.lower():
        work_mode = "Remote"
    elif "hybrid" in text.lower():
        work_mode = "Hybrid"

    # 5. Location
    location_keywords = ['bangalore', 'bengaluru', 'hyderabad', 'mumbai', 'delhi', 'pune', 'chennai', 'noida', 'gurgaon']
    city = ""
    for loc in location_keywords:
        if loc in text.lower():
            city = loc.title()
            break

    # 6. Urgency
    urgency = "Normal"
    if any(k in text.lower() for k in ["immediate", "urgent", "asap", "priority"]):
        urgency = "Immediate"

    return {
        "skills_mandatory": mandatory,
        "skills_good_to_have": good_to_have,
        "experience_min": exp_min,
        "experience_max": exp_max,
        "ctc_min": ctc_min,
        "ctc_max": ctc_max,
        "location_details": {"city": city, "type": work_mode},
        "urgency": urgency,
        "interview_stages": ["Screening", "Technical", "HR"] # Default stages
    }


# ============================================================
# JOB DESCRIPTION BASED QUESTION TEMPLATES (INDIA READY)
# ============================================================

JD_QUESTION_TEMPLATES = {
    "intro": [
        "Please introduce yourself and briefly explain your background relevant to this job."
    ],
    "job_understanding": [
        "What do you understand about this role based on the job description?",
        "What kind of work do you think you will be doing in this role?"
    ],
    "skill": [
        "The job requires {skill}. Can you explain your experience with it?",
        "How have you used {skill} in your previous work or studies?",
        "What challenges have you faced while working with {skill}?"
    ],
    "responsibility": [
        "This role involves {responsibility}. How would you handle this task?",
        "Have you worked on tasks related to {responsibility}? Please explain."
    ],
    "behavioral": [
        "Describe a challenge you faced while doing similar work and how you handled it.",
        "How do you handle pressure or difficult situations at work?",
        "How do you ensure accuracy and responsibility in your work?"
    ],
    "closing": [
        "Do you have any questions about this role or the work involved?"
    ]
}


# ============================================================
# AI CHAT INTERVIEWER (JOB DESCRIPTION BASED)
# ============================================================

class AIInterviewer:

    def __init__(self, job_data: Dict[str, Any], resume_text: str | None = None):
        self.job = job_data
        self.resume = parse_resume(resume_text) if resume_text else {"skills": []}

        self.job_skills = [s.lower() for s in (job_data.get("skills") or [])]

        self.questions = self._build_question_flow()
        self.current_index = 0

        self.conversation_history: List[Dict[str, Any]] = []
        self.scores: List[float] = []

    # --------------------------------------------------------
    # EXTRACT RESPONSIBILITIES FROM JD
    # --------------------------------------------------------

    def _extract_responsibilities(self) -> List[str]:
        desc = (self.job.get("description") or "").lower()

        keywords = [
            "handle", "manage", "maintain", "support", "coordinate",
            "develop", "build", "sell", "resolve", "prepare",
            "analyze", "design", "implement", "debug", "assist"
        ]

        found = []
        for k in keywords:
            if k in desc:
                found.append(k)

        return found[:2]

    # --------------------------------------------------------
    # QUESTION FLOW (JD BASED)
    # --------------------------------------------------------

    def _build_question_flow(self) -> List[str]:
        questions = []

        responsibilities = self._extract_responsibilities()

        # 1️⃣ Intro
        questions.append(random.choice(JD_QUESTION_TEMPLATES["intro"]))

        # 2️⃣ Job understanding
        questions.append(random.choice(JD_QUESTION_TEMPLATES["job_understanding"]))

        # 3️⃣ Skill based (from JD skills)
        if self.job_skills:
            skill = random.choice(self.job_skills)
            questions.append(
                random.choice(JD_QUESTION_TEMPLATES["skill"]).format(skill=skill)
            )
        else:
            questions.append(
                "What skills do you think are important to perform well in this role?"
            )

        # 4️⃣ Responsibility based (from JD description)
        if responsibilities:
            resp = random.choice(responsibilities)
            questions.append(
                random.choice(JD_QUESTION_TEMPLATES["responsibility"]).format(
                    responsibility=resp
                )
            )

        # 5️⃣ Behavioral
        questions.append(random.choice(JD_QUESTION_TEMPLATES["behavioral"]))

        # 6️⃣ Closing
        questions.append(random.choice(JD_QUESTION_TEMPLATES["closing"]))

        return questions

    # --------------------------------------------------------
    # FLOW CONTROL
    # --------------------------------------------------------

    def get_next_question(self):
        if self.current_index >= len(self.questions):
            return None

        text = self.questions[self.current_index]
        self.current_index += 1
        self._add_history("ai", text)

        return {
            "question_text": text,
            "is_last_question": self.current_index >= len(self.questions)
        }

    def submit_answer(self, answer: str):
        self._add_history("candidate", answer)

        score, feedback = self._score_answer(answer)
        self.scores.append(score)

        next_q = self.get_next_question()

        return {
            "partial_score": score,
            "feedback": feedback,
            "next_question": next_q["question_text"] if next_q else None,
            "is_last_question": next_q["is_last_question"] if next_q else True
        }

    # --------------------------------------------------------
    # SCORING (JOB SKILL BASED)
    # --------------------------------------------------------

    def _score_answer(self, answer: str):
        answer_lower = answer.lower()
        word_count = len(answer.split())

        keyword_hits = sum(1 for skill in self.job_skills if skill in answer_lower)
        keyword_score = min(10, keyword_hits * 3)
        length_score = min(5, word_count / 20)

        final_score = round(keyword_score * 0.6 + length_score * 0.4, 2)

        feedback = []
        if keyword_hits == 0:
            feedback.append("Answer does not reference job-related skills")
        if word_count < 20:
            feedback.append("Answer is too brief and lacks explanation")
        if not feedback:
            feedback.append("Relevant and well-structured answer")

        return final_score, feedback

    # --------------------------------------------------------
    # FINAL SUMMARY
    # --------------------------------------------------------

    def get_final_score(self) -> float:
        if not self.scores:
            return 0.0
        return round(sum(self.scores) / len(self.scores), 2)

    def get_summary(self):
        score = self.get_final_score()

        return {
            "final_score": score,
            "recommendation": (
                "hire" if score >= 7 else
                "consider" if score >= 5 else
                "no-hire"
            ),
            "strengths": [] if score < 7 else ["Good job-relevant understanding"],
            "weaknesses": [] if score >= 7 else ["Needs stronger job knowledge"],
            "transcript": self.conversation_history
        }

    # --------------------------------------------------------
    # HISTORY
    # --------------------------------------------------------

    def _add_history(self, role: str, content: str):
        self.conversation_history.append({
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat()
        })


# ============================================================
# AI VIDEO INTERVIEW QUESTION TEMPLATES (SPEAK-BASED)
# ============================================================

VIDEO_QUESTION_TEMPLATES = {
    "intro": [
        "Please introduce yourself in 60 seconds.",
        "Tell us about yourself and your professional background."
    ],

    "motivation": [
        "Why are you interested in this role?",
        "What made you apply for this position?"
    ],

    "skill_speak": [
        "Please explain how you have practically used {skill} in your work.",
        "Talk about your hands-on experience with {skill}."
    ],

    "scenario": [
        "Describe a challenging situation you faced at work and how you handled it.",
        "Tell us about a problem you solved under pressure."
    ],

    "communication": [
        "Explain a complex task you have done, in a simple way.",
        "How do you communicate issues or delays to your team?"
    ]
}


# ============================================================
# AI VIDEO INTERVIEW QUESTION GENERATOR (JOB BASED)
# ============================================================

def generate_video_interview_questions(job: Dict[str, Any]) -> List[str]:
    """
    Generates SPEAK-based questions for AI video interview.
    These questions are DIFFERENT from chat interview.
    """

    questions = []

    title = (job.get("title") or "").lower()
    skills = job.get("skills") or []

    # 1️⃣ Intro
    questions.append(random.choice(VIDEO_QUESTION_TEMPLATES["intro"]))

    # 2️⃣ Motivation
    questions.append(random.choice(VIDEO_QUESTION_TEMPLATES["motivation"]))

    # 3️⃣ Skill-based (spoken explanation)
    if skills:
        skill = random.choice(skills)
        questions.append(
            random.choice(VIDEO_QUESTION_TEMPLATES["skill_speak"]).format(skill=skill)
        )

    # 4️⃣ Scenario (common for all Indian jobs)
    questions.append(random.choice(VIDEO_QUESTION_TEMPLATES["scenario"]))

    # 5️⃣ Communication
    questions.append(random.choice(VIDEO_QUESTION_TEMPLATES["communication"]))

    return questions  # max 5 (video fatigue avoid)
