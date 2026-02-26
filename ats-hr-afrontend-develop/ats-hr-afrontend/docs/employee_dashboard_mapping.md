Employee Dashboard Mapping

This document maps the Employee Dashboard sections (as per the provided spreadsheet) to existing frontend pages and backend APIs.

- Dashboard (My Attendance, My Leave):
  - Frontend: `src/pages/EmployeeDashboard.jsx` (summary card)
  - Attendance: Link to `/attendance` (nav present in `src/App.jsx`). Backend attendance APIs implemented:
    - `POST /v1/attendance/mark` — mark check-in/out (body: `action: "in"|"out"`, optional `timestamp`)
    - `GET /v1/attendance/me` — recent attendance rows
    - `GET /v1/attendance/me/summary` — simple summary over last N days
  - Leave balance: Uses `/v1/leaves/balance/{employee_id}` (existing, used in `src/pages/Leaves.jsx`).

- My Profile (Personal Details, Documents):
  - Frontend: `src/pages/EmployeeProfile.jsx` (route `/employees/:id`).
  - Backend: `GET /v1/employees/{id}`, `PUT /v1/employees/{id}`, and document upload endpoints (existing in employee service).

- Attendance (Daily Attendance):
  - Frontend: Link to `/attendance` (route not implemented; add page to mark attendance and show history).
  - Backend: No attendance endpoints found; recommend implementing attendance service.

- Leave (Apply, My Requests):
  - Frontend: `src/pages/Leaves.jsx` (route `/leaves`) — supports balance, apply, approve.
  - Backend: `/v1/leaves`, `/v1/leaves/balance/{employee_id}` (existing).

- Payslips (Salary History):
  - Frontend: `src/pages/Finance.jsx` (view payslips by payroll run). The Employee Dashboard links to `/finance` for full payslip UI.
  - Backend: payroll endpoints like `/v1/payroll/payslips/{runId}` (existing for Finance view).

- Holidays (Holiday Calendar):
  - Frontend: Not implemented as a dedicated page. The Dashboard links to `/settings` where holiday configuration lives. Recommend adding a `Holidays` page and an endpoint `/v1/holidays`.

- Notifications (HR Alerts):
  - Frontend: `src/pages/EmployeeDashboard.jsx` uses `/v1/notifications` to surface HR alerts.
  - Backend: `/v1/notifications` (role-aware; returns candidate vs user items).

Notes & Next Steps
- Implement attendance service and page to allow employees to mark attendance and view history.
- Add a dedicated `Holidays` page and backend endpoints if needed.
- Consider adding a `mark_read` notification endpoint and persistent notifications table for persistent state across devices.

Files changed/added
- `src/pages/EmployeeDashboard.jsx` — new UI page
- `docs/employee_dashboard_mapping.md` — this mapping document
- `src/App.jsx` — added sidebar link and route for Employee Dashboard

If you want, I can also:
- Implement an `Attendance` page and the matching backend endpoints.
- Add a `Holidays` page and `/v1/holidays` endpoint.
- Wire `mark_read` for notifications.

