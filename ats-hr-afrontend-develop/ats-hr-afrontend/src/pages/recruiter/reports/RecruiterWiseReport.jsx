import React from "react";
import ReportsTable from "./components/ReportsTable";

export default function RecruiterWiseReport() {
  // Placeholder for API integration
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState([
    {
      recruiter: "John Doe",
      views: 120,
      downloads: 30,
      searches: 50,
      invites: 20,
      actions: 220,
    },
    {
      recruiter: "Jane Smith",
      views: 100,
      downloads: 25,
      searches: 40,
      invites: 15,
      actions: 180,
    },
  ]);

  return (
    <div>
      <ReportsTable
        columns={[
          "Recruiter Name",
          "CV Views",
          "Downloads",
          "Searches",
          "Invites",
          "Total Actions",
        ]}
        data={data}
        loading={loading}
        pagination
        sortable
        filterable
        exportExcel
      />
    </div>
  );
}
