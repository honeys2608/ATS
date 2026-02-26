import React, { useEffect } from "react";
import CallFeedbackForm from "./CallFeedbackForm";

const CallFeedbackDrawer = ({
  isOpen,
  candidateId,
  candidateName,
  initialData = null,
  onClose,
  onSuccess,
}) => {
  // Warn before closing if unsaved
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isOpen && initialData?.is_draft) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isOpen, initialData]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      if (initialData?.is_draft) {
        if (
          window.confirm(
            "You have unsaved changes. Are you sure you want to close?",
          )
        ) {
          onClose();
        }
      } else {
        onClose();
      }
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-40 transition-opacity duration-300 z-[80] ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={handleOverlayClick}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full bg-white shadow-xl transition-transform duration-300 z-[90] overflow-y-auto ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width: "480px" }}
      >
        <div className="p-6 h-full flex flex-col">
          {/* Close Button */}
          <div className="flex justify-between items-center mb-6">
            <div></div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
              title="Close drawer"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Form Container */}
          <div className="flex-1 overflow-y-auto">
            <CallFeedbackForm
              candidateId={candidateId}
              candidateName={candidateName}
              initialData={initialData}
              onSuccess={() => {
                onSuccess && onSuccess();
                onClose();
              }}
              onCancel={onClose}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default CallFeedbackDrawer;
