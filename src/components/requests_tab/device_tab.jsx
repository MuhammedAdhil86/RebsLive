import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import UniversalTable, { StatusBadge } from "../../ui/universal_table";

// Components
import DeviceApprovalModal from "../../ui/devicestatusmodal";

// Services
import { fetchDeviceChangeRequests } from "../../service/deviceService";

// Toast helpers (backend message + data)
import { showApiError } from "../../utils/apiToast";

/* ================= HELPERS ================= */
// "2026-10-20T09:00:00Z" -> "20/10/2026" (UTC, so the date never shifts)
const formatDate = (raw) => {
  if (!raw) return "--";
  const d = new Date(raw);
  return isNaN(d.getTime())
    ? "--"
    : d.toLocaleDateString("en-GB", { timeZone: "UTC" });
};

const capitalize = (s) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "Pending";

const STATUS_FILTERS = ["All", "Pending", "Approved", "Rejected"];

/* ================= RESPONSIVE CHAR LIMIT + HOVER (this tab only) ================= */
const getLimits = (width) => {
  if (width < 640) return { name: 10, designation: 8, device: 8 };
  if (width < 1024) return { name: 14, designation: 10, device: 12 };
  if (width < 1280) return { name: 18, designation: 14, device: 16 };
  return { name: 24, designation: 20, device: 22 };
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
export default function DeviceRequestTab() {
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
      const responseData = await fetchDeviceChangeRequests();

      // Guard: make sure we always map over an array
      const list = Array.isArray(responseData)
        ? responseData
        : responseData?.data || [];

      // Transform raw backend shapes (SQL nullable objects) into flat row data
      const transformed = list.map((item) => {
        const rawDate = item.change_detected_date?.Valid
          ? item.change_detected_date.Time
          : null;

        return {
          ...item, // keeps original properties for the modal payload
          id: item.id,
          name: item.name || "N/A",
          designation: item.designation || "N/A",
          oldDevice: item.device || "N/A",
          newDevice: item.new_device?.Valid ? item.new_device.String : "N/A",
          date: formatDate(rawDate),
          status: item.status?.trim()
            ? capitalize(item.status.trim())
            : "Pending",
        };
      });

      setData(transformed);
    } catch (err) {
      // Backend message + data (or error) in one toast
      showApiError(err, "Failed to load device requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  /* ================= HANDLERS ================= */
  const handleOpenModal = (req) => {
    setSelectedRequest(req);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRequest(null);
  };

  const handleOptimisticUpdate = (id, newStatus) => {
    const formattedStatus = capitalize(newStatus);
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
      label: "Employee",
      width: "20%",
      render: (_, row) => <LimitedText text={row.name} limit={limits.name} />,
    },
    {
      key: "designation",
      label: "Designation",
      width: "16%",
      render: (_, row) => (
        <LimitedText text={row.designation} limit={limits.designation} />
      ),
    },
    {
      key: "oldDevice",
      label: "Current Device",
      width: "18%",
      render: (_, row) => (
        <LimitedText text={row.oldDevice} limit={limits.device} />
      ),
    },
    {
      key: "newDevice",
      label: "Requested Device",
      width: "18%",
      render: (_, row) => (
        <LimitedText text={row.newDevice} limit={limits.device} />
      ),
    },
    { key: "date", label: "Detected Date", width: "14%" },
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
        title="Device Change Requests"
        actions={filterButtons}
        columns={columns}
        data={tableData}
        rowsPerPage={6}
        loading={loading}
        rowClickHandler={handleOpenModal}
        emptyText="No device requests found"
      />

      {/* THE MODAL */}
      {isModalOpen &&
        createPortal(
          <DeviceApprovalModal
            open={isModalOpen}
            data={selectedRequest}
            onClose={handleCloseModal}
            onSuccess={() => fetchData(true)}
            onOptimisticUpdate={handleOptimisticUpdate}
          />,
          document.body,
        )}
    </>
  );
}
