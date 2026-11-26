import React, { useEffect, useMemo, useState } from "react";

import UniversalTable, { StatusBadge } from "../../ui/universal_table";

import InsuranceApprovalModal from "../../ui/insurancestatusmodal";
import { fetchInsuranceClaimList } from "../../service/insuranceservice";

// Toast helpers (backend message + data)
import { showApiError } from "../../utils/apiToast";

const STATUS_FILTERS = ["All", "Pending", "Approved", "Rejected"];

// Helper function to format numeric values to local currency format
const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

/* ================= RESPONSIVE CHAR LIMIT + HOVER (this tab only) ================= */
const getLimits = (width) => {
  if (width < 640) return { name: 10, claim: 8 };
  if (width < 1024) return { name: 14, claim: 12 };
  if (width < 1280) return { name: 18, claim: 16 };
  return { name: 24, claim: 22 };
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

export default function InsuranceClaimTab({ onRowClick }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("All");
  const limits = useCharLimits();

  // --- MODAL STATES ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const responseData = await fetchInsuranceClaimList();

      // Guard: make sure we always map over an array
      const list = Array.isArray(responseData)
        ? responseData
        : responseData?.data || [];

      // Transform raw backend payload to match component table expectations
      const transformed = list.map((item) => {
        const rawStatus =
          item.claim_status && item.claim_status.trim() !== ""
            ? item.claim_status
            : "Pending";

        const cleanDate = item.claim_date
          ? new Date(item.claim_date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "--";

        return {
          ...item, // Retains raw object structure for downstream actions
          name: item.employee_name || "N/A",
          user_uuid: item.employee_id || "N/A",
          claimNumber: item.claim_number || "N/A",
          claimAmount: formatCurrency(item.claim_amount),
          settlementAmount: item.settlement_amount
            ? formatCurrency(item.settlement_amount)
            : "--",
          date: cleanDate,
          status:
            rawStatus.charAt(0).toUpperCase() +
            rawStatus.slice(1).toLowerCase(),
        };
      });

      setData(transformed);
    } catch (err) {
      // Backend message + data (or error) in one toast
      showApiError(err, "Failed to load insurance claims");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- HANDLER ACTIONS ---
  const handleRowClick = (reqRowObject) => {
    // Ensures modal receives fresh row object instance on every click
    setSelectedRequest({ ...reqRowObject });
    setIsModalOpen(true);

    if (onRowClick) {
      onRowClick(reqRowObject);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRequest(null);
  };

  const handleOptimisticUpdate = (id, newStatus) => {
    const formattedStatus =
      newStatus.charAt(0).toUpperCase() + newStatus.slice(1).toLowerCase();

    setData((prevRows) =>
      prevRows.map((row) =>
        row.id === id
          ? { ...row, status: formattedStatus, claim_status: formattedStatus }
          : row,
      ),
    );

    // Synchronize active selected row inside modal dynamically
    if (selectedRequest && selectedRequest.id === id) {
      setSelectedRequest((prev) => ({
        ...prev,
        status: formattedStatus,
        claim_status: formattedStatus,
      }));
    }
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
      key: "claimNumber",
      label: "Claim Number",
      width: "17%",
      render: (_, row) => (
        <LimitedText text={row.claimNumber} limit={limits.claim} />
      ),
    },
    { key: "claimAmount", label: "Claim Amount", width: "15%" },
    { key: "settlementAmount", label: "Settlement Amount", width: "17%" },
    { key: "date", label: "Claim Date", width: "16%" },
    {
      key: "status",
      label: "Status",
      width: "15%",
      render: (v) => <StatusBadge status={v} />,
    },
  ];

  return (
    <>
      <UniversalTable
        title="Insurance Claim Requests"
        actions={filterButtons}
        columns={columns}
        data={tableData}
        rowsPerPage={6}
        loading={loading}
        rowClickHandler={handleRowClick}
        emptyText="No insurance claims found"
      />

      {/* --- INTEGRATED MODAL COMPONENT --- */}
      {isModalOpen && selectedRequest && (
        <InsuranceApprovalModal
          open={isModalOpen}
          data={selectedRequest}
          onClose={handleCloseModal}
          onSuccess={fetchData}
          onOptimisticUpdate={handleOptimisticUpdate}
        />
      )}
    </>
  );
}
