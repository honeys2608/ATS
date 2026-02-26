import React from "react";
import { Link } from "react-router-dom";

export default function MatchCard({ match }) {
  return (
    <div className="p-4 bg-white rounded shadow">
      <div className="flex justify-between">
        <div>
          <h3 className="text-xl font-bold">Candidate #{match.candidate_id}</h3>
          <p className="text-sm text-gray-600">Fit Score</p>
          <div className="text-3xl font-bold text-indigo-600">
            {match.fit_score.toFixed(1)}
          </div>
        </div>

        <Link
          to={`/candidates/${match.candidate_id}`}
          className="bg-blue-600 text-white px-4 py-2 rounded h-fit"
        >
          View Profile
        </Link>
      </div>

      <div className="mt-4">
        <h4 className="font-semibold">Top Factors</h4>
        <ul className="list-disc ml-6 text-gray-700">
          {match.top_factors?.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
