import { useEffect, useState } from "react";
import clientService from "../../services/clientService";

export default function ClientDeployments() {
  const [data, setData] = useState([]);

  useEffect(() => {
    clientService.getDeployments().then(setData);
  }, []);

  return (
    <div className="bg-white rounded shadow">
      <table className="w-full text-sm">
        <th className="p-2">S. No.</th> {/* ✅ Serial */}
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Consultant</th>
            <th>Role</th>
            <th>Deployed On</th> {/* ⭐ ADD */}
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, index) => (
            <tr key={d.id} className="border-t">
              <td className="p-2 text-center font-medium">{index + 1}</td>

              <td className="p-2">{d.consultant_name}</td>

              <td>{d.role}</td>

              <td className="text-sm text-gray-700">
                {d.start_date
                  ? (() => {
                      const dt = new Date(d.start_date);

                      const time = dt
                        .toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })
                        .toUpperCase();

                      const date = dt
                        .toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                        .toUpperCase();

                      return `${time} | ${date}`;
                    })()
                  : "-"}
              </td>

              <td>{d.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
