import { useAuth } from "../../context/AuthContext";

export default function CandidateCard({ candidate }) {
  const auth = useAuth() || {};
const role = auth.role || "guest";


  return (
    <div className="bg-white p-4 rounded shadow flex justify-between items-center">
      <div>
        <div className="font-medium">{candidate.full_name}</div>
        <div className="text-xs text-gray-500">{candidate.email}</div>
      </div>

      <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
        {candidate.status || "Applied"}
      </span>
    </div>
  );
}
