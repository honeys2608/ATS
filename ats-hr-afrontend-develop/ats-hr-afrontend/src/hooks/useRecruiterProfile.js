import { useState, useEffect } from "react";
import {
  getRecruiterProfile,
  updateRecruiterProfile,
  validateFullName,
  validatePhone,
} from "../services/recruiterService";

/**
 * Custom hook for managing recruiter profile state and operations
 * @returns {Object} Profile state, loading, error, and action functions
 */
export const useRecruiterProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  /**
   * Load recruiter profile from API
   */
  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getRecruiterProfile();
      setProfile(data);
    } catch (err) {
      const errorMsg = err.response?.data?.detail || "Failed to load profile";
      setError(errorMsg);
      console.error("Failed to load recruiter profile:", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update recruiter profile with validation
   * @param {Object} profileData - Profile data to update
   * @returns {Object} { success: boolean, error: string|null, data: Object }
   */
  const updateProfile = async (profileData) => {
    // Validate before sending
    const errors = {};

    if (profileData.full_name !== undefined) {
      const fullNameErr = validateFullName(profileData.full_name);
      if (fullNameErr) errors.full_name = fullNameErr;
    }

    if (profileData.phone !== undefined) {
      const phoneErr = validatePhone(profileData.phone);
      if (phoneErr) errors.phone = phoneErr;
    }

    // Return validation errors
    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        errors,
        error: "Validation failed",
        data: null,
      };
    }

    // Send to API
    try {
      const updated = await updateRecruiterProfile(profileData);
      setProfile(updated);
      return {
        success: true,
        errors: {},
        error: null,
        data: updated,
      };
    } catch (err) {
      const errorMsg = err.response?.data?.detail || "Failed to update profile";
      setError(errorMsg);
      return {
        success: false,
        errors: { submit: errorMsg },
        error: errorMsg,
        data: null,
      };
    }
  };

  /**
   * Validate profile field locally without API call
   * @param {string} fieldName - Field to validate (full_name, phone)
   * @param {string} value - Value to validate
   * @returns {string|null} Error message or null if valid
   */
  const validateField = (fieldName, value) => {
    if (fieldName === "full_name") {
      return validateFullName(value);
    } else if (fieldName === "phone") {
      return validatePhone(value);
    }
    return null;
  };

  return {
    profile,
    loading,
    error,
    loadProfile,
    updateProfile,
    validateField,
  };
};
