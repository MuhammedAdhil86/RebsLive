import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";

import UniversalTable, { StatusBadge } from "../../ui/universal_table";

// Components
import RegularizationApprovalModal from "../../ui/regularizationapproval";

// Services
import { fetchRegularizationRequests } from "../../service/employeeService";
import {
  fetchRemainingRegularization,
  getShiftPolicyById,
} from "../../service/companyService";

/* ================= TOAST HELPER (all backend messages go through here) ================= */
const getErrorMessage = (err, fallback) =>
  err?.response?.data?.message ||
  (typeof err?.response?.data?.data === "string" && err.response.data.data) ||
  err?.message ||
  fallback;

/* ================= DATE / TIME HELPERS ================= */
// "2026-10-20T09:00:00Z" -> "09:00:00" (shown exactly as stored, no timezone shift)
const formatTime = (raw) => {
  if (!raw) return "--";
  const d = new Date(raw);
  return isNaN(d.getTime()) ? "--" : d.toISOString().slice(11, 19);
};

// "2026-10-20T09:00:00Z" -> "20/10/2026" (UTC, so the date never shifts)
const formatDate = (raw) => {
  if (!raw) return "--";
  const d = new Date(raw);
  return isNaN(d.getTime())
    ? "--"
    : d.toLocaleDateString("en-GB", { timeZone: "UTC" });
};

const STATUS_FILTERS = ["All", "Pending", "Approved", "Rejected"];

/* ================= RESPONSIVE CHAR LIMIT + HOVER (this tab only) ================= */
const getLimits = (width) => {
  if (width < 640) return { name: 10, designation: 8 };
  if (width < 1024) return { name: 14, designation: 10 };
  if (width < 1280) return { name: 18, designation: 14 };
  return { name: 24, designation: 22 };
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

/* ================= MAIN COMPONENT ================= */
export default function RegularizationTab() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("All");
  const limits = useCharLimits();

  // Modal states
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [shiftData, setShiftData] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetchRegularizationRequests();
      const transformed = (res.data || []).map((item) => {
        const rawInDate = item.in_date?.Valid ? item.in_date.Time : null;
        const rawOutDate = item.out_date?.Valid ? item.out_date.Time : null;

        return {
          ...item,
          id: item.id,
          userId: item.user_id,
          name: item.user_name || "N/A",
          designation_name: item.designation_name || "N/A",
          designation: item.designation_name || "N/A",
          status: item.status
            ? item.status.charAt(0).toUpperCase() +
              item.status.slice(1).toLowerCase()
            : "Pending",
          remarks: item.remarks || "",

          date: formatDate(rawInDate),
          checkIn: formatTime(rawInDate),
          checkOut: formatTime(rawOutDate),
          displayInDate: formatDate(rawInDate),
          displayOutDate: formatDate(rawOutDate),
          workingHours: item.total_work_hours || "--",
          remaining: 0,
        };
      });
      setData(transformed);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load requests"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = async (req) => {
    // Set the request first so the modal never renders with null data
    setSelectedRequest(req);
    setIsModalOpen(true);
    try {
      const [shift, remainingRes] = await Promise.all([
        getShiftPolicyById(req.userId),
        fetchRemainingRegularization(req.userId),
      ]);

      setShiftData(shift);
      setSelectedRequest({
        ...req,
        remainingData: remainingRes,
      });
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load shift details"));
      setShiftData({ shift_name: "Not Allocated" });
      setSelectedRequest(req);
    }
  };

  const handleOptimisticUpdate = (id, newStatus) => {
    const formattedStatus =
      newStatus.charAt(0).toUpperCase() + newStatus.slice(1).toLowerCase();
    setData((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: formattedStatus } : item,
      ),
    );
  };

  // Status filter (same buttons as the WFH tab)
  const tableData = useMemo(() => {
    if (filterStatus === "All") return data;
    return data.filter(
      (item) =>
        (item.status ?? "").toString().toLowerCase() ===
        filterStatus.toLowerCase(),
    );
  }, [data, filterStatus]);

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

  /* ================= COLUMNS: first = left, all others = center ================= */
  const columns = [
    {
      key: "name",
      label: "Name",
      width: "20%",
      render: (_, row) => <LimitedText text={row.name} limit={limits.name} />,
    },
    {
      key: "designation_name",
      label: "Designation",
      width: "17%",
      render: (_, row) => (
        <LimitedText text={row.designation_name} limit={limits.designation} />
      ),
    },
    { key: "date", label: "Date", width: "13%" },
    { key: "checkIn", label: "Check In", width: "12%" },
    { key: "checkOut", label: "Check Out", width: "12%" },
    { key: "workingHours", label: "Working Hours", width: "14%" },
    {
      key: "status",
      label: "Status",
      width: "12%",
      render: (v) => <StatusBadge status={v} />,
    },
  ];

  return (
    <>
      <UniversalTable
        title="Regularization Requests"
        actions={filterButtons}
        columns={columns}
        data={tableData}
        rowsPerPage={6}
        loading={loading}
        rowClickHandler={handleOpenModal}
        emptyText="No requests found"
      />

      {/* THE MODAL */}
      {isModalOpen &&
        createPortal(
          <RegularizationApprovalModal
            open={isModalOpen}
            data={selectedRequest}
            shiftData={shiftData}
            onClose={() => {
              setIsModalOpen(false);
              setSelectedRequest(null);
              setShiftData(null);
            }}
            onSuccess={() => fetchData(true)}
            onOptimisticUpdate={handleOptimisticUpdate}
          />,
          document.body,
        )}
    </>
  );
}
