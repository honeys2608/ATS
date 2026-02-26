export default function PermissionMatrix({ permissions }) {
  const roles = Object.keys(permissions);

  // collect all modules & actions
  const moduleActionMap = {};
  roles.forEach((role) => {
    Object.entries(permissions[role]).forEach(([module, actions]) => {
      if (!moduleActionMap[module]) moduleActionMap[module] = new Set();
      actions.forEach((a) => moduleActionMap[module].add(a));
    });
  });

  return (
    <div className="border rounded overflow-auto">
      <table className="min-w-full border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-3 py-2">Module / Action</th>
            {roles.map((role) => (
              <th key={role} className="border px-3 py-2 capitalize">
                {role.replace("_", " ")}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {Object.entries(moduleActionMap).map(([module, actions]) =>
            [...actions].map((action, index) => (
              <tr key={`${module}-${action}`}>
                {index === 0 && (
                  <td
                    rowSpan={actions.size}
                    className="border px-3 py-2 font-semibold bg-gray-50"
                  >
                    {module}
                  </td>
                )}

                {roles.map((role) => (
                  <td key={role} className="border px-3 py-2 text-center">
                    {permissions[role]?.[module]?.includes(action) ? "✅" : "—"}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
