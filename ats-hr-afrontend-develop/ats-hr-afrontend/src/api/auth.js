// src/api/auth.js
import api from "./axios";

// LOGIN
export const loginApi = (data) => {
  return api.post("/auth/login", data);
};

// REGISTER
export const registerApi = (data) => {
  return api.post("/auth/register", data);
};

// FORGOT PASSWORD → sends OTP to email
export const forgotPasswordApi = (email) => {
  return api.post("/auth/forgot-password", { email });
};

// VERIFY OTP
export const verifyOtpApi = (data) => {
  return api.post("/auth/verify-otp", data); 
  // backend expects: { email, otp }
};

// RESET PASSWORD
export const resetPasswordApi = (data) => {
  return api.post("/auth/reset-password", data);
  // backend expects: { email, otp, new_password }
};

// LOGOUT
export const logoutApi = () => {
  return api.post("/auth/logout");
};

// GET CURRENT USER
export const getMeApi = () => {
  return api.get("/auth/me");
};

// REFRESH TOKEN
export const refreshTokenApi = () => {
  return api.post("/auth/refresh");
};
