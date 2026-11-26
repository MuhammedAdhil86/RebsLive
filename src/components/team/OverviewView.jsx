import React, { useState, useEffect, useMemo, useRef } from "react";
import { Icon } from "@iconify/react";
import teamService from "../../service/teamservice"; // adjust path if different

/* =====================================================================
   1. ICONS (Solar outline only, defined once)
   ===================================================================== */
const ICONS = {
  filter: "solar:filter-outline",
  calendar: "solar:calendar-outline",
  search: "solar:magnifer-outline",
  chevronDown: "solar:alt-arrow-down-outline",
  prev: "solar:alt-arrow-left-outline",
  next: "solar:alt-arrow-right-outline",
  close: "solar:close-circle-outline",
  refresh: "solar:refresh-outline",
  empty: "solar:folder-outline",
  error: "solar:danger-triangle-outline",
  projects: "solar:folder-outline",
  tasks: "solar:checklist-minimalistic-outline",
  members: "solar:users-group-rounded-outline",
  warning: "solar:danger-triangle-outline",
  success: "solar:check-circle-outline",
  view: "solar:eye-outline",
};

/* =====================================================================
   2. STYLE TOKENS (same scale as the Dashboard)
   ===================================================================== */
const T = {
  card: "bg-white rounded-lg shadow-sm border border-gray-100",
  cardTitle: "text-sm font-medium text-gray-800",
  subtitle: "text-[10px] sm:text-[13px] text-gray-400 font-light",
  label: "text-[10px] sm:text-xs uppercase font-semibold text-gray-400",
  body: "text-xs sm:text-sm text-gray-800",
  muted: "text-[10px] sm:text-xs text-gray-400",
  th: "text-[10px] sm:text-xs uppercase font-semibold text-gray-500",
  legend: "text-[10px] sm:text-xs text-gray-800",
};

/* pastel colors (KPI cards, soft badges) */
const COLORS = {
  green: "#EBFDEF",
  blue: "#E8EFF9",
  orange: "#FFEFE7",
  yellow: "#FFFBDB",
  red: "#FFDADA",
};

/* stronger tones (chart fills) */
const CHART = {
  green: "#34c759",
  blue: "#5b8def",
  orange: "#ff9a62",
  yellow: "#f2c94c",
  red: "#ef6b6b",
};

const WORKLOAD_COLORS = [
  "#5b8def",
  "#8b5cf6",
  "#14b8a6",
  "#06b6d4",
  "#6366f1",
  "#0ea5e9",
  "#a78bfa",
  "#2dd4bf",
];

const CHART_H = "h-44"; // every chart graphic uses this height
const LEGEND_H = "h-24"; // every legend uses this height
const MAX_SLICES = 7; // pie draws the top 7, the rest become "Others"
const OTHERS_COLOR = "#cbd5e1";
const STEP = 10; // nested lists reveal 10 at a time

/* =====================================================================
   3. HELPERS
   ===================================================================== */
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

/* amount + currency, e.g. ₹13,000.00 */
const formatAmount = (amount, currency) => {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount)))
    return "—";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
    }).format(Number(amount));
  } catch {
    return `${currency ? `${currency} ` : ""}${Number(amount).toLocaleString(
      "en-IN",
    )}`;
  }
};

const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/* =====================================================================
   4. SMALL UI PIECES
   ===================================================================== */

/* Date field: native input + lined calendar icon on the right.
   The browser's own picker icon is invisible and stretched over the whole
   field, so a click anywhere opens the calendar. */
const DateField = ({
  value,
  onChange,
  min,
  max,
  ariaLabel = "Select date",
}) => (
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
      className="w-full pr-9 cursor-pointer border border-gray-200 rounded-lg bg-white px-2.5 py-1.5 text-[10px] sm:text-xs text-gray-800 focus:outline-none focus:border-black [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
    />
    <Icon
      icon={ICONS.calendar}
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

/* StatCard: pastel bg + black round icon. `icon` is an Iconify name. */
const StatCard = ({ icon, label, value, hint, bg }) => (
  <div
    className="shadow-sm rounded-lg p-3 flex items-center gap-3 min-w-0"
    style={{ backgroundColor: bg }}
  >
    <div className="flex items-center justify-center min-w-10 h-10 rounded-full bg-black text-white">
      <Icon icon={icon} className="w-[18px] h-[18px]" />
    </div>
    <div className="overflow-hidden">
      <p className="text-gray-500 text-[10px] sm:text-xs uppercase font-semibold truncate">
        {label}
      </p>
      <h2 className="text-lg sm:text-xl font-medium text-gray-800">{value}</h2>
      {hint && (
        <p className="text-[10px] sm:text-xs text-gray-500 truncate">{hint}</p>
      )}
    </div>
  </div>
);

const Avatar = ({ src, name, size = 40 }) => {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  if (!src || failed) {
    return (
      <div
        style={style}
        className="rounded-full bg-black text-white flex items-center justify-center text-xs shrink-0"
      >
        {initials(name)}
      </div>
    );
  }
  return (
    <img
      src={encodeURI(src)}
      alt={name}
      style={style}
      onError={() => setFailed(true)}
      className="rounded-full object-cover shrink-0"
    />
  );
};

const Field = ({ label, value }) => (
  <div className="min-w-0">
    <p className={T.label}>{label}</p>
    <p className={`${T.body} mt-0.5 break-words`}>{value ?? "—"}</p>
  </div>
);

const ShowMore = ({ remaining, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[10px] sm:text-xs text-gray-800 hover:bg-gray-50"
  >
    Show {Math.min(STEP, remaining)} more · {remaining} remaining
  </button>
);

const EmptyState = ({ icon, title, text, action }) => (
  <div className={`${T.card} py-16 px-4 text-center`}>
    <Icon icon={icon} className="w-6 h-6 text-gray-400 mx-auto mb-2" />
    <p className={T.body}>{title}</p>
    <p className={`${T.muted} mt-1`}>{text}</p>
    {action}
  </div>
);

const PageSkeleton = () => (
  <div className="space-y-6 min-w-0 max-w-full font-poppins animate-pulse">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[66px] rounded-lg bg-gray-100" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className={`${T.card} p-4 sm:p-5`}>
          <div className="h-3 w-1/3 rounded bg-gray-100" />
          <div className="h-2.5 w-1/2 rounded bg-gray-100 mt-2" />
          <div className="h-60 rounded-lg bg-gray-100 mt-4" />
        </div>
      ))}
    </div>
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className={`${T.card} px-5 py-4`}>
          <div className="h-3 w-1/4 rounded bg-gray-100" />
          <div className="h-2.5 w-1/3 rounded bg-gray-100 mt-2" />
        </div>
      ))}
    </div>
  </div>
);

/* ---------- Pager: 10 / 25 / 50 per page, Prev / Next ---------- */
const Pager = ({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  sizes = [10, 25, 50],
}) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null; // hide when there is only one page

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const btn =
    "w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className={T.muted}>
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <select
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          aria-label="Rows per page"
          className="border border-gray-200 rounded-lg bg-white px-2 py-1.5 text-[10px] sm:text-xs text-gray-800 focus:outline-none focus:border-black"
        >
          {sizes.map((s) => (
            <option key={s} value={s}>
              {s} / page
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className={btn}
        >
          <Icon icon={ICONS.prev} className="w-4 h-4" />
        </button>
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className={btn}
        >
          <Icon icon={ICONS.next} className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

/* =====================================================================
   5. FILTER MENU (one filter icon, everything inside it)
   fields: [{ key, label, type: "select" | "date" | "checkbox",
              options?: [{ value, label }],
              visible?, min?, max?, loading? }]

   onExpandAll / onCollapseAll (optional): when passed, a "Projects" section
   with Expand all / Collapse all buttons is shown at the top of the panel.
   They act immediately and keep the panel open.
   ===================================================================== */

/* checkbox list: search when long, scrolls inside, max 200 rows */
const CheckList = ({ options, value = [], onChange }) => {
  const [q, setQ] = useState("");
  const rows = useMemo(
    () =>
      options
        .filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 200),
    [options, q],
  );
  const toggle = (v) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div className="flex flex-col gap-2">
      {options.length > 8 && (
        <div className="relative">
          <Icon
            icon={ICONS.search}
            className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            aria-label="Search options"
            className="w-full pl-8 pr-2.5 py-1.5 border border-gray-200 rounded-lg text-[10px] sm:text-xs text-gray-800 focus:outline-none focus:border-black"
          />
        </div>
      )}
      <div className="max-h-36 overflow-y-auto flex flex-col gap-1">
        {rows.length === 0 && <p className={`${T.muted} py-1`}>No results</p>}
        {rows.map((o) => (
          <label
            key={o.value}
            className="flex items-center gap-2 text-xs sm:text-sm text-gray-800 cursor-pointer min-w-0"
          >
            <input
              type="checkbox"
              checked={value.includes(o.value)}
              onChange={() => toggle(o.value)}
              className="accent-black"
            />
            <span className="truncate" title={o.label}>
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
};

const FilterMenu = ({
  fields,
  filters,
  setFilters,
  defaults,
  onApply,
  onReset,
  context,
  shown,
  totalCount,
  onExpandAll,
  onCollapseAll,
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const wrapRef = useRef(null);

  const hasViewControls = Boolean(onExpandAll || onCollapseAll);

  // sync the draft with applied filters whenever the panel opens
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  // close on outside click and Esc
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target))
        setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isActive = (f, key) => {
    const a = f[key];
    const d = defaults[key];
    return Array.isArray(a)
      ? a.length > 0
      : String(a ?? "") !== String(d ?? "");
  };

  const activeCount = fields.filter(
    (fl) => (!fl.visible || fl.visible(filters)) && isActive(filters, fl.key),
  ).length;

  const setField = (key, val) => setDraft((d) => ({ ...d, [key]: val }));

  const apply = () => {
    setFilters(draft);
    onApply?.(draft);
    setOpen(false);
  };

  const reset = () => {
    setDraft(defaults);
    setFilters(defaults);
    onReset?.(defaults);
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-3 min-w-0" ref={wrapRef}>
      {/* readout */}
      <div className="min-w-0 text-right">
        {context && <p className={`${T.muted} truncate`}>{context}</p>}
        {totalCount != null && (
          <p className={T.muted}>
            {shown} of {totalCount}
          </p>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          aria-label="Open filters"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={`relative w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${
            open || activeCount > 0
              ? "bg-black text-white border-black"
              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
          }`}
        >
          <Icon icon={ICONS.filter} className="w-4 h-4" />
          {activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-11 z-30 w-[calc(100vw-2rem)] sm:w-[22rem] max-h-[75vh] flex flex-col bg-white rounded-lg border border-gray-200 shadow-lg">
            {/* sticky header */}
            <div className="sticky top-0 bg-white rounded-t-lg flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className={T.cardTitle}>Filters</p>
              <button
                type="button"
                aria-label="Close filters"
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-gray-800"
              >
                <Icon icon={ICONS.close} className="w-5 h-5" />
              </button>
            </div>

            {/* scrolling body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
              {/* Expand / Collapse all */}
              {hasViewControls && (
                <div className="flex flex-col gap-1.5 min-w-0 pb-4 border-b border-gray-100">
                  <p className={T.label}>Projects</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {onExpandAll && (
                      <button
                        type="button"
                        onClick={() => onExpandAll()}
                        className="px-3 py-1.5 text-xs rounded-md border bg-white text-gray-700 border-gray-300 hover:bg-gray-50 transition"
                      >
                        Expand all
                      </button>
                    )}
                    {onCollapseAll && (
                      <button
                        type="button"
                        onClick={() => onCollapseAll()}
                        className="px-3 py-1.5 text-xs rounded-md border bg-white text-gray-700 border-gray-300 hover:bg-gray-50 transition"
                      >
                        Collapse all
                      </button>
                    )}
                  </div>
                </div>
              )}

              {fields
                .filter((fl) => !fl.visible || fl.visible(draft))
                .map((fl) => (
                  <div key={fl.key} className="flex flex-col gap-1.5 min-w-0">
                    <p className={T.label}>{fl.label}</p>

                    {fl.type === "select" && (
                      <div className="relative">
                        <select
                          value={draft[fl.key] ?? ""}
                          aria-label={fl.label}
                          onChange={(e) => setField(fl.key, e.target.value)}
                          disabled={fl.loading}
                          className="w-full appearance-none pr-8 border border-gray-200 rounded-lg bg-white px-2.5 py-1.5 text-[10px] sm:text-xs text-gray-800 focus:outline-none focus:border-black disabled:opacity-50"
                        >
                          {fl.options.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <Icon
                          icon={ICONS.chevronDown}
                          className="w-4 h-4 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        />
                      </div>
                    )}

                    {fl.type === "date" && (
                      <DateField
                        value={draft[fl.key]}
                        onChange={(v) => setField(fl.key, v)}
                        min={fl.min?.(draft)}
                        max={fl.max?.(draft)}
                        ariaLabel={fl.label}
                      />
                    )}

                    {fl.type === "checkbox" && (
                      <CheckList
                        options={fl.options}
                        value={draft[fl.key]}
                        onChange={(v) => setField(fl.key, v)}
                      />
                    )}
                  </div>
                ))}
            </div>

            {/* sticky footer */}
            <div className="sticky bottom-0 bg-white rounded-b-lg flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-100">
              <button
                type="button"
                onClick={reset}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs sm:text-sm text-gray-800 hover:bg-gray-50"
              >
                Reset all
              </button>
              <button
                type="button"
                onClick={apply}
                className="px-3 py-1.5 rounded-lg bg-black text-white text-xs sm:text-sm hover:bg-black/80"
              >
                Apply filters
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* page filter defaults + helpers */
const EMPTY_FILTERS = {
  statuses: [],
  projectIds: [],
  memberIds: [],
  assignment: "all", // all | assigned | unassigned
  from: "",
  to: "",
};

const ASSIGNMENT_OPTIONS = [
  { value: "all", label: "All tasks" },
  { value: "assigned", label: "Assigned" },
  { value: "unassigned", label: "Unassigned" },
];

const countActiveFilters = (f) =>
  (f.statuses.length ? 1 : 0) +
  (f.projectIds.length ? 1 : 0) +
  (f.memberIds.length ? 1 : 0) +
  (f.assignment !== "all" ? 1 : 0) +
  (f.from || f.to ? 1 : 0);

/* =====================================================================
   6. CHARTS: only donut, pie and bar.
   Every card has the SAME fixed height. Any amount of data scrolls
   INSIDE the legend / bar area, so the layout never breaks.
   ===================================================================== */

const ChartCard = ({ title, subtitle, children }) => (
  <div className={`${T.card} p-4 sm:p-5 min-w-0 overflow-hidden flex flex-col`}>
    <h3 className={`${T.cardTitle} truncate`}>{title}</h3>
    {subtitle && <p className={`${T.subtitle} mt-0.5 truncate`}>{subtitle}</p>}
    <div className="mt-4 flex flex-col">{children}</div>
  </div>
);

/* fixed-height legend: unlimited rows scroll inside, long names truncate */
const LegendList = ({ rows }) => (
  <ul className={`mt-4 ${LEGEND_H} overflow-y-auto pr-1 space-y-1.5`}>
    {rows.map((r) => (
      <li
        key={r.key}
        className="flex items-center gap-2 min-w-0"
        title={`${r.name} · ${r.value}${r.pct != null ? ` (${r.pct}%)` : ""}`}
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: r.color }}
        />
        <span className={`${T.legend} truncate flex-1 min-w-0`}>{r.name}</span>
        <span className={`${T.muted} shrink-0 tabular-nums`}>
          {r.value}
          {r.pct != null ? ` · ${r.pct}%` : ""}
        </span>
      </li>
    ))}
  </ul>
);

/* same total height as graphic + legend, so empty cards match too */
const Empty = ({ text }) => (
  <div className="h-72 flex items-center justify-center">
    <p className={T.muted}>{text}</p>
  </div>
);

/* 1. DONUT: assigned vs unassigned */
const Donut = ({ assigned, unassigned }) => {
  const total = assigned + unassigned;
  if (!total) return <Empty text="No tasks yet." />;

  const r = 38;
  const c = 2 * Math.PI * r;
  const assignedLen = (assigned / total) * c;

  return (
    <>
      <div className={`${CHART_H} flex items-center justify-center`}>
        <svg viewBox="0 0 100 100" className="h-full aspect-square">
          <g transform="rotate(-90 50 50)">
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={CHART.red}
              strokeWidth="14"
            />
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={CHART.green}
              strokeWidth="14"
              strokeDasharray={`${assignedLen} ${c - assignedLen}`}
            />
          </g>
          <text
            x="50"
            y="50"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="16"
            fontWeight="500"
            fill="#1f2937"
          >
            {Math.round((assigned / total) * 100)}%
          </text>
        </svg>
      </div>
      <LegendList
        rows={[
          {
            key: "assigned",
            name: "Assigned",
            value: assigned,
            pct: Math.round((assigned / total) * 100),
            color: CHART.green,
          },
          {
            key: "unassigned",
            name: "Unassigned",
            value: unassigned,
            pct: Math.round((unassigned / total) * 100),
            color: CHART.red,
          },
        ]}
      />
    </>
  );
};

/* 2. PIE: workload by member (top 7 + "Others"; full list scrolls in legend) */
const WorkloadPie = ({ data }) => {
  const items = data.filter((w) => w.count > 0);
  const total = items.reduce((sum, w) => sum + w.count, 0);
  if (!total) return <Empty text="No tasks allocated yet." />;

  const colorOf = (i) =>
    i < MAX_SLICES ? WORKLOAD_COLORS[i % WORKLOAD_COLORS.length] : OTHERS_COLOR;

  /* legend lists EVERYONE (scrolls); the pie itself draws top 7 + Others */
  const legendRows = items.map((w, i) => ({
    key: `${w.name}-${i}`,
    name: w.name,
    value: w.count,
    pct: Math.round((w.count / total) * 100),
    color: colorOf(i),
  }));

  const top = items.slice(0, MAX_SLICES);
  const rest = items.slice(MAX_SLICES);
  const restSum = rest.reduce((s, w) => s + w.count, 0);
  const pieItems = restSum
    ? [
        ...top.map((w, i) => ({ ...w, color: colorOf(i) })),
        {
          name: `Others (${rest.length})`,
          count: restSum,
          color: OTHERS_COLOR,
        },
      ]
    : top.map((w, i) => ({ ...w, color: colorOf(i) }));

  const cx = 50;
  const cy = 50;
  const r = 46;
  let angle = -Math.PI / 2;

  const slices = pieItems.map((w) => {
    const frac = w.count / total;
    const start = angle;
    const end = angle + frac * 2 * Math.PI;
    angle = end;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const large = frac > 0.5 ? 1 : 0;
    return {
      ...w,
      pct: Math.round(frac * 100),
      full: pieItems.length === 1,
      d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`,
    };
  });

  return (
    <>
      <div className={`${CHART_H} flex items-center justify-center`}>
        <svg viewBox="0 0 100 100" className="h-full aspect-square">
          {slices.map((s, i) =>
            s.full ? (
              <circle key={i} cx={cx} cy={cy} r={r} fill={s.color}>
                <title>{`${s.name} · ${s.count} tasks`}</title>
              </circle>
            ) : (
              <path
                key={i}
                d={s.d}
                fill={s.color}
                stroke="#fff"
                strokeWidth="1"
              >
                <title>{`${s.name} · ${s.count} task${s.count === 1 ? "" : "s"} (${s.pct}%)`}</title>
              </path>
            ),
          )}
        </svg>
      </div>
      <LegendList rows={legendRows} />
    </>
  );
};

/* 3. BAR: tasks per project (ALL projects, scrolls inside a fixed area) */
const ProjectBars = ({ data }) => {
  const items = data
    .map((d) => ({ ...d, total: d.assigned + d.unassigned }))
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total);
  if (!items.length) return <Empty text="No tasks yet." />;

  const max = Math.max(...items.map((i) => i.total));
  const sumAssigned = items.reduce((s, i) => s + i.assigned, 0);
  const sumUnassigned = items.reduce((s, i) => s + i.unassigned, 0);

  return (
    <>
      <div className={`${CHART_H} overflow-y-auto pr-1 space-y-3`}>
        {items.map((it) => (
          <div
            key={it.id}
            className="shrink-0"
            title={`${it.name} · ${it.total} tasks (${it.assigned} assigned, ${it.unassigned} unassigned)`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className={`${T.legend} truncate min-w-0`}>{it.name}</span>
              <span className={`${T.muted} shrink-0 tabular-nums`}>
                {it.total}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-zinc-100 overflow-hidden flex">
              <div
                className="h-full transition-all"
                style={{
                  width: `${(it.assigned / max) * 100}%`,
                  background: CHART.green,
                }}
              />
              <div
                className="h-full transition-all"
                style={{
                  width: `${(it.unassigned / max) * 100}%`,
                  background: CHART.red,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <LegendList
        rows={[
          {
            key: "assigned",
            name: "Assigned",
            value: sumAssigned,
            color: CHART.green,
          },
          {
            key: "unassigned",
            name: "Unassigned",
            value: sumUnassigned,
            color: CHART.red,
          },
          {
            key: "projects",
            name: "Projects",
            value: items.length,
            color: CHART.blue,
          },
        ]}
      />
    </>
  );
};

const StackedBar = ({ assigned, unassigned }) => {
  const total = assigned + unassigned;
  return (
    <div className="h-2.5 rounded-full bg-zinc-100 overflow-hidden flex">
      <div
        style={{
          width: `${total ? (assigned / total) * 100 : 0}%`,
          background: CHART.green,
        }}
      />
      <div
        style={{
          width: `${total ? (unassigned / total) * 100 : 0}%`,
          background: CHART.red,
        }}
      />
    </div>
  );
};

/* =====================================================================
   7. OVERVIEW TAB (the page)
   ===================================================================== */

const STATUS_STYLES = {
  active: "bg-emerald-50 text-emerald-700",
  completed: "bg-zinc-100 text-gray-600",
  on_hold: "bg-amber-50 text-amber-700",
};

const OverviewView = () => {
  const [projects, setProjects] = useState([]);
  const [total, setTotal] = useState(null);
  const [summary, setSummary] = useState(null); // API summary block
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [openIds, setOpenIds] = useState(() => new Set());
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  // pagination + "show more" state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [taskLimits, setTaskLimits] = useState({}); // project_id -> visible tasks
  const [attnLimit, setAttnLimit] = useState(STEP);

  const toggle = (id) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // back to page 1 whenever filters or page size change
  useEffect(() => {
    setPage(1);
  }, [filters, pageSize]);

  // GET /admin/projects/overview
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    teamService
      .fetchProjectsOverview({ page: 1, limit: 50 })
      .then((res) => {
        if (cancelled) return;
        setProjects(res.projects);
        setTotal(res.total);
        setSummary(res.summary || null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err.response?.data?.message ||
            err.message ||
            "Could not load projects.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  /* options shown inside the filter menu (built from ALL projects) */
  const options = useMemo(() => {
    const statuses = new Set();
    const members = new Map();
    projects.forEach((p) => {
      if (p.status) statuses.add(p.status);
      (p.team || []).forEach((m) => members.set(m.employee_id, m.name));
      (p.tasks || []).forEach((t) =>
        (t.allocations || []).forEach((a) =>
          members.set(a.employee_id, a.employee_name),
        ),
      );
    });
    return {
      statuses: [...statuses],
      projects: projects.map((p) => ({ id: p.project_id, name: p.project })),
      members: [...members.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    };
  }, [projects]);

  /* field config for the FilterMenu */
  const fields = useMemo(
    () => [
      {
        key: "assignment",
        label: "Task assignment",
        type: "select",
        options: ASSIGNMENT_OPTIONS,
      },
      {
        key: "statuses",
        label: "Project status",
        type: "checkbox",
        options: options.statuses.map((s) => ({
          value: s,
          label: humanize(s),
        })),
      },
      {
        key: "from",
        label: "Created from",
        type: "date",
        max: (d) => d.to || undefined,
      },
      {
        key: "to",
        label: "Created to",
        type: "date",
        min: (d) => d.from || undefined,
      },
      {
        key: "projectIds",
        label: "Project",
        type: "checkbox",
        options: options.projects.map((p) => ({
          value: p.id,
          label: String(p.name ?? "Untitled"),
        })),
      },
      {
        key: "memberIds",
        label: "Member",
        type: "checkbox",
        options: options.members.map((m) => ({
          value: m.id,
          label: String(m.name ?? "Unknown"),
        })),
      },
    ],
    [options],
  );

  /* apply filters */
  const filtered = useMemo(() => {
    const { statuses, projectIds, memberIds, assignment, from, to } = filters;
    const fromD = from ? new Date(`${from}T00:00:00`) : null;
    const toD = to ? new Date(`${to}T23:59:59`) : null;
    const taskFilter = assignment !== "all" || memberIds.length > 0;

    return projects
      .filter((p) => {
        if (statuses.length && !statuses.includes(p.status)) return false;
        if (projectIds.length && !projectIds.includes(p.project_id))
          return false;
        if (fromD || toD) {
          const d = new Date(p.created_at);
          if (Number.isNaN(d.getTime())) return false;
          if (fromD && d < fromD) return false;
          if (toD && d > toD) return false;
        }
        return true;
      })
      .map((p) => {
        if (!taskFilter) return p;
        const tasks = (p.tasks || []).filter((t) => {
          const has = !!t.allocations?.length;
          if (assignment === "assigned" && !has) return false;
          if (assignment === "unassigned" && has) return false;
          if (
            memberIds.length &&
            !(t.allocations || []).some((a) =>
              memberIds.includes(a.employee_id),
            )
          )
            return false;
          return true;
        });
        return { ...p, tasks };
      })
      .filter((p) => !taskFilter || (p.tasks || []).length > 0);
  }, [projects, filters]);

  const activeFilterCount = countActiveFilters(filters);

  /* Expand all / Collapse all (act on every project that matches the filters,
     across all pages) */
  const expandAll = () =>
    setOpenIds(new Set(filtered.map((p) => p.project_id)));
  const collapseAll = () => setOpenIds(new Set());

  const { taskCount, members, unassigned, perProject, workload } =
    useMemo(() => {
      const memberIds = new Set();
      const open = [];
      const load = {}; // employee_id -> { name, count }
      const per = [];
      let count = 0;

      filtered.forEach((p) => {
        let assignedN = 0;
        let unassignedN = 0;

        (p.team || []).forEach((m) => {
          memberIds.add(m.employee_id);
          if (!load[m.employee_id])
            load[m.employee_id] = { name: m.name, count: 0 };
        });

        (p.tasks || []).forEach((t) => {
          count += 1;
          if (!t.allocations?.length) {
            unassignedN += 1;
            open.push({ ...t, project: p.project });
          } else {
            assignedN += 1;
          }
          (t.allocations || []).forEach((a) => {
            memberIds.add(a.employee_id);
            if (!load[a.employee_id])
              load[a.employee_id] = { name: a.employee_name, count: 0 };
            load[a.employee_id].count += 1;
          });
        });

        per.push({
          id: p.project_id,
          name: p.project,
          assigned: assignedN,
          unassigned: unassignedN,
        });
      });

      return {
        taskCount: count,
        members: memberIds.size,
        unassigned: open,
        perProject: per,
        workload: Object.values(load).sort((a, b) => b.count - a.count),
      };
    }, [filtered]);

  /* ---------- loading / error ---------- */

  if (loading) return <PageSkeleton />;

  if (error) {
    return (
      <div className="py-24 px-4 text-center font-poppins">
        <Icon
          icon={ICONS.error}
          className="w-6 h-6 text-gray-400 mx-auto mb-2"
        />
        <p className={T.body}>Could not load projects</p>
        <p className={`${T.muted} mt-1 break-words`}>{error}</p>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm rounded-lg bg-black text-white hover:bg-black/80 transition-colors"
        >
          <Icon icon={ICONS.refresh} className="w-4 h-4" />
          Try again
        </button>
      </div>
    );
  }

  const assignedCount = taskCount - unassigned.length;

  /* With no filters: use the API summary. With filters: use filtered numbers. */
  const useSummary = activeFilterCount === 0;
  const cardProjects = useSummary
    ? (summary?.total_projects ?? total ?? projects.length)
    : filtered.length;
  const cardTasks = useSummary
    ? (summary?.total_tasks ?? taskCount)
    : taskCount;
  const cardPeople = useSummary ? (summary?.total_people ?? members) : members;
  const cardUnallocated = useSummary
    ? (summary?.unallocated_tasks ?? unassigned.length)
    : unassigned.length;

  /* pagination slice */
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const pageItems = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  return (
    <div className="flex flex-col gap-6 min-w-0 max-w-full font-poppins">
      {/* FILTER ICON (all filters + expand/collapse are inside it) */}
      <div className="flex items-center justify-end">
        <FilterMenu
          fields={fields}
          filters={filters}
          setFilters={setFilters}
          defaults={EMPTY_FILTERS}
          context="Projects"
          shown={filtered.length}
          totalCount={projects.length}
          onExpandAll={expandAll}
          onCollapseAll={collapseAll}
        />
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={ICONS.projects}
          label="Projects"
          value={num(cardProjects)}
          bg={COLORS.green}
        />
        <StatCard
          icon={ICONS.tasks}
          label="Tasks"
          value={num(cardTasks)}
          hint={`${Math.max(cardTasks - cardUnallocated, 0)} assigned`}
          bg={COLORS.blue}
        />
        <StatCard
          icon={ICONS.members}
          label="Members"
          value={num(cardPeople)}
          bg={COLORS.yellow}
        />
        <StatCard
          icon={ICONS.warning}
          label="Unassigned tasks"
          value={num(cardUnallocated)}
          bg={COLORS.red}
        />
      </div>

      {/* GRAPHS: donut + pie + bar, identical size */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch [&>*]:min-w-0">
          <ChartCard title="Task assignment" subtitle="Assigned vs unassigned">
            <Donut assigned={assignedCount} unassigned={unassigned.length} />
          </ChartCard>

          <ChartCard
            title="Workload by member"
            subtitle="Tasks allocated per person"
          >
            <WorkloadPie data={workload} />
          </ChartCard>

          <ChartCard
            title="Tasks per project"
            subtitle="Top projects by number of tasks"
          >
            <ProjectBars data={perProject} />
          </ChartCard>
        </div>
      )}

      {/* PROJECTS (accordion) + NEEDS ATTENTION */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={ICONS.empty}
              title={
                projects.length === 0
                  ? "No projects found"
                  : "No projects match the filters"
              }
              text={
                projects.length === 0
                  ? "Projects will appear here once they are created."
                  : "Try changing or resetting the filters."
              }
              action={
                projects.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilters(EMPTY_FILTERS)}
                    className="mt-4 px-3.5 py-2 text-xs sm:text-sm rounded-lg bg-black text-white hover:bg-black/80 transition-colors"
                  >
                    Reset filters
                  </button>
                )
              }
            />
          ) : (
            pageItems.map((p) => {
              const isOpen = openIds.has(p.project_id);
              const tasks = p.tasks || [];
              const team = p.team || [];
              const unassignedN = tasks.filter(
                (t) => !t.allocations?.length,
              ).length;
              const assignedN = tasks.length - unassignedN;
              const taskLimit = taskLimits[p.project_id] || STEP;
              const visibleTasks = tasks.slice(0, taskLimit);
              const tasksLeft = tasks.length - visibleTasks.length;

              return (
                <div key={p.project_id} className={`${T.card} overflow-hidden`}>
                  {/* Accordion header */}
                  <button
                    type="button"
                    onClick={() => toggle(p.project_id)}
                    aria-expanded={isOpen}
                    className="w-full flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <h3
                        className={`${T.cardTitle} truncate`}
                        title={p.project}
                      >
                        {p.project}
                      </h3>
                      <p className={`${T.subtitle} mt-0.5 break-words`}>
                        Created by {p.created_by_name}
                        {[p.designation, p.department].filter(Boolean).length
                          ? ` (${[p.designation, p.department]
                              .filter(Boolean)
                              .join(" | ")})`
                          : ""}{" "}
                        on {formatDate(p.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <Badge className="bg-[#E8EFF9] text-gray-700">
                        {tasks.length} tasks
                      </Badge>
                      <Badge className="bg-[#FFFBDB] text-gray-700">
                        {team.length} members
                      </Badge>
                      {unassignedN > 0 && (
                        <Badge className="bg-[#FFDADA] text-red-700">
                          {unassignedN} unassigned
                        </Badge>
                      )}
                      <Badge
                        className={
                          STATUS_STYLES[p.status] || "bg-zinc-100 text-gray-600"
                        }
                      >
                        {humanize(p.status)}
                      </Badge>
                      <Icon
                        icon={ICONS.chevronDown}
                        className={`w-4 h-4 text-gray-500 shrink-0 transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>

                  {/* Accordion body */}
                  {isOpen && (
                    <div className="border-t border-gray-100">
                      {/* Project details */}
                      <div className="px-4 sm:px-5 py-4 grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-3 2xl:grid-cols-4 gap-4 bg-gray-50/60">
                        <Field label="Project" value={p.project} />
                        <Field label="Status" value={humanize(p.status)} />
                        <Field label="Description" value={p.description} />
                        <Field
                          label="End date"
                          value={formatDate(p.end_date)}
                        />
                        <Field
                          label="Amount"
                          value={formatAmount(p.amount, p.currency)}
                        />
                        <Field label="Currency" value={p.currency} />
                        <Field label="Created by" value={p.created_by_name} />
                        <Field label="Designation" value={p.designation} />
                        <Field label="Department" value={p.department} />
                        <Field
                          label="Created at"
                          value={formatDateTime(p.created_at)}
                        />
                        <Field
                          label="Updated at"
                          value={formatDateTime(p.updated_at)}
                        />
                        <Field label="Total tasks" value={tasks.length} />
                        <Field label="Assigned tasks" value={assignedN} />
                        <Field label="Unassigned tasks" value={unassignedN} />
                        <Field label="Team members" value={team.length} />
                      </div>

                      {/* Progress */}
                      <div className="px-4 sm:px-5 py-4 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={T.body}>Task assignment</span>
                          <span className={T.muted}>
                            {assignedN}/{tasks.length} assigned
                          </span>
                        </div>
                        <StackedBar
                          assigned={assignedN}
                          unassigned={unassignedN}
                        />
                      </div>

                      {/* Tasks table */}
                      <div className="border-t border-gray-100">
                        <p className={`px-4 sm:px-5 pt-4 ${T.label}`}>
                          Tasks ({tasks.length})
                        </p>
                        <div className="overflow-auto max-h-[480px]">
                          <table className="w-full text-left min-w-[860px] mt-2">
                            <thead className="sticky top-0 z-10 bg-gray-50">
                              <tr className="bg-gray-50 border-y border-gray-100">
                                <th className={`${T.th} px-5 py-3`}>Task</th>
                                <th className={`${T.th} px-3 py-3`}>
                                  Assigned to
                                </th>
                                <th className={`${T.th} px-3 py-3`}>
                                  Comments
                                </th>
                                <th className={`${T.th} px-3 py-3`}>Created</th>
                                <th className={`${T.th} px-5 py-3`}>Updated</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {tasks.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={5}
                                    className={`px-5 py-10 text-center ${T.muted}`}
                                  >
                                    No tasks in this project yet.
                                  </td>
                                </tr>
                              ) : (
                                visibleTasks.map((t) => (
                                  <tr
                                    key={t.task_id}
                                    className="hover:bg-gray-50 transition-colors align-top"
                                  >
                                    {/* Task name + description + attachment */}
                                    <td
                                      className={`px-5 py-3 ${T.body} max-w-[280px] break-words`}
                                    >
                                      {t.task}
                                      {t.description && (
                                        <p
                                          className={`${T.muted} mt-1 break-words`}
                                        >
                                          {t.description}
                                        </p>
                                      )}
                                      {t.attachment && (
                                        <a
                                          href={encodeURI(t.attachment)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 text-[10px] sm:text-xs rounded-lg border border-gray-200 text-gray-800 hover:bg-black hover:text-white transition-colors"
                                        >
                                          <Icon
                                            icon={ICONS.view}
                                            className="w-4 h-4 shrink-0"
                                          />
                                          View attachment
                                        </a>
                                      )}
                                    </td>

                                    {/* Assigned to */}
                                    <td className="px-3 py-3">
                                      {t.allocations?.length ? (
                                        <ul className="space-y-2">
                                          {t.allocations.map((a) => (
                                            <li key={a.allocation_id}>
                                              <p className={T.body}>
                                                {a.employee_name}
                                              </p>
                                              <p
                                                className={`${T.muted} mt-0.5`}
                                              >
                                                {[a.designation, a.department]
                                                  .filter(Boolean)
                                                  .join(" | ")}{" "}
                                                · Allocated{" "}
                                                {formatDateTime(a.allocated_at)}
                                              </p>
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <Badge className="bg-amber-50 text-amber-700">
                                          Unassigned
                                        </Badge>
                                      )}
                                    </td>

                                    {/* Comments */}
                                    <td className="px-3 py-3 max-w-[280px]">
                                      {t.comments?.length ? (
                                        <ul className="space-y-2.5">
                                          {t.comments.map((c) => (
                                            <li
                                              key={c.id}
                                              className="border border-gray-200 rounded-lg p-2.5"
                                            >
                                              <p className={T.muted}>
                                                <span className="text-gray-800">
                                                  {c.employee_name}
                                                </span>{" "}
                                                · {formatDateTime(c.created_at)}
                                              </p>
                                              <p
                                                className={`${T.body} mt-1 break-words`}
                                              >
                                                {c.comment}
                                              </p>
                                              {c.tagged_employees?.length >
                                                0 && (
                                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                  {c.tagged_employees.map(
                                                    (te) => (
                                                      <Badge
                                                        key={te.employee_id}
                                                        className="bg-[#E8EFF9] text-gray-700"
                                                      >
                                                        @{te.employee_name}
                                                      </Badge>
                                                    ),
                                                  )}
                                                </div>
                                              )}
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <span className="text-gray-400">—</span>
                                      )}
                                    </td>

                                    <td
                                      className={`px-3 py-3 ${T.body} whitespace-nowrap`}
                                    >
                                      {formatDate(t.created_at)}
                                    </td>
                                    <td
                                      className={`px-5 py-3 ${T.body} whitespace-nowrap`}
                                    >
                                      {formatDate(t.updated_at)}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                        {tasksLeft > 0 && (
                          <div className="px-4 sm:px-5 py-3 border-t border-gray-100">
                            <ShowMore
                              remaining={tasksLeft}
                              onClick={() =>
                                setTaskLimits((l) => ({
                                  ...l,
                                  [p.project_id]: taskLimit + STEP,
                                }))
                              }
                            />
                          </div>
                        )}
                      </div>

                      {/* Team */}
                      <div className="border-t border-gray-100 px-4 sm:px-5 py-4">
                        <p className={T.label}>Team ({team.length})</p>
                        {team.length === 0 ? (
                          <p className={`${T.muted} mt-3`}>
                            No team members yet.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 max-h-72 overflow-y-auto pr-1">
                            {team.map((m) => (
                              <div
                                key={m.employee_id}
                                className="flex items-center gap-3 border border-gray-200 rounded-lg p-3 min-w-0"
                              >
                                <Avatar src={m.image} name={m.name} />
                                <div className="min-w-0 flex-1">
                                  <p
                                    className={`${T.body} truncate`}
                                    title={m.name}
                                  >
                                    {m.name}
                                    {m.is_me && (
                                      <span className="ml-1.5 text-[10px] sm:text-xs text-emerald-700">
                                        (You)
                                      </span>
                                    )}
                                  </p>
                                  <p className={`${T.muted} truncate`}>
                                    {[m.designation, m.department]
                                      .filter(Boolean)
                                      .join(" | ") || "—"}
                                  </p>
                                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {(m.roles || []).map((r) => (
                                      <Badge
                                        key={r}
                                        className="bg-[#EBFDEF] text-gray-700"
                                      >
                                        {humanize(r)}
                                      </Badge>
                                    ))}
                                  </div>
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
            })
          )}

          <Pager
            page={safePage}
            pageSize={pageSize}
            total={filtered.length}
            onPage={setPage}
            onPageSize={setPageSize}
          />
        </div>

        {/* NEEDS ATTENTION: full viewport height on large screens, stays in
            view while the projects scroll, the list scrolls inside */}
        <aside
          className={`${T.card} min-w-0 flex flex-col overflow-hidden max-h-[480px] xl:max-h-none xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]`}
        >
          <div className="shrink-0 flex items-center justify-between gap-2 px-4 sm:px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2 min-w-0">
              <Icon
                icon={ICONS.warning}
                className="w-4 h-4 text-gray-800 shrink-0"
              />
              <h3 className={`${T.cardTitle} truncate`}>Needs attention</h3>
            </div>
            <span className="text-[10px] sm:text-xs text-white bg-black rounded-full px-2 py-0.5 shrink-0">
              {unassigned.length}
            </span>
          </div>

          {unassigned.length === 0 ? (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-5 py-10 text-center">
              <Icon
                icon={ICONS.success}
                className="w-6 h-6 text-emerald-600 mb-2"
              />
              <p className={T.body}>All clear</p>
              <p className={`${T.muted} mt-1`}>
                Every task has someone assigned.
              </p>
            </div>
          ) : (
            <>
              <ul className="flex-1 min-h-0 divide-y divide-gray-100 overflow-y-auto">
                {unassigned.slice(0, attnLimit).map((t) => (
                  <li key={t.task_id} className="px-4 sm:px-5 py-3">
                    <p className={`${T.body} break-words`}>{t.task}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <Badge>{t.project}</Badge>
                      <Badge className="bg-red-50 text-red-600">
                        No one assigned
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
              {unassigned.length > attnLimit && (
                <div className="shrink-0 px-4 sm:px-5 py-3 border-t border-gray-100">
                  <ShowMore
                    remaining={unassigned.length - attnLimit}
                    onClick={() => setAttnLimit((n) => n + STEP)}
                  />
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
};

export default OverviewView;
