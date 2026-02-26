# Account Manager (AM) — API mapping

This document maps the AM screens to existing backend endpoints used by the frontend scaffolding.

- My Clients: derived from `GET /v1/jobs` (group by `company_name`) — frontend groups jobs per client
- My Jobs: `GET /v1/jobs` (filtering available via query params)
- Job Details / JD / SLA: `GET /v1/jobs/{job_id}` and `POST /v1/jobs/{job_id}/jd` (upload JD)
- Assign Recruiter: `POST /v1/jobs/{job_id}/assign` (payload `{ recruiters: [user_id] }`)
- Recruiter Submissions / Client Submissions: `GET /v1/jobs/{job_id}/submissions` and `GET /v1/jobs/{job_id}/candidates`
- Interviews: `GET /v1/interviews?job_id={job_id}` (existing interview list endpoints)
- Deployments / Approvals: `GET /v1/deployments` (if available) or via `GET /v1/jobs` filtered by status; approvals route TBD
- Invoices: `GET /v1/invoices` and `GET /v1/invoices/{invoice_id}`

Notes:
- The frontend scaffolding uses `GET /v1/users?role=recruiter` to list available recruiters for assignment.
- Where dedicated AM-specific endpoints are missing (clients, SLA, approvals), the frontend uses job fields (`company_name`) and existing job endpoints as fallbacks. We can add AM-specific endpoints on the backend if you want stricter separation.
