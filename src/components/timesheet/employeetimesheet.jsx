import React, { useState, useEffect, useMemo, useRef } from "react";
import { Icon } from "@iconify/react";
import { fetchTeamTimesheets } from "../../service/timesheetservice";
import useEmployeeStore from "../../store/employeeStore";

/* =====================================================================
   1. TOKENS + ICONS
   ===================================================================== */
const T = {
  card: "bg-white rounded-lg shadow-sm border border-gray-100",
  cardTitle: "text-sm font-medium text-gray-800",
  subtitle: "text-[10px] sm:text-[13px] text-gray-400 font-light",
  label: "text-[10px] sm:text-xs uppercase font-semibold text-gray-400",
  body: "text-xs sm:text-sm text-gray-800",
  muted: "text-[10px] sm:text-xs text-gray-400",
  th: "text-[10px] sm:text-xs uppercase font-semibold text-gray-500",
  input:
    "border border-gray-200 rounded-lg bg-white px-2.5 py-1.5 text-[10px] sm:text-xs text-gray-800 focus:outline-none focus:border-black",
};

const COLORS = {
  green: "#EBFDEF",
  blue: "#E8EFF9",
  orange: "#FFEFE7",
  yellow: "#FFFBDB",
  red: "#FFDADA",
};

/* Lined (outline) icons only. Every calendar icon and date field uses
   IC.calendar, so the icon is defined in this one place. */
const IC = {
  filter: "solar:filter-outline",
  calendar: "solar:calendar-outline",
  users: "solar:users-group-rounded-outline",
  clock: "solar:clock-circle-outline",
  down: "solar:alt-arrow-down-outline",
  left: "solar:alt-arrow-left-outline",
  right: "solar:alt-arrow-right-outline",
  close: "solar:close-circle-outline",
  refresh: "solar:refresh-outline",
  folder: "solar:folder-outline",
  warning: "solar:danger-triangle-outline",
};

const Ico = ({ name, className = "w-4 h-4" }) => (
  <Icon icon={name} className={className} />
);

const STEP = 10; // rows revealed 10 at a time inside a date group
const PAGE_SIZES = [10, 25, 50];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
].map((m, i) => ({ value: String(i + 1), label: m }));

const WEEKS = ["1", "2", "3", "4", "5"].map((w) => ({
  value: w,
  label: `Week ${w}`,
}));

const VIEWS = ["Date", "Week", "Month"].map((v) => ({ value: v, label: v }));

/* =====================================================================
   2. HELPERS
   ===================================================================== */

// Local-time YYYY-MM-DD (no UTC shift)
const getTodayFormatted = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const getDefaultFilters = () => ({
  viewBy: "Date",
  date: getTodayFormatted(),
  month: String(new Date().getMonth() + 1),
  week: "1",
  employee: "all", // "all" or a user uuid
});

const formatDate = (iso) => {
  if (!iso || iso === "—") return "—";
  const d = new Date(String(iso).length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// UTC ISO string -> 24-hour HH:MM:SS
const formatIsoTime = (isoString) => {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "—";
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
  } catch {
    return "—";
  }
};

/* first non-empty value from a list of possible API keys */
const pick = (obj, keys, fallback = "—") => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== null && v !== undefined && v !== "") return v;
  }
  return fallback;
};

/* entries of a date group (adjust the key list if your API differs) */
const entriesOf = (group) =>
  group?.entries ||
  group?.employees ||
  group?.timesheets ||
  group?.records ||
  [];

const periodLabel = (f, summary) => {
  if (summary.fromDate !== "—" && summary.toDate !== "—")
    return summary.fromDate === summary.toDate
      ? formatDate(summary.fromDate)
      : `${formatDate(summary.fromDate)} – ${formatDate(summary.toDate)}`;
  if (f.viewBy === "Date") return formatDate(f.date);
  const m = MONTHS[Number(f.month) - 1]?.label || "";
  return f.viewBy === "Week" ? `${m} · Week ${f.week}` : m;
};

const countActive = (f, d) =>
  (f.viewBy !== d.viewBy ? 1 : 0) +
  (f.employee !== d.employee ? 1 : 0) +
  (f.viewBy === "Date" && f.date !== d.date ? 1 : 0) +
  (f.viewBy !== "Date" && f.month !== d.month ? 1 : 0) +
  (f.viewBy === "Week" && f.week !== d.week ? 1 : 0);

/* =====================================================================
   3. SMALL UI PIECES
   ===================================================================== */

/* Date field: native input + lined calendar icon on the right.
   The browser's own picker icon is invisible and stretched over the whole
   field, so clicking anywhere opens the calendar. */
const DateField = ({ value, onChange, min, max, ariaLabel = "Date" }) => (
  <div className="relative w-full">
    <input
      type="date"
      value={value || ""}
      min={min}
      max={max}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => {
        try {
          e.currentTarget.showPicker?.();
        } catch {
          /* picker already open / unsupported */
        }
      }}
      className={`w-full pr-9 cursor-pointer ${T.input} [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
    />
    <Icon
      icon={IC.calendar}
      className="w-4 h-4 text-gray-700 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
    />
  </div>
);

const Badge = ({ children, className = "bg-zinc-100 text-gray-600" }) => (
  <span
    className={`inline-block max-w-full truncate align-middle px-2.5 py-1 rounded-full text-[10px] sm:text-xs whitespace-nowrap ${className}`}
  >
    {children}
  </span>
);

const StatCard = ({ icon, label, value, hint, bg }) => (
  <div
    className="shadow-sm rounded-lg p-3 flex items-center gap-3 min-w-0"
    style={{ backgroundColor: bg }}
  >
    <div className="flex items-center justify-center min-w-10 h-10 rounded-full bg-black text-white">
      <Ico name={icon} className="w-[18px] h-[18px]" />
    </div>
    <div className="overflow-hidden">
      <p className="text-gray-500 text-[10px] sm:text-xs uppercase font-semibold truncate">
        {label}
      </p>
      <h2 className="text-lg sm:text-xl font-medium text-gray-800 truncate">
        {value}
      </h2>
      {hint && (
        <p className="text-[10px] sm:text-xs text-gray-500 truncate">{hint}</p>
      )}
    </div>
  </div>
);

const Select = ({ value, onChange, options, disabled, ariaLabel }) => (
  <div className="relative">
    <select
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full appearance-none pr-8 ${T.input} disabled:opacity-50`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    <Ico
      name={IC.down}
      className="w-4 h-4 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
    />
  </div>
);

const FilterGroup = ({ title, children }) => (
  <div className="py-3 border-b border-gray-100 last:border-b-0">
    <p className={`${T.label} mb-2`}>{title}</p>
    {children}
  </div>
);

const Pager = ({ page, pages, total, size, onPage, onSize }) => {
  const from = total ? (page - 1) * size + 1 : 0;
  const to = Math.min(page * size, total);
  const btn =
    "flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-700 hover:border-gray-400 disabled:opacity-40 disabled:hover:border-gray-200 transition-colors";
  return (
    <div
      className={`${T.card} px-4 py-3 flex flex-wrap items-center justify-between gap-3`}
    >
      <p className={T.muted}>
        {from}–{to} of {total} days
      </p>
      <div className="flex items-center gap-2">
        <select
          value={size}
          onChange={(e) => onSize(Number(e.target.value))}
          aria-label="Days per page"
          className={T.input}
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s} / page
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className={btn}
        >
          <Ico name={IC.left} />
        </button>
        <span className={`${T.muted} tabular-nums min-w-[64px] text-center`}>
          {page} / {pages}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          aria-label="Next page"
          className={btn}
        >
          <Ico name={IC.right} />
        </button>
      </div>
    </div>
  );
};

const ListSkeleton = () => (
  <div className="space-y-4">
    {[0, 1, 2].map((i) => (
      <div key={i} className={`${T.card} px-5 py-4 animate-pulse`}>
        <div className="h-3 w-40 bg-gray-100 rounded" />
        <div className="h-2.5 w-24 bg-gray-100 rounded mt-2" />
        <div className="h-16 w-full bg-gray-100 rounded mt-4" />
      </div>
    ))}
  </div>
);

/* =====================================================================
   4. FILTER MENU (one filter icon, everything inside it)
   ===================================================================== */
const FilterMenu = ({
  applied,
  defaults,
  onApply,
  employeeOptions,
  loading,
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(applied);
  const ref = useRef(null);
  const activeCount = countActive(applied, defaults);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const apply = () => {
    onApply(draft);
    setOpen(false);
  };
  const reset = () => {
    setDraft(defaults);
    onApply(defaults);
    setOpen(false);
  };

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => {
          if (!open) setDraft(applied);
          setOpen((o) => !o);
        }}
        aria-label="Filters"
        aria-expanded={open}
        className={`relative flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${
          open || activeCount
            ? "bg-black text-white border-black"
            : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
        }`}
      >
        <Ico name={IC.filter} className="w-[18px] h-[18px]" />
        {activeCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-30 w-[calc(100vw-2rem)] sm:w-[22rem] max-h-[75vh] flex flex-col bg-white border border-gray-200 rounded-lg shadow-lg">
          {/* header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className={T.cardTitle}>Filters</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close filters"
              className="text-gray-500 hover:text-black"
            >
              <Ico name={IC.close} className="w-5 h-5" />
            </button>
          </div>

          {/* body (scrolls) */}
          <div className="flex-1 overflow-y-auto px-4">
            <FilterGroup title="View by">
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                {VIEWS.map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    onClick={() => set({ viewBy: v.value })}
                    className={`flex-1 px-3 py-1.5 text-[10px] sm:text-xs transition-colors ${
                      draft.viewBy === v.value
                        ? "bg-black text-white"
                        : "text-gray-800 hover:bg-gray-50"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </FilterGroup>

            <FilterGroup title="Period">
              {draft.viewBy === "Date" ? (
                <DateField
                  value={draft.date}
                  onChange={(v) => v && set({ date: v })}
                />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={draft.month}
                    onChange={(v) => set({ month: v })}
                    options={MONTHS}
                    ariaLabel="Month"
                  />
                  {draft.viewBy === "Week" && (
                    <Select
                      value={draft.week}
                      onChange={(v) => set({ week: v })}
                      options={WEEKS}
                      ariaLabel="Week"
                    />
                  )}
                </div>
              )}
            </FilterGroup>

            <FilterGroup title="Employee">
              <Select
                value={draft.employee}
                onChange={(v) => set({ employee: v })}
                disabled={loading}
                ariaLabel="Employee"
                options={[
                  { value: "all", label: "All employees" },
                  ...employeeOptions,
                ]}
              />
            </FilterGroup>
          </div>

          {/* footer */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100">
            <button
              type="button"
              onClick={reset}
              className="text-[10px] sm:text-xs text-gray-500 hover:text-black"
            >
              Reset all
            </button>
            <button
              type="button"
              onClick={apply}
              className="px-4 py-2 text-xs sm:text-sm rounded-lg bg-black text-white hover:bg-black/80 transition-colors"
            >
              Apply filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* =====================================================================
   5. ONE DATE GROUP (accordion + table)
   Entry field names are read through pick(); add your API keys if needed.
   ===================================================================== */
const DateGroup = ({ group, open, onToggle }) => {
  const [limit, setLimit] = useState(STEP);
  const entries = entriesOf(group);
  const visible = entries.slice(0, limit);
  const remaining = entries.length - visible.length;

  return (
    <div className={`${T.card} overflow-hidden`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <h3 className={`${T.cardTitle} truncate`}>
            {formatDate(group.work_date)}
          </h3>
          <p className={`${T.subtitle} mt-0.5`}>
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-w-full">
          {group.total_hours && (
            <Badge className="bg-[#EBFDEF] text-gray-700">
              {group.total_hours}
            </Badge>
          )}
          <Ico
            name={IC.down}
            className={`w-4 h-4 text-gray-500 shrink-0 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {entries.length === 0 ? (
            <p className={`px-5 py-8 ${T.muted}`}>No entries for this day.</p>
          ) : (
            <>
              <div className="overflow-auto max-h-[480px]">
                <table className="w-full text-left min-w-[860px]">
                  <thead className="sticky top-0 z-10 bg-gray-50">
                    <tr className="border-y border-gray-100">
                      <th className={`${T.th} px-5 py-3`}>Employee</th>
                      <th className={`${T.th} px-3 py-3`}>Project</th>
                      <th className={`${T.th} px-3 py-3`}>Task</th>
                      <th className={`${T.th} px-3 py-3`}>Start</th>
                      <th className={`${T.th} px-3 py-3`}>End</th>
                      <th className={`${T.th} px-3 py-3`}>Hours</th>
                      <th className={`${T.th} px-3 py-3`}>Status</th>
                      <th className={`${T.th} px-5 py-3`}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visible.map((e, i) => {
                      const name = pick(e, [
                        "employee_name",
                        "name",
                        "full_name",
                      ]);
                      const status = pick(e, ["status", "task_status"], "");
                      return (
                        <tr
                          key={pick(e, ["id", "timesheet_id", "entry_id"], i)}
                          className="align-top hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-5 py-3 max-w-[220px]">
                            <p className={`${T.body} truncate`} title={name}>
                              {name}
                            </p>
                            <p className={T.muted}>
                              ID {pick(e, ["employee_id", "user_id"])}
                            </p>
                          </td>
                          <td
                            className={`px-3 py-3 ${T.body} max-w-[200px] break-words`}
                          >
                            {pick(e, ["project", "project_name"])}
                          </td>
                          <td
                            className={`px-3 py-3 ${T.body} max-w-[240px] break-words`}
                          >
                            {pick(e, ["task", "task_name"])}
                          </td>
                          <td
                            className={`px-3 py-3 ${T.body} whitespace-nowrap`}
                          >
                            {formatIsoTime(
                              pick(e, ["start_time", "check_in"], null),
                            )}
                          </td>
                          <td
                            className={`px-3 py-3 ${T.body} whitespace-nowrap`}
                          >
                            {formatIsoTime(
                              pick(e, ["end_time", "check_out"], null),
                            )}
                          </td>
                          <td
                            className={`px-3 py-3 ${T.body} whitespace-nowrap`}
                          >
                            {pick(e, ["total_hours", "hours", "duration"])}
                          </td>
                          <td className="px-3 py-3">
                            {status ? (
                              <Badge>{status}</Badge>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td
                            className={`px-5 py-3 ${T.body} text-gray-600 max-w-[260px] break-words`}
                          >
                            {pick(e, ["remarks", "description", "notes"])}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {remaining > 0 && (
                <div className="px-4 sm:px-5 py-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setLimit((n) => n + STEP)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[10px] sm:text-xs text-gray-800 hover:bg-gray-50"
                  >
                    Show {Math.min(STEP, remaining)} more · {remaining}{" "}
                    remaining
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

/* =====================================================================
   6. PAGE
   ===================================================================== */
export default function EmployeeTimeSheet() {
  // Employee dropdown data (GET /staff/get-active-users-light)
  const lightUsers = useEmployeeStore((s) => s.lightUsers);
  const lightLoading = useEmployeeStore((s) => s.lightLoading);
  const fetchLightUsers = useEmployeeStore((s) => s.fetchLightUsers);

  const defaults = useMemo(() => getDefaultFilters(), []);
  const [filters, setFilters] = useState(defaults);

  const [timesheetData, setTimesheetData] = useState([]);
  const [summary, setSummary] = useState({
    fromDate: "—",
    toDate: "—",
    totalEmployees: 0,
    totalHours: "0h 0m",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openSections, setOpenSections] = useState({});

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fetch the employee list once on mount
  useEffect(() => {
    fetchLightUsers();
  }, [fetchLightUsers]);

  // employee options for the filter (value = uuid)
  const employeeOptions = useMemo(
    () =>
      (lightUsers || [])
        .map((u) => ({
          value: String(u.uuid ?? u.id ?? ""),
          label: String(u.name ?? u.full_name ?? u.employee_name ?? "Unknown")
            .replace(/\s+/g, " ")
            .trim(),
        }))
        .filter((o) => o.value),
    [lightUsers],
  );

  // Fetch timesheet data
  const loadTimesheetData = async (f) => {
    setLoading(true);
    setError(null);

    const params = { view: f.viewBy.toLowerCase() };
    if (params.view === "month") {
      params.month = f.month;
    } else if (params.view === "week") {
      params.month = f.month;
      params.week = f.week;
    } else if (params.view === "date") {
      params.date = f.date;
    }
    if (f.employee && f.employee !== "all") {
      params.employee_id = f.employee; // change the key if your API expects another name
    }

    try {
      const data = await fetchTeamTimesheets(params);

      setSummary({
        fromDate: data.from_date || "—",
        toDate: data.to_date || "—",
        totalEmployees: data.total_employees || 0,
        totalHours: data.total_hours || "0h 0m",
      });

      const datesList = data.dates || [];
      setTimesheetData(datesList);

      const open = {};
      datesList.forEach((g) => {
        open[g.work_date] = true;
      });
      setOpenSections(open);
      setPage(1);
    } catch (err) {
      console.error("Error loading team timesheet data:", err);
      setTimesheetData([]);
      setError("Failed to fetch employee timesheets. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimesheetData(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApply = (next) => {
    setFilters(next);
    loadTimesheetData(next);
  };

  const toggleSection = (date) =>
    setOpenSections((prev) => ({ ...prev, [date]: !prev[date] }));

  const activeCount = countActive(filters, defaults);

  const pages = Math.max(1, Math.ceil(timesheetData.length / pageSize));
  const safePage = Math.min(page, pages);
  const pageGroups = timesheetData.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  return (
    <div className="w-full min-w-0 max-w-full flex flex-col gap-6 font-poppins text-xs sm:text-sm text-gray-800">
      {/* TOOLBAR: period readout + the one filter icon */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={`${T.cardTitle} flex items-center gap-2`}>
            <Ico
              name={IC.calendar}
              className="w-4 h-4 text-gray-700 shrink-0"
            />
            <span className="truncate">{periodLabel(filters, summary)}</span>
          </p>
          <p className={`${T.subtitle} mt-0.5`}>
            {timesheetData.length} {timesheetData.length === 1 ? "day" : "days"}
          </p>
        </div>

        <FilterMenu
          applied={filters}
          defaults={defaults}
          onApply={handleApply}
          employeeOptions={employeeOptions}
          loading={lightLoading}
        />
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={IC.calendar}
          label="From"
          value={formatDate(summary.fromDate)}
          bg={COLORS.blue}
        />
        <StatCard
          icon={IC.calendar}
          label="To"
          value={formatDate(summary.toDate)}
          bg={COLORS.yellow}
        />
        <StatCard
          icon={IC.users}
          label="Employees"
          value={Number(summary.totalEmployees).toLocaleString("en-IN")}
          bg={COLORS.green}
        />
        <StatCard
          icon={IC.clock}
          label="Total hours"
          value={summary.totalHours}
          bg={COLORS.orange}
        />
      </div>

      {/* ENTRIES */}
      <div className="flex flex-col gap-4 min-w-0">
        <h3 className={T.cardTitle}>Timesheet entries</h3>

        {loading ? (
          <ListSkeleton />
        ) : error ? (
          <div className={`${T.card} py-16 text-center px-4`}>
            <Ico
              name={IC.warning}
              className="w-6 h-6 text-gray-400 mx-auto mb-2"
            />
            <p className={T.body}>Could not load timesheets</p>
            <p className={`${T.muted} mt-1 break-words`}>{error}</p>
            <button
              type="button"
              onClick={() => loadTimesheetData(filters)}
              className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm rounded-lg bg-black text-white hover:bg-black/80 transition-colors"
            >
              <Ico name={IC.refresh} />
              Try again
            </button>
          </div>
        ) : timesheetData.length === 0 ? (
          <div className={`${T.card} py-16 text-center px-4`}>
            <Ico
              name={IC.folder}
              className="w-6 h-6 text-gray-400 mx-auto mb-2"
            />
            <p className={T.body}>No timesheet entries found</p>
            <p className={`${T.muted} mt-1`}>
              No entries match the selected period or employee.
            </p>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={() => handleApply(defaults)}
                className="mt-4 px-3.5 py-2 text-xs sm:text-sm rounded-lg bg-black text-white hover:bg-black/80 transition-colors"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <>
            {pageGroups.map((g) => (
              <DateGroup
                key={g.work_date}
                group={g}
                open={!!openSections[g.work_date]}
                onToggle={() => toggleSection(g.work_date)}
              />
            ))}

            {timesheetData.length > PAGE_SIZES[0] && (
              <Pager
                page={safePage}
                pages={pages}
                total={timesheetData.length}
                size={pageSize}
                onPage={setPage}
                onSize={(s) => {
                  setPageSize(s);
                  setPage(1);
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
