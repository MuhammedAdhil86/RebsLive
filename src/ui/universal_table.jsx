import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/* ================= ALIGNMENT: first column = left, all others = center ================= */
const textAlign = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};
const flexAlign = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};
const getAlign = (col, idx) => col.align || (idx === 0 ? "left" : "center");

/* ================= STATUS BADGE (same pill as the Employee table) ================= */
export const getStatusColor = (status) => {
  if (!status) return "bg-gray-100 text-gray-600";
  const s = status.toString().toLowerCase();
  if (s === "online" || s.includes("approved"))
    return "bg-green-100 text-green-600";
  if (s.includes("pending")) return "bg-orange-100 text-orange-600";
  if (s === "absent" || s.includes("rejected") || s.includes("inactive"))
    return "bg-red-100 text-red-600";
  if (s === "late") return "bg-purple-100 text-purple-600";
  return "bg-blue-100 text-blue-600";
};

export function StatusBadge({ status }) {
  const text = (status ?? "").toString();
  return (
    <span
      title={text}
      className={`px-3 py-1 w-[85px] text-center rounded-full text-[12px] font-poppins truncate cursor-default ${getStatusColor(text)}`}
    >
      {text === "Early Check-in" ? "Early..." : text || "-"}
    </span>
  );
}

/**
 * Props:
 *  title           heading shown top-left (e.g. "Employee List")
 *  columns         [{ key, label, width?("24%" | px number), align?("left"|"center"|"right"), render?(value,row,pageIdx,globalIdx) }]
 *  data            array of rows
 *  rowsPerPage     default 6
 *  rowClickHandler optional (row) => void
 *  loading         optional boolean
 *  actions         optional node shown top-right (e.g. filter buttons)
 *  emptyText       default "No data available"
 */
function UniversalTable({
  title,
  columns,
  data = [],
  rowsPerPage = 6,
  rowClickHandler,
  loading = false,
  actions = null,
  emptyText = "No data available",
}) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(data.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * rowsPerPage;
  const endIdx = startIdx + rowsPerPage;
  const currentRows = data.slice(startIdx, endIdx);

  const handlePrev = () => safePage > 1 && setCurrentPage(safePage - 1);
  const handleNext = () =>
    safePage < totalPages && setCurrentPage(safePage + 1);

  // Same fixed column widths for header and body tables => always aligned
  const toWidth = (w, n) =>
    w == null ? `${100 / n}%` : typeof w === "number" ? `${w}px` : w;

  const colSpan = columns.length;

  return (
    <section className="ut-mobile px-3 rounded-2xl overflow-x-auto relative w-full">
      {/* Header */}
      {(title || actions) && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-2">
          <h3 className="text-base font-medium text-gray-800">{title}</h3>
          {actions && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
              {actions}
            </div>
          )}
        </div>
      )}

      {/* Loader */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Header Table */}
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[600px] table-fixed text-[12px] bg-white border-separate border-spacing-0 rounded-2xl">
              <colgroup>
                {columns.map((col) => (
                  <col
                    key={col.key}
                    style={{ width: toWidth(col.width, columns.length) }}
                  />
                ))}
              </colgroup>
              <thead className="bg-white text-gray-600 text-[12.5px] rounded-xl">
                <tr>
                  {columns.map((col, idx) => (
                    <th
                      key={col.key}
                      className={`px-4 py-3 font-medium text-gray-700 whitespace-nowrap align-middle rounded-xl ${textAlign[getAlign(col, idx)]}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
            </table>
          </div>

          <div className="h-2" />

          {/* Body Table */}
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[600px] table-fixed text-[12px] bg-white border-separate border-spacing-0 rounded-2xl">
              <colgroup>
                {columns.map((col) => (
                  <col
                    key={col.key}
                    style={{ width: toWidth(col.width, columns.length) }}
                  />
                ))}
              </colgroup>
              <tbody className="text-gray-800 font-poppins text-[12px]">
                {currentRows.length === 0 ? (
                  <tr className="border-b border-gray-300">
                    <td
                      colSpan={colSpan}
                      className="text-center py-4 text-gray-500"
                    >
                      {emptyText}
                    </td>
                  </tr>
                ) : (
                  currentRows.map((row, idx) => (
                    <tr
                      key={row.id ?? idx}
                      onClick={() => rowClickHandler && rowClickHandler(row)}
                      className={`hover:bg-gray-50 align-middle border-b border-gray-300 ${
                        rowClickHandler ? "cursor-pointer" : ""
                      }`}
                    >
                      {columns.map((col, colIdx) => {
                        const value = row[col.key];
                        const align = getAlign(col, colIdx);
                        return (
                          <td
                            key={col.key}
                            data-label={col.label}
                            className={`px-4 py-3 relative group border-b border-[#f9fafb] align-middle ${textAlign[align]}`}
                          >
                            <div
                              className={`flex items-center ${flexAlign[align]}`}
                            >
                              {col.render ? (
                                col.render(value, row, idx, startIdx + idx)
                              ) : (
                                <>{value ?? "-"}</>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}

                {/* Pagination */}
                {data.length > 0 && (
                  <tr>
                    <td colSpan={colSpan}>
                      <div className="flex flex-col sm:flex-row justify-between items-center gap-2 px-4 py-3 text-[12px] rounded-b-2xl">
                        <span className="text-gray-500">
                          Showing {startIdx + 1}-{Math.min(endIdx, data.length)}{" "}
                          of {data.length}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handlePrev}
                            disabled={safePage === 1}
                            className="p-2 rounded disabled:opacity-50 hover:bg-gray-300 transition"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={handleNext}
                            disabled={safePage === totalPages}
                            className="p-2 rounded disabled:opacity-50 hover:bg-gray-300 transition"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Mobile View (scoped to this table only) */}
      <style>
        {`
          @media (max-width: 640px) {
            .ut-mobile table, .ut-mobile thead, .ut-mobile tbody, .ut-mobile th, .ut-mobile td, .ut-mobile tr { display: block; }
            .ut-mobile thead tr { display: none; }
            .ut-mobile tbody tr { margin-bottom: 1rem; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 0.5rem; }
            .ut-mobile tbody td { display: flex; justify-content: space-between; padding: 0.25rem 0.5rem; }
            .ut-mobile tbody td::before { content: attr(data-label); font-weight: 500; color: #6b7280; }
          }
        `}
      </style>
    </section>
  );
}

export default UniversalTable;
