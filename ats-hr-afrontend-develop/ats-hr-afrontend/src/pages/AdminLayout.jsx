import React, { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  FolderKanban,
  ClipboardList,
  FileText,
  CalendarDays,
  MessageSquare,
  Building2,
  ShieldCheck,
  UserCog,
  Settings,
  User,
  BarChart3,
  Wallet,
  GraduationCap,
  Megaphone,
  LogOut,
  Handshake,
  BadgeCheck,
  Network,
  FileSignature,
} from "lucide-react";

const NAV_SECTIONS = [
  {
    title: "Overview",
    defaultOpen: true,
    items: [
      {
        label: "Dashboard",
        to: "/dashboard",
        icon: LayoutDashboard,
        roles: ["admin", "recruiter", "employee", "internal_hr"],
      },
    ],
  },
  {
    title: "Talent Acquisition",
    items: [
      {
        label: "Jobs",
        to: "/jobs",
        icon: Briefcase,
        roles: ["admin", "recruiter"],
      },
      {
        label: "Job Submissions",
        to: "/recruitment/jobs/submissions",
        icon: ClipboardList,
        roles: ["admin", "recruiter", "account_manager"],
      },
    ],
  },
  {
    title: "Candidate Management",
    items: [
      {
        label: "Candidate Intake",
        to: "/candidates",
        icon: Users,
        roles: ["admin", "recruiter"],
      },
      {
        label: "Candidate Pool",
        to: "/matching",
        icon: FolderKanban,
        roles: ["admin", "recruiter"],
      },
      {
        label: "Candidate Profile",
        to: "/candidates/:id",
        icon: User,
        roles: ["admin", "recruiter"],
      },
      {
        label: "Background Verification",
        to: "/candidates/verification",
        icon: ShieldCheck,
        roles: ["admin", "internal_hr"],
      },
    ],
  },
  {
    title: "Interviews",
    items: [
      {
        label: "Interview Calendar",
        to: "/interviews/calendar",
        icon: CalendarDays,
        roles: ["admin", "recruiter", "account_manager"],
      },
      {
        label: "Interview Schedule",
        to: "/interviews",
        icon: ClipboardList,
        roles: ["admin", "recruiter"],
      },
      {
        label: "Interview Logs",
        to: "/interviews/logs",
        icon: FileText,
        roles: ["admin", "recruiter", "account_manager"],
      },
    ],
  },
  {
    title: "Boarding Procedures",
    items: [
      {
        label: "Offer Letter",
        to: "/offer-letter",
        icon: FileSignature,
        roles: ["admin", "internal_hr"],
      },
      {
        label: "Onboarding",
        to: "/onboarding",
        icon: ClipboardList,
        roles: ["admin", "internal_hr"],
      },
    ],
  },
  {
    title: "Consultant Management",
    items: [
      {
        label: "Consultant Pool",
        to: "/consultants",
        icon: Users,
        roles: [
          "admin",
          "consultant_manager",
          "account_manager",
          "internal_hr",
        ],
      },
      {
        label: "Client Management",
        to: "/clients",
        icon: Building2,
        roles: ["admin", "account_manager"],
      },
      {
        label: "Contract Management",
        to: "/contracts",
        icon: FileText,
        roles: ["admin", "account_manager"],
      },
      {
        label: "Consultant Deployments",
        to: "/consultant-deployments",
        icon: Handshake,
        roles: ["admin", "account_manager"],
      },
    ],
  },
  {
    title: "Employee Management",
    items: [
      {
        label: "Employees",
        to: "/employees",
        icon: Users,
        roles: ["admin", "internal_hr"],
      },
      {
        label: "Employee Dashboard",
        to: "/employee/dashboard",
        icon: LayoutDashboard,
        roles: ["employee"],
      },
      {
        label: "Employee Directory",
        to: "/employees/directory",
        icon: FileText,
        roles: ["admin", "internal_hr"],
      },
      {
        label: "Leaves",
        to: "/leaves",
        icon: ClipboardList,
        roles: ["admin", "internal_hr", "employee"],
      },
      {
        label: "Attendance",
        to: "/attendance",
        icon: ClipboardList,
        roles: ["admin", "employee", "internal_hr", "recruiter"],
      },
      {
        label: "Performance",
        to: "/performance",
        icon: BarChart3,
        roles: ["admin", "employee", "recruiter"],
      },
      {
        label: "Payroll",
        to: "/payroll",
        icon: Wallet,
        roles: ["admin", "internal_hr"],
      },
      {
        label: "Invoices",
        to: "/invoices",
        icon: FileText,
        roles: ["admin", "internal_hr", "finance"],
      },
      {
        label: "Alumni",
        to: "/alumni",
        icon: GraduationCap,
        roles: ["admin", "employee", "internal_hr"],
      },
    ],
  },
  {
    title: "Client Section",
    items: [
      {
        label: "Client List",
        to: "/clients",
        icon: Building2,
        roles: ["admin", "account_manager"],
      },
      {
        label: "Client Requirements",
        to: "/client/requirements",
        icon: ClipboardList,
        roles: ["client", "admin"],
      },
      {
        label: "Client Deployments",
        to: "/client/deployments",
        icon: Handshake,
        roles: ["client", "admin"],
      },
      {
        label: "Client Invoices",
        to: "/client/invoices",
        icon: FileText,
        roles: ["client", "admin"],
      },
      {
        label: "Client Timesheets",
        to: "/client/timesheets",
        icon: ClipboardList,
        roles: ["client", "admin"],
      },
    ],
  },
  {
    title: "MarCom",
    items: [
      {
        label: "Leads",
        to: "/leads",
        icon: Megaphone,
        roles: ["admin"],
      },
      {
        label: "Campaigns",
        to: "/campaigns",
        icon: Megaphone,
        roles: ["admin"],
      },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        label: "User Management",
        to: "/users",
        icon: UserCog,
        roles: ["admin"],
      },
      {
        label: "Roles",
        to: "/roles",
        icon: ShieldCheck,
        roles: ["admin"],
      },
      {
        label: "Permissions",
        to: "/permissions",
        icon: ShieldCheck,
        roles: ["admin"],
      },
      {
        label: "Roles List",
        to: "/roles-list",
        icon: FileText,
        roles: ["admin"],
      },
      {
        label: "Permissions List",
        to: "/permissions-list",
        icon: FileText,
        roles: ["admin"],
      },
      {
        label: "Role-Permission Matrix",
        to: "/role-permission-matrix",
        icon: ShieldCheck,
        roles: ["admin"],
      },
      {
        label: "Settings",
        to: "/settings",
        icon: Settings,
        roles: ["admin"],
      },
    ],
  },
];

const hasAccess = (roles, currentRole) => {
  if (!roles || roles.length === 0) return true;
  if (currentRole === "consultant" && roles.includes("employee")) {
    return true;
  }
  return roles.includes(currentRole);
};

export default function AdminLayout({ onLogout, children, currentRole }) {
  const role = (
    currentRole ||
    localStorage.getItem("role") ||
    "admin"
  ).toLowerCase();
  const location = useLocation();
  const navigate = useNavigate();
  const [openSections, setOpenSections] = useState(() => {
    const initial = {};
    NAV_SECTIONS.forEach((section) => {
      initial[section.title] = !!section.defaultOpen;
    });
    return initial;
  });

  const filteredSections = useMemo(() => {
    return NAV_SECTIONS.map((section) => {
      const visibleItems = section.items.filter((item) =>
        hasAccess(item.roles, role),
      );
      return { ...section, items: visibleItems };
    }).filter((section) => section.items.length > 0);
  }, [role]);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes("/dashboard")) return "Admin Dashboard";
    if (path.includes("/recruiter/dashboard")) return "Recruiter Dashboard";
    if (path.includes("/jobs")) return "Jobs";
    if (path.includes("/recruitment/jobs/submissions"))
      return "Job Submissions";
    if (path.includes("/candidates/verification"))
      return "Background Verification";
    if (path.includes("/candidates/bulk-actions")) return "Bulk Actions";
    if (path.includes("/candidates")) return "Candidate Intake";
    if (path.includes("/matching")) return "Candidate Pool";
    if (path.includes("/interviews/calendar")) return "Interview Calendar";
    if (path.includes("/interviews/logs")) return "Interview Logs";
    if (path.includes("/interviews")) return "Interview Schedule";
    if (path.includes("/onboarding")) return "Onboarding";
    if (path.includes("/offer-letter")) return "Offer Letter";
    if (path.includes("/consultant-deployments"))
      return "Consultant Deployments";
    if (path.includes("/consultants")) return "Consultant Pool";
    if (path.includes("/employees/directory")) return "Employee Directory";
    if (path.includes("/employee/dashboard")) return "Employee Dashboard";
    if (path.includes("/employees")) return "Employees";
    if (path.includes("/leaves")) return "Leaves";
    if (path.includes("/attendance")) return "Attendance";
    if (path.includes("/performance")) return "Performance";
    if (path.includes("/payroll")) return "Payroll";
    if (path.includes("/invoices")) return "Invoices";
    if (path.includes("/alumni")) return "Alumni";
    if (path.includes("/client/requirements")) return "Client Requirements";
    if (path.includes("/client/deployments")) return "Client Deployments";
    if (path.includes("/client/invoices")) return "Client Invoices";
    if (path.includes("/client/timesheets")) return "Client Timesheets";
    if (path.includes("/clients")) return "Client List";
    if (path.includes("/leads")) return "Leads";
    if (path.includes("/campaigns")) return "Campaigns";
    if (path.includes("/users")) return "User Management";
    if (path.includes("/roles-list")) return "Roles List";
    if (path.includes("/permissions-list")) return "Permissions List";
    if (path.includes("/role-permission-matrix"))
      return "Role-Permission Matrix";
    if (path.includes("/roles")) return "Roles";
    if (path.includes("/permissions")) return "Permissions";
    if (path.includes("/settings")) return "Settings";
    return "Admin Panel";
  };

  const navItem =
    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition duration-200";
  const active = "bg-white text-gray-900 font-semibold shadow";
  const inactive =
    "text-white/90 hover:bg-white/20 hover:text-white transition-all";

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    if (onLogout) onLogout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-72 flex-shrink-0 bg-gradient-to-b from-purple-600 to-emerald-500 text-white flex flex-col shadow-lg">
        <div className="px-6 py-5 border-b border-white/20">
          <h2 className="text-lg font-bold text-white">Admin Portal</h2>
          <p className="text-xs text-white/80">Enterprise HR Console</p>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-3 overflow-y-auto">
          {filteredSections.map((section) => (
            <div key={section.title} className="mb-2">
              <button
                type="button"
                onClick={() =>
                  setOpenSections((prev) => ({
                    ...prev,
                    [section.title]: !prev[section.title],
                  }))
                }
                className="w-full flex items-center justify-between px-3 py-2 text-white/90 hover:bg-white/10 rounded-lg"
              >
                <span className="text-xs font-extrabold uppercase tracking-wider">
                  {section.title}
                </span>
                <span className="text-xs">
                  {openSections[section.title] ? "-" : "+"}
                </span>
              </button>

              {openSections[section.title] && (
                <div className="mt-2 space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    if (item.disabled) {
                      return (
                        <div
                          key={item.label}
                          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-white/50 cursor-not-allowed"
                        >
                          <Icon size={18} />
                          <span>{item.label}</span>
                        </div>
                      );
                    }
                    return (
                      <NavLink
                        key={item.label}
                        to={item.to}
                        end={
                          item.to === "/interviews" || item.to === "/employees"
                        }
                        className={({ isActive }) =>
                          `${navItem} ${isActive ? active : inactive}`
                        }
                      >
                        <Icon size={18} />
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-gradient-to-r from-purple-600 to-emerald-500 px-6 py-4 flex items-center justify-between text-white shadow-sm">
          <h1 className="text-xl font-extrabold text-white">
            {getPageTitle()}
          </h1>
          <div className="flex items-center gap-4">
            {/* Search Box */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search candidates..."
                className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/20 transition-all duration-200 w-64"
              />
              <svg
                className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/70"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm bg-white/20 hover:bg-white/30 text-white border border-white/30 hover:border-white/50 transition-all duration-200 font-semibold px-4 py-2 rounded-lg shadow-sm"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto bg-gray-50">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            {children ? children : <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
}
