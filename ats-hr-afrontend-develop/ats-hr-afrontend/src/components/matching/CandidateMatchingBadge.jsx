import React from "react";
import { CheckCircle2, AlertCircle, TrendingUp, Briefcase } from "lucide-react";

/**
 * CandidateMatchingBadge
 * Displays a color-coded badge showing the fit label and match percentage
 *
 * Props:
 * - matchScore: float (0-100)
 * - fitLabel: string ("Excellent Fit" | "Good Fit" | "Partial Fit" | "Poor Fit")
 * - size: string ("sm" | "md" | "lg")
 */
const CandidateMatchingBadge = ({ matchScore, fitLabel, size = "md" }) => {
  const getColorScheme = () => {
    if (fitLabel === "Excellent Fit") {
      return {
        bgColor: "bg-green-50",
        borderColor: "border-green-200",
        badgeBg: "bg-green-100",
        badgeText: "text-green-800",
        icon: "text-green-600",
        label: fitLabel,
      };
    } else if (fitLabel === "Good Fit") {
      return {
        bgColor: "bg-blue-50",
        borderColor: "border-blue-200",
        badgeBg: "bg-blue-100",
        badgeText: "text-blue-800",
        icon: "text-blue-600",
        label: fitLabel,
      };
    } else if (fitLabel === "Partial Fit") {
      return {
        bgColor: "bg-yellow-50",
        borderColor: "border-yellow-200",
        badgeBg: "bg-yellow-100",
        badgeText: "text-yellow-800",
        icon: "text-yellow-600",
        label: fitLabel,
      };
    } else {
      return {
        bgColor: "bg-red-50",
        borderColor: "border-red-200",
        badgeBg: "bg-red-100",
        badgeText: "text-red-800",
        icon: "text-red-600",
        label: fitLabel,
      };
    }
  };

  const colors = getColorScheme();

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base",
  };

  return (
    <div
      className={`${sizeClasses[size]} ${colors.badgeBg} ${colors.badgeText} rounded-full font-medium inline-flex items-center space-x-2 border ${colors.borderColor}`}
    >
      <span className={colors.icon}>
        {fitLabel === "Excellent Fit" || fitLabel === "Good Fit" ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          <AlertCircle className="w-4 h-4" />
        )}
      </span>
      <span>
        {matchScore}% - {colors.label}
      </span>
    </div>
  );
};

export default CandidateMatchingBadge;
