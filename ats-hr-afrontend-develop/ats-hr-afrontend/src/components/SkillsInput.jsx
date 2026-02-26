// src/components/SkillsInput.jsx
import React, { useState, useEffect, useRef } from "react";
import { FiX, FiCheck } from "react-icons/fi";
import { getSkillSuggestions } from "../utils/skillsData";

export const SkillsInput = ({
  value = "",
  onChange,
  error,
  editable = true,
}) => {
  const [skills, setSkills] = useState([]);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const suggestionsRef = useRef(null);
  const inputRef = useRef(null);

  // Parse skills from comma-separated string
  useEffect(() => {
    if (typeof value === "string" && value) {
      const parsed = value
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s);
      setSkills(parsed);
    } else if (Array.isArray(value)) {
      setSkills(value);
    }
  }, [value]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);
    setSelectedIndex(-1);

    // Get suggestions
    if (val.trim()) {
      const sug = getSkillSuggestions(val);
      setSuggestions(sug);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const addSkill = (skill) => {
    const trimmed = skill.trim();

    // Validation
    if (!trimmed) {
      return;
    }
    if (trimmed.length < 2) {
      alert("Skill must be at least 2 characters");
      return;
    }
    if (trimmed.length > 50) {
      alert("Skill cannot exceed 50 characters");
      return;
    }
    if (skills.includes(trimmed)) {
      alert("Skill already added");
      setInput("");
      return;
    }
    if (skills.length >= 100) {
      alert("Maximum 100 skills allowed");
      return;
    }

    const newSkills = [...skills, trimmed];
    setSkills(newSkills);
    onChange(newSkills.join(", "));

    setInput("");
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const removeSkill = (index) => {
    const newSkills = skills.filter((_, i) => i !== index);
    setSkills(newSkills);
    onChange(newSkills.join(", "));
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addSkill(input);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0) {
          addSkill(suggestions[selectedIndex]);
        } else {
          addSkill(input);
        }
        break;
      case ",":
        e.preventDefault();
        addSkill(input);
        break;
      case "Escape":
        e.preventDefault();
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="w-full">
      <label className="text-sm font-medium block mb-2">
        Skills <span className="text-gray-500">({skills.length}/100)</span>
      </label>

      {/* Skills Tags */}
      <div className="flex flex-wrap gap-2 mb-2">
        {skills.map((skill, idx) => (
          <div
            key={idx}
            className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm flex items-center gap-2"
          >
            <span>{skill}</span>
            {editable && (
              <button
                type="button"
                onClick={() => removeSkill(idx)}
                className="hover:text-indigo-900"
              >
                <FiX size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Input with autocomplete */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => input && setShowSuggestions(true)}
          disabled={!editable}
          placeholder="Type skill name or paste comma-separated skills..."
          className={`border p-2 w-full rounded disabled:bg-gray-100 transition-colors ${
            error
              ? "border-red-500 bg-red-50 focus:ring-2 focus:ring-red-300"
              : "border-gray-300 focus:ring-2 focus:ring-indigo-300"
          }`}
        />

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 max-h-64 overflow-y-auto"
          >
            {suggestions.map((skill, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => addSkill(skill)}
                className={`w-full text-left px-4 py-2 hover:bg-indigo-50 transition-colors ${
                  idx === selectedIndex ? "bg-indigo-100" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{skill}</span>
                  {idx === selectedIndex && (
                    <FiCheck size={16} className="text-indigo-600" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <span className="text-red-500 text-xs mt-1 block">{error}</span>
      )}

      {/* Help text */}
      <p className="text-xs text-gray-500 mt-2">
        Press Enter or comma to add skill. Use arrow keys to navigate
        suggestions.
      </p>
    </div>
  );
};
