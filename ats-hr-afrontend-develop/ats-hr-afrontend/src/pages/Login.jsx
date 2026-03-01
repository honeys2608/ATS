// src/pages/Login.jsx
import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import {
  HiEnvelope,
  HiLockClosed,
  HiArrowRight,
} from "react-icons/hi2";

/**
 * SINGLE source of truth for role → dashboard mapping
 */
const ROLE_DASHBOARD_MAP = {
  admin: "/dashboard",
  super_admin: "/super-admin/dashboard",
  recruiter: "/recruiter/dashboard",
  employee: "/employee/dashboard",
  candidate: "/candidate/dashboard",
  account_manager: "/account-manager/dashboard",
  client: "/client/dashboard",
  consultant: "/consultant/dashboard",
  vendor: "/vendor/dashboard",
};

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const emailRef = useRef(null);
  const errorRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  // -----------------------------
  // FRONTEND VALIDATION
  // -----------------------------
  const validateLogin = () => {
    if (!email.trim()) return "Email or username is required";
    if (!password.trim()) return "Password is required";
    if (password.length < 3) return "Password must be at least 3 characters";
    return null;
  };

  // -----------------------------
  // SUBMIT
  // -----------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const validationError = validateLogin();
    if (validationError) {
      setError(validationError);
      setTimeout(() => errorRef.current?.focus?.(), 50);
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("/auth/login", { email, password });

      // Support multiple backend response shapes
      const token =
        response?.data?.access_token ||
        response?.data?.accessToken ||
        response?.data?.token;

      const userFromApi = response?.data?.user || response?.data || null;

      const roleFromApi =
        response?.data?.role ||
        response?.data?.user?.role ||
        (userFromApi && userFromApi.role) ||
        "employee";

      if (!token) {
        throw new Error("No token received from server");
      }

      // -----------------------------
      // PERSIST AUTH STATE
      // -----------------------------
      localStorage.setItem("access_token", token);
      localStorage.setItem("role", String(roleFromApi).toLowerCase());

      if (userFromApi && typeof userFromApi === "object") {
        localStorage.setItem("user", JSON.stringify(userFromApi));
      }

      // Set axios header for this session
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      // Inform App.jsx that login succeeded
      if (typeof onLogin === "function") {
        onLogin();
      }

      // -----------------------------
      // ROLE-BASED REDIRECT
      // -----------------------------
      const role = String(roleFromApi).toLowerCase();
      const dashboardPath = ROLE_DASHBOARD_MAP[role] || "/dashboard";

      navigate(dashboardPath, { replace: true });
    } catch (err) {
      console.error("Login error:", {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
      });

      // Handle unverified account specially
      if (err.response?.status === 403) {
        const detail = err.response?.data?.detail;
        if (typeof detail === "object" && detail?.unverified) {
          // Redirect to verification page with user_id
          navigate("/verify-account", {
            state: {
              user_id: detail.user_id,
              verification_method: detail.verification_method,
              email: email,
            },
          });
          return;
        }
      }

      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        (typeof err?.response?.data?.detail === "object"
          ? err?.response?.data?.detail?.message
          : null) ||
        err?.message ||
        "Login failed - please try again";

      setError(msg);
      setTimeout(() => errorRef.current?.focus?.(), 50);
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div className="min-h-screen bg-[#f5f7fb] text-gray-900">
      <style>{`
        .hero-card {
          background: linear-gradient(135deg, #0b1224 0%, #111827 45%, #1b1740 100%);
        }
        .hero-anim {
          background: linear-gradient(120deg, rgba(124,58,237,0.18), rgba(16,185,129,0.12), rgba(124,58,237,0.18));
          background-size: 200% 200%;
          animation: heroShift 24s ease infinite;
        }
        @keyframes heroShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-anim { animation: none; }
        }
      `}</style>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white text-gray-900 shadow-sm z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <nav className="flex items-center gap-3 text-sm font-medium">
            <Link
              to="/#what-we-do"
              className="px-4 py-2 rounded-full border border-gray-200 text-gray-700 hover:border-purple-300 hover:text-purple-600"
            >
              What We Do
            </Link>
            <Link
              to="/#who-we-are"
              className="px-4 py-2 rounded-full border border-gray-200 text-gray-700 hover:border-purple-300 hover:text-purple-600"
            >
              Who We Are
            </Link>
            <Link
              to="/#jobs"
              className="px-4 py-2 rounded-full bg-purple-600 text-white hover:bg-purple-700"
            >
              Jobs
            </Link>
          </nav>
          <div className="text-2xl font-extrabold text-purple-600">ATS-HR</div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 rounded-full border border-purple-600 text-purple-600 text-sm font-semibold hover:bg-purple-50"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="px-4 py-2 rounded-full bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700"
            >
              Register
            </Link>
          </div>
        </div>
      </header>

      <div className="pt-28 pb-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="hero-card rounded-3xl shadow-2xl overflow-hidden relative">
            <div className="absolute inset-0 hero-anim" aria-hidden="true" />
            <div
              className="relative px-6 py-14 md:px-12"
              onClick={() => navigate("/careers")}
              role="presentation"
            >
              <div
                className="max-w-md mx-auto bg-[#0f1224] text-white rounded-2xl shadow-xl border border-white/10 p-7"
                onClick={(e) => e.stopPropagation()}
                role="presentation"
              >
                <h2 className="text-xl font-semibold mb-4">Login</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* EMAIL */}
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <div className="relative">
                <HiEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-300" />
                <input
                  ref={emailRef}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="
                  w-full pl-10 pr-4 py-3 rounded-lg
                  bg-[#0b0f1f] border border-[#20243a] text-white
                  focus:outline-none
                  focus:ring-2 focus:ring-emerald-400
                  focus:border-emerald-400
                "
                  placeholder=""
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <div className="relative">
                <HiLockClosed className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-300" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="
                  w-full pl-10 pr-4 py-3 rounded-lg
                  bg-[#0b0f1f] border border-[#20243a] text-white
                  focus:outline-none
                  focus:ring-2 focus:ring-emerald-400
                  focus:border-emerald-400
                "
                  placeholder="Enter password"
                />
              </div>
            </div>

            {/* ERROR */}
            {error && (
              <div
                ref={errorRef}
                tabIndex={-1}
                className="bg-red-900/40 border border-red-500/40 text-red-200 px-4 py-3 rounded-lg text-sm"
              >
                {error}
              </div>
            )}

            {/* BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="
              w-full flex items-center justify-center gap-2
              bg-purple-600
              text-white py-3 rounded-lg font-semibold
              hover:bg-purple-700 transition
              disabled:opacity-60
            "
            >
              {loading ? "Signing in..." : "Login"}
              {!loading && <HiArrowRight />}
            </button>

            {/* LINKS */}
            <div className="flex justify-between text-sm text-gray-300">
              <Link to="/forgot-password" className="text-emerald-300">
                Forgot password?
              </Link>
              <Link to="/register" className="text-gray-300">
                Register
              </Link>
            </div>
          </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;