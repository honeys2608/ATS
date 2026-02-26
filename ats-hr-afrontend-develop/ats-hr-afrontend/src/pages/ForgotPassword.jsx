// src/pages/ForgotPassword.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { forgotPasswordApi } from "../api/auth";
import { HiEnvelope, HiArrowRight } from "react-icons/hi2";

// -----------------------------
// VALIDATION SCHEMA
// -----------------------------
const schema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),
});

export default function ForgotPassword() {
  const [serverError, setServerError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
  });

  // -----------------------------
  // SUBMIT HANDLER
  // -----------------------------
  const onSubmit = async (data) => {
    setServerError(null);
    setSuccessMsg(null);

    try {
      await forgotPasswordApi({ email: data.email });

      setSuccessMsg("If the email exists, an OTP has been sent to your inbox.");
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to process request";

      setServerError(msg);
    }
  };

  const formError = errors?.email?.message ? String(errors.email.message) : null;

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
                <h2 className="text-xl font-semibold mb-1">Forgot Password</h2>
                <p className="text-sm text-gray-400 mb-6">
                  Enter your email and we’ll send you an OTP.
                </p>

                {/* ERROR */}
                {(serverError || formError) && (
                  <div className="mb-4 bg-red-900/40 border border-red-500/40 text-red-200 px-4 py-3 rounded-lg text-sm">
                    {serverError || formError}
                  </div>
                )}

                {/* SUCCESS */}
                {successMsg && (
                  <div className="mb-4 bg-emerald-900/30 border border-emerald-500/30 text-emerald-200 px-4 py-3 rounded-lg text-sm">
                    {successMsg}
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  {/* EMAIL */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Email
                    </label>
                    <div className="relative">
                      <HiEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-300" />
                      <input
                        {...register("email")}
                        autoFocus
                        type="email"
                        placeholder=""
                        className={`
                        w-full pl-10 pr-4 py-3 rounded-lg
                        bg-[#0b0f1f] border text-white
                        focus:outline-none focus:ring-2
                        ${
                          errors.email
                            ? "border-red-500/40 focus:ring-red-400 focus:border-red-400"
                            : "border-[#20243a] focus:ring-emerald-400 focus:border-emerald-400"
                        }
                      `}
                      />
                    </div>
                  </div>

                  {/* BUTTON */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="
                    w-full flex items-center justify-center gap-2
                    bg-purple-600
                    text-white py-3 rounded-lg font-semibold
                    hover:bg-purple-700 transition
                    disabled:opacity-60
                  "
                  >
                    {isSubmitting ? "Sending..." : "Send OTP"}
                    {!isSubmitting && <HiArrowRight />}
                  </button>

                  {/* LINKS */}
                  <div className="flex justify-between text-sm text-gray-300">
                    <Link to="/login" className="text-emerald-300">
                      Back to login
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
