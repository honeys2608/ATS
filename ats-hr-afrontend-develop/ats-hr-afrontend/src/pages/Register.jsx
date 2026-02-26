import React, { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import {
  HiUser,
  HiEnvelope,
  HiLockClosed,
  HiCheckCircle,
  HiArrowRight,
} from "react-icons/hi2";

export default function Register() {
  const [step, setStep] = useState("form"); // form, otp, success
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationMethod] = useState("email"); // email only for UI consistency
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const navigate = useNavigate();
  const otpRef = useRef(null);

  // --- Frontend Validation Helper ---
  const validateForm = () => {
    if (!username.trim()) return "Username is required";

    if (!email.trim()) return "Email is required";

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Enter a valid email address";

    // Phone validation (basic)
    const phoneRegex =
      /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
    if (
      verificationMethod === "phone" &&
      !phoneRegex.test(phone.replace(/\s/g, ""))
    ) {
      return "Enter a valid phone number";
    }

    if (!password) return "Password is required";

    if (password.length < 8)
      return "Password must be at least 8 characters long";

    if (!/[A-Z]/.test(password))
      return "Password must contain at least one uppercase letter";

    if (!/[a-z]/.test(password))
      return "Password must contain at least one lowercase letter";

    if (!/[0-9]/.test(password))
      return "Password must contain at least one number";

    if (!/[@$!%*#?_&]/.test(password))
      return "Password must contain at least one special character";

    if (password !== confirmPassword) return "Passwords do not match";

    return null; // No errors
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Run validation
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      full_name: username.trim(),
      email: email.trim(),
      phone: verificationMethod === "phone" ? phone.trim() : null,
      password,
      confirm_password: confirmPassword,
      verification_method: verificationMethod, // email or phone
    };

    try {
      setLoading(true);

      const resp = await api.post("/auth/candidate/register", payload);

      // Backend returns user_id and sends OTP
      const returnedUserId = resp?.data?.user_id || resp?.data?.id;
      setUserId(returnedUserId);
      setStep("otp");
      setError("");
    } catch (err) {
      console.error("Register error:", err);

      const backendError =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Registration failed";

      setError(
        typeof backendError === "string"
          ? backendError
          : JSON.stringify(backendError),
      );
    } finally {
      setLoading(false);
    }
  };

  // --- STEP 2: Verify OTP ---
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");

    if (!otp.trim()) {
      setError("Please enter the OTP");
      return;
    }

    if (otp.trim().length < 4) {
      setError("OTP must be at least 4 digits");
      return;
    }

    try {
      setLoading(true);

      const resp = await api.post("/auth/verify-otp-registration", {
        user_id: userId,
        otp: otp.trim(),
      });

      // Success - OTP verified
      setStep("success");
      setError("");

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      console.error("OTP verification error:", err);

      const backendError =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Invalid or expired OTP";

      setError(backendError);
    } finally {
      setLoading(false);
    }
  };

  // --- Resend OTP ---
  const handleResendOtp = async () => {
    setError("");
    try {
      setLoading(true);

      await api.post("/auth/resend-otp", {
        user_id: userId,
        verification_method: verificationMethod,
      });

      setError("");
      setOtp("");
      otpRef.current?.focus();
    } catch (err) {
      console.error("Resend OTP error:", err);
      setError("Failed to resend OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
          {/* ===== STEP 1: REGISTRATION FORM ===== */}
          {step === "form" && (
            <>
              <h2 className="text-xl font-semibold mb-4">Register</h2>

              {error && (
                <div className="mb-4 text-sm text-red-200 bg-red-900/40 border border-red-500/40 px-3 py-2 rounded">
                  {error}
                </div>
              )}

              <form className="space-y-4" onSubmit={handleSubmit}>
                {/* USERNAME */}
                <div>
                  <label className="block text-sm font-medium mb-1">Full Name</label>
                  <div className="relative">
                    <HiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-300" />
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="
                      w-full pl-10 pr-4 py-3 rounded-lg
                      bg-[#0b0f1f] border border-[#20243a] text-white
                      focus:ring-2 focus:ring-emerald-400
                      focus:border-emerald-400
                    "
                      placeholder=""
                    />
                  </div>
                </div>

                {/* EMAIL */}
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <div className="relative">
                    <HiEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-300" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="
                      w-full pl-10 pr-4 py-3 rounded-lg
                      bg-[#0b0f1f] border border-[#20243a] text-white
                      focus:ring-2 focus:ring-emerald-400
                      focus:border-emerald-400
                    "
                      placeholder=""
                    />
                  </div>
                </div>

                {/* PHONE NUMBER - SHOW ONLY IF PHONE VERIFICATION SELECTED */}
                {verificationMethod === "phone" && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Phone (optional)</label>
                    <div className="relative">
                      <HiEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-300" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="
                        w-full pl-10 pr-4 py-3 rounded-lg
                        bg-[#0b0f1f] border border-[#20243a] text-white
                        focus:ring-2 focus:ring-emerald-400
                        focus:border-emerald-400
                      "
                        placeholder=""
                      />
                    </div>
                  </div>
                )}

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
                      focus:ring-2 focus:ring-emerald-400
                      focus:border-emerald-400
                    "
                      placeholder=""
                    />
                  </div>
                </div>

                {/* CONFIRM PASSWORD */}
                <div>
                  <label className="block text-sm font-medium mb-1">Confirm Password</label>
                  <div className="relative">
                    <HiLockClosed className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-300" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="
                      w-full pl-10 pr-4 py-3 rounded-lg
                      bg-[#0b0f1f] border border-[#20243a] text-white
                      focus:ring-2 focus:ring-emerald-400
                      focus:border-emerald-400
                    "
                      placeholder=""
                    />
                  </div>
                </div>

                {/* SUBMIT */}
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
                  {loading ? "Creating account..." : "Register"}
                  {!loading && <HiArrowRight />}
                </button>

                <div className="text-center text-sm mt-4 text-gray-300">
                  Already have an account?{" "}
                  <Link to="/login" className="text-emerald-300 font-medium">
                    Login
                  </Link>
                </div>
              </form>
            </>
          )}

          {/* ===== STEP 2: OTP VERIFICATION ===== */}
          {step === "otp" && (
            <>
              <h2 className="text-xl font-semibold mb-4">
                Verify {verificationMethod === "email" ? "Email" : "Phone"}
              </h2>
              <p className="text-gray-400 mb-6">
                We sent a code to your{" "}
                {verificationMethod === "email" ? email : phone}
              </p>

              {error && (
                <div className="mb-4 text-sm text-red-200 bg-red-900/40 border border-red-500/40 px-3 py-2 rounded">
                  {error}
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                {/* OTP INPUT */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Enter OTP Code
                  </label>
                  <input
                    ref={otpRef}
                    type="text"
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))
                    }
                    maxLength="6"
                    className="
                    w-full px-4 py-3 rounded-lg text-center text-2xl tracking-widest
                    bg-[#0b0f1f] border border-[#20243a] text-white
                    focus:ring-2 focus:ring-emerald-400
                    focus:border-emerald-400
                  "
                    placeholder="000000"
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    {otp.length}/6 digits entered
                  </p>
                </div>

                {/* SUBMIT OTP */}
                <button
                  type="submit"
                  disabled={loading || otp.length < 4}
                  className="
                  w-full flex items-center justify-center gap-2
                  bg-purple-600
                  text-white py-3 rounded-lg font-semibold
                  hover:bg-purple-700 transition
                  disabled:opacity-60
                "
                >
                  {loading ? "Verifying..." : "Verify OTP"}
                  {!loading && <HiCheckCircle />}
                </button>

                {/* RESEND OTP */}
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="
                  w-full text-sm text-emerald-300 font-medium
                  py-2 rounded-lg hover:bg-white/5 transition
                  disabled:opacity-60
                "
                >
                  Resend OTP
                </button>
              </form>
            </>
          )}

          {/* ===== STEP 3: SUCCESS ===== */}
          {step === "success" && (
            <div className="text-center py-8">
              <div className="flex justify-center mb-4">
                <div className="bg-emerald-500/20 p-4 rounded-full">
                  <HiCheckCircle className="text-4xl text-emerald-300" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Account Created!
              </h2>
              <p className="text-gray-400 mb-6">
                Your account has been verified. Redirecting to login...
              </p>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-300 mx-auto"></div>
            </div>
          )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
