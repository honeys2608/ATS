import { useNavigate } from "react-router-dom";

export default function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    { label: "Mark Attendance", path: "/attendance" },
    { label: "Apply Leave", path: "/leaves" },
    { label: "View Payslip", path: "/finance" },
    { label: "My Profile", path: "/employee-profile" },
  ];

  return (
    <div className="bg-white rounded-xl p-4 border shadow-sm">
      <h3 className="font-semibold mb-3">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-2">
        {actions.map(a => (
          <button
            key={a.label}
            onClick={() => navigate(a.path)}
            className="border rounded-lg p-2 text-sm hover:bg-gray-100"
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
