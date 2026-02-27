import React, { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

// Admin/Auth pages
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";

// Public careers pages
import CareersPublic from "./pages/CareersPublic";
import JobDetail from "./pages/JobDetail";

// Candidate auth (inside /pages/candidate)
import CandidateRegister from "./pages/candidate/CandidateRegister";
import CandidateLogin from "./pages/candidate/CandidateLogin";

// Admin dashboard pages
import Dashboard from "./pages/Dashboard";
import Jobs from "./pages/Jobs";
import Interviews from "./pages/Interviews";
import InterviewRoom from "./pages/InterviewRoom";
import InterviewChat from "./pages/InterviewChat";
import Onboarding from "./pages/Onboarding";
import Employees from "./pages/Employees";
import EmployeeProfile from "./pages/EmployeeProfile";
import EmployeeDirectory from "./pages/EmployeeDirectory";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import Alumni from "./pages/Alumni";
import Finance from "./pages/Finance";
import Leaves from "./pages/Leaves";
import Attendance from "./pages/Attendance";
import Performance from "./pages/Performance";
import UserManagement from "./pages/UserManagement";
import Campaigns from "./pages/Campaigns";
import Leads from "./pages/Leads";
import InterviewFeedback from "./pages/InterviewFeedback";

// Unified Candidate Dashboard (admin + candidate)
import CandidateDashboard from "./pages/CandidateDashboard";

import Roles from "./pages/Roles";
import Permissions from "./pages/Permissions";
import RolesList from "./pages/RolesList";
import PermissionsList from "./pages/PermissionsList";
import RolePermissionMatrix from "./pages/RolePermissionMatrix";

// Sprint 4 Pages
import CandidateMatching from "./pages/CandidateMatching";
import InterviewCalendar from "./pages/InterviewCalendar";
import CandidateInterviews from "./pages/CandidateInterviews";
import InterviewLogs from "./pages/InterviewLogs";
import InterviewDetail from "./pages/InterviewDetail";
import LiveInterviewDetail from "./pages/LiveInterviewDetail";

// Role-specific dashboards
import AccountManager from "./pages/account-manager/AccountManagerDashboard";
import ConsultantAssignments from "./pages/account-manager/ConsultantAssignments";
import ClientDirectory from "./pages/account-manager/ClientDirectory";
import InterviewCalendarPage from "./pages/account-manager/InterviewCalendarPage";
import InterviewLogsPage from "./pages/account-manager/InterviewLogsPage";
import SubmissionsPage from "./pages/account-manager/SubmissionsPage";
import TimesheetsPage from "./pages/account-manager/TimesheetsPage";
import AccountManagerProfile from "./pages/account-manager/AccountManagerProfile";
import AccountManagerSettings from "./pages/account-manager/AccountManagerSettings";
import ReportsAnalytics from "./pages/reports/ReportsAnalytics";

// Recruitment-specific pages (jobs)
import JobCreate from "./pages/recruitment/JobCreate";
import JobEdit from "./pages/recruitment/JobEdit";
import JobMatch from "./pages/recruitment/JobMatch";
import JobSubmissions from "./pages/recruitment/JobSubmissions";

// candidate/admin pages
import CandidateIntake from "./pages/CandidateIntake";
import CandidateProfile from "./pages/candidate/CandidateProfile";
import MyInterviews from "./pages/candidate/MyInterviews";
import MyInterviewDetail from "./pages/candidate/MyInterviewDetail";
import CandidateProfileAdmin from "./pages/recruiter/CandidateProfileAdmin";
import CandidatesBulkActions from "./pages/CandidatesBulkActions";
import CandidatePool from "./pages/CandidatePool";
import BackgroundVerification from "./pages/BackgroundVerification";

// Permission provider
import { PermissionProvider } from "./context/PermissionContext";
import { ThemeProvider } from "./context/ThemeContext";

// Recruiter dashboard
import RecruiterDashboard from "./pages/recruiter/RecruiterDashboard";
import RecruiterRequirements from "./pages/RecruiterRequirements";
import RequirementDetail from "./pages/RequirementDetail";
import AssignedJobs from "./pages/recruiter/AssignedJobs";
import RecruiterAssignJobDetail from "./pages/recruiter/RecruiterAssignJobDetail";
import RecruiterProfile from "./pages/recruiter/RecruiterProfile";
import RecruiterSettings from "./pages/recruiter/RecruiterSettings";
import CandidateWorkflow from "./pages/recruiter/CandidateWorkflow";
import Trackers from "./pages/recruiter/Trackers";
import ReportsDashboard from "./pages/recruiter/reports/ReportsDashboard";

import OfferLetter from "./pages/OfferLetter";

import Consultants from "./pages/Consultants";
import ConsultantDetail from "./pages/ConsultantDetail";
import ConsultantDeploy from "./pages/ConsultantDeploy";
import ConsultantDeployments from "./pages/ConsultantDeployments";
import ConsultantDeploymentDetail from "./pages/ConsultantDeploymentDetail";

import ConsultantDashboard from "./pages/consultant/ConsultantDashboard";
import ConsultantProfile from "./pages/consultant/ConsultantProfile";

import ClientDashboard from "./pages/client/ClientDashboard";
import ClientRequirements from "./pages/client/ClientRequirements";
import ClientSubmissions from "./pages/client/ClientSubmissions";
import ClientDeployments from "./pages/client/ClientDeployments";
import ClientInvoices from "./pages/client/ClientInvoices";
import ClientLayout from "./pages/client/ClientLayout";
import RecruiterLayout from "./pages/recruiter/RecruiterLayout";
import CandidateLayout from "./pages/candidate/CandidateLayout";
import AccountManagerLayout from "./pages/account-manager/AccountManagerLayout";
import AdminLayout from "./pages/AdminLayout";
import SuperAdminLayout from "./pages/super-admin/SuperAdminLayout";
import SuperAdminDashboard from "./pages/super-admin/SuperAdminDashboard";
import BusinessSetup from "./pages/super-admin/BusinessSetup";
import BusinessSetupOrgStructure from "./pages/super-admin/business-setup/OrgStructure";
import BusinessSetupJobSettings from "./pages/super-admin/business-setup/JobSettings";
import BusinessSetupCompanyProfile from "./pages/super-admin/business-setup/CompanyProfile";
import BusinessSetupEmailTemplates from "./pages/super-admin/business-setup/EmailTemplates";
import BusinessSetupApprovalWorkflows from "./pages/super-admin/business-setup/ApprovalWorkflows";
import BusinessSetupIntegrations from "./pages/super-admin/business-setup/Integrations";
import ClientsTenants from "./pages/super-admin/ClientsTenants";
import AdminManagement from "./pages/super-admin/AdminManagement";
import RolesPermissions from "./pages/super-admin/RolesPermissions";
import TrackerMetricsDashboard from "./pages/super-admin/TrackerMetricsDashboard";
import OperationsAnalytics from "./pages/super-admin/OperationsAnalytics";
import FinanceBilling from "./pages/super-admin/FinanceBilling";
import ComplianceSecurity from "./pages/super-admin/ComplianceSecurity";
import SystemSettingsSuperAdmin from "./pages/super-admin/SystemSettings";
import AuditLogs from "./pages/super-admin/AuditLogs";
import SuperAdminUserManagement from "./pages/super-admin/UserManagement";
import WorkflowBuilder from "./pages/super-admin/WorkflowBuilder";
import ResdexSearchResumes from "./pages/recruiter/ResdexSearchResumes";
import ResdexSendNVite from "./pages/recruiter/ResdexSendNVite";
import ResdexManageSearches from "./pages/recruiter/ResdexManageSearches";
import ResdexFolders from "./pages/recruiter/ResdexFolders";
import AdvancedSearch from "./pages/recruiter/AdvancedSearch";
import RequirementsList from "./components/account-manager/RequirementsList";
import RequirementReview from "./components/account-manager/RequirementReview";
import RecruiterAssignment from "./components/account-manager/RecruiterAssignment";
import RecruiterSubmissions from "./components/account-manager/RecruiterSubmissions";
import AMCandidateWorkflow from "./pages/account-manager/AMCandidateWorkflow";
import RecruiterJobDetail from "./pages/recruiter/RecruiterJobDetail";
import CreateRequirement from "./pages/client/CreateRequirements";

// Job Management Module
import JobsList from "./pages/jobs/JobsList";
import JobDetailNew from "./pages/jobs/JobDetail";
import JobCreateForm from "./pages/jobs/JobCreateForm";
import JobPostingForm from "./pages/jobs/JobPostingForm";

// Vendor Portal
import VendorLayout from "./pages/vendor/VendorLayout";
import VendorDashboard from "./pages/vendor/VendorDashboard";
import VendorCandidates from "./pages/vendor/VendorCandidates";
import VendorDocuments from "./pages/vendor/VendorDocuments";
import VendorProfile from "./pages/vendor/VendorProfile";
import VendorBGVAssigned from "./pages/vendor/VendorBGVAssigned";
import VendorBGVSubmit from "./pages/vendor/VendorBGVSubmit";

import Settings from "./pages/Settings";
import Clients from "./pages/Clients";
import AdminClientRequirements from "./pages/admin/AdminClientRequirements";
import CreateRequirementAdmin from "./pages/admin/CreateRequirementAdmin";
import AdminClientLayout from "./pages/admin/AdminClientLayout";
import OfferLetterPage from "./pages/offers/OfferLetterPage";
import MyTimesheets from "./pages/consultant/MyTimesheets";
import Timesheets from "./pages/consultant/Timesheets";
import AMTimesheets from "./pages/account-manager/Timesheets";
import ClientTimesheets from "./pages/client/ClientTimesheets";
import ClientTimesheetHistory from "./pages/client/ClientTimesheetHistory";
import AMTimesheetHistory from "./pages/account-manager/AMTimesheetHistory";

function AppRouter({ children }) {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      {children}
    </Router>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem("access_token"),
  );

  const [authRole, setAuthRole] = useState(localStorage.getItem("role"));

  const handleLogin = () => {
    setIsAuthenticated(true);
    setAuthRole(localStorage.getItem("role"));
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");

    setIsAuthenticated(false);
    setAuthRole(null);
  };

  // PUBLIC (NOT LOGGED IN)
  if (!isAuthenticated) {
    return (
      <AppRouter>
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          <Route path="/" element={<CareersPublic />} />
          <Route path="/careers" element={<CareersPublic />} />
          <Route path="/careers/job/:id" element={<JobDetail />} />
          <Route path="/careers/register" element={<CandidateRegister />} />
          <Route
            path="/careers/login"
            element={<CandidateLogin onLogin={handleLogin} />}
          />

          <Route path="*" element={<Navigate to="/careers" replace />} />
        </Routes>
      </AppRouter>
    );
  }

  // CANDIDATE ROLE
  if (authRole && authRole.toLowerCase() === "candidate") {
    return (
      <AppRouter>
        <Routes>
          <Route
            path="/candidate"
            element={<CandidateLayout onLogout={handleLogout} />}
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<CandidateDashboard />} />
            <Route path="notifications" element={<CandidateDashboard />} />
            <Route path="complete-profile" element={<CandidateDashboard />} />
            <Route path="apply-jobs" element={<CandidateDashboard />} />
            <Route path="applied-jobs" element={<CandidateDashboard />} />
            <Route path="my-interviews" element={<MyInterviews />} />
            <Route
              path="my-interviews/:interviewId"
              element={<MyInterviewDetail />}
            />
            <Route path="profile" element={<CandidateProfile />} />
            <Route path="profile/:id" element={<CandidateProfile />} />
            <Route path="portal" element={<Navigate to="dashboard" replace />} />
            <Route path="jobs" element={<Navigate to="dashboard" replace />} />
            <Route
              path="applications"
              element={<Navigate to="dashboard" replace />}
            />
          </Route>
          <Route path="/interviews/:id" element={<InterviewChat />} />
          <Route
            path="/interviews/:id/feedback"
            element={<InterviewFeedback />}
          />
          <Route
            path="/live-interviews/:id/detail"
            element={<LiveInterviewDetail />}
          />
          <Route path="/interviews/:id/detail" element={<InterviewDetail />} />
          <Route
            path="*"
            element={<Navigate to="/candidate/dashboard" replace />}
          />
        </Routes>
      </AppRouter>
    );
  }

  // SUPER ADMIN ROLE
  if (authRole === "super_admin") {
    return (
      <AppRouter>
        <SuperAdminLayout onLogout={handleLogout}>
          <Routes>
            <Route
              path="/super-admin"
              element={<Navigate to="/super-admin/dashboard" replace />}
            />
            <Route
              path="/super-admin/dashboard"
              element={<SuperAdminDashboard />}
            />
            <Route path="/super-admin/business-setup" element={<BusinessSetup />} />
            <Route path="/super-admin/business-setup/org-structure" element={<BusinessSetupOrgStructure />} />
            <Route path="/super-admin/business-setup/job-settings" element={<BusinessSetupJobSettings />} />
            <Route path="/super-admin/business-setup/company-profile" element={<BusinessSetupCompanyProfile />} />
            <Route path="/super-admin/business-setup/email-templates" element={<BusinessSetupEmailTemplates />} />
            <Route path="/super-admin/business-setup/approval-workflows" element={<BusinessSetupApprovalWorkflows />} />
            <Route path="/super-admin/business-setup/integrations" element={<BusinessSetupIntegrations />} />
            <Route path="/super-admin/clients" element={<ClientsTenants />} />
            <Route
              path="/super-admin/admin-management"
              element={<AdminManagement />}
            />
            <Route
              path="/super-admin/roles-permissions"
              element={<RolesPermissions />}
            />
            <Route
              path="/super-admin/tracker-dashboard"
              element={<TrackerMetricsDashboard />}
            />
            <Route
              path="/super-admin/workflow-builder"
              element={<WorkflowBuilder />}
            />
            <Route
              path="/super-admin/operations-analytics"
              element={<OperationsAnalytics />}
            />
            <Route
              path="/super-admin/finance-billing"
              element={<FinanceBilling />}
            />
            <Route
              path="/super-admin/compliance-security"
              element={<ComplianceSecurity />}
            />
            <Route
              path="/super-admin/system-settings"
              element={<SystemSettingsSuperAdmin />}
            />
            <Route
              path="/super-admin/system-settings/general"
              element={<SystemSettingsSuperAdmin />}
            />
            <Route
              path="/super-admin/system-settings/security"
              element={<SystemSettingsSuperAdmin />}
            />
            <Route
              path="/super-admin/system-settings/email"
              element={<SystemSettingsSuperAdmin />}
            />
            <Route
              path="/super-admin/system-settings/uploads"
              element={<SystemSettingsSuperAdmin />}
            />
            <Route
              path="/super-admin/system-settings/feature-flags"
              element={<SystemSettingsSuperAdmin />}
            />
            <Route
              path="/super-admin/system-settings/maintenance"
              element={<SystemSettingsSuperAdmin />}
            />
            <Route
              path="/super-admin/system-settings/audit-logs"
              element={<SystemSettingsSuperAdmin />}
            />
            <Route
              path="/super-admin/user-management/users"
              element={<SuperAdminUserManagement />}
            />
            <Route
              path="/super-admin/users"
              element={<Navigate to="/super-admin/user-management/users" replace />}
            />
            <Route path="/super-admin/audit-logs" element={<AuditLogs />} />
            <Route
              path="*"
              element={<Navigate to="/super-admin/dashboard" replace />}
            />
          </Routes>
        </SuperAdminLayout>
      </AppRouter>
    );
  }

  // VENDOR ROLE
  if (authRole === "vendor") {
    return (
      <AppRouter>
        <Routes>
          <Route path="/vendor" element={<VendorLayout />}>
            <Route index element={<VendorDashboard />} />
            <Route path="dashboard" element={<VendorDashboard />} />
            <Route path="candidates" element={<VendorCandidates />} />
            <Route path="documents" element={<VendorDocuments />} />
            <Route path="profile" element={<VendorProfile />} />
            <Route path="bgv-assigned" element={<VendorBGVAssigned />} />
            <Route path="bgv-submit/:id" element={<VendorBGVSubmit />} />
          </Route>
          <Route path="*" element={<Navigate to="/vendor/dashboard" replace />} />
        </Routes>
      </AppRouter>
    );
  }

  // CLIENT ROLE
  if (authRole === "client") {
    return (
      <AppRouter>
        <Routes>
          <Route path="/client" element={<ClientLayout onLogout={handleLogout} />}>
            <Route index element={<ClientDashboard />} />
            <Route path="dashboard" element={<ClientDashboard />} />
            <Route path="requirements" element={<ClientRequirements />} />
            <Route path="requirements/create" element={<CreateRequirement />} />
            <Route path="timesheets" element={<ClientTimesheets />} />
            <Route path="timesheet-history" element={<ClientTimesheetHistory />} />
            <Route path="jobs/:jobId/submissions" element={<ClientSubmissions />} />
            <Route path="submissions" element={<ClientSubmissions />} />
            <Route path="deployments" element={<ClientDeployments />} />
            <Route path="invoices" element={<ClientInvoices />} />
          </Route>
          <Route path="*" element={<Navigate to="/client/dashboard" replace />} />
        </Routes>
      </AppRouter>
    );
  }

  // RECRUITER ROLE
  if (authRole === "recruiter") {
    return (
      <AppRouter>
        <Routes>
          <Route path="/recruiter" element={<RecruiterLayout onLogout={handleLogout} />}>
            <Route index element={<RecruiterDashboard />} />
            <Route path="dashboard" element={<RecruiterDashboard />} />
            <Route path="assigned-jobs" element={<AssignedJobs />} />
            <Route path="assigned-jobs/:id" element={<RecruiterJobDetail />} />
            <Route path="requirements" element={<RecruiterRequirements />} />
            <Route
              path="requirements/:requirementId"
              element={<RequirementDetail />}
            />
            <Route path="profile" element={<RecruiterProfile />} />
            <Route path="my-profile" element={<RecruiterProfile />} />
            <Route path="settings" element={<RecruiterSettings />} />
            <Route path="trackers" element={<Trackers />} />
            <Route path="reports" element={<ReportsDashboard />} />
            <Route path="job-management" element={<JobsList userRole="recruiter" />} />
            <Route path="job-management/:id" element={<JobDetailNew userRole="recruiter" />} />
            <Route path="job-management/new" element={<JobCreateForm userRole="recruiter" />} />
            <Route
              path="job-management/:jobId/posting/new"
              element={<JobPostingForm userRole="recruiter" />}
            />
            <Route path="jobs" element={<Jobs />} />
            <Route path="candidates" element={<CandidateIntake />} />
            <Route path="candidates/:id" element={<CandidateIntake />} />
            <Route path="candidate-profile" element={<CandidateProfileAdmin />} />
            <Route path="candidate-profile/:id" element={<CandidateProfile />} />
            <Route path="matching" element={<CandidatePool />} />
            <Route path="jobs/:id/submissions" element={<JobSubmissions />} />
            <Route path="resdex/search-resumes" element={<ResdexSearchResumes />} />
            <Route path="resdex/advanced-search" element={<AdvancedSearch />} />
            <Route path="resdex/send-nvite" element={<ResdexSendNVite />} />
            <Route path="resdex/manage-searches" element={<ResdexManageSearches />} />
            <Route path="resdex/folders" element={<ResdexFolders />} />
            <Route path="interviews" element={<Interviews />} />
            <Route path="interviews/calendar" element={<InterviewCalendar />} />
            <Route path="interviews/logs" element={<InterviewLogs />} />
            <Route path="interview-calendar" element={<InterviewCalendar />} />
            <Route path="interview-logs" element={<InterviewLogs />} />
            <Route path="interviews/:id" element={<InterviewDetail />} />
            <Route path="interviews/:id/detail" element={<InterviewDetail />} />
            <Route path="live-interviews/:id/detail" element={<LiveInterviewDetail />} />
            <Route path="interviews/:id/feedback" element={<InterviewFeedback />} />
            <Route path="candidates/:id/interviews" element={<CandidateInterviews />} />
            <Route path="onboarding" element={<Onboarding />} />
            <Route path="employees" element={<Employees />} />
            <Route path="employee/dashboard" element={<EmployeeDashboard />} />
            <Route path="employees/directory" element={<EmployeeDirectory />} />
            <Route path="employees/:id" element={<EmployeeProfile />} />
            <Route path="candidate-workflow" element={<CandidateWorkflow />} />
          </Route>

          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/leaves" element={<Leaves />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/performance" element={<Performance />} />
          <Route path="/alumni" element={<Alumni />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/roles" element={<Roles />} />
          <Route path="/permissions" element={<Permissions />} />
          <Route path="/roles-list" element={<RolesList />} />
          <Route path="/permissions-list" element={<PermissionsList />} />
          <Route path="/role-permission-matrix" element={<RolePermissionMatrix />} />
          <Route path="/settings" element={<Settings />} />

          <Route path="*" element={<Navigate to="/recruiter/dashboard" replace />} />
        </Routes>
      </AppRouter>
    );
  }

  // ACCOUNT MANAGER ROLE
  if (authRole === "account_manager") {
    return (
      <AppRouter>
        <PermissionProvider>
          <ThemeProvider>
            <Routes>
              <Route path="/account-manager" element={<AccountManagerLayout onLogout={handleLogout} />}>
                <Route index element={<AccountManager />} />
                <Route path="dashboard" element={<AccountManager />} />
                <Route path="requirements" element={<RequirementsList />} />
                <Route path="requirements/:id" element={<RequirementReview />} />
                <Route path="submissions" element={<SubmissionsPage />} />
                <Route path="interview-calendar" element={<InterviewCalendarPage />} />
                <Route path="interview-logs" element={<InterviewLogsPage />} />
                <Route path="candidate-review" element={<AMCandidateWorkflow />} />
                <Route path="assignments" element={<ConsultantAssignments />} />
                <Route path="assign/:id" element={<RecruiterAssignment />} />
                <Route path="timesheets" element={<TimesheetsPage />} />
                <Route path="timesheet-history" element={<AMTimesheetHistory />} />
                <Route path="clients" element={<ClientDirectory />} />
                <Route path="reports" element={<ReportsAnalytics />} />
                <Route path="profile" element={<AccountManagerProfile />} />
                <Route path="settings" element={<AccountManagerSettings />} />
                <Route path="job-management" element={<JobsList userRole="account_manager" />} />
                <Route path="job-management/:id" element={<JobDetailNew userRole="account_manager" />} />
                <Route path="job-management/new" element={<JobCreateForm userRole="account_manager" />} />
                <Route
                  path="job-management/:jobId/posting/new"
                  element={<JobPostingForm userRole="account_manager" />}
                />
              </Route>

              <Route
                path="*"
                element={<Navigate to="/account-manager/dashboard" replace />}
              />
            </Routes>
          </ThemeProvider>
        </PermissionProvider>
      </AppRouter>
    );
  }

  // ADMIN / RECRUITER / EMPLOYEE
  return (
    <AppRouter>
      <PermissionProvider>
        <ThemeProvider>
          <AdminLayout onLogout={handleLogout}>
            <Routes>
              <Route path="/offers/send/:candidateId" element={<OfferLetterPage />} />
              <Route path="/consultant/dashboard" element={<ConsultantDashboard />} />
              <Route path="/consultant/timesheets" element={<MyTimesheets />} />
              <Route path="/consultant/timesheets/new" element={<Timesheets />} />
              <Route path="/consultant/timesheets/edit/:id" element={<Timesheets />} />
              <Route path="/account-manager/timesheets" element={<AMTimesheets />} />
              <Route path="/account-manager/timesheet-history" element={<AMTimesheetHistory />} />
              <Route path="/consultant/profile" element={<ConsultantProfile />} />
              <Route path="/client/dashboard" element={<ClientDashboard />} />
              <Route path="/client/requirements" element={<ClientRequirements />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/client/jobs/:jobId/submissions" element={<ClientSubmissions />} />
              <Route path="/client/deployments" element={<ClientDeployments />} />
              <Route path="/client/invoices" element={<ClientInvoices />} />

              <Route
                path="/dashboard"
                element={
                  authRole === "admin" ? (
                    <Dashboard />
                  ) : (
                    <Navigate
                      to={
                        authRole === "account_manager"
                          ? "/account-manager/dashboard"
                          : authRole === "consultant"
                            ? "/consultant/dashboard"
                            : "/"
                      }
                      replace
                    />
                  )
                }
              />

              <Route path="/clients" element={<Clients />} />
              <Route path="/clients/:clientId" element={<AdminClientLayout />}>
                <Route index element={<AdminClientRequirements />} />
                <Route path="requirements" element={<AdminClientRequirements />} />
                <Route path="requirements/create" element={<CreateRequirementAdmin />} />
              </Route>

              <Route
                path="/clients/:clientId/requirements/create"
                element={<CreateRequirementAdmin />}
              />

              <Route path="/candidate-dashboard" element={<CandidateDashboard />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/recruitment/jobs" element={<Jobs />} />
              <Route path="/recruitment/jobs/create" element={<JobCreate />} />
              <Route path="/recruitment/jobs/:id" element={<JobDetail />} />
              <Route path="/recruitment/jobs/:id/edit" element={<JobEdit />} />
              <Route path="/recruitment/jobs/:id/match" element={<JobMatch />} />
              <Route path="/recruitment/jobs/:id/submissions" element={<JobSubmissions />} />
              <Route path="/recruitment/jobs/submissions" element={<JobSubmissions />} />
              <Route path="/recruiter/jobs/:id" element={<RecruiterJobDetail />} />

              <Route path="/candidates" element={<CandidateIntake />} />
              <Route path="/candidates/:id" element={<CandidateProfileAdmin />} />
              <Route path="/matching" element={<CandidatePool />} />
              <Route path="/candidates/verification" element={<BackgroundVerification />} />

              <Route path="/interviews" element={<Interviews />} />
              <Route path="/interviews/logs" element={<InterviewLogs />} />
              <Route path="/interviews/:id" element={<InterviewRoom />} />
              <Route path="/interviews/:id/detail" element={<InterviewDetail />} />
              <Route path="/live-interviews/:id/detail" element={<LiveInterviewDetail />} />
              <Route path="/interviews/:id/feedback" element={<InterviewFeedback />} />

              <Route path="/recruiter/dashboard" element={<RecruiterDashboard />} />
              <Route path="/recruiter/assigned-jobs" element={<AssignedJobs />} />
              <Route path="/recruiter/candidate-workflow" element={<CandidateWorkflow />} />
              <Route path="/recruiter/resdex/search-resumes" element={<ResdexSearchResumes />} />
              <Route path="/recruiter/resdex/advanced-search" element={<AdvancedSearch />} />
              <Route path="/recruiter/resdex/send-nvite" element={<ResdexSendNVite />} />
              <Route path="/recruiter/resdex/manage-searches" element={<ResdexManageSearches />} />
              <Route path="/recruiter/resdex/folders" element={<ResdexFolders />} />
              <Route path="/recruiter/requirements" element={<RecruiterRequirements />} />
              <Route path="/recruiter/requirements/:requirementId" element={<RequirementDetail />} />
              <Route path="/recruitment/jobs/:id" element={<RecruiterAssignJobDetail />} />

              <Route path="/matching" element={<CandidateMatching />} />
              <Route path="/candidates/bulk-actions" element={<CandidatesBulkActions />} />
              <Route path="/interviews/calendar" element={<InterviewCalendar />} />
              <Route path="/candidates/:id/interviews" element={<CandidateInterviews />} />

              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/employees" element={<Employees />} />
              <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
              <Route path="/employees/directory" element={<EmployeeDirectory />} />
              <Route path="/employees/:id" element={<EmployeeProfile />} />
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/leaves" element={<Leaves />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/performance" element={<Performance />} />
              <Route path="/alumni" element={<Alumni />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/users" element={<UserManagement />} />

              <Route path="/roles" element={<Roles />} />
              <Route path="/permissions" element={<Permissions />} />
              <Route path="/roles-list" element={<RolesList />} />
              <Route path="/permissions-list" element={<PermissionsList />} />
              <Route path="/role-permission-matrix" element={<RolePermissionMatrix />} />

              <Route path="/careers" element={<CareersPublic />} />
              <Route path="/careers/job/:id" element={<JobDetail />} />

              <Route path="/consultants" element={<Consultants />} />
              <Route path="/consultants/:id" element={<ConsultantDetail />} />
              <Route path="/consultants/:id/deploy" element={<ConsultantDeploy />} />
              <Route path="/consultant-deployments" element={<ConsultantDeployments />} />
              <Route path="/consultant-deployments/:id" element={<ConsultantDeploymentDetail />} />
              <Route path="/consultants/:id" element={<EmployeeProfile />} />

              <Route path="/offer-letter" element={<OfferLetter />} />

              <Route
                path="/"
                element={
                  authRole === "vendor" ? (
                    <Navigate to="/vendor/dashboard" replace />
                  ) : authRole === "employee" ? (
                    <Navigate to="/employee/dashboard" replace />
                  ) : authRole === "recruiter" ? (
                    <Navigate to="/recruiter/dashboard" replace />
                  ) : authRole === "account_manager" ? (
                    <Navigate to="/account-manager/dashboard" replace />
                  ) : authRole === "client" ? (
                    <Navigate to="/client/dashboard" replace />
                  ) : authRole === "consultant" ? (
                    <Navigate to="/consultant/dashboard" replace />
                  ) : (
                    <Navigate to="/dashboard" replace />
                  )
                }
              />

              <Route path="/account-manager/dashboard" element={<AccountManager />} />
              <Route path="/account-manager/assignments" element={<ConsultantAssignments />} />
              <Route path="/account-manager/requirements" element={<RequirementsList />} />
              <Route path="/account-manager/submissions" element={<ClientSubmissions />} />
              <Route path="/account-manager/feedback" element={<ClientSubmissions />} />
              <Route path="/account-manager/requirements/:id" element={<RequirementReview />} />
              <Route path="/account-manager/assign/:id" element={<RecruiterAssignment />} />
              <Route
                path="/account-manager/requirement/:jobId/submissions"
                element={<RecruiterSubmissions />}
              />
            </Routes>
          </AdminLayout>
        </ThemeProvider>
      </PermissionProvider>
    </AppRouter>
  );
}

export default App;
