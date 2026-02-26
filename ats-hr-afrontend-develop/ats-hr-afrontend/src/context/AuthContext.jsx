// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "../api/axios";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("access_token");
    const storedUser = localStorage.getItem("user");

    if (storedToken) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${storedToken}`;
    }

    if (storedToken && storedUser) {
      const parsed = JSON.parse(storedUser);
      setUser(parsed);
      setToken(storedToken);
      // ensure role saved too (backwards-compat)
      if (parsed.role) localStorage.setItem("role", parsed.role.toLowerCase());
      setLoading(false);
      return;
    }

    if (storedToken && !storedUser) {
      axios
        .get("/auth/me")
        .then((res) => {
          setUser(res.data);
          setToken(storedToken);
          localStorage.setItem("user", JSON.stringify(res.data));
          if (res.data.role)
            localStorage.setItem("role", res.data.role.toLowerCase());
        })
        .catch(() => {
          localStorage.removeItem("access_token");
          localStorage.removeItem("user");
          localStorage.removeItem("role");
          delete axios.defaults.headers.common["Authorization"];
        })
        .finally(() => setLoading(false));
      return;
    }

    setLoading(false);
  }, []);

  const login = async ({ email, password }) => {
    const res = await axios.post("/auth/login", { email, password });
    const { access_token, user } = res.data;

    setUser(user);
    setToken(access_token);
    axios.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;

    localStorage.setItem("access_token", access_token);
    localStorage.setItem("user", JSON.stringify(user));
    if (user.role) localStorage.setItem("role", user.role.toLowerCase());

    return user;
  };

  const logout = async () => {
    try {
      await axios.post("/auth/logout");
    } catch (e) {
      // ignore
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    localStorage.removeItem("role");
    delete axios.defaults.headers.common["Authorization"];
  };

  const setTokenAndUser = (newToken, newUser) => {
    if (newToken) {
      setToken(newToken);
      localStorage.setItem("access_token", newToken);
      axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
    }
    if (newUser) {
      setUser(newUser);
      localStorage.setItem("user", JSON.stringify(newUser));
    }
  };

  const value = {
    user,
    role: (user?.role || localStorage.getItem("role") || "").toLowerCase(),
    token,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    setTokenAndUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
