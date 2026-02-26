import { useEffect } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Bell,
  User,
  Briefcase,
  CheckCircle,
  CalendarDays,
  LogOut,
} from "lucide-react";

export default function CandidateLayout({ onLogout }) {
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
"flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200";

const active =
"bg-white/20 backdrop-blur text-white font-semibold border border-white/20";

const inactive =
"text-white/80 hover:bg-white/10 hover:text-white";


  const getPageTitle = () => {
    if (location.pathname.includes("dashboard")) return "Dashboard";
    if (location.pathname.includes("my-interviews")) return "My Interviews";
    if (location.pathname.includes("notifications")) return "Notifications & Alerts";
    if (location.pathname.includes("complete-profile")) return "Complete Profile";
    if (location.pathname.includes("apply-jobs")) return "Apply Jobs";
    if (location.pathname.includes("applied-jobs")) return "Applied Jobs";
    if (location.pathname.includes("my-applications")) return "My Applications";
    return "Candidate Portal";
  };

  const isCompleteProfilePage = location.pathname.includes("complete-profile");

  useEffect(() => {
    // Defensive cleanup: remove any stale full-screen overlays that block clicks
    const overlays = Array.from(document.querySelectorAll("div"))
      .filter((el) => {
        const cls = el.className || "";
        return (
          typeof cls === "string" &&
          cls.includes("fixed") &&
          cls.includes("inset-0") &&
          cls.includes("bg-black")
        );
      });

    overlays.forEach((el) => {
      el.style.pointerEvents = "none";
      el.style.display = "none";
    });
  }, []);

  return (
    <div className="min-h-screen flex bg-gray-50 relative z-[9999] pointer-events-auto">
      {/* SIDEBAR */}
      <aside className="w-56 flex-shrink-0 bg-gradient-to-b from-purple-600 to-emerald-500 text-white flex flex-col shadow-lg relative z-[60] pointer-events-auto">
        {/* Brand */}
        <div className="px-6 py-5 border-b border-white border-opacity-20">
          <h2 className="text-lg font-bold text-white">Candidate Portal</h2>
          <p className="text-xs text-white text-opacity-80">
            Explore & apply jobs
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          {/* Main Menu */}
          <div className="mb-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/70
 mb-2">
              Menu
            </div>
            <NavLink
              to="/candidate/dashboard"
              className={({ isActive }) =>
                `${navItem} ${isActive ? active : inactive}`
              }
            >
              <LayoutDashboard size={18} />
              Dashboard
            </NavLink>

            <NavLink
              to="/candidate/notifications"
              className={({ isActive }) =>
                `${navItem} ${isActive ? active : inactive}`
              }
            >
              <Bell size={18} />
              Notifications & Alerts
            </NavLink>

            <NavLink
              to="/candidate/complete-profile"
              className={({ isActive }) =>
                `${navItem} ${isActive ? active : inactive}`
              }
            >
              <User size={18} />
              Complete Profile
            </NavLink>
          </div>

          {/* Jobs */}
          <div className="mb-3">
            <div className="text-xs font-extrabold uppercase text-white tracking-wider mb-2">
              Jobs
            </div>
            <NavLink
              to="/candidate/apply-jobs"
              className={({ isActive }) =>
                `${navItem} ${isActive ? active : inactive}`
              }
            >
              <Briefcase size={18} />
              Apply Jobs
            </NavLink>

            <NavLink
              to="/candidate/applied-jobs"
              className={({ isActive }) =>
                `${navItem} ${isActive ? active : inactive}`
              }
            >
              <CheckCircle size={18} />
              Applied Jobs
            </NavLink>

            <NavLink
              to="/candidate/my-applications"
              className={({ isActive }) =>
                `${navItem} ${isActive ? active : inactive}`
              }
            >
              <Briefcase size={18} />
              My Applications
            </NavLink>

            <NavLink
              to="/candidate/my-interviews"
              className={({ isActive }) =>
                `${navItem} ${isActive ? active : inactive}`
              }
            >
              <CalendarDays size={18} />
              My Interviews
            </NavLink>
          </div>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-[60] pointer-events-auto">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0 flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-gray-800">
            {getPageTitle()}
          </h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-gray-700 hover:text-red-600 transition font-semibold"
          >
            <LogOut size={16} />
            Logout
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto bg-gray-50">
          {isCompleteProfilePage ? (
            <Outlet />
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
