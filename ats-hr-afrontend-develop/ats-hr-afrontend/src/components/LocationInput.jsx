// src/components/LocationInput.jsx
import React, { useState, useRef, useEffect } from "react";
import { FiX, FiCheck } from "react-icons/fi";

const COMMON_CITIES = [
  "Bangalore",
  "Mumbai",
  "Delhi",
  "Hyderabad",
  "Chennai",
  "Pune",
  "Kolkata",
  "Ahmedabad",
  "Jaipur",
  "Chandigarh",
  "Lucknow",
  "Indore",
  "Bhopal",
  "Gurgaon",
  "Noida",
  "Thane",
  "Visakhapatnam",
  "Nashik",
  "Baroda",
  "Nagpur",
  "New York",
  "Los Angeles",
  "Chicago",
  "Houston",
  "Phoenix",
  "San Francisco",
  "London",
  "Manchester",
  "Paris",
  "Berlin",
  "Amsterdam",
  "Toronto",
  "Sydney",
];

const PINCODE_REGEX = /^[0-9]{6}$/;

export const LocationInput = ({
  location,
  city,
  pincode,
  onLocationChange,
  onCityChange,
  onPincodeChange,
  editable = true,
  errors = {},
}) => {
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [selectedLocationIdx, setSelectedLocationIdx] = useState(-1);
  const [selectedCityIdx, setSelectedCityIdx] = useState(-1);
  const [tempInput, setTempInput] = useState("");
  const locationRef = useRef(null);
  const cityRef = useRef(null);
  const locationSuggestionsRef = useRef(null);
  const citySuggestionsRef = useRef(null);

  // Real-time validation for location
  const validateLocation = (val) => {
    if (!val) return null;
    if (val.length < 2) return "Location must be at least 2 characters";
    if (val.length > 100) return "Location cannot exceed 100 characters";
    if (!/^[\p{L}\s\-,.]+$/u.test(val)) {
      return "Location contains invalid characters";
    }
    return null;
  };

  // Real-time validation for city
  const validateCity = (val) => {
    if (!val) return null;
    if (val.length < 2) return "City must be at least 2 characters";
    if (val.length > 50) return "City cannot exceed 50 characters";
    if (!/^[\p{L}\s\-,.]+$/u.test(val)) {
      return "City contains invalid characters";
    }
    return null;
  };

  // Real-time validation for pincode
  const validatePincode = (val) => {
    if (!val) return null;
    if (!/^[0-9\s\-]+$/.test(val)) {
      return "Pincode must contain only numbers";
    }
    const cleaned = val.replace(/\D/g, "");
    if (cleaned.length !== 6) {
      return "Pincode must be exactly 6 digits";
    }
    return null;
  };

  // Handle location input
  const handleLocationChange = (e) => {
    const val = e.target.value;
    onLocationChange(val);

    // Get suggestions
    if (val.trim()) {
      const matches = COMMON_CITIES.filter((city) =>
        city.toLowerCase().includes(val.toLowerCase()),
      );
      setLocationSuggestions(matches.slice(0, 5));
      setShowLocationSuggestions(true);
      setSelectedLocationIdx(-1);
    } else {
      setLocationSuggestions([]);
      setShowLocationSuggestions(false);
    }
  };

  // Handle city input
  const handleCityChange = (e) => {
    const val = e.target.value;
    onCityChange(val);

    // Get suggestions
    if (val.trim()) {
      const matches = COMMON_CITIES.filter((c) =>
        c.toLowerCase().includes(val.toLowerCase()),
      );
      setCitySuggestions(matches.slice(0, 5));
      setShowCitySuggestions(true);
      setSelectedCityIdx(-1);
    } else {
      setCitySuggestions([]);
      setShowCitySuggestions(false);
    }
  };

  // Handle pincode input with validation
  const handlePincodeChange = (e) => {
    let val = e.target.value;

    // Allow only digits and formatting characters
    val = val.replace(/[^\d\s\-]/g, "");

    onPincodeChange(val);
  };

  // Handle location keyboard navigation
  const handleLocationKeyDown = (e) => {
    if (e.key === "," || (e.key === " " && !e.ctrlKey && !e.metaKey)) {
      e.preventDefault();
      if (selectedLocationIdx >= 0) {
        const selected = locationSuggestions[selectedLocationIdx];
        onLocationChange(selected);
        setShowLocationSuggestions(false);
      }
      return;
    }

    if (!showLocationSuggestions || locationSuggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedLocationIdx((prev) =>
          prev < locationSuggestions.length - 1 ? prev + 1 : prev,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedLocationIdx((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedLocationIdx >= 0) {
          onLocationChange(locationSuggestions[selectedLocationIdx]);
          setShowLocationSuggestions(false);
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowLocationSuggestions(false);
        break;
      default:
        break;
    }
  };

  // Handle city keyboard navigation
  const handleCityKeyDown = (e) => {
    if (e.key === "," || (e.key === " " && !e.ctrlKey && !e.metaKey)) {
      e.preventDefault();
      if (selectedCityIdx >= 0) {
        const selected = citySuggestions[selectedCityIdx];
        onCityChange(selected);
        setShowCitySuggestions(false);
      }
      return;
    }

    if (!showCitySuggestions || citySuggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedCityIdx((prev) =>
          prev < citySuggestions.length - 1 ? prev + 1 : prev,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedCityIdx((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedCityIdx >= 0) {
          onCityChange(citySuggestions[selectedCityIdx]);
          setShowCitySuggestions(false);
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowCitySuggestions(false);
        break;
      default:
        break;
    }
  };

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        locationSuggestionsRef.current &&
        !locationSuggestionsRef.current.contains(e.target) &&
        locationRef.current &&
        !locationRef.current.contains(e.target)
      ) {
        setShowLocationSuggestions(false);
      }
      if (
        citySuggestionsRef.current &&
        !citySuggestionsRef.current.contains(e.target) &&
        cityRef.current &&
        !cityRef.current.contains(e.target)
      ) {
        setShowCitySuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const locationError = errors.currentLocation || validateLocation(location);
  const cityError = errors.city || validateCity(city);
  const pincodeError = errors.pincode || validatePincode(pincode);

  return (
    <div className="space-y-4">
      {/* Current Location with Autocomplete */}
      <div className="relative">
        <label className="text-sm font-medium">Current Location</label>
        <input
          ref={locationRef}
          type="text"
          value={location}
          onChange={handleLocationChange}
          onKeyDown={handleLocationKeyDown}
          onFocus={() => location && setShowLocationSuggestions(true)}
          disabled={!editable}
          placeholder="Enter current location (press space/comma to select from suggestions)"
          className={`border p-2 w-full rounded disabled:bg-gray-100 transition-colors ${
            locationError
              ? "border-red-500 bg-red-50 focus:ring-2 focus:ring-red-300"
              : "border-gray-300 focus:ring-2 focus:ring-indigo-300"
          }`}
        />

        {/* Location Suggestions */}
        {showLocationSuggestions && locationSuggestions.length > 0 && (
          <div
            ref={locationSuggestionsRef}
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 max-h-48 overflow-y-auto"
          >
            {locationSuggestions.map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onLocationChange(suggestion);
                  setShowLocationSuggestions(false);
                }}
                className={`w-full text-left px-4 py-2 hover:bg-indigo-50 transition-colors ${
                  idx === selectedLocationIdx ? "bg-indigo-100" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{suggestion}</span>
                  {idx === selectedLocationIdx && (
                    <FiCheck size={16} className="text-indigo-600" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {locationError && (
          <span className="text-red-500 text-xs mt-1 block">
            {locationError}
          </span>
        )}
      </div>

      {/* City with Autocomplete */}
      <div className="relative">
        <label className="text-sm font-medium">City</label>
        <input
          ref={cityRef}
          type="text"
          value={city}
          onChange={handleCityChange}
          onKeyDown={handleCityKeyDown}
          onFocus={() => city && setShowCitySuggestions(true)}
          disabled={!editable}
          placeholder="Enter city (press space/comma to select from suggestions)"
          className={`border p-2 w-full rounded disabled:bg-gray-100 transition-colors ${
            cityError
              ? "border-red-500 bg-red-50 focus:ring-2 focus:ring-red-300"
              : "border-gray-300 focus:ring-2 focus:ring-indigo-300"
          }`}
        />

        {/* City Suggestions */}
        {showCitySuggestions && citySuggestions.length > 0 && (
          <div
            ref={citySuggestionsRef}
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 max-h-48 overflow-y-auto"
          >
            {citySuggestions.map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onCityChange(suggestion);
                  setShowCitySuggestions(false);
                }}
                className={`w-full text-left px-4 py-2 hover:bg-indigo-50 transition-colors ${
                  idx === selectedCityIdx ? "bg-indigo-100" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{suggestion}</span>
                  {idx === selectedCityIdx && (
                    <FiCheck size={16} className="text-indigo-600" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {cityError && (
          <span className="text-red-500 text-xs mt-1 block">{cityError}</span>
        )}
      </div>

      {/* Pincode with Real-time Validation */}
      <div>
        <label className="text-sm font-medium">Pincode</label>
        <input
          type="text"
          value={pincode}
          onChange={handlePincodeChange}
          disabled={!editable}
          placeholder="Enter 6-digit pincode"
          maxLength="6"
          className={`border p-2 w-full rounded disabled:bg-gray-100 transition-colors ${
            pincodeError
              ? "border-red-500 bg-red-50 focus:ring-2 focus:ring-red-300"
              : "border-gray-300 focus:ring-2 focus:ring-indigo-300"
          }`}
        />

        {pincodeError && (
          <span className="text-red-500 text-xs mt-1 block">
            {pincodeError}
          </span>
        )}
      </div>
    </div>
  );
};
