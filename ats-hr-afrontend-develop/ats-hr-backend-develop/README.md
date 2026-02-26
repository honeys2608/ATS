# Akshu HR - AI-Powered End-to-End HR Platform

A comprehensive HR automation platform covering the complete employee lifecycle from recruitment through alumni management, powered by local AI models for privacy and cost control.

## Features

### 🎯 Recruitment & Hiring
- **AI-Powered Resume Parsing**: Automatic extraction of skills, education, and experience using spaCy NLP
- **Smart Candidate Matching**: Vector embeddings-based job-candidate fit scoring with explainability
- **AI Interviewing**: Text and video interview capabilities with real-time transcription
- **Human-in-Loop Review**: Complete transparency with AI scores, explanations, and override capabilities

### 📋 Onboarding
- **Automated Task Management**: Pre-configured onboarding checklists
- **Document Tracking**: Background checks, identity verification, and compliance forms
- **Progressive Workflow**: Status tracking from offer acceptance to active employment

### 👥 Employee Lifecycle
- **Performance Management**: Goal tracking, reviews, and development plans
- **Exit Management**: Structured exit interviews and offboarding workflows
- **Alumni Network**: Post-employment engagement and rehire tracking

### 💰 Finance & Analytics
- **Invoice Generation**: Automated billing for placements
- **Revenue Tracking**: Projected vs. realized revenue analytics
- **Dashboard Metrics**: Real-time recruitment funnel, time-to-hire, and KPIs

## Technology Stack

### Frontend
- **React 18** with Vite for fast development
- **Tailwind CSS** for modern UI design
- **React Router** for navigation
- **Recharts** for data visualization
- **Axios** for API communication

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - SQL toolkit and ORM
- **SQLite** - Lightweight database (production-ready PostgreSQL support)
- **Pydantic** - Data validation

### AI/ML (Local Models)
- **spaCy** - Resume parsing and NER
- **NumPy** - Vector operations and embeddings
- **In-Memory FAISS Alternative** - Fast similarity search
- **Custom AI Interviewer** - Conversation flow and scoring

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+

### Installation

The platform is already configured and running on Replit! Both workflows are active:

1. **Backend API**: Running on port 8000
2. **Frontend**: Running on port 5000

### Access the Platform

1. Open the webview to access the frontend
2. API documentation available at `http://localhost:8000/docs`

### Demo Accounts

Create accounts via the registration endpoint:
```bash
POST /auth/register
{
  "username": "admin",
  "email": "admin@akshuhr.com",
  "password": "admin123",
  "role": "admin",
  "full_name": "System Administrator"
}
```

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - Create new user

### Jobs
- `GET /v1/jobs` - List all jobs
- `POST /v1/jobs` - Create job
- `POST /v1/jobs/{job_id}/match` - Get ranked candidates for job

### Candidates
- `POST /v1/candidates` - Upload resume and create candidate (multipart/form-data)
- `GET /v1/candidates` - List candidates with filters
- `GET /v1/candidates/{id}` - Candidate details with fit scores

### Interviews
- `POST /v1/interview` - Schedule interview
- `POST /v1/interview/{id}/start` - Start AI interview session
- `GET /v1/interview/{id}/question` - Get next question
- `POST /v1/interview/{id}/answer` - Submit answer and get scores
- `POST /v1/interview/{id}/complete` - End interview
- `POST /v1/interview/{id}/review` - Human review with override

### Onboarding
- `POST /v1/onboarding/{employee_id}/start` - Create onboarding tasks
- `GET /v1/onboarding/{employee_id}` - Get tasks
- `PUT /v1/onboarding/{task_id}/complete` - Mark task complete

### Employees
- `POST /v1/employees` - Convert candidate to employee
- `GET /v1/employees` - List employees
- `POST /v1/employees/{id}/exit` - Initiate exit process
- `POST /v1/employees/{id}/performance` - Add performance review

### Alumni
- `GET /v1/alumni` - List alumni
- `PUT /v1/alumni/{id}/update` - Update alumni info
- `POST /v1/alumni/{id}/referral` - Track referral

### Finance
- `POST /v1/invoices` - Create invoice
- `GET /v1/invoices` - List invoices
- `GET /v1/invoices/dashboard/metrics` - Dashboard metrics

## Project Structure

```
/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI application
│   │   ├── models.py        # Database models
│   │   ├── schemas.py       # Pydantic schemas
│   │   ├── db.py            # Database configuration
│   │   ├── ai_core.py       # AI/ML functionality
│   │   └── routes/          # API endpoints
│   │       ├── auth.py
│   │       ├── jobs.py
│   │       ├── candidates.py
│   │       ├── interviews.py
│   │       ├── onboarding.py
│   │       ├── employees.py
│   │       ├── invoices.py
│   │       └── alumni.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main application
│   │   ├── pages/           # Page components
│   │   └── components/      # Reusable components
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Key Features Explained

### AI-Powered Resume Parsing
- Extracts skills, education, and work experience from text resumes
- Uses regular expressions and NLP patterns for robust extraction
- Generates structured data for candidate profiles

### Candidate-Job Matching
- Creates vector embeddings for both jobs and candidates
- Calculates similarity scores using cosine similarity
- Provides explainable top 3 factors for each match

### AI Interviewer
- Dynamic question generation based on job requirements
- Multi-dimensional scoring: technical fit, communication, cultural fit, role match
- Conversation history tracking for review

### Human-in-Loop
- AI scores are advisory, not final
- Recruiters can override AI decisions
- Complete audit trail of all AI decisions

## Compliance & Privacy

- **Local AI Processing**: All AI models run locally - no PII sent to external APIs
- **Consent Management**: Explicit consent recording for all candidate data processing
- **AI Audit Logging**: Every AI decision logged with model version, inputs, and explanations
- **Bias Monitoring**: Dashboard for tracking fairness metrics across demographics

## Future Enhancements

- Advanced video analysis with quality metrics (non-biometric)
- Multi-language interview support
- Predictive attrition modeling
- Integration with external ATS and HRIS systems
- Mobile applications for candidates and employees
- Advanced analytics with ML-powered insights

## License

Proprietary - Akshu HR Platform

## Support

For support and questions, contact the development team.
