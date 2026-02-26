// src/pages/CandidateLogin.jsx
import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

export default function CandidateLogin() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setTokenAndUser } = useAuth ? useAuth() : { setTokenAndUser: null };

  // keep backward-compatible param names:
  const applyJob = searchParams.get("applyJob");
  const redirect = searchParams.get("redirect");

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await api.post("/auth/login", form);

      const token = res?.data?.access_token;
      const user = res?.data?.user;

      if (!token) {
        setError("Login succeeded but no token returned from server.");
        setLoading(false);
        return;
      }

      // Store token and user properly
      localStorage.setItem("access_token", token);
      if (user) {
        localStorage.setItem("user", JSON.stringify(user));
      }
      localStorage.setItem("role", "candidate");

      // Set axios default header
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      // Call AuthContext if available
      try {
        if (typeof setTokenAndUser === "function") {
          setTokenAndUser(token, user);
        }
      } catch (ctxErr) {
        console.warn("setTokenAndUser threw:", ctxErr);
      }

      // Decide where to redirect
      if (redirect) {
        if (redirect.startsWith("/")) navigate(redirect);
        else navigate("/candidate/dashboard");
      } else if (applyJob) {
        // keep applyJob as query param for candidate portal to handle auto-apply or focus
        navigate(`/candidate/dashboard?applyJob=${encodeURIComponent(applyJob)}`);
      } else {
        navigate("/candidate/dashboard");
      }
    } catch (err) {
      console.error("Candidate login failed:", err);
      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Login failed",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto p-6 bg-white rounded shadow">
      <h2 className="text-xl font-semibold mb-4">Candidate Login</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-3">
        <input
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="Email"
          className="w-full border p-2 rounded disabled:bg-gray-100"
          type="email"
          disabled={loading}
        />
        <input
          required
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          type="password"
          placeholder="Password"
          className="w-full border p-2 rounded disabled:bg-gray-100"
          disabled={loading}
        />
        <div className="flex gap-2">
          <button
            disabled={loading}
            type="submit"
            className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded font-medium disabled:bg-gray-400"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <button
            type="button"
            onClick={() => navigate("/candidate/register")}
            className="flex-1 px-3 py-2 border rounded hover:bg-gray-50 font-medium"
            disabled={loading}
          >
            Register
          </button>
        </div>
      </form>

      <p className="text-xs text-gray-500 mt-3">
        Admin? Use the{" "}
        <a href="/login" className="text-indigo-600 underline">
          admin login
        </a>
      </p>
    </div>
  );
}
