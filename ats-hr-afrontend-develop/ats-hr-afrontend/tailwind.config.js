/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class", // Enable dark mode using class strategy
  theme: {
    extend: {
      colors: {
        brand: {
          purple: "#6D28D9", // Primary purple
          purpleLight: "#7C3AED",
          green: "#22C55E", // Parrot green
          greenLight: "#4ADE80",
        },

        darkSlate: {
          900: "#1e293b", // Dark slate background
          800: "#334155", // Slightly lighter slate
          700: "#475569", // Even lighter slate
        },
      },

      backgroundImage: {
        // Main gradient (LEFT PANEL + BUTTONS) - Purple to Teal
        "brand-gradient":
          "linear-gradient(135deg, #7C3AED 0%, #1E40AF 50%, #0891B2 100%)",

        // Optional soft gradient (cards / hovers)
        "brand-soft": "linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)",
      },

      boxShadow: {
        brand: "0 10px 25px rgba(109, 40, 217, 0.25)",
      },
    },
  },
  plugins: [],
};
