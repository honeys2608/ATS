import React from "react";
import ProductSettingsToggles from "../../components/profile/ProductSettingsToggles";

export default function RecruiterSettingsSection() {
  return (
    <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Settings</h2>
      <ProductSettingsToggles />
      {/* You can add more settings components here if needed */}
    </div>
  );
}
