import React from "react";
import { useTheme } from "../context/ThemeContext";
import { SunIcon, MoonIcon } from "@heroicons/react/24/solid";

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full bg-gray-200 dark:bg-darkSlate-800 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
      aria-label={
        theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"
      }
    >
      {theme === "dark" ? (
        <SunIcon
          className="w-6 h-6 text-yellow-400"
          title="Switch to Light Mode"
        />
      ) : (
        <MoonIcon
          className="w-6 h-6 text-gray-800"
          title="Switch to Dark Mode"
        />
      )}
    </button>
  );
};

export default ThemeToggle;
