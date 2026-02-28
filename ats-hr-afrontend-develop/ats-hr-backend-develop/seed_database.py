import sys
import hashlib
import secrets
from datetime import datetime, timedelta
from sqlalchemy import inspect
from app.db import SessionLocal, engine
from app import models

def get_password_hash(password):
    salt = secrets.token_hex(16)
    hash_value = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()
    return f"{salt}:{hash_value}"

def seed_roles_safe(db):
    required_roles = [
        "account_manager",
        "accounts",
        "admin",
        "candidate",
        "candidate2",
        "ceo",
        "consultant",
        "consultant_support",
        "employee",
        "finance_officer",
        "internal_hr",
        "recruiter",
        "recruiter2",
        "super_admin",
    ]

    role_model = getattr(models, "Role", None)
    if role_model is None:
        print("⚠️ Role model not found on models. Skipping safe role seed.")
        return

    try:
        table_name = getattr(role_model, "__tablename__", "roles")
        if not inspect(db.bind).has_table(table_name):
            print(f"⚠️ Table '{table_name}' not found. Skipping safe role seed.")
            return
    except Exception as e:
        print(f"⚠️ Unable to inspect roles table. Skipping safe role seed: {e}")
        return

    try:
        existing_roles = {
            str(name).strip().lower()
            for (name,) in db.query(role_model.name).all()
            if name
        }
        missing_roles = [r for r in required_roles if r.lower() not in existing_roles]

        if not missing_roles:
            print("✅ Roles already present. No missing roles to seed.")
            return

        for role_name in missing_roles:
            db.add(role_model(name=role_name))
        db.commit()
        print(f"✅ Seeded missing roles safely: {', '.join(missing_roles)}")
    except Exception as e:
        db.rollback()
        print(f"⚠️ Failed safe role seed. Rolled back role inserts: {e}")

def seed_database():
    models.Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    seed_roles_safe(db)
    
    print("Clearing existing data...")
    db.query(models.CommunicationLog).delete()
    db.query(models.LeaveRequest).delete()
    db.query(models.LeaveBalance).delete()
    db.query(models.SystemSettings).delete()
    db.query(models.InterviewScore).delete()
    db.query(models.HumanReview).delete()
    db.query(models.Interview).delete()
    db.query(models.OnboardingTask).delete()
    db.query(models.PerformanceReview).delete()
    db.query(models.ExitInterview).delete()
    db.query(models.Alumni).delete()
    db.query(models.Employee).delete()
    db.query(models.JobApplication).delete()
    db.query(models.Lead).delete()
    db.query(models.Campaign).delete()
    db.query(models.Candidate).delete()
    db.query(models.Job).delete()
    db.query(models.Invoice).delete()
    db.query(models.User).delete()
    db.commit()
    
    print("Creating users...")
    users_data = [
        {"username": "admin", "email": "admin@akshuhr.com", "password": "admin123", "role": "admin", "full_name": "System Administrator"},
        {"username": "recruiter", "email": "recruiter@akshuhr.com", "password": "recruiter123", "role": "recruiter", "full_name": "Sarah Johnson"},
        {"username": "manager", "email": "manager@akshuhr.com", "password": "manager123", "role": "admin", "full_name": "Michael Chen"},
        {"username": "employee", "email": "employee@akshuhr.com", "password": "employee123", "role": "employee", "full_name": "Emily Davis"}
    ]
    
    users = {}
    for user_data in users_data:
        hashed_password = get_password_hash(user_data["password"])
        new_user = models.User(
            username=user_data["username"],
            email=user_data["email"],
            hashed_password=hashed_password,
            role=user_data["role"],
            full_name=user_data["full_name"]
        )
        db.add(new_user)
        db.flush()
        users[user_data["username"]] = new_user
        print(f"  Created user: {user_data['username']}")
    
    print("Creating jobs...")
    jobs_data = [
        {
            "title": "Senior Full Stack Developer",
            "description": "Looking for an experienced full-stack developer proficient in React and Python",
            "skills": ["React", "Python", "FastAPI", "PostgreSQL", "AWS"],
            "min_experience": 3,
            "max_experience": 7,
            "location": "San Francisco, CA",
            "department": "Engineering",
            "embedding_vector": [0.2, 0.4, 0.6, 0.8, 0.5],
            "status": "active",
            "is_active": True
        },
        {
            "title": "Data Scientist",
            "description": "Seeking a data scientist with ML expertise and Python skills",
            "skills": ["Python", "Machine Learning", "TensorFlow", "Statistics", "SQL"],
            "min_experience": 2,
            "max_experience": 5,
            "location": "Remote",
            "department": "Data Science",
            "embedding_vector": [0.3, 0.5, 0.7, 0.4, 0.9],
            "status": "active",
            "is_active": True
        },
        {
            "title": "Product Manager",
            "description": "Experienced PM to lead product development initiatives",
            "skills": ["Product Strategy", "Agile", "Stakeholder Management", "Analytics"],
            "min_experience": 5,
            "max_experience": 10,
            "location": "New York, NY",
            "department": "Product",
            "embedding_vector": [0.4, 0.3, 0.8, 0.6, 0.7],
            "status": "active",
            "is_active": True
        },
        {
            "title": "Frontend Developer",
            "description": "React specialist for building modern web applications",
            "skills": ["React", "JavaScript", "TypeScript", "CSS", "HTML"],
            "min_experience": 2,
            "max_experience": 5,
            "location": "Austin, TX",
            "department": "Engineering",
            "embedding_vector": [0.5, 0.6, 0.4, 0.7, 0.3],
            "status": "active",
            "is_active": True
        }
    ]
    
    jobs = []
    for idx, job_data in enumerate(jobs_data, 1):
        job = models.Job(
            job_id=f"ORG-J-{idx:04d}",
            **job_data,
            created_by=users["recruiter"].id,
            is_active=True
        )
        db.add(job)
        db.flush()
        jobs.append(job)
        print(f"  Created job: {job_data['title']} ({job.job_id})")
    
    print("Creating campaigns...")
    campaigns_data = [
        {
            "job_id": jobs[0].id,
            "platform": "LinkedIn",
            "campaign_name": "Senior Full Stack Dev - LinkedIn Sponsored",
            "utm_source": "linkedin",
            "utm_medium": "sponsored_post",
            "utm_campaign": "fullstack_q4_2025",
            "budget": 2000.0,
            "impressions": 15000,
            "clicks": 450,
            "applications": 0,
            "start_date": datetime.utcnow() - timedelta(days=15),
            "end_date": datetime.utcnow() + timedelta(days=15),
            "status": "active"
        },
        {
            "job_id": jobs[0].id,
            "platform": "Indeed",
            "campaign_name": "Full Stack Developer - Indeed Premium",
            "utm_source": "indeed",
            "utm_medium": "job_board",
            "utm_campaign": "fullstack_q4_2025",
            "budget": 1500.0,
            "impressions": 8500,
            "clicks": 280,
            "applications": 0,
            "start_date": datetime.utcnow() - timedelta(days=20),
            "end_date": datetime.utcnow() + timedelta(days=10),
            "status": "active"
        },
        {
            "job_id": jobs[1].id,
            "platform": "Twitter",
            "campaign_name": "Data Scientist - Twitter Ads",
            "utm_source": "twitter",
            "utm_medium": "promoted_tweet",
            "utm_campaign": "datascience_hiring",
            "budget": 1200.0,
            "impressions": 22000,
            "clicks": 380,
            "applications": 0,
            "start_date": datetime.utcnow() - timedelta(days=10),
            "end_date": datetime.utcnow() + timedelta(days=20),
            "status": "active"
        },
        {
            "job_id": jobs[2].id,
            "platform": "Facebook",
            "campaign_name": "Product Manager - Facebook Jobs",
            "utm_source": "facebook",
            "utm_medium": "job_listing",
            "utm_campaign": "pm_recruitment",
            "budget": 800.0,
            "impressions": 12000,
            "clicks": 320,
            "applications": 0,
            "start_date": datetime.utcnow() - timedelta(days=7),
            "end_date": datetime.utcnow() + timedelta(days=23),
            "status": "active"
        },
        {
            "job_id": jobs[3].id,
            "platform": "Instagram",
            "campaign_name": "Frontend Dev - Instagram Stories",
            "utm_source": "instagram",
            "utm_medium": "story_ad",
            "utm_campaign": "frontend_hiring",
            "budget": 600.0,
            "impressions": 9500,
            "clicks": 195,
            "applications": 0,
            "start_date": datetime.utcnow() - timedelta(days=5),
            "end_date": datetime.utcnow() + timedelta(days=25),
            "status": "active"
        }
    ]
    
    campaigns = []
    for campaign_data in campaigns_data:
        campaign = models.Campaign(**campaign_data)
        db.add(campaign)
        db.flush()
        campaigns.append(campaign)
        print(f"  Created campaign: {campaign_data['campaign_name']} on {campaign_data['platform']}")
    
    print("Creating leads...")
    leads_data = [
        {
            "campaign_id": campaigns[0].id,
            "full_name": "Michael Zhang",
            "email": "michael.zhang@email.com",
            "phone": "+1-555-0201",
            "location": "San Francisco, CA",
            "linkedin_url": "https://linkedin.com/in/michaelzhang",
            "source": "LinkedIn Sponsored Post",
            "utm_params": {"utm_source": "linkedin", "utm_medium": "sponsored_post", "utm_campaign": "fullstack_q4_2025"},
            "status": "new",
            "score": 75
        },
        {
            "campaign_id": campaigns[0].id,
            "full_name": "Sarah Williams",
            "email": "sarah.williams@email.com",
            "phone": "+1-555-0202",
            "location": "Seattle, WA",
            "linkedin_url": "https://linkedin.com/in/sarahwilliams",
            "source": "LinkedIn Sponsored Post",
            "utm_params": {"utm_source": "linkedin", "utm_medium": "sponsored_post", "utm_campaign": "fullstack_q4_2025"},
            "status": "contacted",
            "score": 82
        },
        {
            "campaign_id": campaigns[1].id,
            "full_name": "James Rodriguez",
            "email": "james.rodriguez@email.com",
            "phone": "+1-555-0203",
            "location": "Austin, TX",
            "linkedin_url": "https://linkedin.com/in/jamesrodriguez",
            "source": "Indeed Job Board",
            "utm_params": {"utm_source": "indeed", "utm_medium": "job_board", "utm_campaign": "fullstack_q4_2025"},
            "status": "qualified",
            "score": 88
        },
        {
            "campaign_id": campaigns[2].id,
            "full_name": "Aisha Patel",
            "email": "aisha.patel@email.com",
            "phone": "+1-555-0204",
            "location": "Boston, MA",
            "source": "Twitter Promoted Tweet",
            "utm_params": {"utm_source": "twitter", "utm_medium": "promoted_tweet", "utm_campaign": "datascience_hiring"},
            "status": "new",
            "score": 71
        },
        {
            "campaign_id": campaigns[2].id,
            "full_name": "Kevin Chen",
            "email": "kevin.chen@email.com",
            "phone": "+1-555-0205",
            "location": "Remote",
            "linkedin_url": "https://linkedin.com/in/kevinchen",
            "source": "Twitter Promoted Tweet",
            "utm_params": {"utm_source": "twitter", "utm_medium": "promoted_tweet", "utm_campaign": "datascience_hiring"},
            "status": "contacted",
            "score": 79
        },
        {
            "campaign_id": campaigns[3].id,
            "full_name": "Emily Johnson",
            "email": "emily.johnson@email.com",
            "phone": "+1-555-0206",
            "location": "New York, NY",
            "linkedin_url": "https://linkedin.com/in/emilyjohnson",
            "source": "Facebook Jobs",
            "utm_params": {"utm_source": "facebook", "utm_medium": "job_listing", "utm_campaign": "pm_recruitment"},
            "status": "qualified",
            "score": 85
        },
        {
            "campaign_id": campaigns[4].id,
            "full_name": "David Martinez",
            "email": "david.martinez@email.com",
            "phone": "+1-555-0207",
            "location": "Austin, TX",
            "source": "Instagram Story Ad",
            "utm_params": {"utm_source": "instagram", "utm_medium": "story_ad", "utm_campaign": "frontend_hiring"},
            "status": "new",
            "score": 68
        },
        {
            "campaign_id": campaigns[4].id,
            "full_name": "Lisa Anderson",
            "email": "lisa.anderson@email.com",
            "phone": "+1-555-0208",
            "location": "Portland, OR",
            "linkedin_url": "https://linkedin.com/in/lisaanderson",
            "source": "Instagram Story Ad",
            "utm_params": {"utm_source": "instagram", "utm_medium": "story_ad", "utm_campaign": "frontend_hiring"},
            "status": "contacted",
            "score": 76
        }
    ]
    
    leads = []
    for lead_data in leads_data:
        lead = models.Lead(**lead_data, created_at=datetime.utcnow() - timedelta(days=secrets.randbelow(10)))
        db.add(lead)
        db.flush()
        leads.append(lead)
        print(f"  Created lead: {lead_data['full_name']} from {lead_data['source']}")
    
    print("Creating candidates...")
    candidates_data = [
        {
            "full_name": "Alex Thompson",
            "email": "alex.thompson@email.com",
            "phone": "+1-555-0101",
            "parsed_resume": {
                "skills": ["React", "Python", "FastAPI", "Docker", "AWS"],
                "education": [{"degree": "BS Computer Science", "university": "Stanford", "year": 2018}],
                "experience": [
                    {"company": "Tech Corp", "role": "Full Stack Developer", "duration": "3 years", "description": "Built scalable web applications"}
                ]
            },
            "embedding_vector": [0.25, 0.45, 0.65, 0.75, 0.55],
            "fit_score": 92,
            "fit_explanation": {
                "top_factors": [
                    {"factor": "Strong React and Python skills", "weight": 0.35},
                    {"factor": "3+ years relevant experience", "weight": 0.30},
                    {"factor": "AWS cloud experience", "weight": 0.25}
                ]
            },
            "applied_job_id": jobs[0].id,
            "status": "new",
            "source": "LinkedIn"
        },
        {
            "full_name": "Priya Sharma",
            "email": "priya.sharma@email.com",
            "phone": "+1-555-0102",
            "parsed_resume": {
                "skills": ["Python", "Machine Learning", "TensorFlow", "Pandas", "SQL"],
                "education": [{"degree": "MS Data Science", "university": "MIT", "year": 2020}],
                "experience": [
                    {"company": "AI Startup", "role": "ML Engineer", "duration": "2.5 years", "description": "Built ML models for prediction"}
                ]
            },
            "embedding_vector": [0.35, 0.55, 0.75, 0.45, 0.85],
            "fit_score": 88,
            "fit_explanation": {
                "top_factors": [
                    {"factor": "Strong ML and Python background", "weight": 0.40},
                    {"factor": "Relevant MS degree", "weight": 0.30},
                    {"factor": "Hands-on TensorFlow experience", "weight": 0.20}
                ]
            },
            "applied_job_id": jobs[1].id,
            "status": "screening",
            "source": "Indeed"
        },
        {
            "full_name": "Robert Kim",
            "email": "robert.kim@email.com",
            "phone": "+1-555-0103",
            "parsed_resume": {
                "skills": ["Product Strategy", "Agile", "SQL", "Analytics", "Leadership"],
                "education": [{"degree": "MBA", "university": "Harvard", "year": 2015}],
                "experience": [
                    {"company": "Enterprise Inc", "role": "Senior PM", "duration": "6 years", "description": "Led multiple product launches"}
                ]
            },
            "embedding_vector": [0.45, 0.35, 0.85, 0.65, 0.75],
            "fit_score": 85,
            "fit_explanation": {
                "top_factors": [
                    {"factor": "6 years PM experience", "weight": 0.35},
                    {"factor": "Product strategy expertise", "weight": 0.30},
                    {"factor": "MBA from top school", "weight": 0.25}
                ]
            },
            "applied_job_id": jobs[2].id,
            "status": "screened",
            "source": "Referral"
        },
        {
            "full_name": "Jessica Martinez",
            "email": "jessica.martinez@email.com",
            "phone": "+1-555-0104",
            "parsed_resume": {
                "skills": ["React", "JavaScript", "TypeScript", "Redux", "Tailwind CSS"],
                "education": [{"degree": "BS Software Engineering", "university": "UC Berkeley", "year": 2019}],
                "experience": [
                    {"company": "Web Agency", "role": "Frontend Dev", "duration": "3 years", "description": "Built responsive UIs"}
                ]
            },
            "embedding_vector": [0.55, 0.65, 0.45, 0.75, 0.35],
            "fit_score": 90,
            "fit_explanation": {
                "top_factors": [
                    {"factor": "Expert React developer", "weight": 0.40},
                    {"factor": "TypeScript proficiency", "weight": 0.30},
                    {"factor": "Modern CSS frameworks", "weight": 0.20}
                ]
            },
            "applied_job_id": jobs[3].id,
            "status": "verified",
            "source": "Company Website"
        },
        {
            "full_name": "David Lee",
            "email": "david.lee@email.com",
            "phone": "+1-555-0105",
            "parsed_resume": {
                "skills": ["Java", "Spring Boot", "Microservices", "Docker", "Kubernetes"],
                "education": [{"degree": "BS Computer Science", "university": "Georgia Tech", "year": 2017}],
                "experience": [
                    {"company": "FinTech Co", "role": "Backend Engineer", "duration": "4 years", "description": "Built scalable backend systems"}
                ]
            },
            "embedding_vector": [0.3, 0.4, 0.5, 0.6, 0.7],
            "fit_score": 75,
            "fit_explanation": {
                "top_factors": [
                    {"factor": "Backend development experience", "weight": 0.30},
                    {"factor": "Microservices architecture", "weight": 0.25},
                    {"factor": "Container orchestration", "weight": 0.20}
                ]
            },
            "applied_job_id": jobs[0].id,
            "status": "screening",
            "source": "LinkedIn"
        }
    ]
    
    candidates = []
    for cand_data in candidates_data:
        candidate = models.Candidate(**cand_data, consent_recorded=True, consent_timestamp=datetime.utcnow())
        db.add(candidate)
        db.flush()
        candidates.append(candidate)
        print(f"  Created candidate: {cand_data['full_name']}")
    
    print("Creating interviews...")
    interviews_data = [
        {
            "candidate_id": candidates[0].id,
            "job_id": jobs[0].id,
            "mode": "text",
            "scheduled_at": datetime.utcnow() + timedelta(days=2),
            "status": "scheduled"
        },
        {
            "candidate_id": candidates[1].id,
            "job_id": jobs[1].id,
            "mode": "text",
            "scheduled_at": datetime.utcnow() - timedelta(days=1),
            "started_at": datetime.utcnow() - timedelta(days=1),
            "completed_at": datetime.utcnow() - timedelta(hours=22),
            "status": "completed",
            "transcript": [
                {"speaker": "AI", "text": "Hello! Welcome to the interview. Can you tell me about your experience with machine learning?"},
                {"speaker": "Candidate", "text": "I have 2.5 years of hands-on ML experience, working primarily with TensorFlow and scikit-learn."},
                {"speaker": "AI", "text": "Great! Can you describe a challenging ML project you worked on?"},
                {"speaker": "Candidate", "text": "I built a recommendation system that improved user engagement by 35% using collaborative filtering and deep learning."}
            ]
        },
        {
            "candidate_id": candidates[3].id,
            "job_id": jobs[3].id,
            "mode": "text",
            "scheduled_at": datetime.utcnow() - timedelta(days=5),
            "started_at": datetime.utcnow() - timedelta(days=5),
            "completed_at": datetime.utcnow() - timedelta(days=4, hours=23),
            "status": "completed",
            "transcript": [
                {"speaker": "AI", "text": "Hi Jessica! Let's discuss your React experience. What's your approach to state management?"},
                {"speaker": "Candidate", "text": "I use Redux for complex state and Context API for simpler cases. I also leverage React Query for server state."}
            ]
        }
    ]
    
    interviews = []
    for int_data in interviews_data:
        interview = models.Interview(**int_data)
        db.add(interview)
        db.flush()
        interviews.append(interview)
        print(f"  Created interview for candidate: {int_data['candidate_id'][:8]}")
    
    print("Creating interview scores...")
    if len(interviews) >= 2:
        scores_data = [
            {"interview_id": interviews[1].id, "dimension": "technical", "score": 4.2, "explanation": "Strong ML fundamentals", "ai_model_version": "v1"},
            {"interview_id": interviews[1].id, "dimension": "communication", "score": 4.5, "explanation": "Clear and articulate", "ai_model_version": "v1"},
            {"interview_id": interviews[2].id, "dimension": "technical", "score": 4.7, "explanation": "Excellent React knowledge", "ai_model_version": "v1"},
            {"interview_id": interviews[2].id, "dimension": "role_match", "score": 4.8, "explanation": "Perfect fit for frontend role", "ai_model_version": "v1"}
        ]
        
        for score_data in scores_data:
            score = models.InterviewScore(**score_data)
            db.add(score)
        print(f"  Created {len(scores_data)} interview scores")
    
    print("Creating employees...")
    employee_data = {
        "candidate_id": candidates[3].id,
        "user_id": users["employee"].id,
        "employee_code": "EMP001",
        "full_name": "Jessica Martinez",
        "email": "jessica.martinez@company.com",
        "phone": "+1-555-0104",
        "photo_url": "https://i.pravatar.cc/300?img=45",
        "signature_url": "https://placehold.co/400x100/e2e8f0/1e40af?text=J.+Martinez",
        "date_of_birth": datetime(1997, 5, 15),
        "gender": "Female",
        "blood_group": "O+",
        "marital_status": "Single",
        "address": "123 Tech Street, Apartment 4B",
        "city": "Austin",
        "state": "Texas",
        "country": "USA",
        "pincode": "78701",
        "designation": "Frontend Developer",
        "department": "Engineering",
        "team": "Product Development",
        "reporting_manager_id": None,
        "sanction_authority_id": None,
        "additional_duties": ["Code Review", "Mentoring Interns", "UI/UX Consultation"],
        "employment_type": "permanent",
        "probation_end_date": datetime.utcnow() - timedelta(days=30),
        "confirmation_date": datetime.utcnow() - timedelta(days=29),
        "join_date": datetime.utcnow() - timedelta(days=90),
        "status": "active",
        "ctc": 120000,
        "location": "Austin, TX",
        "emergency_contact_name": "Maria Martinez",
        "emergency_contact_phone": "+1-555-9876",
        "emergency_contact_relation": "Mother",
        "education": [
            {
                "degree": "BS",
                "field": "Software Engineering",
                "university": "UC Berkeley",
                "start_year": 2015,
                "end_year": 2019,
                "grade": "3.8 GPA"
            },
            {
                "degree": "High School Diploma",
                "field": "General",
                "university": "Austin High School",
                "start_year": 2011,
                "end_year": 2015,
                "grade": "4.0 GPA"
            }
        ],
        "work_experience": [
            {
                "company": "Web Agency LLC",
                "position": "Frontend Developer",
                "start_date": "Aug 2019",
                "end_date": "Sep 2024",
                "duration": "5 years 1 month",
                "description": "Built responsive web applications using React and modern CSS frameworks",
                "key_achievements": [
                    "Led migration to TypeScript, reducing bugs by 40%",
                    "Improved page load time by 60% through optimization",
                    "Mentored 3 junior developers"
                ]
            },
            {
                "company": "Startup XYZ",
                "position": "Junior Frontend Developer (Intern)",
                "start_date": "Jun 2018",
                "end_date": "Aug 2018",
                "duration": "3 months",
                "description": "Developed UI components for SaaS platform",
                "key_achievements": [
                    "Implemented reusable component library",
                    "Contributed to design system documentation"
                ]
            }
        ],
        "certifications": [
            {"name": "AWS Certified Developer", "issuer": "Amazon Web Services", "year": "2023"},
            {"name": "React Advanced Patterns", "issuer": "Frontend Masters", "year": "2022"}
        ],
        "skills": ["React", "JavaScript", "TypeScript", "Redux", "Tailwind CSS", "Git", "Figma", "Node.js"],
        "documents": [
            {"name": "Offer Letter", "type": "PDF", "upload_date": "2024-07-15", "url": "/docs/emp001_offer.pdf"},
            {"name": "ID Proof - Driver License", "type": "PDF", "upload_date": "2024-07-16", "url": "/docs/emp001_id.pdf"},
            {"name": "Educational Certificate", "type": "PDF", "upload_date": "2024-07-16", "url": "/docs/emp001_degree.pdf"},
            {"name": "W-4 Tax Form", "type": "PDF", "upload_date": "2024-07-17", "url": "/docs/emp001_w4.pdf"}
        ]
    }
    
    employee = models.Employee(**employee_data)
    db.add(employee)
    db.flush()
    print(f"  Created employee: {employee.employee_code} - {employee.full_name}")
    
    print("Creating leave balances...")
    leave_types = [
        {"leave_type": "casual", "total": 12},
        {"leave_type": "sick", "total": 12},
        {"leave_type": "earned", "total": 15}
    ]
    
    for leave_type in leave_types:
        balance = models.LeaveBalance(
            employee_id=employee.id,
            leave_type=leave_type["leave_type"],
            total_allocated=leave_type["total"],
            used=2,
            available=leave_type["total"] - 2,
            year=datetime.now().year
        )
        db.add(balance)
    print(f"  Created leave balances for employee")
    
    print("Creating leave requests...")
    leave_requests = [
        {
            "employee_id": employee.id,
            "leave_type": "casual",
            "start_date": datetime.utcnow() + timedelta(days=10),
            "end_date": datetime.utcnow() + timedelta(days=12),
            "days_count": 3,
            "reason": "Personal work",
            "status": "pending"
        },
        {
            "employee_id": employee.id,
            "leave_type": "sick",
            "start_date": datetime.utcnow() - timedelta(days=15),
            "end_date": datetime.utcnow() - timedelta(days=14),
            "days_count": 2,
            "reason": "Medical appointment",
            "status": "approved",
            "approved_by": users["manager"].id,
            "approved_at": datetime.utcnow() - timedelta(days=16)
        }
    ]
    
    for leave_req in leave_requests:
        leave = models.LeaveRequest(**leave_req)
        db.add(leave)
    print(f"  Created {len(leave_requests)} leave requests")
    
    print("Creating onboarding tasks...")
    tasks_data = [
        {"title": "Submit ID Proof", "description": "Upload government-issued ID", "task_type": "document", "status": "completed", "completed_at": datetime.utcnow() - timedelta(days=85)},
        {"title": "Complete IT Setup", "description": "Laptop and access provisioning", "task_type": "it", "status": "completed", "completed_at": datetime.utcnow() - timedelta(days=84)},
        {"title": "Compliance Training", "description": "Complete mandatory training modules", "task_type": "training", "status": "in_progress"},
        {"title": "Team Introduction", "description": "Meet team members", "task_type": "meeting", "status": "pending", "due_date": datetime.utcnow() + timedelta(days=5)}
    ]
    
    for task_data in tasks_data:
        task = models.OnboardingTask(employee_id=employee.id, **task_data)
        db.add(task)
    print(f"  Created {len(tasks_data)} onboarding tasks")
    
    print("Creating invoices...")
    invoices_data = [
        {
            "client_name": "Tech Solutions Inc",
            "invoice_number": "INV-2025-001",
            "amount": 25000,
            "status": "paid",
            "placements": [{"employee": "Jessica Martinez", "position": "Frontend Developer", "fee": 25000}],
            "due_date": datetime.utcnow() - timedelta(days=30),
            "paid_date": datetime.utcnow() - timedelta(days=15)
        },
        {
            "client_name": "Enterprise Corp",
            "invoice_number": "INV-2025-002",
            "amount": 30000,
            "status": "sent",
            "placements": [{"employee": "Robert Kim", "position": "Product Manager", "fee": 30000}],
            "due_date": datetime.utcnow() + timedelta(days=15)
        }
    ]
    
    for inv_data in invoices_data:
        invoice = models.Invoice(**inv_data)
        db.add(invoice)
    print(f"  Created {len(invoices_data)} invoices")
    
    print("Creating system settings...")
    settings_data = [
        {"module_name": "recruitment", "setting_key": "auto_screening_enabled", "setting_value": {"enabled": True, "threshold": 70}, "description": "Enable automatic candidate screening"},
        {"module_name": "recruitment", "setting_key": "interview_modes", "setting_value": {"text": True, "video": False}, "description": "Enabled interview modes"},
        {"module_name": "leaves", "setting_key": "leave_policy", "setting_value": {"casual": 12, "sick": 12, "earned": 15, "maternity": 180, "paternity": 15}, "description": "Leave allocation per year"},
        {"module_name": "leaves", "setting_key": "approval_workflow", "setting_value": {"requires_manager_approval": True, "auto_approve_days": 2}, "description": "Leave approval workflow"},
        {"module_name": "onboarding", "setting_key": "default_tasks", "setting_value": {"tasks": ["Submit ID proof", "IT setup", "Compliance training", "Team introduction"]}, "description": "Default onboarding tasks"},
        {"module_name": "performance", "setting_key": "review_cycle", "setting_value": {"frequency": "quarterly", "rating_scale": 5}, "description": "Performance review cycle"},
        {"module_name": "ai", "setting_key": "models", "setting_value": {"resume_parser": "local-nlp-v1", "interview_bot": "local-llm-v1"}, "description": "AI models configuration"}
    ]
    
    for setting_data in settings_data:
        setting = models.SystemSettings(**setting_data, updated_by=users["admin"].id)
        db.add(setting)
    print(f"  Created {len(settings_data)} system settings")
    
    try:
        db.commit()
        print("\n✅ Database seeded successfully with comprehensive dummy data!")
        print("\nDemo Accounts:")
        print("  - admin / admin123")
        print("  - recruiter / recruiter123")
        print("  - manager / manager123")
        print("  - employee / employee123")
        print("\nData Created:")
        print(f"  - {len(jobs_data)} jobs")
        print(f"  - {len(campaigns_data)} campaigns (LinkedIn, Indeed, Twitter, Facebook, Instagram)")
        print(f"  - {len(leads_data)} leads from campaigns")
        print(f"  - {len(candidates_data)} candidates")
        print(f"  - {len(interviews_data)} interviews")
        print(f"  - 1 employee with leave management")
        print(f"  - {len(invoices_data)} invoices")
        print(f"  - {len(settings_data)} system settings")
        print("\n📊 Complete Hiring Pipeline:")
        print("  Campaign → Lead → JobApplication → Candidate → Interview → Employee")
    except Exception as e:
        db.rollback()
        print(f"❌ Error committing changes: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
