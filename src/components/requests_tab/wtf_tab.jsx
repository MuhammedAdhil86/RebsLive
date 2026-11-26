import React, { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { MoreHorizontal, CheckCircle2, XCircle } from "lucide-react";

import UniversalTable, { StatusBadge } from "../../ui/universal_table";

// Services
import {
  fetchWfhRequests,
  updateWfhStatus,
} from "../../service/employeeService";

/* ================= TOAST HELPERS (all backend messages go through here) ================= */
const getErrorMessage = (err, fallback) =>
  err?.response?.data?.message ||
  (typeof err?.response?.data?.data === "string" && err.response.data.data) ||
  err?.message ||
  fallback;

const getSuccessMessage = (res, fallback) =>
  (typeof res?.message === "string" && res.message) ||
  (typeof res?.data?.message === "string" && res.data.message) ||
  fallback;

const DEFAULT_AVATAR =
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQJFYyBlkZfPY6Jb_BDM0gAW2jdMCFsYWxgeQ&s";

const STATUS_FILTERS = ["All", "Pending", "Approved", "Rejected"];

/* ================= RESPONSIVE CHAR LIMIT + HOVER (WFH tab only) ================= */
// Limits grow with the screen: [name, reason]
const getLimits = (width) => {
  if (width < 640) return { name: 10, reason: 8 };
  if (width < 1024) return { name: 14, reason: 10 };
  if (width < 1280) return { name: 18, reason: 14 };
  return { name: 24, reason: 22 };
};

function useCharLimits() {
  const [limits, setLimits] = useState(() =>
    getLimits(typeof window !== "undefined" ? window.innerWidth : 1280),
  );
  useEffect(() => {
    const onResize = () => setLimits(getLimits(window.innerWidth));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return limits;
}

// Shows the first `limit` characters; hovering shows the full text
function LimitedText({ text, limit }) {
  const full = (text ?? "-").toString();
  const shown = full.length > limit ? full.substring(0, limit) + "..." : full;
  return (
    <span className="cursor-default whitespace-nowrap" title={full}>
      {shown}
    </span>
  );
}

// Portal-based floating action menu with horizontal trigger
function ActionMenuPortal({ row, onUpdate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuCoords, setMenuCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const toggleDropdown = (e) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuCoords({
        top: rect.bottom + window.scrollY + 6,
        left: rect.right + window.scrollX - 128, // Matches w-32 (128px)
      });
    }
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleDismissOnScrollOrResize = () => {
      if (isOpen) setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      window.addEventListener("scroll", handleDismissOnScrollOrResize, true);
      window.addEventListener("resize", handleDismissOnScrollOrResize);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("scroll", handleDismissOnScrollOrResize, true);
      window.removeEventListener("resize", handleDismissOnScrollOrResize);
    };
  }, [isOpen]);

  const currentStatus = (row.status || "").toLowerCase();
  const showApprove =
    currentStatus === "pending" || currentStatus === "rejected";
  const showReject =
    currentStatus === "pending" || currentStatus === "approved";

  return (
    <div className="flex items-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleDropdown}
        aria-label="Actions"
        className="p-1.5 rounded-md hover:bg-gray-200/70 text-gray-500 hover:text-gray-900 transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "absolute",
              top: `${menuCoords.top}px`,
              left: `${menuCoords.left}px`,
              zIndex: 9999,
            }}
            className="w-32 bg-white border border-gray-100 rounded-lg shadow-xl py-1 text-xs animate-in fade-in zoom-in-95 duration-75 select-none"
          >
            {showApprove && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onUpdate(row.id, "Approved");
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-emerald-600 hover:bg-emerald-50 transition-colors text-left font-medium"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approve
              </button>
            )}

            {showReject && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onUpdate(row.id, "Rejected");
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-rose-600 hover:bg-rose-50 transition-colors text-left font-medium"
              >
                <XCircle className="w-3.5 h-3.5" />
                Reject
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

export default function WfhTab() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("All");
  const limits = useCharLimits();

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB");
    } catch {
      return "—";
    }
  };

  const fetchData = async (status = filterStatus, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const rawList = await fetchWfhRequests(status);

      const transformed = (rawList || []).map((item) => ({
        ...item,
        id: item.id,
        name: item.name || "-",
        image: item.image || null,
        reason: item.reason?.trim() || "-",
        fromDate: formatDate(item.from_date),
        toDate: formatDate(item.to_date),
        rawDate: item.from_date || item.applied_on || null,
        status: item.status
          ? item.status.charAt(0).toUpperCase() +
            item.status.slice(1).toLowerCase()
          : "Pending",
      }));

      setData(transformed);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load WFH requests"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(filterStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const handleStatusUpdate = async (id, nextStatus) => {
    // Optimistic UI state update
    setData((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: nextStatus } : item,
      ),
    );

    const tid = toast.loading("Updating status...");
    try {
      const res = await updateWfhStatus(id, nextStatus);
      toast.success(getSuccessMessage(res, `Request marked as ${nextStatus}`), {
        id: tid,
      });
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update status"), { id: tid });
      fetchData(filterStatus, true);
    }
  };

  // Newest first
  const sortedData = useMemo(() => {
    const arr = Array.isArray(data) ? [...data] : [];
    arr.sort((a, b) => {
      const dateA = a.rawDate ? new Date(a.rawDate) : new Date(0);
      const dateB = b.rawDate ? new Date(b.rawDate) : new Date(0);
      return dateB - dateA;
    });
    return arr;
  }, [data]);

  const columns = [
    {
      key: "name",
      label: "Name",
      width: "26%",
      render: (_, row) => {
        const imageSrc =
          row?.image && row.image.trim() !== "" ? row.image : DEFAULT_AVATAR;
        return (
          <div className="flex items-center gap-2">
            <img
              src={imageSrc}
              alt="avatar"
              className="w-7 h-7 rounded-full object-cover"
            />
            <LimitedText text={row.name} limit={limits.name} />
          </div>
        );
      },
    },
    { key: "fromDate", label: "From Date", width: "15%" },
    { key: "toDate", label: "To Date", width: "15%" },
    {
      key: "reason",
      label: "Reason",
      width: "22%",
      render: (v) => <LimitedText text={v} limit={limits.reason} />,
    },
    {
      key: "status",
      label: "Status",
      width: "14%",
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: "action",
      label: "Action",
      width: "8%",
      searchValue: () => "",
      render: (_, row) => (
        <ActionMenuPortal row={row} onUpdate={handleStatusUpdate} />
      ),
    },
  ];

  const filterButtons = (
    <div className="flex flex-wrap items-center gap-2">
      {STATUS_FILTERS.map((status) => (
        <button
          key={status}
          type="button"
          onClick={() => setFilterStatus(status)}
          className={`px-3 py-1.5 text-xs rounded-md border transition ${
            filterStatus === status
              ? "bg-black text-white border-black"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          }`}
        >
          {status}
        </button>
      ))}
    </div>
  );

  return (
    <UniversalTable
      title="Work From Home Requests"
      actions={filterButtons}
      columns={columns}
      data={sortedData}
      rowsPerPage={6}
      loading={loading}
      emptyText="No WFH requests found"
    />
  );
}
