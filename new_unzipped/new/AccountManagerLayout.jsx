import React from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  BarChart2,
  LogOut,
  Users,
  Building,
  TrendingUp,
  Settings,
  User,
  Mail,
  Calendar,
  FileText,
  Zap,
} from "lucide-react";
import AlarmIcon from "../../components/notifications/AlarmIcon";

// Keep route/page intact; only hide sidebar entry for now.
const SHOW_SUBMISSIONS_NAV = false;
const SHOW_CONSULTANTS_NAV = false;
const SHOW_CLIENTS_NAV = false;

export default function AccountManagerLayout({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");

    if (onLogout) onLogout();
    navigate("/login", { replace: true });
  };

  const navItem =
    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition duration-200";
  const active = "!bg-white !text-gray-900 font-bold !shadow-lg";
  const inactive =
    "text-white hover:bg-white hover:text-gray-900 transition-all duration-200 hover:shadow-md";

  const getPageTitle = () => {
    if (location.pathname.includes("dashboard")) return "Dashboard";
    if (location.pathname.includes("requirements")) return "Requirements";
    if (location.pathname.includes("submissions"))
      return "Recruiter Submissions";
    if (location.pathname.includes("interview-calendar"))
      return "Interview Calendar";
    if (location.pathname.includes("interview-logs")) return "Interview Logs";
    if (location.pathname.includes("candidate-review"))
      return "Candidate Review";
    if (
      location.pathname.includes("timesheets") &&
      location.pathname.includes("history")
    )
      return "Timesheet History";
    if (location.pathname.includes("timesheets")) return "Timesheets";
    if (location.pathname.includes("clients")) return "Client Directory";
    if (location.pathname.includes("assignments"))
      return "Consultant Assignments";
    if (location.pathname.includes("reports")) return "Reports";
    if (location.pathname.includes("settings")) return "Settings";
    if (location.pathname.includes("profile")) return "My Profile";
    return "Account Manager";
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* SIDEBAR */}
      <aside className="w-64 flex-shrink-0 bg-gradient-to-b from-purple-600 to-emerald-500 text-white flex flex-col shadow-lg">
        {/* Brand */}
        <div className="px-6 py-5 border-b border-white border-opacity-20">
          <h2 className="text-lg font-bold text-white">Account Manager</h2>
          <p className="text-xs text-white text-opacity-80">
            Manage clients & accounts
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          {/* Overview */}
          <div className="mb-3">
            <div className="text-xs font-extrabold uppercase text-white tracking-wider mb-2">
              Overview
            </div>
            <NavLink
              to="/account-manager/dashboard"
              className={({ isActive }) =>
                `${navItem} ${isActive ? active : inactive}`
              }
            >
              <LayoutDashboard size={18} />
              Dashboard
            </NavLink>
          </div>

          {/* Pipeline */}
          <div className="mb-3">
            <div className="text-xs font-extrabold uppercase text-white tracking-wider mb-2">
              Pipeline
            </div>
            <NavLink
              to="/account-manager/requirements"
              className={({ isActive }) =>
                `${navItem} ${isActive ? active : inactive}`
              }
            >
              <FileText size={18} />
              Requirements
            </NavLink>
            <NavLink
              to="/account-manager/candidate-review"
              className={({ isActive }) =>
                `${navItem} ${isActive ? active : inactive}`
              }
            >
              <Users size={18} />
              Candidate Review
            </NavLink>
            {SHOW_SUBMISSIONS_NAV ? (
              <NavLink
                to="/account-manager/submissions"
                className={({ isActive }) =>
                  `${navItem} ${isActive ? active : inactive}`
                }
              >
                <Zap size={18} />
                Submissions
              </NavLink>
            ) : null}
            <NavLink
              to="/account-manager/interview-calendar"
              className={({ isActive }) =>
                `${navItem} ${isActive ? active : inactive}`
              }
            >
              <Calendar size={18} />
              Interview Calendar
            </NavLink>
            <NavLink
              to="/account-manager/interview-logs"
              className={({ isActive }) =>
                `${navItem} ${isActive ? active : inactive}`
              }
            >
              <Mail size={18} />
              Interview Logs
            </NavLink>
          </div>

          {SHOW_CONSULTANTS_NAV ? (
            <div className="mb-3">
              <div className="text-xs font-extrabold uppercase text-white tracking-wider mb-2">
                Consultants
              </div>
              <NavLink
                to="/account-manager/assignments"
                className={({ isActive }) =>
                  `${navItem} ${isActive ? active : inactive}`
                }
              >
                <Users size={18} />
                Assignments
              </NavLink>
              <NavLink
                to="/account-manager/timesheets"
                className={({ isActive }) =>
                  `${navItem} ${isActive ? active : inactive}`
                }
              >
                <BarChart2 size={18} />
                Timesheets
              </NavLink>
              <NavLink
                to="/account-manager/timesheet-history"
                className={({ isActive }) =>
                  `${navItem} ${isActive ? active : inactive}`
                }
              >
                <FileText size={18} />
                Timesheet History
              </NavLink>
            </div>
          ) : null}

          {SHOW_CLIENTS_NAV ? (
            <div className="mb-3">
              <div className="text-xs font-extrabold uppercase text-white tracking-wider mb-2">
                Clients
              </div>
              <NavLink
                to="/account-manager/clients"
                className={({ isActive }) =>
                  `${navItem} ${isActive ? active : inactive}`
                }
              >
                <Building size={18} />
                Client Directory
              </NavLink>
            </div>
          ) : null}

          {/* Reports & Analytics */}
          <div className="mb-3">
            <div className="text-xs font-extrabold uppercase text-white tracking-wider mb-2">
              Reports & Analytics
            </div>
            <NavLink
              to="/account-manager/reports"
              className={({ isActive }) =>
                `${navItem} ${isActive ? active : inactive}`
              }
            >
              <TrendingUp size={18} />
              Reports
            </NavLink>
          </div>

          {/* Settings */}
          <div className="mb-3">
            <div className="text-xs font-extrabold uppercase text-white tracking-wider mb-2">
              Account
            </div>
            <NavLink
              to="/account-manager/profile"
              className={({ isActive }) =>
                `${navItem} ${isActive ? active : inactive}`
              }
            >
              <User size={18} />
              My Profile
            </NavLink>

            <NavLink
              to="/account-manager/settings"
              className={({ isActive }) =>
                `${navItem} ${isActive ? active : inactive}`
              }
            >
              <Settings size={18} />
              Settings
            </NavLink>
          </div>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0 flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-gray-800">
            {getPageTitle()}
          </h1>
          <div className="flex items-center gap-4">
            <AlarmIcon />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-gray-700 hover:text-red-600 transition font-semibold"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto bg-gray-50">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
