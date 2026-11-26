import React, { useState, useEffect, useMemo } from "react";
import { Users, Clock, CheckCircle2, XCircle } from "lucide-react";
import exitService from "../../service/exitService";
import UniversalTable, { StatusBadge } from "../../ui/universal_table";

/* ---------- helpers ---------- */

const formatDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

/* Same palette as the dashboard KPI cards */
const COLORS = {
  green: "#EBFDEF",
  blue: "#E8EFF9",
  orange: "#FFEFE7",
  red: "#FFDADA",
};

/* KPI card: exactly the dashboard card */
const StatCard = ({ icon: IconCmp, label, value, bg }) => (
  <div
    className="shadow-sm rounded-lg p-3 flex items-center gap-3"
    style={{ backgroundColor: bg }}
  >
    <div className="flex items-center justify-center min-w-10 h-10 rounded-full bg-black text-white">
      {IconCmp && <IconCmp size={20} />}
    </div>
    <div className="overflow-hidden">
      <p className="text-gray-500 text-[10px] sm:text-xs truncate uppercase font-semibold">
        {label}
      </p>
      <h2 className="text-lg sm:text-xl font-medium text-gray-800">{value}</h2>
    </div>
  </div>
);

const ProgressBar = ({ value }) => (
  <div className="flex items-center gap-2 w-full max-w-[120px]">
    <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
      <div
        className="h-full rounded-full bg-black"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
    <span className="text-[12px] text-gray-800 w-8 text-right">{value}%</span>
  </div>
);

const FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "revoked", label: "Revoked" },
];

const bucket = (p) => {
  const s = String(p.status ?? "").toLowerCase();
  if (s === "completed") return "completed";
  if (s === "revoked") return "revoked";
  return "active"; // anything still open
};

/* ================= RESPONSIVE CHAR LIMIT + HOVER (this tab only) ================= */
const getLimits = (width) => {
  if (width < 640) return { name: 10, dept: 8 };
  if (width < 1024) return { name: 14, dept: 10 };
  if (width < 1280) return { name: 18, dept: 14 };
  return { name: 24, dept: 20 };
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

/* ---------- list ---------- */

const ExitProcessList = ({ onOpen }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState("all");
  const limits = useCharLimits();

  // GET /admin/exit-process/list-all
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    exitService
      .fetchExitProcesses()
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err.response?.data?.message ||
            err.message ||
            "Could not load exit processes.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const counts = useMemo(() => {
    const c = { all: items.length, active: 0, completed: 0, revoked: 0 };
    items.forEach((p) => {
      c[bucket(p)] += 1;
    });
    return c;
  }, [items]);

  // Filter by bucket + flatten display fields for the table
  const tableData = useMemo(
    () =>
      items
        .filter((p) => filter === "all" || bucket(p) === filter)
        .map((p) => ({
          ...p,
          name: p.employeeName || "—",
          departmentDisplay: p.department || "—",
          typeDisplay: p.employmentType || "—",
          appliedDisplay: formatDate(p.appliedOn),
          noticeDisplay: formatDate(p.noticePeriodStart),
          statusDisplay: p.status || "—",
        })),
    [items, filter],
  );

  const filterButtons = (
    <div className="flex flex-wrap items-center gap-2">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => setFilter(f.id)}
          className={`px-3 py-1.5 text-xs rounded-md border transition ${
            filter === f.id
              ? "bg-black text-white border-black"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );

  /* ================= COLUMNS: first = left, all others = center ================= */
  const columns = [
    {
      key: "name",
      label: "Employee",
      width: "16%",
      render: (_, row) => <LimitedText text={row.name} limit={limits.name} />,
    },
    {
      key: "departmentDisplay",
      label: "Department",
      width: "13%",
      render: (_, row) => (
        <LimitedText text={row.departmentDisplay} limit={limits.dept} />
      ),
    },
    { key: "typeDisplay", label: "Type", width: "11%", searchValue: () => "" },
    {
      key: "appliedDisplay",
      label: "Applied On",
      width: "12%",
      searchValue: () => "",
    },
    {
      key: "noticeDisplay",
      label: "Notice Start",
      width: "12%",
      searchValue: () => "",
    },
    {
      key: "statusDisplay",
      label: "Status",
      width: "12%",
      searchValue: () => "",
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: "completion",
      label: "Progress",
      width: "14%",
      searchValue: () => "",
      render: (v) => <ProgressBar value={Number(v) || 0} />,
    },
    {
      key: "action",
      label: "Action",
      width: "10%",
      searchValue: () => "",
      render: (_, row) => (
        <button
          type="button"
          onClick={() => onOpen(row.id)}
          className="px-3 py-1.5 text-xs rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-black hover:text-white hover:border-black transition"
        >
          View
        </button>
      ),
    },
  ];

  return (
    <>
      {/* SUMMARY CARDS (same grid as the dashboard KPI cards) */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full px-4 sm:px-6">
        <StatCard
          icon={Users}
          label="Total"
          value={counts.all}
          bg={COLORS.blue}
        />
        <StatCard
          icon={Clock}
          label="Active"
          value={counts.active}
          bg={COLORS.orange}
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={counts.completed}
          bg={COLORS.green}
        />
        <StatCard
          icon={XCircle}
          label="Revoked"
          value={counts.revoked}
          bg={COLORS.red}
        />
      </section>

      {error ? (
        <div className="flex flex-col items-center justify-center h-40 w-full text-red-500 font-poppins text-xs gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="px-3 sm:px-4 py-3 text-xs rounded-lg border bg-black text-white transition-all hover:bg-gray-800"
          >
            Try again
          </button>
        </div>
      ) : (
        <UniversalTable
          title="Exit Process"
          actions={filterButtons}
          columns={columns}
          data={tableData}
          rowsPerPage={6}
          loading={loading}
          emptyText={
            items.length === 0
              ? "No exit processes yet."
              : "No exit processes match your filters."
          }
        />
      )}
    </>
  );
};

export default ExitProcessList;
