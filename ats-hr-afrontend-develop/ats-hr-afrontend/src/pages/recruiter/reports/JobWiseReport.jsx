import React from "react";
import ReportsTable from "./components/ReportsTable";

export default function JobWiseReport() {
  // Placeholder for API integration
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState([
    {
      job_id: "J123",
      job_title: "Frontend Developer",
      views: 80,
      applications: 20,
      invites: 10,
      status: "Open",
    },
    {
      job_id: "J124",
      job_title: "Backend Developer",
      views: 60,
      applications: 15,
      invites: 8,
      status: "Closed",
    },
  ]);

  return (
    <div>
      <ReportsTable
        columns={[
          "Job ID",
          "Job Title",
          "CV Views",
          "Applications",
          "Invites Sent",
          "Status",
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
