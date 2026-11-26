import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import UniversalTable, { StatusBadge } from "../../ui/universal_table";

// Components
import AdvanceSalaryApprovalModal from "../../ui/advancesalarystatusmodal";

// Services
import { fetchAdvanceSalaries } from "../../service/advanceSalaryService";

// Toast helpers (backend message + data)
import { showApiError } from "../../utils/apiToast";

const STATUS_FILTERS = ["All", "Pending", "Approved", "Rejected"];

/* ================= DATE / AMOUNT HELPERS ================= */
// "2026-10-20T10:10:44Z" -> "20/10/2026" (UTC, so the date never shifts)
// Backend sends "0001-01-01T00:00:00Z" when a date is not set -> "--"
const formatDate = (raw) => {
  if (!raw) return "--";
  const d = new Date(raw);
  if (isNaN(d.getTime()) || d.getUTCFullYear() < 1971) return "--";
  return d.toLocaleDateString("en-GB", { timeZone: "UTC" });
};

const formatAmount = (raw) => {
  const n = Number(raw);
  if (raw === null || raw === undefined || raw === "" || isNaN(n)) return "--";
  return n.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
};

const capitalize = (s) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";

/* ================= RESPONSIVE CHAR LIMIT + HOVER (this tab only) ================= */
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

/* ================= MAIN COMPONENT ================= */
export default function AdvanceSalaryReqTab() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("All");
  const limits = useCharLimits();

  // Modal states
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // body = { status_code, message, data: [ ... ] }
      const body = await fetchAdvanceSalaries();
      const list = Array.isArray(body?.data) ? body.data : [];

      const transformed = list
        .map((item) => ({
          ...item,
          id: item.id,
          // the API returns the staff name inside staff_id
          name: (item.staff_id || "").trim() || "N/A",
          status: capitalize(item.status) || "Pending",
          reason: item.reason || "--",
          approvedBy: item.approved_by || "--",

          rawAmount: item.amount,
          rawBasic: item.basic_salary,
          amount: formatAmount(item.amount),
          basicSalary: formatAmount(item.basic_salary),
          advanceDate: formatDate(item.date),
          requestedOn: formatDate(item.requested_at),
          _requestedAt: item.requested_at,
        }))
        // newest request first
        .sort(
          (a, b) =>
            new Date(b._requestedAt || 0) - new Date(a._requestedAt || 0),
        );

      setData(transformed);
    } catch (err) {
      console.error("LOAD ERROR:", err);
      // Backend message + data (or error) in one toast
      showApiError(err, "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (req) => {
    setSelectedRequest(req);
    setIsModalOpen(true);
  };

  const handleOptimisticUpdate = (id, newStatus) => {
    const formattedStatus = capitalize(newStatus);
    setData((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: formattedStatus } : item,
      ),
    );
    // keep the open modal in sync with the table
    setSelectedRequest((prev) =>
      prev && prev.id === id ? { ...prev, status: formattedStatus } : prev,
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
      width: "16%",
      render: (_, row) => <LimitedText text={row.name} limit={limits.name} />,
    },
    { key: "amount", label: "Advance Amount", width: "15%" },
    { key: "basicSalary", label: "Basic Salary", width: "13%" },
    {
      key: "reason",
      label: "Reason",
      width: "16%",
      render: (_, row) => (
        <LimitedText text={row.reason} limit={limits.reason} />
      ),
    },
    { key: "advanceDate", label: "Advance Date", width: "13%" },
    { key: "requestedOn", label: "Requested On", width: "13%" },
    {
      key: "status",
      label: "Status",
      width: "14%",
      render: (v) => <StatusBadge status={v} />,
    },
  ];

  return (
    <>
      <UniversalTable
        title="Advance Salary Requests"
        actions={filterButtons}
        columns={columns}
        data={tableData}
        rowsPerPage={6}
        loading={loading}
        rowClickHandler={handleOpenModal}
        emptyText="No advance salary requests found"
      />

      {/* THE MODAL */}
      {isModalOpen &&
        createPortal(
          <AdvanceSalaryApprovalModal
            open={isModalOpen}
            data={selectedRequest}
            onClose={() => {
              setIsModalOpen(false);
              setSelectedRequest(null);
            }}
            onSuccess={() => fetchData(true)}
            onOptimisticUpdate={handleOptimisticUpdate}
          />,
          document.body,
        )}
    </>
  );
}
