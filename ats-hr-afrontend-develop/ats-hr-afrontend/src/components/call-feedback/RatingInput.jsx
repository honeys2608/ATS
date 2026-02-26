import React, { useState } from "react";

const RatingInput = ({ label, value = 0, onChange, required = false }) => {
  const [hoverValue, setHoverValue] = useState(0);

  const handleStarClick = (rating) => {
    onChange(rating);
  };

  const handleStarHover = (rating) => {
    setHoverValue(rating);
  };

  const handleMouseLeave = () => {
    setHoverValue(0);
  };

  const displayValue = hoverValue || value;

  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => handleStarClick(rating)}
              onMouseEnter={() => handleStarHover(rating)}
              onMouseLeave={handleMouseLeave}
              className="transition-transform duration-200 hover:scale-110 focus:outline-none"
              title={`Rating: ${rating} stars`}
            >
              <svg
                className={`w-6 h-6 ${
                  rating <= displayValue
                    ? "text-yellow-400 fill-current"
                    : "text-gray-300 fill-current"
                }`}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </button>
          ))}
        </div>
        <span className="ml-2 text-sm text-gray-600">
          {displayValue ? `${displayValue}/5` : "Select rating"}
        </span>
      </div>
    </div>
  );
};

export default RatingInput;
