import React from "react";
import ReportsTable from "./components/ReportsTable";

export default function UsageReports() {
  // Placeholder for API integration
  const [type, setType] = React.useState("yesterday");
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState([]);

  // Always define columns for the table
  const columns = ["Metric", "Value"];

  React.useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setData([
        { Metric: "CVs Viewed", Value: 120 },
        { Metric: "CVs Downloaded", Value: 30 },
        { Metric: "Searches", Value: 50 },
        { Metric: "Invites", Value: 20 },
        { Metric: "Total Actions", Value: 220 },
      ]);
      setLoading(false);
    }, 800);
  }, [type]);

  return (
    <div>
      <div className="flex gap-4 mb-4">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={type === "yesterday"}
            onChange={() => setType("yesterday")}
          />{" "}
          Yesterday
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={type === "week"}
            onChange={() => setType("week")}
          />{" "}
          This Week
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={type === "month"}
            onChange={() => setType("month")}
          />{" "}
          This Month
        </label>
        <button className="ml-auto bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700 transition">
          Generate Report
        </button>
      </div>
      <ReportsTable data={data} columns={columns} loading={loading} />
    </div>
  );
}
