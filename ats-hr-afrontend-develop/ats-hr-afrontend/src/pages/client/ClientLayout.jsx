import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  Briefcase,
  FileText,
  Clock,
  LogOut,
} from "lucide-react";

export default function ClientLayout({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");

    if (onLogout) onLogout();
    navigate("/login", { replace: true });
  };

  // 🔥 UPDATED STYLES (Vendor-like)
  const navItem =
    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition";

  const active = "bg-blue-600 text-white";
  const inactive = "text-slate-200 hover:bg-slate-800";

  const getPageTitle = () => {
    if (location.pathname.includes("requirements")) return "Requirements";
    if (location.pathname.includes("deployments")) return "Deployments";
    if (location.pathname.includes("timesheets")) return "Timesheets";
    if (location.pathname.includes("invoices")) return "Invoices";
    return "Dashboard";
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* 🔥 SIDEBAR */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col">
        {/* Brand */}
        <div className="px-6 py-5 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">Client Portal</h2>
          <p className="text-xs text-slate-400">Manage hiring & billing</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          <NavLink
            to="/client/dashboard"
            className={({ isActive }) =>
              `${navItem} ${isActive ? active : inactive}`
            }
          >
            <LayoutDashboard size={18} />
            Dashboard
          </NavLink>

          <NavLink
            to="/client/requirements"
            className={({ isActive }) =>
              `${navItem} ${isActive ? active : inactive}`
            }
          >
            <ClipboardList size={18} />
            Requirements
          </NavLink>

          <NavLink
            to="/client/deployments"
            className={({ isActive }) =>
              `${navItem} ${isActive ? active : inactive}`
            }
          >
            <Briefcase size={18} />
            Deployments
          </NavLink>

          <NavLink
            to="/client/timesheets"
            className={({ isActive }) =>
              `${navItem} ${isActive ? active : inactive}`
            }
          >
            <Clock size={18} />
            Timesheets
          </NavLink>
          <NavLink
            to="/client/timesheet-history"
            className={({ isActive }) =>
              `${navItem} ${isActive ? active : inactive}`
            }
          >
            <Clock size={18} />
            Timesheet History
          </NavLink>

          <NavLink
            to="/client/invoices"
            className={({ isActive }) =>
              `${navItem} ${isActive ? active : inactive}`
            }
          >
            <FileText size={18} />
            Invoices
          </NavLink>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-red-400 hover:text-red-500"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b px-6 py-4">
          <h1 className="text-xl font-semibold text-gray-800">
            {getPageTitle()}
          </h1>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
