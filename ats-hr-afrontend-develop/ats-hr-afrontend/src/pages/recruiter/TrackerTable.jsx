import React, {
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Download, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";

const COLUMNS = [
  { key: "checkbox", label: "", width: "50px", fixed: true },
  { key: "serial", label: "S#", width: "60px", fixed: true },
  { key: "recruiterName", label: "Recruiter Name", width: "150px" },
  { key: "status", label: "Status", width: "120px" },
  { key: "comment", label: "Comment", width: "150px" },
  { key: "month", label: "Month", width: "80px" },
  { key: "date", label: "Date", width: "120px" },
  { key: "clients", label: "Clients", width: "120px" },
  { key: "reqJrId", label: "Req / JR ID", width: "120px" },
  { key: "spocHm", label: "SPOC / HM", width: "120px" },
  { key: "clientTaBu", label: "Client TA / BU", width: "130px" },
  { key: "amName", label: "AM Name", width: "120px" },
  { key: "skills", label: "Skills", width: "150px" },
  { key: "candidateName", label: "Candidate Name", width: "150px" },
  { key: "contactNumber", label: "Contact #", width: "120px" },
  { key: "emailId", label: "Email ID", width: "180px" },
  { key: "currentCompany", label: "Current Company", width: "150px" },
  { key: "designation", label: "Designation", width: "120px" },
  { key: "experienceInField", label: "Experience in Field", width: "140px" },
  { key: "totalExperience", label: "Total Experience", width: "130px" },
  { key: "relevantExperience", label: "Relevant Experience", width: "150px" },
  { key: "currentCtc", label: "Current CTC", width: "120px" },
  { key: "expectedCtc", label: "Expected CTC", width: "120px" },
  { key: "noticePeriod", label: "Notice Period (LWD)", width: "160px" },
  { key: "qualification", label: "Qualification", width: "120px" },
  { key: "currentLocation", label: "Current Location", width: "140px" },
  { key: "preferredLocation", label: "Preferred Location", width: "160px" },
  { key: "certifications", label: "Certifications", width: "150px" },
  { key: "vendors", label: "Vendors", width: "120px" },
  { key: "actions", label: "Actions", width: "100px" },
];

const TrackerTable = forwardRef(({ isAdmin }, ref) => {
  const [data, setData] = useState([]);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);

  useImperativeHandle(ref, () => ({
    addEntry: (newEntry) => {
      const newData = [
        ...data,
        {
          ...newEntry,
          id: Date.now(),
          serial: data.length + 1,
          date: formatDate(newEntry.date),
          noticePeriod: newEntry.noticePeriod
            ? formatDate(newEntry.noticePeriod)
            : "",
        },
      ];
      setData(newData);
      localStorage.setItem("recruiterTrackerData", JSON.stringify(newData));
    },
  }));

  useEffect(() => {
    // Load data from localStorage or initialize with mock data
    const savedData = localStorage.getItem("recruiterTrackerData");
    if (savedData) {
      setData(JSON.parse(savedData));
    } else {
      // Mock data for demonstration
      const mockData = [
        {
          id: 1,
          serial: 1,
          recruiterName: "John Doe",
          status: "In Progress",
          comment: "Good candidate",
          month: "JAN",
          date: "15 JAN 2024",
          clients: "ABC Corp",
          reqJrId: "JR001",
          spocHm: "Jane Smith",
          clientTaBu: "IT",
          amName: "Mike Johnson",
          skills: ["React", "Node.js"],
          candidateName: "Alice Brown",
          contactNumber: "9876543210",
          emailId: "alice@example.com",
          currentCompany: "XYZ Ltd",
          designation: "Developer",
          experienceInField: 3,
          totalExperience: 5,
          relevantExperience: 3,
          currentCtc: 600000,
          expectedCtc: 800000,
          noticePeriod: "15 FEB 2024",
          qualification: "B.Tech",
          currentLocation: "Mumbai",
          preferredLocation: "Bangalore",
          certifications: ["AWS"],
          vendors: "Vendor A",
        },
      ];
      setData(mockData);
      localStorage.setItem("recruiterTrackerData", JSON.stringify(mockData));
    }
    setLoading(false);
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, "0");
    const month = date
      .toLocaleString("default", { month: "short" })
      .toUpperCase();
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedRows(new Set(paginatedData.map((row) => row.id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (id, checked) => {
    const newSelected = new Set(selectedRows);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedRows(newSelected);
  };

  const handleDeleteRow = (id) => {
    if (isAdmin || confirm("Are you sure you want to delete this entry?")) {
      const newData = data.filter((row) => row.id !== id);
      setData(newData);
      localStorage.setItem("recruiterTrackerData", JSON.stringify(newData));
      setSelectedRows((prev) => {
        const newSelected = new Set(prev);
        newSelected.delete(id);
        return newSelected;
      });
    }
  };

  const handleBulkDelete = () => {
    if (!isAdmin && selectedRows.size > 0) {
      alert("You can only delete your own entries.");
      return;
    }
    if (confirm(`Delete ${selectedRows.size} selected entries?`)) {
      const newData = data.filter((row) => !selectedRows.has(row.id));
      setData(newData);
      localStorage.setItem("recruiterTrackerData", JSON.stringify(newData));
      setSelectedRows(new Set());
    }
  };

  const exportToExcel = (selectedOnly = false) => {
    const exportData =
      selectedOnly && selectedRows.size > 0
        ? data.filter((row) => selectedRows.has(row.id))
        : data;

    const ws = XLSX.utils.json_to_sheet(
      exportData.map((row) => ({
        ...row,
        skills: Array.isArray(row.skills) ? row.skills.join(", ") : row.skills,
        certifications: Array.isArray(row.certifications)
          ? row.certifications.join(", ")
          : row.certifications,
      })),
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Recruiter Tracker");

    const month = new Date()
      .toLocaleString("default", { month: "short" })
      .toUpperCase();
    const year = new Date().getFullYear();
    const filename = `Recruiter_Tracker_${month}_${year}.xlsx`;

    XLSX.writeFile(wb, filename);
  };

  const paginatedData = data.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const totalPages = Math.ceil(data.length / pageSize);

  if (loading)
    return <div className="p-8 text-center">Loading tracker data...</div>;

  return (
    <div className="p-6">
      {/* Bulk Actions Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          {selectedRows.size > 0 && (
            <span className="text-sm text-gray-600">
              {selectedRows.size} row{selectedRows.size > 1 ? "s" : ""} selected
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedRows.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-gradient-to-r from-red-600 to-red-700 text-white rounded-md hover:from-red-700 hover:to-red-800 focus:ring-2 focus:ring-red-500 focus:ring-offset-1 shadow-sm transition-all duration-200"
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected
            </button>
          )}
          <button
            onClick={() => exportToExcel(false)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-md hover:from-emerald-700 hover:to-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 shadow-sm transition-all duration-200"
          >
            <Download className="w-4 h-4" />
            Export All
          </button>
          {selectedRows.size > 0 && (
            <button
              onClick={() => exportToExcel(true)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-md hover:from-blue-700 hover:to-blue-800 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 shadow-sm transition-all duration-200"
            >
              <Download className="w-4 h-4" />
              Export Selected
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 ${
                    col.fixed ? "sticky left-0 bg-gray-50 z-20" : ""
                  }`}
                  style={{ width: col.width, minWidth: col.width }}
                >
                  {col.key === "checkbox" ? (
                    <input
                      type="checkbox"
                      checked={
                        selectedRows.size === paginatedData.length &&
                        paginatedData.length > 0
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((row, index) => (
              <tr
                key={row.id}
                className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
              >
                {COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-2 text-sm text-gray-900 border-r border-gray-200 ${
                      col.fixed ? "sticky left-0 bg-inherit z-10" : ""
                    }`}
                    style={{ width: col.width, minWidth: col.width }}
                  >
                    {col.key === "checkbox" ? (
                      <input
                        type="checkbox"
                        checked={selectedRows.has(row.id)}
                        onChange={(e) =>
                          handleSelectRow(row.id, e.target.checked)
                        }
                        className="rounded border-gray-300"
                      />
                    ) : col.key === "serial" ? (
                      row.serial
                    ) : col.key === "skills" ? (
                      Array.isArray(row[col.key]) ? (
                        row[col.key].join(", ")
                      ) : (
                        row[col.key]
                      )
                    ) : col.key === "certifications" ? (
                      Array.isArray(row[col.key]) ? (
                        row[col.key].join(", ")
                      ) : (
                        row[col.key]
                      )
                    ) : col.key === "actions" ? (
                      <button
                        onClick={() => handleDeleteRow(row.id)}
                        className="inline-flex items-center justify-center p-1.5 text-red-600 hover:text-white hover:bg-gradient-to-r hover:from-red-600 hover:to-red-700 rounded-md transition-all duration-200 focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                        title="Delete row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      row[col.key] || ""
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2 py-1 border border-gray-300 rounded text-sm"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">
            {Math.min((currentPage - 1) * pageSize + 1, data.length)} -{" "}
            {Math.min(currentPage * pageSize, data.length)} of {data.length}
          </span>
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:border-gray-400 transition-all duration-200 focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
          >
            Previous
          </button>
          <button
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
            className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:border-gray-400 transition-all duration-200 focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
});

TrackerTable.displayName = "TrackerTable";

export default TrackerTable;
