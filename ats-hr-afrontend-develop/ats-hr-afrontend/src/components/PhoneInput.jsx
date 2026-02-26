// src/components/PhoneInput.jsx
import React, { useState, useEffect } from "react";
import { COUNTRY_CODES, validatePhoneForCountry } from "../utils/countryData";

export const PhoneInput = ({
  value = "",
  onChange,
  error,
  editable = true,
}) => {
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [realTimeError, setRealTimeError] = useState("");

  // Parse phone value to extract country code and number
  useEffect(() => {
    if (value) {
      // Check if value starts with a country code
      const matchedCountry = COUNTRY_CODES.find((c) =>
        value.startsWith(c.code),
      );

      if (matchedCountry) {
        setCountryCode(matchedCountry.code);
        const digitsOnly = value
          .replace(matchedCountry.code, "")
          .replace(/\D/g, "");
        setPhoneNumber(digitsOnly);
      } else {
        // Try to extract just digits
        const digitsOnly = value.replace(/\D/g, "");
        setPhoneNumber(digitsOnly);
      }
    }
  }, []);

  // Get current country details
  const currentCountry = COUNTRY_CODES.find((c) => c.code === countryCode);

  // Handle country code change
  const handleCountryChange = (e) => {
    setCountryCode(e.target.value);
    setRealTimeError("");
    validateAndUpdate(phoneNumber, e.target.value);
  };

  // Handle phone number input with real-time validation
  const handlePhoneChange = (e) => {
    let val = e.target.value;

    // Allow only digits for input
    val = val.replace(/\D/g, "");

    // Limit based on country digits
    if (currentCountry && val.length > currentCountry.digits) {
      val = val.slice(0, currentCountry.digits);
    }

    setPhoneNumber(val);
    validateAndUpdate(val, countryCode);
  };

  // Validate and update
  const validateAndUpdate = (digits, code) => {
    if (!digits) {
      setRealTimeError("");
      onChange("");
      return;
    }

    const error = validatePhoneForCountry(code, digits);

    if (error) {
      setRealTimeError(error);
      onChange(""); // Don't set invalid phone
    } else {
      setRealTimeError("");
      const fullPhone = code + " " + digits;
      onChange(fullPhone);
    }
  };

  const country = COUNTRY_CODES.find((c) => c.code === countryCode);
  const displayError = error || realTimeError;

  return (
    <div>
      <label className="text-sm font-medium block mb-2">
        Phone Number <span className="text-red-500">*</span>
      </label>

      <div className="flex gap-2">
        {/* Country Code Selector */}
        <select
          value={countryCode}
          onChange={handleCountryChange}
          disabled={!editable}
          className={`border p-2 rounded disabled:bg-gray-100 min-w-fit ${
            displayError
              ? "border-red-500 focus:ring-2 focus:ring-red-300"
              : "border-gray-300 focus:ring-2 focus:ring-indigo-300"
          }`}
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} {c.country}
            </option>
          ))}
        </select>

        {/* Phone Number Input */}
        <input
          type="tel"
          value={phoneNumber}
          onChange={handlePhoneChange}
          disabled={!editable}
          placeholder={`Enter ${country?.digits || 10} digit number`}
          maxLength={country?.digits || 15}
          className={`border p-2 w-full rounded disabled:bg-gray-100 transition-colors ${
            displayError
              ? "border-red-500 bg-red-50 focus:ring-2 focus:ring-red-300"
              : "border-gray-300 focus:ring-2 focus:ring-indigo-300"
          }`}
        />
      </div>

      {/* Real-time error message */}
      {displayError && (
        <span className="text-red-500 text-xs mt-1 block">{displayError}</span>
      )}

      {/* Format hint */}
      {country && (
        <p className="text-xs text-gray-500 mt-2">Format: {country.format}</p>
      )}

      {/* Helper text */}
      {!displayError && phoneNumber && (
        <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
          ✓ Valid {country?.country} phone number
        </p>
      )}
    </div>
  );
};
