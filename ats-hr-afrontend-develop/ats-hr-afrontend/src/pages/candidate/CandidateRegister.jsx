import React, { useState } from "react";
import api from "../../api/axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function CandidateRegister() {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm_password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const nav = useNavigate();
  const { login } = useAuth();

  async function handleRegister(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (form.password !== form.confirm_password) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const resp = await api.post("/auth/candidate/register", {
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        confirm_password: form.confirm_password,
      });

      if (resp.data?.access_token && resp.data?.user) {
        // Store token and user using proper keys
        localStorage.setItem("access_token", resp.data.access_token);
        localStorage.setItem("user", JSON.stringify(resp.data.user));
        localStorage.setItem("role", "candidate");

        // Set axios default header
        api.defaults.headers.common["Authorization"] =
          `Bearer ${resp.data.access_token}`;

        alert("Account created successfully!");
        nav("/candidate/profile");
      } else {
        setError("Registration successful but token missing");
      }
    } catch (err) {
      console.error("Registration error:", err);
      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Registration failed",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Candidate Register</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-3">
        <input
          required
          placeholder="Full Name"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          className="w-full p-2 border rounded"
          disabled={loading}
        />

        <input
          required
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full p-2 border rounded"
          disabled={loading}
        />

        <input
          required
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="w-full p-2 border rounded"
          disabled={loading}
        />

        <input
          required
          type="password"
          placeholder="Confirm Password"
          value={form.confirm_password}
          onChange={(e) =>
            setForm({ ...form, confirm_password: e.target.value })
          }
          className="w-full p-2 border rounded"
          disabled={loading}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white p-2 rounded font-medium disabled:bg-gray-400"
        >
          {loading ? "Creating account..." : "Register"}
        </button>
      </form>

      <p className="text-sm mt-4 text-center">
        Already have an account?{" "}
        <a href="/login" className="text-indigo-600 font-medium">
          Login
        </a>
      </p>
    </div>
  );
}
