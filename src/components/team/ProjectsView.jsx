import React, { useState, useEffect, useMemo, useRef } from "react";
import { Icon } from "@iconify/react";
import teamService from "../../service/teamservice"; // adjust path if different
import { fetchTimesheetStatuses } from "../../service/timesheetservice";
import { getActiveUsersLight } from "../../service/employeeService"; // adjust to the file that exports getActiveUsersLight

/* =====================================================================
   STYLE TOKENS  (same scale as the Dashboard / Overview page)
   Change a value here and the whole page follows.
   ===================================================================== */
const T = {
  card: "bg-white rounded-lg shadow-sm border border-gray-100",
  cardTitle: "text-sm font-medium text-gray-800",
  subtitle: "text-[10px] sm:text-[13px] text-gray-400 font-light",
  label: "text-[10px] sm:text-xs uppercase text-gray-400",
  body: "text-xs sm:text-sm text-gray-800",
  muted: "text-[10px] sm:text-xs text-gray-400",
  th: "text-[10px] sm:text-xs uppercase text-gray-500",
  input:
    "border border-gray-200 rounded-lg bg-white px-2.5 py-1.5 text-[10px] sm:text-xs text-gray-800 focus:outline-none focus:border-black",
};

const CHART = {
  green: "#34c759",
};

/* Same palette as the dashboard KPI cards */
const COLORS = {
  green: "#EBFDEF",
  blue: "#E8EFF9",
  orange: "#FFEFE7",
  yellow: "#FFFBDB",
  red: "#FFDADA",
};

/* Lined (outline) icons — Solar outline set through Iconify */
const IC = {
  filter: "solar:filter-outline",
  calendar: "solar:calendar-outline",
  users: "solar:users-group-rounded-outline",
  tasks: "solar:checklist-minimalistic-outline",
  done: "solar:check-circle-outline",
  running: "solar:play-circle-outline",
  down: "solar:alt-arrow-down-outline",
  left: "solar:alt-arrow-left-outline",
  right: "solar:alt-arrow-right-outline",
  close: "solar:close-circle-outline",
  search: "solar:magnifer-outline",
  refresh: "solar:refresh-outline",
  folder: "solar:folder-outline",
  warning: "solar:danger-triangle-outline",
};

const Ico = ({ name, className = "w-4 h-4" }) => (
  <Icon icon={name} className={className} />
);

/* Date field: native date input with the lined calendar icon on the right.
   The browser's own picker icon is made invisible and stretched over the whole
   field, so clicking anywhere opens the calendar. */
const DateField = ({ value, onChange, min, max, ariaLabel = "Date" }) => (
  <div className="relative w-full">
    <input
      type="date"
      value={value}
      min={min}
      max={max}
      onChange={onChange}
      onClick={(e) => {
        try {
          e.currentTarget.showPicker?.();
        } catch {
          /* picker already open / unsupported */
        }
      }}
      aria-label={ariaLabel}
      className={`w-full pr-9 cursor-pointer ${T.input} [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
    />
    <Icon
      icon="solar:calendar-outline"
      className="w-4 h-4 text-gray-700 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
    />
  </div>
);

/* ---------- helpers + small UI pieces ---------- */

const num = (v) =>
  v === null || v === undefined || Number.isNaN(Number(v))
    ? "—"
    : Number(v).toLocaleString("en-IN");

const humanize = (s) => {
  if (!s) return "—";
  const t = String(s).replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

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

const formatDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const formatMinutes = (m) => {
  const mins = Number(m) || 0;
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  if (!h) return `${r}m`;
  return r ? `${h}h ${r}m` : `${h}h`;
};

/* long text is cut with "…" so a badge can never stretch its row */
const Badge = ({
  children,
  className = "bg-zinc-100 text-gray-600",
  style,
}) => (
  <span
    style={style}
    className={`inline-block max-w-full truncate align-middle px-2.5 py-1 rounded-full text-[10px] sm:text-xs whitespace-nowrap ${className}`}
  >
    {children}
  </span>
);

/* StatCard — dashboard style: pastel bg + black round lined icon */
const StatCard = ({ icon, label, value, hint, bg }) => (
  <div
    className="shadow-sm rounded-lg p-3 flex items-center gap-3 min-w-0"
    style={{ backgroundColor: bg }}
  >
    <div className="flex items-center justify-center min-w-10 h-10 rounded-full bg-black text-white">
      <Ico name={icon} className="w-[18px] h-[18px]" />
    </div>
    <div className="overflow-hidden">
      <p className="text-gray-500 text-[10px] sm:text-xs truncate uppercase ">
        {label}
      </p>
      <h2 className="text-lg sm:text-xl font-medium text-gray-800">{value}</h2>
      {hint && <p className="text-[10px] text-gray-500 truncate">{hint}</p>}
    </div>
  </div>
);

const Field = ({ label, value }) => (
  <div className="min-w-0">
    <p className={T.label}>{label}</p>
    <p className={`${T.body} mt-0.5 break-words`}>{value ?? "—"}</p>
  </div>
);

/* ---------- option builders ---------- */

const PERIODS = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

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
];

// Convert API status values into the format expected by the filter list.
const buildTimesheetStatusOptions = (statuses) => {
  const items = Array.isArray(statuses)
    ? statuses
    : Array.isArray(statuses?.statuses)
      ? statuses.statuses
      : [];

  const options = items
    .map((item) => {
      if (typeof item === "string" || typeof item === "number") {
        const value = String(item);
        return { value, label: value };
      }

      if (!item || typeof item !== "object") return null;

      // Keep the backend status text exactly as returned. The projects API
      // expects values such as "In Progress" and "Blocked".
      const value =
        item.status ??
        item.value ??
        item.name ??
        item.label ??
        item.status_name ??
        item.title ??
        item.code;

      if (value === null || value === undefined || value === "") return null;

      const label =
        item.label ??
        item.name ??
        item.status_name ??
        item.title ??
        String(value);

      return { value: String(value), label: String(label) };
    })
    .filter(Boolean);

  return options.filter(
    (option, index, list) =>
      list.findIndex((item) => item.value === option.value) === index,
  );
};

// Convert the active-users response into options (value = employee id)
const buildEmployeeOptions = (res) => {
  const items = Array.isArray(res)
    ? res
    : Array.isArray(res?.users)
      ? res.users
      : Array.isArray(res?.employees)
        ? res.employees
        : [];

  const options = items
    .map((u) => {
      if (!u || typeof u !== "object") return null;
      // `uuid` (e.g. "100557") is the id the projects API uses; `id` is internal
      const value = u.uuid ?? u.employee_id ?? u.user_id ?? u.id;
      if (value === null || value === undefined || value === "") return null;
      const label =
        u.name ??
        u.full_name ??
        u.employee_name ??
        ([u.first_name, u.last_name].filter(Boolean).join(" ") ||
          String(value));
      return {
        value: String(value),
        label: String(label).replace(/\s+/g, " ").trim(),
      };
    })
    .filter(Boolean);

  return options.filter(
    (option, index, list) =>
      list.findIndex((item) => item.value === option.value) === index,
  );
};

const PROJECT_STATUS_STYLES = {
  active: "bg-emerald-50 text-emerald-700",
  completed: "bg-zinc-100 text-gray-600",
  on_hold: "bg-amber-50 text-amber-700",
};

/* ---------- period helpers ---------- */

const pad = (n) => String(n).padStart(2, "0");

const toISODate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Week of the month, weeks start on Monday (week 1 = the week containing the 1st)
const weekOfMonth = (d) => {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  return Math.ceil((d.getDate() + offset) / 7);
};

// month is 1-based
const weeksInMonth = (month, year) => weekOfMonth(new Date(year, month, 0));

// e.g. "9–15 Nov" (week clipped to the month)
const weekRangeShort = (month, year, week) => {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const offset = (first.getDay() + 6) % 7;
  let start = new Date(year, month - 1, 1 - offset + (week - 1) * 7);
  let end = new Date(start);
  end.setDate(end.getDate() + 6);
  if (start < first) start = first;
  if (end > last) end = last;
  const mon = end.toLocaleDateString("en-IN", { month: "short" });
  return `${start.getDate()}–${end.getDate()} ${mon}`;
};

/* ---------- filters state ---------- */

const makeDefaults = (projectStatuses = []) => {
  const now = new Date();
  return {
    period: "daily",
    date: toISODate(now),
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    week: weekOfMonth(now),
    statuses: [], // task statuses (empty = all)
    projectStatuses, // project statuses (empty = all)
    employees: [], // employee ids (empty = all)
    q: "", // project search (client side only, never sent to the API)
  };
};

const sameList = (a, b) =>
  a.length === b.length && a.every((x) => b.includes(x));

const countActive = (f, d) => {
  let n = 0;
  if (
    f.period !== d.period ||
    f.date !== d.date ||
    f.month !== d.month ||
    f.year !== d.year ||
    f.week !== d.week
  )
    n += 1;
  if (f.statuses.length) n += 1;
  if (!sameList(f.projectStatuses, d.projectStatuses)) n += 1;
  if (f.employees.length) n += 1;
  if (f.q.trim()) n += 1;
  return n;
};

const periodLabelOf = (f) => {
  if (f.period === "daily") return formatDate(`${f.date}T00:00:00`);
  if (f.period === "weekly") {
    const w = Math.min(f.week, weeksInMonth(f.month, f.year));
    return `Week ${w} · ${weekRangeShort(f.month, f.year, w)} ${f.year}`;
  }
  return `${MONTHS[f.month - 1]} ${f.year}`;
};

/* ---------- API query params ---------- */

const buildParams = (f) => {
  const params = { period: f.period };

  if (f.period === "daily") {
    params.date = f.date;
  } else if (f.period === "weekly") {
    params.month = f.month;
    params.year = f.year;
    params.week = Math.min(f.week, weeksInMonth(f.month, f.year));
  } else {
    params.month = f.month;
    params.year = f.year;
  }

  if (f.statuses.length) params.status = f.statuses.join(",");
  if (f.projectStatuses.length)
    params.project_status = f.projectStatuses.join(",");
  if (f.employees.length) params.employees = f.employees.join(",");
  return params;
};

/* =====================================================================
   FILTER MENU — every filter lives inside the one filter icon
   ===================================================================== */

const FilterGroup = ({ title, children }) => (
  <div className="py-3 border-b border-gray-100 last:border-b-0">
    <p className={`${T.label} mb-2`}>{title}</p>
    {children}
  </div>
);

/* checkbox list that scrolls inside a fixed height (works for 100s of rows) */
const CheckList = ({
  options,
  value,
  onChange,
  searchable = false,
  allLabel = "All",
  emptyText = "No options",
}) => {
  const [q, setQ] = useState("");
  const selected = useMemo(() => new Set(value), [value]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s
      ? options.filter((o) => o.label.toLowerCase().includes(s))
      : options;
  }, [options, q]);

  const CAP = 200; // never render more than this many rows at once
  const capped = shown.slice(0, CAP);

  const toggle = (v) =>
    onChange(selected.has(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className={T.muted}>
          {value.length ? `${value.length} selected` : allLabel}
        </span>
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[10px] sm:text-xs text-gray-500 hover:text-black underline"
          >
            Clear
          </button>
        )}
      </div>

      {searchable && (
        <div className="relative mb-2">
          <Ico
            name={IC.search}
            className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className={`w-full pl-8 ${T.input}`}
          />
        </div>
      )}

      <ul className="max-h-36 overflow-y-auto border border-gray-100 rounded-lg py-1">
        {capped.length === 0 ? (
          <li className={`px-3 py-2 ${T.muted}`}>{emptyText}</li>
        ) : (
          capped.map((o) => (
            <li key={o.value}>
              <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(o.value)}
                  onChange={() => toggle(o.value)}
                  className="accent-black w-3.5 h-3.5 shrink-0"
                />
                <span className={`${T.body} truncate`} title={o.label}>
                  {o.label}
                </span>
              </label>
            </li>
          ))
        )}
        {shown.length > CAP && (
          <li className={`px-3 py-2 ${T.muted}`}>
            Showing first {CAP} of {shown.length} — type to narrow down.
          </li>
        )}
      </ul>
    </div>
  );
};

const FilterMenu = ({ applied, defaults, onApply, options }) => {
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

  const weeksCount = weeksInMonth(draft.month, draft.year);
  const draftWeek = Math.min(draft.week, weeksCount);

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 3, y - 2, y - 1, y, y + 1];
  }, []);

  const apply = () => {
    onApply({ ...draft, week: draftWeek });
    setOpen(false);
  };

  const reset = () => {
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
            <FilterGroup title="Search project">
              <div className="relative">
                <Ico
                  name={IC.search}
                  className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                />
                <input
                  type="text"
                  value={draft.q}
                  onChange={(e) => set({ q: e.target.value })}
                  placeholder="Project name or ID"
                  className={`w-full pl-8 ${T.input}`}
                />
              </div>
            </FilterGroup>

            <FilterGroup title="Period">
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden mb-2">
                {PERIODS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => set({ period: p.id })}
                    className={`flex-1 px-3 py-1.5 text-[10px] sm:text-xs transition-colors ${
                      draft.period === p.id
                        ? "bg-black text-white"
                        : "text-gray-800 hover:bg-gray-50"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {draft.period === "daily" ? (
                <DateField
                  value={draft.date}
                  onChange={(e) =>
                    e.target.value && set({ date: e.target.value })
                  }
                />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={draft.month}
                    onChange={(e) => set({ month: Number(e.target.value) })}
                    aria-label="Month"
                    className={`w-full ${T.input}`}
                  >
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    value={draft.year}
                    onChange={(e) => set({ year: Number(e.target.value) })}
                    aria-label="Year"
                    className={`w-full ${T.input}`}
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>

                  {draft.period === "weekly" && (
                    <select
                      value={draftWeek}
                      onChange={(e) => set({ week: Number(e.target.value) })}
                      aria-label="Week"
                      className={`col-span-2 w-full ${T.input}`}
                    >
                      {Array.from({ length: weeksCount }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {`Week ${i + 1} · ${weekRangeShort(
                            draft.month,
                            draft.year,
                            i + 1,
                          )}`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </FilterGroup>

            <FilterGroup title="Project status">
              <CheckList
                options={options.projectStatuses}
                value={draft.projectStatuses}
                onChange={(v) => set({ projectStatuses: v })}
                allLabel="All projects"
              />
            </FilterGroup>

            <FilterGroup title="Task status">
              <CheckList
                options={options.taskStatuses}
                value={draft.statuses}
                onChange={(v) => set({ statuses: v })}
                allLabel="All statuses"
              />
            </FilterGroup>

            <FilterGroup title="Employees">
              <CheckList
                options={options.employees}
                value={draft.employees}
                onChange={(v) => set({ employees: v })}
                allLabel="All employees"
                searchable
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

/* ---------- pagination (keeps 100+ projects from making a huge page) ---------- */

const PAGE_SIZES = [10, 25, 50];

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
        {from}–{to} of {total} projects
      </p>

      <div className="flex items-center gap-2">
        <select
          value={size}
          onChange={(e) => onSize(Number(e.target.value))}
          aria-label="Projects per page"
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
          <Ico name={IC.left} className="w-4 h-4" />
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
          <Ico name={IC.right} className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

/* ---------- assignee helpers ---------- */

const isDone = (a) => /complete/i.test(a?.status || "");

const assigneeBadge = (a) => {
  const label = a.status || "Not started";
  return a.status_color
    ? {
        text: label,
        className: "",
        style: {
          color: a.status_color,
          backgroundColor: `${a.status_color}1A`,
        },
      }
    : { text: label, className: "bg-zinc-100 text-gray-600", style: undefined };
};

/* ---------- one task + its assignees (table scrolls inside a fixed height) ---------- */

const TaskBlock = ({ t }) => {
  const assignees = t.assignees || [];

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-gray-50/60">
        <p className={`${T.body} min-w-0 break-words`}>
          <span className="text-gray-400">#{t.task_id}</span> {t.task}
        </p>
        {assignees.length === 0 ? (
          <Badge className="bg-amber-50 text-amber-700">Unassigned</Badge>
        ) : (
          <Badge className="bg-[#FFFBDB] text-gray-700">
            {assignees.length}{" "}
            {assignees.length === 1 ? "assignee" : "assignees"}
          </Badge>
        )}
      </div>

      {assignees.length > 0 && (
        <div className="overflow-auto max-h-72">
          <table className="w-full text-left min-w-[860px]">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr className="border-y border-gray-100">
                <th className={`${T.th} px-4 py-2.5`}>Employee</th>
                <th className={`${T.th} px-3 py-2.5`}>Status</th>
                <th className={`${T.th} px-3 py-2.5`}>Work date</th>
                <th className={`${T.th} px-3 py-2.5`}>Start time</th>
                <th className={`${T.th} px-3 py-2.5`}>Time taken</th>
                <th className={`${T.th} px-3 py-2.5`}>Days worked</th>
                <th className={`${T.th} px-3 py-2.5`}>Working</th>
                <th className={`${T.th} px-4 py-2.5`}>Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {assignees.map((a) => {
                const b = assigneeBadge(a);
                return (
                  <tr
                    key={a.employee_id}
                    className="align-top hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className={`${T.body} truncate`} title={a.name}>
                        {a.name}
                      </p>
                      <p className={T.muted}>ID {a.employee_id}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Badge className={b.className} style={b.style}>
                        {b.text}
                      </Badge>
                    </td>
                    <td className={`px-3 py-3 ${T.body} whitespace-nowrap`}>
                      {a.work_date
                        ? formatDate(`${a.work_date}T00:00:00`)
                        : "—"}
                    </td>
                    <td className={`px-3 py-3 ${T.body} whitespace-nowrap`}>
                      {formatDateTime(a.start_time)}
                    </td>
                    <td className={`px-3 py-3 ${T.body} whitespace-nowrap`}>
                      {formatMinutes(a.time_taken_minutes)}
                    </td>
                    <td className={`px-3 py-3 ${T.body}`}>
                      {num(a.days_worked ?? 0)}
                    </td>
                    {/* is_working true -> "Running", false -> "Not running" */}
                    <td className="px-3 py-3">
                      {a.is_working ? (
                        <Badge className="bg-emerald-50 text-emerald-700">
                          Running
                        </Badge>
                      ) : (
                        <Badge className="bg-zinc-100 text-gray-600">
                          Not running
                        </Badge>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-xs sm:text-sm text-gray-600 max-w-[260px] break-words`}
                    >
                      {a.remarks || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* ---------- one project (accordion) ---------- */

const TASK_STEP = 10; // tasks are revealed 10 at a time

const ProjectCard = ({ r }) => {
  const [open, setOpen] = useState(false);
  const [taskLimit, setTaskLimit] = useState(TASK_STEP);

  const unassignedN = r.tasks.filter((t) => !t.assignees?.length).length;
  const pct = r.tasks.length ? Math.round((r.done / r.tasks.length) * 100) : 0;
  const visibleTasks = r.tasks.slice(0, taskLimit);
  const remaining = r.tasks.length - visibleTasks.length;

  return (
    <div className={`${T.card} overflow-hidden`}>
      {/* Accordion header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <h3 className={`${T.cardTitle} truncate`} title={r.project}>
            {r.project}
          </h3>
          <p className={`${T.subtitle} mt-0.5`}>Project ID {r.project_id}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 max-w-full">
          <Badge className="bg-[#E8EFF9] text-gray-700">
            {r.tasks.length} {r.tasks.length === 1 ? "task" : "tasks"}
          </Badge>
          <Badge className="bg-[#FFFBDB] text-gray-700">
            {r.people.length} {r.people.length === 1 ? "person" : "people"}
          </Badge>
          {r.tasks.length > 0 && (
            <Badge className="bg-[#EBFDEF] text-gray-700">{r.done} done</Badge>
          )}
          {unassignedN > 0 && (
            <Badge className="bg-[#FFDADA] text-red-700">
              {unassignedN} unassigned
            </Badge>
          )}
          {r.working_now > 0 && (
            <Badge className="bg-emerald-50 text-emerald-700">
              {r.working_now} working now
            </Badge>
          )}
          <Badge
            className={
              PROJECT_STATUS_STYLES[r.status] || "bg-zinc-100 text-gray-600"
            }
          >
            {humanize(r.status)}
          </Badge>
          <Ico
            name={IC.down}
            className={`w-4 h-4 text-gray-500 shrink-0 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>

        {/* completion bar */}
        {r.tasks.length > 0 && (
          <div className="basis-full flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: CHART.green }}
              />
            </div>
            <span className={`${T.muted} shrink-0 tabular-nums`}>
              {r.done}/{r.tasks.length} done · {pct}%
            </span>
          </div>
        )}
      </button>

      {/* Accordion body — full data */}
      {open && (
        <div className="border-t border-gray-100">
          {/* Project details */}
          <div className="px-4 sm:px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50/60">
            <Field label="Project ID" value={r.project_id} />
            <Field label="Project" value={r.project} />
            <Field label="Status" value={humanize(r.status)} />
            <Field label="Working now" value={r.working_now} />
            <Field label="Tasks" value={r.tasks.length} />
            <Field label="Completed tasks" value={r.done} />
            <Field label="Unassigned tasks" value={unassignedN} />
            <Field label="Allocated people" value={r.people.length} />
          </div>

          {/* Tasks */}
          <div className="border-t border-gray-100">
            <p className={`px-4 sm:px-5 pt-4 ${T.label}`}>
              Tasks ({r.tasks.length})
            </p>

            {r.tasks.length === 0 ? (
              <p className={`px-4 sm:px-5 py-8 ${T.muted}`}>
                No tasks in this period.
              </p>
            ) : (
              <div className="px-4 sm:px-5 py-4 space-y-4 max-h-[560px] overflow-y-auto">
                {visibleTasks.map((t) => (
                  <TaskBlock key={t.task_id} t={t} />
                ))}

                {remaining > 0 && (
                  <button
                    type="button"
                    onClick={() => setTaskLimit((n) => n + TASK_STEP)}
                    className="w-full py-2 text-[10px] sm:text-xs text-gray-700 border border-gray-200 rounded-lg hover:border-gray-400 transition-colors"
                  >
                    Show {Math.min(TASK_STEP, remaining)} more · {remaining}{" "}
                    remaining
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Allocated people */}
          <div className="border-t border-gray-100 px-4 sm:px-5 py-4">
            <p className={T.label}>Allocated people ({r.people.length})</p>
            {r.people.length === 0 ? (
              <p className={`${T.muted} mt-3`}>No one assigned.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 max-h-72 overflow-y-auto pr-1">
                {r.people.map((a) => (
                  <div
                    key={a.employee_id}
                    className="flex items-center gap-3 border border-gray-200 rounded-lg p-3 min-w-0"
                  >
                    <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center text-xs shrink-0">
                      {initials(a.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`${T.body} truncate`} title={a.name}>
                        {a.name}
                        {a.working && (
                          <span className="ml-1.5 text-[10px] text-emerald-700">
                            (Working now)
                          </span>
                        )}
                      </p>
                      <p className={`${T.muted} truncate`}>
                        ID {a.employee_id} · {formatMinutes(a.minutes)} worked
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ListSkeleton = () => (
  <div className="space-y-4">
    {[0, 1, 2].map((i) => (
      <div key={i} className={`${T.card} px-5 py-4 animate-pulse`}>
        <div className="h-3 w-40 bg-gray-100 rounded" />
        <div className="h-2.5 w-24 bg-gray-100 rounded mt-2" />
        <div className="h-1.5 w-full bg-gray-100 rounded mt-4" />
      </div>
    ))}
  </div>
);

/* =====================================================================
   PROJECTS TAB
   ===================================================================== */

const ProjectsView = () => {
  const [defaultProjectStatuses, setDefaultProjectStatuses] = useState([]);
  const defaults = useMemo(
    () => makeDefaults(defaultProjectStatuses),
    [defaultProjectStatuses],
  );
  const [filters, setFilters] = useState(() => makeDefaults());

  const [taskStatusOptions, setTaskStatusOptions] = useState([]);
  const [projectStatusOptions, setProjectStatusOptions] = useState([]);
  const [employeeOptions, setEmployeeOptions] = useState([]);
  const [projectStatusReady, setProjectStatusReady] = useState(false);

  const [data, setData] = useState(null); // { summary, projects }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fetch timesheet/task statuses from timesheetservice.
  useEffect(() => {
    let cancelled = false;

    const loadTimesheetStatuses = async () => {
      try {
        const res = await fetchTimesheetStatuses();
        if (cancelled) return;
        setTaskStatusOptions(buildTimesheetStatusOptions(res));
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch timesheet statuses:", err);
          setTaskStatusOptions([]);
        }
      }
    };

    loadTimesheetStatuses();

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch employees for the employee filter
  useEffect(() => {
    let cancelled = false;

    const loadEmployees = async () => {
      try {
        const res = await getActiveUsersLight();
        if (cancelled) return;
        setEmployeeOptions(buildEmployeeOptions(res));
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch employees:", err);
          setEmployeeOptions([]);
        }
      }
    };

    loadEmployees();

    return () => {
      cancelled = true;
    };
  }, []);

  // GET /manager/projects/statuses
  useEffect(() => {
    let cancelled = false;

    teamService
      .fetchProjectStatuses()
      .then((res) => {
        if (cancelled) return;
        setProjectStatusOptions(res.statuses);
        // start on the API default (e.g. "active")
        const def = res.default ? [res.default] : [];
        setDefaultProjectStatuses(def);
        setFilters((f) => ({ ...f, projectStatuses: def }));
      })
      .catch(() => {
        // fall back to all projects
      })
      .finally(() => {
        if (!cancelled) setProjectStatusReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // only the filters the API understands decide when we refetch
  // (the project search box is client side and never refetches)
  const paramsKey = JSON.stringify(buildParams(filters));

  // GET /admin/projects/task-status
  useEffect(() => {
    if (!projectStatusReady) return undefined; // wait for the project status default
    let cancelled = false;
    setLoading(true);
    setError("");

    teamService
      .fetchProjectsTaskStatus(JSON.parse(paramsKey))
      .then((res) => {
        if (cancelled) return;

        // Supports both the older { summary, projects } response and the
        // current API response: { status_code, message, data: [...] }.
        const payload = res?.data?.data ?? res?.data ?? res;
        const projects = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.projects)
            ? payload.projects
            : [];

        setData({
          ...(Array.isArray(payload) ? {} : payload),
          projects,
          summary: Array.isArray(payload) ? undefined : payload?.summary,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err.response?.data?.message ||
            err.message ||
            "Could not load project task status.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [paramsKey, projectStatusReady, reloadKey]);

  const summary = data?.summary;

  const rows = useMemo(
    () =>
      (data?.projects || []).map((p) => {
        const tasks = p.tasks || [];

        // unique people across all tasks of this project
        const people = new Map();
        tasks.forEach((t) =>
          (t.assignees || []).forEach((a) => {
            const prev = people.get(a.employee_id) || {
              employee_id: a.employee_id,
              name: a.name,
              minutes: 0,
              working: false,
            };
            prev.minutes += Number(a.time_taken_minutes) || 0;
            prev.working = prev.working || !!a.is_working;
            people.set(a.employee_id, prev);
          }),
        );

        // a task is done when it has assignees and all of them completed it
        const done = tasks.filter(
          (t) => t.assignees?.length && t.assignees.every(isDone),
        ).length;

        return { ...p, tasks, people: [...people.values()], done };
      }),
    [data],
  );

  // client side project search
  const filteredRows = useMemo(() => {
    const s = filters.q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        String(r.project || "")
          .toLowerCase()
          .includes(s) ||
        String(r.project_id ?? "")
          .toLowerCase()
          .includes(s),
    );
  }, [rows, filters.q]);

  // go back to page 1 whenever the list changes
  useEffect(() => {
    setPage(1);
  }, [paramsKey, filters.q, pageSize]);

  const pages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, pages);
  const pageRows = filteredRows.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  const workingNow = rows.reduce((s, r) => s + (Number(r.working_now) || 0), 0);
  const activeFilterCount = countActive(filters, defaults);

  const filterOptions = {
    projectStatuses: projectStatusOptions,
    taskStatuses: taskStatusOptions,
    employees: employeeOptions,
  };

  return (
    <div className="space-y-6 min-w-0 max-w-full font-poppins">
      {/* TOOLBAR: period readout + the one filter icon */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={`${T.cardTitle} flex items-center gap-2`}>
            <Ico
              name={IC.calendar}
              className="w-4 h-4 text-gray-700 shrink-0"
            />
            <span className="truncate">{periodLabelOf(filters)}</span>
          </p>
          <p className={`${T.subtitle} mt-0.5`}>
            {filteredRows.length}{" "}
            {filteredRows.length === 1 ? "project" : "projects"}
          </p>
        </div>

        <FilterMenu
          applied={filters}
          defaults={defaults}
          onApply={setFilters}
          options={filterOptions}
        />
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={IC.users}
          label="Total employees"
          value={num(summary?.allocated_employees)}
          hint="Allocated to tasks"
          bg={COLORS.yellow}
        />
        <StatCard
          icon={IC.tasks}
          label="No. of tasks"
          value={num(summary?.total_tasks)}
          hint={
            summary
              ? `${num(summary.total_projects)} ${
                  summary.total_projects === 1 ? "project" : "projects"
                }`
              : undefined
          }
          bg={COLORS.blue}
        />
        <StatCard
          icon={IC.done}
          label="Completion"
          value={
            summary?.completion_rate === null ||
            summary?.completion_rate === undefined
              ? "—"
              : `${summary.completion_rate}%`
          }
          hint={summary?.completion_label}
          bg={COLORS.green}
        />
        <StatCard
          icon={IC.running}
          label="Working now"
          value={num(workingNow)}
          hint="Tasks running right now"
          bg={COLORS.orange}
        />
      </div>

      {/* PROJECTS (accordion, paginated) */}
      <div className="space-y-4 min-w-0">
        <div className="flex items-center justify-between">
          <h3 className={T.cardTitle}>Project breakdown</h3>
          <p className={T.muted}>
            {filteredRows.length}{" "}
            {filteredRows.length === 1 ? "project" : "projects"}
          </p>
        </div>

        {loading ? (
          <ListSkeleton />
        ) : error ? (
          <div className={`${T.card} py-16 text-center px-4`}>
            <Ico
              name={IC.warning}
              className="w-6 h-6 text-gray-400 mx-auto mb-2"
            />
            <p className={T.body}>Could not load projects</p>
            <p className={`${T.muted} mt-1 break-words`}>{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm rounded-lg bg-black text-white hover:bg-black/80 transition-colors"
            >
              <Ico name={IC.refresh} className="w-4 h-4" />
              Try again
            </button>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className={`${T.card} py-16 text-center px-4`}>
            <Ico
              name={IC.folder}
              className="w-6 h-6 text-gray-400 mx-auto mb-2"
            />
            <p className={T.body}>No projects found</p>
            <p className={`${T.muted} mt-1`}>
              No projects match the selected filters.
            </p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => setFilters(defaults)}
                className="mt-4 px-3.5 py-2 text-xs sm:text-sm rounded-lg bg-black text-white hover:bg-black/80 transition-colors"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <>
            {pageRows.map((r) => (
              <ProjectCard key={r.project_id} r={r} />
            ))}

            {filteredRows.length > PAGE_SIZES[0] && (
              <Pager
                page={safePage}
                pages={pages}
                total={filteredRows.length}
                size={pageSize}
                onPage={setPage}
                onSize={setPageSize}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ProjectsView;
