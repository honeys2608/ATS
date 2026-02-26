import React from "react";
import ReportsTable from "./components/ReportsTable";

export default function CandidateMISReport() {
  // Placeholder for API integration
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState([
    {
      candidate: "Alice",
      job: "Frontend Developer",
      stage: "Screening",
      recruiter: "John",
      status: "Active",
      updated: "2026-01-25",
    },
    {
      candidate: "Bob",
      job: "Backend Developer",
      stage: "Interview",
      recruiter: "Jane",
      status: "Inactive",
      updated: "2026-01-24",
    },
  ]);

  return (
    <div>
      <ReportsTable
        columns={[
          "Candidate Name",
          "Applied Job",
          "Stage",
          "Recruiter",
          "Status",
          "Last Updated",
        ]}
        data={data}
        loading={loading}
        pagination
        filterable
        exportExcel
      />
    </div>
  );
}
