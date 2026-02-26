// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { LabelsProvider } from "./context/LabelsContext";
import "./index.css"; // optional - remove if you don't have it (Tailwind/etc)

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element (#root) not found in index.html");
}

createRoot(container).render(
  <React.StrictMode>
    <LabelsProvider>
      <App />
    </LabelsProvider>
  </React.StrictMode>,
);
