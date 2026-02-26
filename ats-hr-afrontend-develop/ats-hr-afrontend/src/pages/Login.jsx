// src/pages/Login.jsx
import React, { useState, useRef, useEffect } from "react";
import { validateEmail } from "../utils/validators";
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
  finance_officer: "/finance",
  "finance officer": "/finance",
};

const normalizeRole = (role) =>
  String(role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
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
  // Password validation (enterprise-grade)
  const validatePassword = (pwd) => {
    if (!pwd || !pwd.trim()) return "Password is required";
    if (pwd.length < 8) return "Password must be at least 8 characters";
    if (pwd.length > 128) return "Password cannot exceed 128 characters";
    if (!/[A-Z]/.test(pwd)) return "Must include at least 1 uppercase letter";
    if (!/[a-z]/.test(pwd)) return "Must include at least 1 lowercase letter";
    if (!/[0-9]/.test(pwd)) return "Must include at least 1 number";
    if (!/[!@#$%^&*(),.?":{}|<>\[\]\\/~`_+=;'\-]/.test(pwd)) return "Must include at least 1 special character";
    // Reject common weak passwords
    const weak = ["password", "password123", "12345678", "qwerty", "letmein", "admin", "welcome"];
    if (weak.includes(pwd.toLowerCase())) return "Password is too weak";
    return null;
  };

  // Combined validation for login
  const validateLogin = () => {
    const emailErr = validateEmail(email);
    const pwdErr = validatePassword(password);
    setEmailError(emailErr || "");
    setPasswordError(pwdErr || "");
    if (emailErr) return emailErr;
    if (pwdErr) return pwdErr;
    return null;
  };

  // -----------------------------
  // SUBMIT
  // -----------------------------
  const handleEmailBlur = () => {
    setEmailError(validateEmail(email) || "");
  };

  const handlePasswordBlur = () => {
    setPasswordError(validatePassword(password) || "");
  };

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
      localStorage.setItem("role", normalizeRole(roleFromApi));

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
      const role = normalizeRole(roleFromApi);
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
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                  onBlur={handleEmailBlur}
                  className={`
                    w-full pl-10 pr-4 py-3 rounded-lg
                    bg-[#0b0f1f] border ${emailError ? "border-red-500" : "border-[#20243a]"} text-white
                    focus:outline-none
                    focus:ring-2 ${emailError ? "focus:ring-red-400" : "focus:ring-emerald-400"}
                    focus:border-emerald-400
                  `}
                  placeholder=""
                  autoComplete="username"
                  maxLength={254}
                />
                {emailError && (
                  <div className="text-red-400 text-xs mt-1">{emailError}</div>
                )}
              </div>
            </div>

            {/* PASSWORD */}
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <div className="relative">
                <HiLockClosed className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-300" />
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordError) setPasswordError("");
                    }}
                    onBlur={handlePasswordBlur}
                    className={`
                      w-full pl-10 pr-10 py-3 rounded-lg
                      bg-[#0b0f1f] border ${passwordError ? "border-red-500" : "border-[#20243a]"} text-white
                      focus:outline-none
                      focus:ring-2 ${passwordError ? "focus:ring-red-400" : "focus:ring-emerald-400"}
                      focus:border-emerald-400
                    `}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    maxLength={128}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-lg"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M9.88 9.88A3 3 0 0012 15a3 3 0 002.12-5.12M15 12a3 3 0 11-6 0 3 3 0 016 0zm6.36 2.64A9.77 9.77 0 0021 12c-1.73-4-5.33-7-9-7-1.13 0-2.22.18-3.24.5m-4.11 2.11A9.77 9.77 0 003 12c1.73 4 5.33 7 9 7 1.13 0 2.22-.18 3.24-.5m4.11-2.11L3 3" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm6.36 2.64A9.77 9.77 0 0021 12c-1.73-4-5.33-7-9-7-3.67 0-7.27 3-9 7a9.77 9.77 0 001.64 2.64m16.72 0A9.77 9.77 0 0121 12c-1.73-4-5.33-7-9-7-3.67 0-7.27 3-9 7a9.77 9.77 0 001.64 2.64" />
                      </svg>
                    )}
                  </button>
                </div>
                {passwordError && (
                  <div className="text-red-400 text-xs mt-1">{passwordError}</div>
                )}
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
              disabled={loading || !!emailError || !!passwordError || !email || !password}
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
