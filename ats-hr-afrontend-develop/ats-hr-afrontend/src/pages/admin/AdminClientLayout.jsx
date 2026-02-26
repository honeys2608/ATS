import { Outlet, NavLink, useParams } from "react-router-dom";

export default function AdminClientLayout() {
  const { clientId } = useParams();

  return (
    <div>
      {/* Sub Navbar */}
      <div className="flex gap-4 border-b mb-4 pb-2">
        <NavLink
          to={`/clients/${clientId}/requirements`}
          className={({ isActive }) =>
            isActive ? "font-bold text-blue-600" : "text-gray-600"
          }
        >
          Requirements
        </NavLink>

        <NavLink
          to={`/clients/${clientId}/requirements/create`}
          className={({ isActive }) =>
            isActive ? "font-bold text-blue-600" : "text-gray-600"
          }
        >
          + Create Requirement
        </NavLink>
      </div>

      {/* Page Content */}
      <Outlet />
    </div>
  );
}
