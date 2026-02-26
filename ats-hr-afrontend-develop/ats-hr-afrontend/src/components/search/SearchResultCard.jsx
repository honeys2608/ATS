import React from "react";
import { 
  User, 
  MapPin, 
  Briefcase, 
  Calendar, 
  Award, 
  ChevronRight, 
  CheckCircle2,
  Info 
} from "lucide-react";

const SearchResultCard = ({ candidate, onView, onInvite }) => {
  const {
    name,
    designation,
    experience,
    location,
    skills,
    match_score,
    score_breakdown,
    employer,
    status
  } = candidate;

  // Color mapping for match score
  const getScoreColor = (score) => {
    if (score >= 80) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 60) return "text-blue-600 bg-blue-50 border-blue-200";
    if (score >= 40) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-gray-600 bg-gray-50 border-gray-200";
  };

  const scoreClass = getScoreColor(match_score);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group">
      <div className="p-5 flex flex-col md:flex-row gap-5">
        {/* Left Section: Match Score & Profile Pic Placeholder */}
        <div className="flex flex-row md:flex-col items-center justify-between md:justify-center gap-4 md:w-32 flex-shrink-0 border-r border-gray-100 pr-5">
          <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center font-bold text-lg ${scoreClass.split(' ')[0]} ${scoreClass.split(' ')[2]}`}>
            {Math.round(match_score)}%
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Match Score</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <div className="h-1.5 w-12 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${scoreClass.split(' ')[0].replace('text', 'bg')}`} 
                  style={{ width: `${match_score}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Middle Section: Candidate Details */}
        <div className="flex-grow space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-purple-600 transition-colors">
                {name}
              </h3>
              <p className="text-gray-600 font-medium flex items-center gap-1.5">
                <Briefcase size={14} className="text-gray-400" />
                {designation} {employer ? `at ${employer}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-600">
                {status || "Active"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <Calendar size={14} className="text-gray-400" />
              {experience} Years Exp
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin size={14} className="text-gray-400" />
              {location}
            </span>
          </div>

          {/* Skills Badges */}
          <div className="flex flex-wrap gap-2 pt-1">
            {skills && skills.slice(0, 8).map((skill, idx) => (
              <span 
                key={idx} 
                className="px-2.5 py-0.5 bg-purple-50 text-purple-700 text-[11px] font-semibold rounded-full border border-purple-100"
              >
                {skill}
              </span>
            ))}
            {skills && skills.length > 8 && (
              <span className="text-[11px] font-medium text-gray-400 self-center">
                +{skills.length - 8} more
              </span>
            )}
          </div>

          {/* Score Breakdown (Subtle) */}
          {score_breakdown && (
            <div className="flex items-center gap-4 pt-2 border-t border-dashed border-gray-100 mt-2">
              <p className="text-[10px] text-gray-400 font-semibold uppercase">Relevance:</p>
              <div className="flex gap-3">
                <span className="text-[10px] flex items-center gap-1 text-gray-500">
                  Semantic: <span className="font-bold text-gray-700">{Math.round(score_breakdown.semantic)}%</span>
                </span>
                <span className="text-[10px] flex items-center gap-1 text-gray-500">
                  Profile: <span className="font-bold text-gray-700">{Math.round(score_breakdown.completeness)}%</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Section: Actions */}
        <div className="flex md:flex-col gap-2 justify-end md:w-32 flex-shrink-0">
          <button 
            onClick={() => onView(candidate.id)}
            className="flex-1 md:flex-none px-4 py-2 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            View
          </button>
          <button 
            onClick={() => onInvite(candidate.id, name)}
            className="flex-1 md:flex-none px-4 py-2 text-sm font-bold text-white bg-purple-600 rounded-lg hover:bg-purple-700 shadow-sm shadow-purple-100 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            NVite
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchResultCard;
