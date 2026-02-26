import React, { useRef } from "react";
import TrackerCell from "./TrackerCell";
import { Trash2 } from "lucide-react";

export default function TrackerRow({
  row,
  rowIdx,
  columns,
  onCellChange,
  onDeleteRow,
  validation,
  onRowFocus,
}) {
  const cellRefs = useRef([]);

  const handleKeyDown = (e, colIdx) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      let nextCol = colIdx + 1;
      let nextRow = rowIdx;
      if (nextCol >= columns.length) {
        nextCol = 0;
        nextRow = rowIdx + 1;
      }
      onRowFocus(nextRow, nextCol);
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onRowFocus(rowIdx, colIdx + 1);
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onRowFocus(rowIdx, colIdx - 1);
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      onRowFocus(rowIdx + 1, colIdx);
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onRowFocus(rowIdx - 1, colIdx);
    }
  };

  return (
    <tr className="hover:bg-gray-50 align-top">
      {columns.map((col, colIdx) => {
        // Define min-widths for columns
        const isCommentType = col === "Comment";
        const isLongText =
          col === "Clients" ||
          col === "SPOC / HM" ||
          col === "Client TA / BU" ||
          col === "Skills" ||
          col === "Certifications" ||
          col === "Candidate Name";
        const minWidth = isCommentType
          ? "240px"
          : isLongText
            ? "180px"
            : "100px";

        return (
          <td
            key={col}
            className="px-3 py-2 border border-gray-200 align-top overflow-hidden"
            data-row={rowIdx}
            data-col={colIdx}
            style={{ minWidth, verticalAlign: "top" }}
          >
            <TrackerCell
              value={row[col]}
              col={col}
              rowIdx={rowIdx}
              colIdx={colIdx}
              onChange={onCellChange}
              error={validation[col]}
              onKeyDown={(e) => handleKeyDown(e, colIdx)}
              inputRef={(el) => (cellRefs.current[colIdx] = el)}
            />
          </td>
        );
      })}
      <td className="px-2 py-2 border border-gray-200 text-center w-10 align-top">
        <button
          onClick={() => {
            if (window.confirm("Are you sure you want to delete this row?")) {
              onDeleteRow(rowIdx);
            }
          }}
          className="text-gray-500 hover:text-red-500 hover:bg-red-50 rounded p-1 transition-colors"
          title="Delete row"
        >
          <Trash2 size={16} />
        </button>
      </td>
    </tr>
  );
}
