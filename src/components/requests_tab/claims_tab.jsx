import React, { useEffect, useMemo, useState } from "react";
import { FiPaperclip, FiChevronDown, FiChevronUp } from "react-icons/fi";

import UniversalTable, { StatusBadge } from "../../ui/universal_table";

import {
  fetchCompanyClaims,
  updateCompanyClaimStatus,
} from "../../service/companyService";
import ViewClaimModal from "../../ui/claimapprovemodal";
import { showApiToast, showApiError, getApiBody } from "../../utils/apiToast";

const STATUS_FILTERS = ["All", "Pending", "Approved", "Rejected"];

const getCleanDocType = (file) => {
  if (file.document_type?.includes("pdf")) return "PDF";
  return "IMG";
};

/* ================= RESPONSIVE CHAR LIMIT + HOVER (this tab only) ================= */
const getLimits = (width) => {
  if (width < 640) return { name: 10, type: 8 };
  if (width < 1024) return { name: 14, type: 12 };
  if (width < 1280) return { name: 18, type: 16 };
  return { name: 24, type: 22 };
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

export default function ClaimsRequestTab() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submittingModal, setSubmittingModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState("All");
  const limits = useCharLimits();

  // --- OVERLAY STATES ---
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [expandedAttachments, setExpandedAttachments] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const responseData = await fetchCompanyClaims();

      // Accept: plain array, { claims: [] }, { data: [] }, or { items: [] }
      const claimsArray = Array.isArray(responseData)
        ? responseData
        : responseData?.claims ||
          responseData?.data ||
          responseData?.items ||
          [];

      const transformed = (Array.isArray(claimsArray) ? claimsArray : []).map(
        (item) => {
          const rawStatus =
            item.status && String(item.status).trim() !== ""
              ? String(item.status)
              : "Pending";

          const cleanExpenseDate = item.expense_date
            ? new Date(item.expense_date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "--";

          return {
            ...item,
            id: item.id ?? item.claim_id,
            name: item.employee_name?.trim() || `ID: ${item.employee_id}`,
            designation: item.employee_designation || "N/A",
            expenseType: item.expense_type || "General Expense",
            amountDisplay: `₹ ${Number(item.amount || 0).toLocaleString("en-IN")}`,
            date: cleanExpenseDate,
            attachments: item.attachments || item.claim_attachments || [],
            status:
              rawStatus.charAt(0).toUpperCase() +
              rawStatus.slice(1).toLowerCase(),
          };
        },
      );

      setData(transformed);
    } catch (err) {
      // Backend message + data (or error) only
      showApiError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRowClick = (claimRowObject) => {
    setSelectedClaim(claimRowObject);
  };

  // --- TRIGGERED FROM MODAL SUBMIT BUTTONS ---
  // action: "Approved" | "Rejected"
  // payoutMethod: "hand" | "payroll" | "voucher" (only sent when approving)
  const handleStatusUpdate = async (id, action, payoutMethod) => {
    if (submittingModal) return;

    setSubmittingModal(true);
    try {
      const res = await updateCompanyClaimStatus(id, action, payoutMethod);
      const body = getApiBody(res);

      // Service returned the error body instead of throwing (e.g. 409)
      if (Number(body?.status_code) >= 400) {
        showApiToast("error", body?.message, body?.data);
        return;
      }

      // Backend message as title, backend data underneath (e.g. voucher code)
      showApiToast("success", body?.message, body?.data);

      setSelectedClaim(null);
      fetchData(); // Reload table data with fresh backend values
    } catch (err) {
      // Backend message + data (or error) only
      showApiError(err);
    } finally {
      setSubmittingModal(false);
    }
  };

  const toggleAttachmentsVisibility = (e, claimId) => {
    e.stopPropagation();
    setExpandedAttachments((prev) => ({
      ...prev,
      [claimId]: !prev[claimId],
    }));
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
      key: "expenseType",
      label: "Expense Type",
      width: "17%",
      render: (_, row) => (
        <LimitedText text={row.expenseType} limit={limits.type} />
      ),
    },
    {
      key: "amountDisplay",
      label: "Amount",
      width: "14%",
      render: (_, row) => (
        <span className="whitespace-nowrap">{row.amountDisplay}</span>
      ),
    },
    { key: "date", label: "Expense Date", width: "15%" },
    {
      key: "attachments",
      label: "Attachments",
      width: "19%",
      searchValue: () => "",
      render: (_, row) => {
        const attachments = row.attachments;
        if (!attachments || attachments.length === 0) {
          return (
            <span className="text-gray-400 text-xs font-normal leading-none">
              None
            </span>
          );
        }

        const isExpanded = !!expandedAttachments[row.id];
        const itemsToRender = isExpanded ? attachments : [attachments[0]];

        return (
          <div className="flex flex-col gap-1.5 justify-center items-center">
            {itemsToRender.map((file) => (
              <a
                key={file.id}
                href={file.path}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center justify-center gap-1.5 text-blue-600 hover:underline bg-blue-50/70 border border-blue-100 px-2 py-0.5 rounded text-[11px] font-semibold tracking-wider leading-none whitespace-nowrap"
              >
                <FiPaperclip className="text-xs shrink-0 text-blue-500" />
                <span>{getCleanDocType(file)}</span>
              </a>
            ))}

            {attachments.length > 1 && (
              <button
                type="button"
                onClick={(e) => toggleAttachmentsVisibility(e, row.id)}
                className="text-[11px] font-medium text-gray-500 hover:text-gray-800 flex items-center justify-center gap-1 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded transition-colors whitespace-nowrap"
              >
                {isExpanded ? (
                  <>
                    Hide <FiChevronUp />
                  </>
                ) : (
                  <>
                    <span className="text-gray-600">
                      +{attachments.length - 1}
                    </span>{" "}
                    More <FiChevronDown />
                  </>
                )}
              </button>
            )}
          </div>
        );
      },
    },
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
        title="Company Claims Requests"
        actions={filterButtons}
        columns={columns}
        data={tableData}
        rowsPerPage={6}
        loading={loading}
        rowClickHandler={handleRowClick}
        emptyText="No claims found"
      />

      <ViewClaimModal
        open={Boolean(selectedClaim)}
        data={selectedClaim}
        submitting={submittingModal}
        onClose={() => setSelectedClaim(null)}
        onStatusUpdate={handleStatusUpdate}
      />
    </>
  );
}
