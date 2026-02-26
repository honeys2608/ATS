import React from "react";
import ReportsTable from "./components/ReportsTable";

export default function ActivityCommentsReport() {
  // Placeholder for API integration
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState([
    {
      recruiter: "John",
      candidate: "Alice",
      action: "CV viewed",
      timestamp: "2026-01-25 10:00",
    },
    {
      recruiter: "Jane",
      candidate: "Bob",
      action: "Resume downloaded",
      timestamp: "2026-01-24 09:30",
    },
  ]);

  return (
    <div>
      <ReportsTable
        columns={["Recruiter", "Candidate", "Action Type", "Timestamp"]}
        data={data}
        loading={loading}
        pagination
        filterable
        exportExcel
      />
    </div>
  );
}
