# Reports & Usage Pulse Module Structure

## Frontend (React)

src/pages/recruiter/reports/

- ReportsDashboard.jsx
- UsagePulse.jsx
- UsageReports.jsx
- RecruiterWiseReport.jsx
- JobWiseReport.jsx
- CandidateMISReport.jsx
- ActivityCommentsReport.jsx
- components/
  - FilterBar.jsx
  - KPICard.jsx
  - KPIGrid.jsx
  - AnimatedCount.jsx
  - LineChart.jsx
  - ReportsTable.jsx
  - ExportButton.jsx
  - DateRangePicker.jsx
  - RecruiterDropdown.jsx
  - MetricsSelector.jsx
  - LoadingSkeleton.jsx
  - EmptyState.jsx
  - ErrorState.jsx

## Backend (FastAPI)

reports/

- **init**.py
- api.py
- models.py
- schemas.py
- crud.py
- excel_export.py
- pdf_export.py
- background_tasks.py

## Database (PostgreSQL)

- activity_logs
- daily_usage_summary
- jobs
- candidates
- users

## Sample API Endpoints

- GET /api/reports/usage-pulse
- GET /api/reports/quick
- POST /api/reports/custom
- GET /api/reports/recruiter-wise
- GET /api/reports/job-wise
- GET /api/reports/candidate-mis
- GET /api/reports/activity-comments

## Notes

- All endpoints JWT protected
- Role-based access in backend
- Excel export via openpyxl, PDF via reportlab
- Recharts for frontend graphs
- Responsive, dark mode, error/loading/empty states
