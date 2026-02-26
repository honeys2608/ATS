import React from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Calendar,
  ClipboardList,
  Clock,
  FileBarChart,
  FileText,
  Grid3X3,
  LogOut,
  Search,
  Settings,
  User,
  Users,
} from "lucide-react";

const itemClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${
    isActive ? "bg-white/20 text-white" : "text-white/85 hover:bg-white/10 hover:text-white"
  }`;

const Section = ({ title, children }) => (
  <div>
    <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-white/90">{title}</p>
    <div className="space-y-1">{children}</div>
  </div>
);

export default function RecruiterLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const pageTitle = location.pathname.includes("/dashboard")
    ? "Dashboard"
    : location.pathname.includes("/candidate-profile")
      ? "Candidate Profile"
      : location.pathname.includes("/assigned-jobs")
        ? "Assigned Jobs"
        : location.pathname.includes("/interviews")
          ? "Interviews"
          : location.pathname.includes("/trackers")
            ? "Trackers"
            : "Recruiter Portal";

  const doLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("token");
    localStorage.removeItem("candidate_token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
    window.location.assign("/login");
  };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <aside className="w-72 shrink-0 bg-gradient-to-b from-purple-700 to-indigo-700 text-white p-4">
        <div className="mb-4 border-b border-white/20 pb-4">
          <h1 className="text-3xl font-extrabold">Recruiter Portal</h1>
          <p className="text-sm text-white/80">Manage recruitment & hiring</p>
        </div>

        <div className="space-y-5">
          <Section title="Talent Acquisition">
            <NavLink to="/recruiter/dashboard" className={itemClass}>
              <Grid3X3 size={18} /> Dashboard
            </NavLink>
            <NavLink to="/recruiter/assigned-jobs" className={itemClass}>
              <ClipboardList size={18} /> Assigned Jobs
            </NavLink>
            <NavLink to="/recruiter/candidate-workflow" className={itemClass}>
              <Users size={18} /> Candidate Workflow
            </NavLink>
          </Section>

          <Section title="Resdex">
            <NavLink to="/recruiter/resdex/advanced-search" className={itemClass}>
              <Search size={18} /> Semantic Search
            </NavLink>
          </Section>

          <Section title="Candidate Management">
            <NavLink to="/recruiter/candidate-profile" className={itemClass}>
              <User size={18} /> Candidate Profile
            </NavLink>
          </Section>

          <Section title="Interviews">
            <NavLink to="/recruiter/interviews" className={itemClass}>
              <Calendar size={18} /> Interviews
            </NavLink>
            <NavLink to="/recruiter/interview-calendar" className={itemClass}>
              <Clock size={18} /> Interview Calendar
            </NavLink>
            <NavLink to="/recruiter/interview-logs" className={itemClass}>
              <FileText size={18} /> Interview Logs
            </NavLink>
          </Section>

          <Section title="Trackers">
            <NavLink to="/recruiter/trackers" className={itemClass}>
              <ClipboardList size={18} /> Trackers
            </NavLink>
          </Section>

          <Section title="Reports">
            <NavLink to="/recruiter/reports" className={itemClass}>
              <FileBarChart size={18} /> Reports
            </NavLink>
          </Section>

          <Section title="Account">
            <NavLink to="/recruiter/my-profile" className={itemClass}>
              <User size={18} /> My Profile
            </NavLink>
            <NavLink to="/recruiter/settings" className={itemClass}>
              <Settings size={18} /> Settings
            </NavLink>
          </Section>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800">{pageTitle}</h2>
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50" type="button">
              <Bell size={18} />
            </button>
            <button
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-semibold hover:bg-slate-50"
              type="button"
              onClick={doLogout}
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
        <div className="p-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
