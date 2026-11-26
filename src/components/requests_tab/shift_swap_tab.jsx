import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { toast } from "react-toastify";

import UniversalTable, { StatusBadge } from "../../ui/universal_table";
import ModalButton from "../../ui/button/modalbutton"; // TODO: adjust path
import { shiftSwapService } from "../../service/policiesService"; // TODO: holds fetchCompanyShiftSwaps + updateShiftSwapStatus
import {
  showApiError,
  resolveApiSuccess,
  resolveApiError,
} from "../../utils/apiToast";

const STATUS_FILTERS = ["All", "Pending", "Approved", "Rejected"];

/* =====================================================================
   HELPERS
   ===================================================================== */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const capitalize = (s) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;

// Ignores empty / zero dates from the backend
const isEmptyDate = (v) => !v || String(v).startsWith("0001-01-01");

// "2026-10-24T00:00:00Z" -> "24 Oct 2026" (reads the string, no timezone shift)
const formatDay = (iso) => {
  if (isEmptyDate(iso)) return "--";
  try {
    const [year, month, day] = String(iso).split("T")[0].split("-");
    return `${day} ${MONTHS[parseInt(month, 10) - 1]} ${year}`;
  } catch {
    return "--";
  }
};

// "2026-10-16T08:02:16.88Z" -> "08:02:16 AM (16 Oct 2026)" (no timezone shift)
const formatExactTime12h = (iso) => {
  if (isEmptyDate(iso)) return null;
  try {
    const [datePart, timePart] = String(iso).split("T");
    const [hourStr, minStr, secWithMs] = timePart.split(":");
    const secStr = secWithMs.substring(0, 2);

    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    const formattedHour = hour < 10 ? `0${hour}` : hour;

    return `${formattedHour}:${minStr}:${secStr} ${ampm} (${formatDay(datePart)})`;
  } catch {
    return null;
  }
};

/* =====================================================================
   MODAL (unchanged)
   ===================================================================== */

const getStatusBadge = (status) => {
  if (status.includes("approved")) return "bg-green-100 text-green-700";
  if (status.includes("rejected"))
    return "bg-red-50 text-red-600 border border-red-200";
  if (status.includes("cancel")) return "bg-gray-100 text-gray-500";
  return "bg-yellow-100 text-yellow-700";
};

const labelCls = "text-[11px] text-gray-500 mb-1";
const boxCls = "bg-slate-50 border border-gray-200 px-4 py-3 rounded-lg";
const valueCls = "text-[13px] text-gray-800 break-words";

const InfoBox = ({ label, children, className = "" }) => (
  <div className={boxCls}>
    <p className={labelCls}>{label}</p>
    <p className={`${valueCls} ${className}`}>
      {children !== null && children !== undefined && children !== ""
        ? children
        : "N/A"}
    </p>
  </div>
);

const ShiftSwapApprovalModal = ({
  open,
  data,
  onClose,
  onSuccess, // refetch list after a successful update
  onOptimisticUpdate, // (id, newStatus) -> update row instantly
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [actionType, setActionType] = useState(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    if (open && data) {
      setSubmitting(false);
      setActionType(null);
      setShowReject(false);
      setRejectionReason("");
    }
  }, [open, data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    if (!submitting && onClose) onClose();
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !submitting && onClose) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, submitting]);

  if (!open || !data) return null;

  const status = data.status ? String(data.status).toLowerCase() : "pending";
  const requestedAt = formatExactTime12h(data.requested_at);
  const respondedAt = formatExactTime12h(data.responded_at);

  /* ---------- APPROVE / REJECT ---------- */
  const handleStatusAction = async (targetStatus) => {
    if (submitting) return;
    if (targetStatus === "Rejected" && !rejectionReason.trim()) return;
    setSubmitting(true);
    setActionType(targetStatus);

    const verb = targetStatus === "Approved" ? "Approving" : "Rejecting";
    const tid = toast.loading(`${verb} shift swap...`);

    try {
      // Service lowercases the status and only sends rejection_reason when rejected
      const res = await shiftSwapService.respondToSwapRequest({
        requestId: data.id,
        status: targetStatus,
        rejectionReason,
      });

      resolveApiSuccess(
        tid,
        res,
        `Shift swap ${targetStatus.toLowerCase()} successfully`,
      );

      onOptimisticUpdate?.(data.id, targetStatus);
      await onSuccess?.();
      onClose?.();
    } catch (err) {
      resolveApiError(
        tid,
        err,
        `Failed to ${targetStatus.toLowerCase()} shift swap`,
      );
      setSubmitting(false);
      setActionType(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/50 backdrop-blur-[2px] font-poppins text-[12px]"
      onClick={handleClose}
    >
      <div
        className="bg-white w-full max-w-[860px] max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-start gap-3">
            <span className="p-2 bg-slate-100 rounded-lg">
              <Icon
                icon="solar:transfer-horizontal-outline"
                className="w-5 h-5 text-black"
              />
            </span>
            <div>
              <h2 className="text-[16px] text-gray-900">Shift Swap Details</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Review and update the shift swap request
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            disabled={submitting}
            className="text-gray-400 hover:text-black transition-colors disabled:opacity-50"
          >
            <Icon icon="material-symbols:close" className="w-6 h-6" />
          </button>
        </div>

        {/* BODY */}
        <div className="px-6 py-5 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* LEFT: PEOPLE + DATE */}
            <div className="space-y-4 min-w-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 shrink-0 bg-slate-100 border border-gray-200 rounded-full flex items-center justify-center text-[15px] text-gray-700 uppercase">
                  {data.name && data.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-[14px] font-medium text-gray-800 leading-tight truncate">
                    {data.name}
                  </h3>
                  <p className="text-[12px] text-gray-500 truncate">
                    Requested by · ID {data.requester_employee_id || "N/A"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoBox label="Swap With" className="font-medium">
                  {data.swapWith}
                </InfoBox>
                <InfoBox label="Swap With ID" className="tabular-nums">
                  {data.target_employee_id}
                </InfoBox>
              </div>

              <InfoBox label="Swap Date" className="font-medium tabular-nums">
                {data.swapDate}
              </InfoBox>
            </div>

            {/* RIGHT: REQUEST INFO */}
            <div className="border border-gray-200 rounded-lg p-4 self-start min-w-0 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-medium text-gray-800">
                  Request Details
                </p>
                <span
                  className={`px-3 py-1 rounded-full text-[11px] capitalize whitespace-nowrap ${getStatusBadge(status)}`}
                >
                  {status}
                </span>
              </div>

              <InfoBox label="Requested On" className="tabular-nums">
                {requestedAt}
              </InfoBox>

              {respondedAt && (
                <InfoBox label="Responded At" className="tabular-nums">
                  {respondedAt}
                </InfoBox>
              )}

              {data.responded_by_name && (
                <InfoBox label="Responded By">{data.responded_by_name}</InfoBox>
              )}
            </div>
          </div>

          {/* Rejection reason (shown after clicking Reject) */}
          {status === "pending" && showReject && (
            <div className="mt-5">
              <label className={labelCls} htmlFor="swap-rejection-reason">
                Rejection reason
              </label>
              <textarea
                id="swap-rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                disabled={submitting}
                rows={3}
                autoFocus
                placeholder="Tell the employee why this swap was rejected"
                className="w-full text-[13px] text-gray-800 bg-white border border-gray-200 focus:border-black outline-none rounded-lg px-3 py-2 resize-none disabled:opacity-60"
              />
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t border-gray-100 bg-slate-50/60 flex justify-end gap-2">
          {status === "pending" && showReject ? (
            <>
              <ModalButton
                variant="secondary"
                onClick={() => {
                  setShowReject(false);
                  setRejectionReason("");
                }}
                disabled={submitting}
              >
                Back
              </ModalButton>

              <ModalButton
                variant="danger"
                onClick={() => handleStatusAction("Rejected")}
                disabled={submitting || !rejectionReason.trim()}
                loading={submitting && actionType === "Rejected"}
              >
                Confirm Reject
              </ModalButton>
            </>
          ) : status === "pending" ? (
            <>
              <ModalButton
                variant="danger"
                onClick={() => setShowReject(true)}
                disabled={submitting}
              >
                Reject
              </ModalButton>

              <ModalButton
                variant="primary"
                onClick={() => handleStatusAction("Approved")}
                disabled={submitting}
                loading={submitting && actionType === "Approved"}
              >
                Approve
              </ModalButton>
            </>
          ) : (
            <ModalButton variant="secondary" onClick={handleClose}>
              Close
            </ModalButton>
          )}
        </div>
      </div>
    </div>
  );
};

/* =====================================================================
   TABLE
   ===================================================================== */

/* ================= RESPONSIVE CHAR LIMIT + HOVER (this tab only) ================= */
const getLimits = (width) => {
  if (width < 640) return { name: 10 };
  if (width < 1024) return { name: 14 };
  if (width < 1280) return { name: 18 };
  return { name: 24 };
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

// Raw backend row -> table/modal row
const transformRow = (item) => {
  const rawStatus =
    item.status && String(item.status).trim() !== "" ? item.status : "Pending";

  return {
    ...item, // keep raw fields for the modal
    name: item.requester_employee_name || "N/A",
    swapWith: item.target_employee_name || "N/A",
    swapDate: formatDay(item.swap_date),
    requestedOn: formatDay(item.requested_at),
    respondedBy: item.responded_by_name || "--",
    status: capitalize(String(rawStatus).trim()),
  };
};

export default function ShiftSwapTab({ onRowClick, departmentId }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("All");
  const limits = useCharLimits();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // fetchCompanyShiftSwaps already returns the clean array
      const list = await shiftSwapService.fetchCompanyShiftSwaps(departmentId);
      setData((Array.isArray(list) ? list : []).map(transformRow));
    } catch (err) {
      showApiError(err, "Failed to load shift swap requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId]);

  const handleRowClick = (row) => {
    setSelectedRequest({ ...row });
    setIsModalOpen(true);
    if (onRowClick) onRowClick(row);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRequest(null);
  };

  const handleOptimisticUpdate = (id, newStatus) => {
    const formatted = capitalize(newStatus);

    setData((prev) =>
      prev.map((row) => (row.id === id ? { ...row, status: formatted } : row)),
    );

    if (selectedRequest && selectedRequest.id === id) {
      setSelectedRequest((prev) => ({ ...prev, status: formatted }));
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
      label: "Requested By",
      width: "22%",
      render: (_, row) => <LimitedText text={row.name} limit={limits.name} />,
    },
    {
      key: "swapWith",
      label: "Swap With",
      width: "22%",
      render: (_, row) => (
        <LimitedText text={row.swapWith} limit={limits.name} />
      ),
    },
    { key: "swapDate", label: "Swap Date", width: "15%" },
    { key: "requestedOn", label: "Requested On", width: "15%" },
    {
      key: "respondedBy",
      label: "Responded By",
      width: "14%",
      render: (_, row) => (
        <LimitedText text={row.respondedBy} limit={limits.name} />
      ),
    },
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
        title="Shift Swap Requests"
        actions={filterButtons}
        columns={columns}
        data={tableData}
        rowsPerPage={6}
        loading={loading}
        rowClickHandler={handleRowClick}
        emptyText="No shift swap requests found"
      />

      {isModalOpen && selectedRequest && (
        <ShiftSwapApprovalModal
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
