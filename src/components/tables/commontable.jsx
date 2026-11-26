import React, { useState, useEffect, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

/* ================= SHARED ALIGNMENT (used by BOTH <th> and <td>) ================= */
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
// One single cell class so header and content can never differ
const cellBase = "px-4 py-3 align-middle";

/* ================= STATUS BADGE (reuse in any tab's col.render) ================= */
export const getStatusColor = (status) => {
  if (!status) return "bg-gray-100 text-gray-600";
  const s = status.toString().toLowerCase();
  if (s.includes("approved")) return "bg-green-100 text-green-600";
  if (s.includes("pending")) return "bg-orange-100 text-orange-600";
  if (s.includes("rejected") || s.includes("inactive"))
    return "bg-red-100 text-red-600";
  return "bg-gray-100 text-gray-600";
};

export function StatusBadge({ status }) {
  const text = (status ?? "").toString();
  const shown = text.length > 10 ? text.substring(0, 10) + "..." : text;
  return (
    <span
      title={text}
      className={`px-3 py-1 rounded-full text-[11px] font-normal whitespace-nowrap inline-block max-w-[100px] text-center ${getStatusColor(text)}`}
    >
      {shown || "-"}
    </span>
  );
}

/**
 * Props:
 *  columns         [{ key, label, width?, align?, render?(value,row,rowIdx) }]
 *                  width: "18%" | 120 (px). First column = left, others = center by default
 *  data            array of rows
 *  rowsPerPage     default 10
 *  rowClickHandler optional (row) => void
 *  loading         optional boolean
 *  emptyText       optional string
 *  searchable      optional boolean, shows the standard search box above the table
 *  minWidth        optional, default 800
 */
function UniversalTable({
  columns,
  data = [],
  rowsPerPage = 10,
  rowClickHandler,
  loading = false,
  emptyText = "No data available",
  searchable = false,
  minWidth = 800,
}) {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const cols = useMemo(
    () =>
      columns.map((c, i) => ({
        ...c,
        align: c.align || (i === 0 ? "left" : "center"),
      })),
    [columns],
  );

  const filteredData = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return data;
    return data.filter((row) =>
      cols.some((col) => row[col.key]?.toString().toLowerCase().includes(term)),
    );
  }, [data, cols, searchTerm]);

  // Reset to first page when searching or when the number of rows changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm, data.length]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const pagedData = filteredData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  const allHaveWidth = cols.every((c) => c.width != null);
  const toWidth = (w) => (typeof w === "number" ? `${w}px` : w);

  return (
    <div className="grid grid-cols-1 gap-4 w-full">
      {searchable && (
        <div className="flex justify-end">
          <div className="flex items-center gap-2 border px-3 py-2 rounded-lg bg-white text-sm w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent text-gray-600 w-full focus:outline-none text-sm placeholder:text-[12px]"
            />
            <Search className="w-4 h-4 text-gray-400" />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-[12px]">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin mb-2" />
          <span>Loading...</span>
        </div>
      ) : (
        <>
          <div className="w-full overflow-x-auto border border-gray-100 rounded-xl bg-white">
            <table
              className={`w-full border-collapse font-['Poppins'] ${allHaveWidth ? "table-fixed" : ""}`}
              style={{ minWidth }}
            >
              {allHaveWidth && (
                <colgroup>
                  {cols.map((col) => (
                    <col key={col.key} style={{ width: toWidth(col.width) }} />
                  ))}
                </colgroup>
              )}
              <thead className="bg-[#f9f9f9]">
                <tr>
                  {cols.map((col) => (
                    <th
                      key={col.key}
                      className={`${cellBase} ${textAlign[col.align]} text-[12px] font-semibold text-gray-600`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={cols.length}
                      className="py-12 text-center text-[12px] text-gray-400"
                    >
                      {emptyText}
                    </td>
                  </tr>
                ) : (
                  pagedData.map((row, rowIdx) => (
                    <tr
                      key={row.id ?? rowIdx}
                      onClick={() => rowClickHandler && rowClickHandler(row)}
                      className={`border-t border-gray-100 hover:bg-gray-50 ${
                        rowClickHandler ? "cursor-pointer" : ""
                      }`}
                    >
                      {cols.map((col) => {
                        const value = row[col.key];
                        return (
                          <td
                            key={col.key}
                            data-label={col.label}
                            className={`${cellBase} ${textAlign[col.align]} text-[12px] text-gray-800`}
                          >
                            <div
                              className={`flex items-center ${flexAlign[col.align]}`}
                            >
                              {col.render ? (
                                col.render(value, row, rowIdx)
                              ) : (
                                <span className="whitespace-nowrap">
                                  {value ?? "-"}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          {filteredData.length > rowsPerPage && (
            <div className="flex items-center justify-between text-[12px] text-gray-500">
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-gray-200 rounded-lg disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-gray-200 rounded-lg disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default UniversalTable;
