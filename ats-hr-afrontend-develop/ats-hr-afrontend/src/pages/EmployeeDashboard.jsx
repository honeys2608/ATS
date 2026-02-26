import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { Link } from "react-router-dom";

export default function EmployeeDashboard() {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [employee, setEmployee] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const me = await api.get("/auth/me");
      const emp = me.data.employee ?? me.data;
      setEmployee(emp);

      const [nres, lbRes] = await Promise.all([
        api.get("/v1/notifications"),
        emp?.id ? api.get(`/v1/leaves/balance/${emp.id}`) : Promise.resolve({ data: [] }),
      ]);

      const nbody = nres.data?.data ?? nres.data ?? [];
      const nitems = Array.isArray(nbody) ? nbody : nbody.items ?? nbody.data ?? [];

      setNotifications(nitems.slice(0, 10));
      setLeaveBalances(lbRes.data ?? lbRes);
    } catch (err) {
      console.error("EmployeeDashboard load", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div className="p-6">Loading employee dashboard...</div>;

  return (
    <div className="max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Employee Dashboard</h1>
          <p className="text-gray-600">Quick access to attendance, leave, payslips and HR alerts</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-4 rounded-lg border">
          <h2 className="font-semibold mb-2">My Attendance</h2>
          <p className="text-sm text-gray-600">View attendance summary and mark your attendance.</p>
          <div className="mt-3">
            <Link to="/attendance" className="text-indigo-600">Go to Attendance</Link>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <h2 className="font-semibold mb-2">My Leave</h2>
          <p className="text-sm text-gray-600">Leave balance and quick actions</p>

          <div className="mt-3 space-y-2">
            {Array.isArray(leaveBalances) && leaveBalances.length ? (
              leaveBalances.map((b) => (
                <div key={b.leave_type} className="flex justify-between">
                  <div className="capitalize">{b.leave_type}</div>
                  <div className="font-semibold">{b.available ?? b.available_days ?? b.available}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500">No leave balance data available.</div>
            )}

            <div className="mt-3">
              <Link to="/leaves" className="text-indigo-600">Apply / View requests</Link>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <h2 className="font-semibold mb-2">My Profile</h2>
          <p className="text-sm text-gray-600">View and update your personal details and documents</p>
          <div className="mt-3">
            <Link to={`/employees/${employee?.id ?? "me"}`} className="text-indigo-600">Open Profile</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-4 rounded-lg border">
          <h2 className="font-semibold mb-2">Payslips</h2>
          <p className="text-sm text-gray-600">View your salary history and download payslips</p>
          <div className="mt-3">
            <Link to="/finance" className="text-indigo-600">View Payslips</Link>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <h2 className="font-semibold mb-2">Holidays</h2>
          <p className="text-sm text-gray-600">View company holidays calendar</p>
          <div className="mt-3">
            <Link to="/settings" className="text-indigo-600">View Holidays</Link>
          </div>
        </div>
      </div>

      <section className="bg-white p-4 rounded-lg border">
        <h2 className="font-semibold text-lg mb-2">Notifications</h2>
        {!notifications.length && <div className="text-gray-600">No notifications</div>}

        <div className="space-y-2">
          {notifications.map((n) => {
            const id = n.id ?? n.notification_id ?? Math.random();
            const title = n.title ?? n.message ?? n.summary ?? "Notification";
            const created = n.created_at ?? n.timestamp ?? n.created ?? Date.now();
            return (
              <div key={id} className="p-2 border rounded flex justify-between items-start">
                <div>
                  <div className="font-medium">{title}</div>
                  {n.detail && <div className="text-sm text-gray-600">{n.detail}</div>}
                  <div className="text-xs text-gray-400 mt-1">{new Date(created).toLocaleString()}</div>
                </div>
                <div className="text-right">
                  {n.meta?.link && <a href={n.meta.link} className="text-indigo-600">Open</a>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
