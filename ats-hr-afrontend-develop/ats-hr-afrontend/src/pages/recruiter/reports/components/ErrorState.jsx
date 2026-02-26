import React from "react";
export default function ErrorState({ message }) {
  return (
    <div className="text-center text-red-500 py-12">
      <div className="text-5xl mb-2">❌</div>
      <div className="font-semibold">{message || "Something went wrong."}</div>
    </div>
  );
}
