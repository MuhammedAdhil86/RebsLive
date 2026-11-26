import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { toast } from "react-toastify"; // <ToastContainer /> lives in App.jsx
import {
  ArrowLeft,
  Lock,
  Check,
  ChevronDown,
  Clock,
  CalendarDays,
} from "lucide-react";
import { Icon } from "@iconify/react";
import exitService from "../../service/exitService";
import { getActiveUsersLight } from "../../service/employeeService";
import { getStatusColor } from "../../ui/universal_table";

/* ---------- helpers ---------- */

const TOTAL_STEPS = 2; // initial step + checklist (questionnaire is not a step)

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

// "2026-12-01T00:00:00Z" -> "2026-12-01" for <input type="date">
const toDateInput = (iso) => (iso ? String(iso).slice(0, 10) : "");

// "2026-12-30T00:00:00Z" -> UTC midnight timestamp (avoids timezone drift)
const parseDay = (iso) => {
  const s = toDateInput(iso);
  if (!s) return null;
  const t = Date.parse(`${s}T00:00:00Z`);
  return Number.isNaN(t) ? null : t;
};

const todayUtc = () => {
  const n = new Date();
  return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
};

const daysBetween = (a, b) =>
  a == null || b == null ? null : Math.round((b - a) / 86400000);

const backendMessage = (err, fallback) =>
  err?.response?.data?.message || err?.message || fallback;

// axios timeout (ECONNABORTED / ETIMEDOUT) or a "timeout" message
const isTimeout = (err) =>
  err?.code === "ECONNABORTED" ||
  err?.code === "ETIMEDOUT" ||
  /timeout/i.test(err?.message || "");

const initials = (name) =>
  String(name ?? "")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/* ---------- uniform UI pieces ---------- */

// Same pill as the tables (colours come from the shared getStatusColor)
const Badge = ({ children, className = "bg-gray-100 text-gray-600" }) => (
  <span
    className={`inline-block px-3 py-1 rounded-full text-[11px] font-normal whitespace-nowrap ${className}`}
  >
    {children}
  </span>
);

const StatusPill = ({ status }) => (
  <Badge className={getStatusColor(status)}>{status || "—"}</Badge>
);

// Same card as the dashboard
const cardCls = "bg-white shadow rounded-xl p-4 border border-gray-100";

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
      <p className="text-gray-500 text-[10px] sm:text-xs truncate uppercase ">
        {label}
      </p>
      <h2 className="text-sm sm:text-sm font-medium text-gray-800 truncate">
        {value}
      </h2>
    </div>
  </div>
);

const ProgressBar = ({ value }) => {
  const v = Number(value) || 0;
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-black transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, v))}%` }}
        />
      </div>
      <span className="text-[12px] text-gray-800 w-8 text-right shrink-0">
        {v}%
      </span>
    </div>
  );
};

/* circular progress for the summary panel */
const Ring = ({ value, size = 84 }) => {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#f3f4f6"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#000"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-base font-medium text-gray-800">
        {Math.round(pct)}%
      </span>
    </div>
  );
};

const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse rounded-lg bg-gray-100 ${className}`} />
);

const Field = ({ label, htmlFor, children }) => (
  <div className="flex flex-col min-w-0">
    <label htmlFor={htmlFor} className="text-[12px] text-gray-600 mb-1.5">
      {label}
    </label>
    {children}
  </div>
);

// Same field style as the search box (border, rounded-lg, text-sm)
const inputClass =
  "w-full min-w-0 border border-gray-300 bg-white px-3 py-2 rounded-lg text-sm text-gray-600 focus:outline-none focus:border-black transition-all disabled:bg-gray-50 disabled:text-gray-400";

/* date input with the solar calendar icon on the left.
   the native calendar icon is stretched over the whole field and made
   invisible, so clicking anywhere opens the picker */
const DateInput = ({ className: _ignored, ...props }) => (
  <div className="relative w-full min-w-0">
    <Icon
      icon="solar:calendar-outline"
      className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 w-4 h-4 text-gray-400"
    />
    <input
      type="date"
      {...props}
      onClick={(e) => {
        try {
          e.currentTarget.showPicker?.();
        } catch {
          /* some browsers block showPicker, native behaviour still works */
        }
      }}
      className={`${inputClass} relative pl-9 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0`}
    />
  </div>
);

// Same buttons as the dashboard
const PrimaryButton = ({ children, ...props }) => (
  <button
    type="button"
    {...props}
    className="w-full sm:w-auto px-3 sm:px-4 py-3 text-xs rounded-lg bg-black text-white transition-all hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
  >
    {children}
  </button>
);

const GhostButton = ({ children, ...props }) => (
  <button
    type="button"
    {...props}
    className="w-full sm:w-auto px-3 sm:px-4 py-3 text-xs rounded-lg border border-gray-300 bg-white text-gray-700 transition-all hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
  >
    {children}
  </button>
);

/* one row of the details list: label left, value right (stacked on phones) */
const DetailRow = ({ label, value, className = "" }) => (
  <div
    className={`flex flex-col gap-0.5 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 2xl:flex-col 2xl:gap-0.5 ${className}`}
  >
    <dt className="text-[12px] text-gray-400 shrink-0">{label}</dt>
    <dd className="text-[12px] text-gray-800 break-words sm:text-right 2xl:text-left">
      {value || "—"}
    </dd>
  </div>
);

/* section header used by every card */
const SectionHead = ({ title, description, status, completion }) => (
  <div className="pb-4 mb-4 border-b border-gray-100">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="text-base font-medium text-gray-800">{title}</h3>
        <p className="text-[10px] sm:text-[13px] text-gray-400 font-light mt-0.5">
          {description}
        </p>
      </div>
      <StatusPill status={status} />
    </div>
    <div className="mt-3 max-w-xs">
      <ProgressBar value={completion} />
    </div>
  </div>
);

/* a step in the vertical timeline */
const TimelineStep = ({
  id,
  number,
  title,
  description,
  status,
  completion,
  last,
  children,
}) => {
  const done = completion >= 100;
  return (
    <div id={id} className="flex gap-3 sm:gap-5 scroll-mt-4">
      {/* rail */}
      <div className="flex flex-col items-center shrink-0">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs ${
            done
              ? "bg-black text-white"
              : "bg-white text-gray-600 border border-gray-300"
          }`}
        >
          {done ? <Check size={14} /> : number}
        </span>
        {!last && <span className="mt-2 w-px flex-1 bg-gray-200" />}
      </div>

      {/* card */}
      <section className={`flex-1 min-w-0 ${cardCls} ${last ? "" : "mb-4"}`}>
        <SectionHead
          title={title}
          description={description}
          status={status}
          completion={completion}
        />
        {children}
      </section>
    </div>
  );
};

/* standalone section (not a timeline step): no number, no rail */
const QuestionnaireCard = ({
  id,
  title,
  description,
  status,
  completion,
  children,
}) => (
  <section id={id} className={`mt-4 scroll-mt-4 ${cardCls}`}>
    <SectionHead
      title={title}
      description={description}
      status={status}
      completion={completion}
    />
    {children}
  </section>
);

/* searchable interviewer dropdown: shows names only, never IDs */
const InterviewerSelect = ({ id, value, selectedName, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  // fetch the light user list here: show names, keep the uuid as the value
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const users = await getActiveUsersLight();
        if (cancelled) return;
        setOptions(
          (users || []).map((u) => ({
            id: String(u.uuid), // value sent to the API
            name: String(u.name || "")
              .replace(/\s+/g, " ")
              .trim(),
            designation: String(u.designation_name || "")
              .replace(/\s+/g, " ")
              .trim(),
            department: u.department_name || "",
          })),
        );
      } catch (err) {
        if (!cancelled) {
          toast.error(backendMessage(err, "Could not load employees."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = options.find((o) => o.id === String(value ?? ""));
  const label = selected?.name || (value ? selectedName : "");

  const filtered = options.filter((o) =>
    `${o.name} ${o.designation} ${o.department}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  // close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // keep the keyboard-highlighted row in view
  useEffect(() => {
    if (!open) return;
    listRef.current?.children?.[activeIdx]?.scrollIntoView?.({
      block: "nearest",
    });
  }, [activeIdx, open]);

  const choose = (optionId) => {
    onChange(optionId);
    setOpen(false);
    setQuery("");
  };

  // arrow keys + Enter inside the search box
  const onSearchKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[activeIdx]) choose(filtered[activeIdx].id);
    }
  };

  return (
    <div ref={wrapRef} className="relative w-full min-w-0">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => {
          setActiveIdx(0);
          setOpen((o) => !o);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm focus:outline-none transition-all disabled:bg-gray-50 disabled:text-gray-400 ${
          open ? "border-black" : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <span
          className={`truncate ${label ? "text-gray-600" : "text-gray-400"}`}
        >
          {loading && !label ? "Loading…" : label || "Select interviewer"}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-gray-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 rounded-lg border border-gray-100 bg-white shadow-xl">
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIdx(0);
              }}
              onKeyDown={onSearchKeyDown}
              placeholder="Search by name"
              aria-label="Search interviewer by name"
              className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-600 placeholder:text-[12px] focus:outline-none focus:border-black"
            />
          </div>
          <ul
            ref={listRef}
            role="listbox"
            className="max-h-60 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-[12px] text-gray-400">
                {loading ? "Loading…" : "No employees found"}
              </li>
            ) : (
              filtered.map((o, idx) => {
                const active = o.id === String(value ?? "");
                return (
                  <li
                    key={o.id}
                    role="option"
                    aria-selected={active}
                    onClick={() => choose(o.id)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors ${
                      idx === activeIdx
                        ? "bg-gray-50"
                        : active
                          ? "bg-gray-50"
                          : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-[12px] text-gray-800 truncate">
                        {o.name}
                      </p>
                      {(o.designation || o.department) && (
                        <p className="text-[11px] text-gray-400 truncate">
                          {[o.designation, o.department]
                            .filter(Boolean)
                            .join(" | ")}
                        </p>
                      )}
                    </div>
                    {active && (
                      <Check size={14} className="shrink-0 text-gray-800" />
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

const CHECKLIST_ITEMS = [
  { key: "assetHanded", label: "Physical assets returned" },
  { key: "digitalAssetHanded", label: "Digital assets returned" },
  { key: "resignationLetter", label: "Resignation letter received" },
  { key: "security", label: "Security clearance completed" },
  { key: "noticePeriodFollowed", label: "Notice period served" },
  { key: "managerClearance", label: "Manager clearance given" },
];

// questionnaire shown as questions (key = field on data.questionnaire)
const QUESTIONS = [
  {
    key: "workAgain",
    question: "Would you work here again?",
    type: "boolean",
  },
  {
    key: "mostLiked",
    question: "What did you like most about working here?",
  },
  {
    key: "improvementSuggestion",
    question: "What could we improve?",
  },
  {
    key: "additionalFeedback",
    question: "Any additional feedback?",
  },
];

/* ---------- detail ---------- */

const ExitProcessDetail = ({ id, onBack }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // editable copies of the two forms
  const [initialForm, setInitialForm] = useState({
    interviewerId: "",
    noticePeriodStart: "",
    separationDate: "",
  });
  const [checklist, setChecklist] = useState({});

  const [savingInitial, setSavingInitial] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);

  // counts requests so a slow, older response can never overwrite a newer one
  const requestRef = useRef(0);

  // GET /admin/exit-process/get/{id}
  // `quiet` = refresh after a save without blanking the page
  const load = useCallback(
    async (quiet = false) => {
      const reqId = ++requestRef.current;
      if (!quiet) {
        setLoading(true);
        setError("");
      }
      try {
        const d = await exitService.fetchExitProcess(id);
        if (reqId !== requestRef.current) return; // stale response
        setData(d);
        setInitialForm({
          interviewerId: String(d.interviewerId ?? ""),
          noticePeriodStart: toDateInput(d.noticePeriodStart),
          separationDate: toDateInput(d.separationDate),
        });
        setChecklist({ ...(d.checklist ?? {}) });
      } catch (err) {
        if (reqId !== requestRef.current) return;
        if (!quiet) {
          setError(backendMessage(err, "Could not load this exit process."));
        } else {
          toast.error(backendMessage(err, "Could not refresh."));
        }
      } finally {
        if (!quiet && reqId === requestRef.current) setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    load();
  }, [load]);

  /* unsaved-change detection: Save is only enabled when something changed */
  const initialDirty = useMemo(
    () =>
      !!data &&
      (String(initialForm.interviewerId ?? "").trim() !==
        String(data.interviewerId ?? "") ||
        initialForm.noticePeriodStart !== toDateInput(data.noticePeriodStart) ||
        initialForm.separationDate !== toDateInput(data.separationDate)),
    [data, initialForm],
  );

  const checklistDirty = useMemo(
    () =>
      !!data &&
      CHECKLIST_ITEMS.some(
        (i) =>
          Boolean(checklist[i.key]) !== Boolean((data.checklist ?? {})[i.key]),
      ),
    [data, checklist],
  );

  const resetInitial = () =>
    setInitialForm({
      interviewerId: String(data.interviewerId ?? ""),
      noticePeriodStart: toDateInput(data.noticePeriodStart),
      separationDate: toDateInput(data.separationDate),
    });

  const resetChecklist = () => setChecklist({ ...(data.checklist ?? {}) });

  const handleBack = () => {
    if (
      (initialDirty || checklistDirty) &&
      !window.confirm("You have unsaved changes. Leave without saving?")
    ) {
      return;
    }
    onBack?.();
  };

  /* ---- step 1: initial step ---- */
  const saveInitial = async () => {
    if (savingInitial) return;

    const interviewerId = String(initialForm.interviewerId ?? "").trim();

    if (!interviewerId) {
      toast.error("Select the interviewer");
      return;
    }
    if (!initialForm.noticePeriodStart || !initialForm.separationDate) {
      toast.error("Select the notice period start and separation dates");
      return;
    }
    if (initialForm.separationDate < initialForm.noticePeriodStart) {
      toast.error("Separation date cannot be before the notice period start");
      return;
    }

    try {
      setSavingInitial(true);
      const res = await exitService.updateInitialStep({
        id,
        interviewerId,
        separationDate: initialForm.separationDate,
        noticePeriodStart: initialForm.noticePeriodStart,
      });
      if (res?.message) toast.success(res.message);
      await load(true);
    } catch (err) {
      if (isTimeout(err)) {
        // the server may have saved it anyway, so refresh instead of a false error
        toast.info("Taking longer than usual. Checking if it was saved…");
        await load(true);
      } else {
        toast.error(backendMessage(err, "Could not save the initial step."));
        if (exitService.isConflict(err)) await load(true); // now locked
      }
    } finally {
      setSavingInitial(false);
    }
  };

  /* ---- step 2: checklist ---- */
  const saveChecklist = async () => {
    if (savingChecklist) return;

    // send only the checklist flags, not completion/status from the response
    const payload = Object.fromEntries(
      CHECKLIST_ITEMS.map((i) => [i.key, Boolean(checklist[i.key])]),
    );

    try {
      setSavingChecklist(true);
      const res = await exitService.updateChecklist({ id, ...payload });
      if (res?.message) toast.success(res.message);
      await load(true);
    } catch (err) {
      if (isTimeout(err)) {
        toast.info("Taking longer than usual. Checking if it was saved…");
        await load(true);
      } else {
        toast.error(backendMessage(err, "Could not save the checklist."));
        if (exitService.isConflict(err)) await load(true); // now locked
      }
    } finally {
      setSavingChecklist(false);
    }
  };

  /* ---- render ---- */

  const backButton = (
    <button
      type="button"
      onClick={handleBack}
      className="inline-flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-black transition-colors self-start"
    >
      <ArrowLeft size={14} />
      Back to exit processes
    </button>
  );

  if (loading) {
    return (
      <div className="space-y-4 w-full px-4 sm:px-6">
        {backButton}
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-2/3 sm:w-1/3" />
            <Skeleton className="h-3 w-3/4 sm:w-1/2" />
          </div>
        </div>
        <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
          <Skeleton className="h-72 2xl:order-2" />
          <div className="space-y-4">
            <Skeleton className="h-64" />
            <Skeleton className="h-40" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4 w-full px-4 sm:px-6">
        {backButton}
        <div className="flex flex-col items-center justify-center h-40 w-full text-red-500 font-poppins text-xs gap-3">
          <span className="break-words">
            {error || "Could not load this exit process"}
          </span>
          <button
            type="button"
            onClick={() => load()}
            className="px-3 sm:px-4 py-3 text-xs rounded-lg border bg-black text-white transition-all hover:bg-gray-800"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const locked = data.isLocked;
  const q = data.questionnaire ?? {};
  const initial = data.initial ?? {};
  const checklistData = data.checklist ?? {};
  const answered = (q.completion ?? 0) > 0 || q.workAgain;
  const checkedCount = CHECKLIST_ITEMS.filter((i) => checklist[i.key]).length;
  // questionnaire is not a step, only initial step + checklist count
  const stepsDone = [initial.completion, checklistData.completion].filter(
    (c) => (c ?? 0) >= 100,
  ).length;

  // summary panel extras
  const noticeTotal = daysBetween(
    parseDay(data.noticePeriodStart),
    parseDay(data.separationDate),
  );
  const daysLeft = daysBetween(todayUtc(), parseDay(data.separationDate));
  const daysLeftLabel =
    daysLeft == null
      ? "—"
      : daysLeft > 0
        ? `${daysLeft} ${daysLeft === 1 ? "day" : "days"}`
        : daysLeft === 0
          ? "Today"
          : "Ended";

  const breakdown = [
    {
      label: "Initial step",
      status: initial.status,
      completion: initial.completion ?? 0,
    },
    {
      label: "Clearance checklist",
      status: checklistData.status,
      completion: checklistData.completion ?? 0,
    },
    {
      label: "Exit questionnaire",
      status: q.status,
      completion: q.completion ?? 0,
    },
  ];

  return (
    <div className="space-y-4 w-full px-4 sm:px-6 font-poppins">
      {backButton}

      {/* HEADER */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center min-w-10 h-10 rounded-full bg-black text-xs text-white">
          {initials(data.employeeName)}
        </div>
        <div className="min-w-0">
          <p className="text-lg sm:text-2xl font-medium break-words">
            {data.employeeName}
          </p>
          <p className="text-[10px] sm:text-[13px] text-gray-400 font-light break-words">
            Exit process · Applied on {formatDate(data.appliedOn)}
          </p>
        </div>
      </div>

      {locked && (
        <div className="flex items-start gap-2 rounded-lg border border-gray-100 bg-white shadow-sm px-4 py-3 text-[12px] text-gray-600">
          <Lock size={14} className="mt-0.5 shrink-0" />
          <span>
            This exit process is {String(data.status ?? "").toLowerCase()} and
            can no longer be edited.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        {/* SUMMARY PANEL (right on large screens, on top on small ones) */}
        <aside className="min-w-0 2xl:order-2 2xl:sticky 2xl:top-4 space-y-4">
          {/* progress ring */}
          <div className={`${cardCls} flex items-center gap-4`}>
            <Ring value={data.completion} />
            <div className="min-w-0">
              <p className="text-base font-medium text-gray-800">
                Overall progress
              </p>
              <p className="text-[10px] sm:text-[13px] text-gray-400 font-light mt-0.5">
                {stepsDone} of {TOTAL_STEPS} steps complete
              </p>
              <div className="mt-2">
                <StatusPill status={data.status} />
              </div>
            </div>
          </div>

          {/* quick stats (dashboard KPI cards) */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              icon={Clock}
              label="Time left"
              value={daysLeftLabel}
              bg="#FFEFE7"
            />
            <StatCard
              icon={CalendarDays}
              label="Notice period"
              value={
                noticeTotal != null && noticeTotal >= 0
                  ? `${noticeTotal} days`
                  : "—"
              }
              bg="#E8EFF9"
            />
          </div>

          {/* per-section breakdown */}
          <div className={`${cardCls} space-y-4`}>
            <p className="text-base font-medium text-gray-800">
              Progress breakdown
            </p>
            {breakdown.map((b) => (
              <div key={b.label}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[12px] text-gray-800">{b.label}</span>
                  <StatusPill status={b.status} />
                </div>
                <ProgressBar value={b.completion} />
              </div>
            ))}
          </div>

          {/* details */}
          <div className={cardCls}>
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 sm:gap-x-8 2xl:grid-cols-1 divide-y divide-gray-100 sm:divide-y-0 2xl:divide-y">
              {data.employeeId && (
                <DetailRow label="Employee ID" value={data.employeeId} />
              )}
              <DetailRow label="Employment type" value={data.employmentType} />
              {data.department && (
                <DetailRow label="Department" value={data.department} />
              )}
              <DetailRow
                label="Applied on"
                value={formatDate(data.appliedOn)}
              />
              <DetailRow
                label="Interviewer"
                value={data.interviewerName || "Not assigned"}
              />
              <DetailRow
                label="Notice period start"
                value={formatDate(data.noticePeriodStart)}
              />
              <DetailRow
                label="Last working day"
                value={formatDate(data.separationDate)}
              />
              <DetailRow
                label="Reason for leaving"
                value={data.reasonForLeaving}
                className="sm:col-span-2 lg:col-span-3 2xl:col-span-1"
              />
            </dl>

            {/* attachment button (no file name) */}
            <div className="pt-4 mt-2 border-t border-gray-100">
              {data.attachment ? (
                <a
                  href={data.attachment}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 px-3 sm:px-4 py-3 text-xs rounded-lg border border-gray-300 bg-white text-gray-700 transition-all hover:bg-gray-50"
                >
                  <Icon icon="solar:paperclip-outline" className="w-4 h-4" />
                  Open attachment
                </a>
              ) : (
                <p className="text-[12px] text-gray-400 text-center">
                  No attachment
                </p>
              )}
            </div>
          </div>
        </aside>

        {/* STEPS (vertical timeline) */}
        <div className="2xl:order-1 min-w-0">
          {/* STEP 1: INITIAL STEP */}
          <TimelineStep
            id="exit-step-1"
            number={1}
            title="Initial step"
            description="Assign the interviewer and set the notice and separation dates."
            status={initial.status}
            completion={initial.completion ?? 0}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Interviewer" htmlFor="exit-interviewer">
                <InterviewerSelect
                  id="exit-interviewer"
                  value={initialForm.interviewerId}
                  selectedName={data.interviewerName}
                  disabled={locked}
                  onChange={(uuid) =>
                    setInitialForm((f) => ({ ...f, interviewerId: uuid }))
                  }
                />
              </Field>
              <Field label="Notice period start" htmlFor="exit-notice-start">
                <DateInput
                  id="exit-notice-start"
                  value={initialForm.noticePeriodStart}
                  disabled={locked}
                  onChange={(e) =>
                    setInitialForm((f) => ({
                      ...f,
                      noticePeriodStart: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field
                label="Separation date (last working day)"
                htmlFor="exit-separation-date"
              >
                <DateInput
                  id="exit-separation-date"
                  value={initialForm.separationDate}
                  min={initialForm.noticePeriodStart || undefined}
                  disabled={locked}
                  onChange={(e) =>
                    setInitialForm((f) => ({
                      ...f,
                      separationDate: e.target.value,
                    }))
                  }
                />
              </Field>
            </div>

            {!locked && (
              <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                {initialDirty && (
                  <span className="text-[12px] text-gray-400 sm:mr-auto text-center sm:text-left">
                    You have unsaved changes
                  </span>
                )}
                {initialDirty && (
                  <GhostButton onClick={resetInitial} disabled={savingInitial}>
                    Discard
                  </GhostButton>
                )}
                <PrimaryButton
                  onClick={saveInitial}
                  disabled={savingInitial || !initialDirty}
                >
                  {savingInitial ? "Saving..." : "Save initial step"}
                </PrimaryButton>
              </div>
            )}
          </TimelineStep>

          {/* STEP 2: CHECKLIST */}
          <TimelineStep
            id="exit-step-2"
            number={2}
            title="Clearance checklist"
            description={`${checkedCount} of ${CHECKLIST_ITEMS.length} items cleared.`}
            status={checklistData.status}
            completion={checklistData.completion ?? 0}
            last
          >
            <ul className="rounded-lg border border-gray-100 divide-y divide-gray-100 overflow-hidden">
              {CHECKLIST_ITEMS.map((item) => {
                const checked = Boolean(checklist[item.key]);
                return (
                  <li key={item.key}>
                    <label
                      className={`flex items-center gap-3 px-4 py-3 text-[12px] text-gray-800 transition-colors ${
                        locked
                          ? "opacity-60"
                          : "cursor-pointer hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={locked}
                        onChange={(e) =>
                          setChecklist((c) => ({
                            ...c,
                            [item.key]: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 shrink-0 accent-black"
                      />
                      <span className="flex-1 min-w-0 break-words">
                        {item.label}
                      </span>
                      <Badge
                        className={
                          checked
                            ? "bg-green-100 text-green-600"
                            : "bg-orange-100 text-orange-600"
                        }
                      >
                        {checked ? "Cleared" : "Pending"}
                      </Badge>
                    </label>
                  </li>
                );
              })}
            </ul>

            {!locked && (
              <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                {checklistDirty && (
                  <span className="text-[12px] text-gray-400 sm:mr-auto text-center sm:text-left">
                    You have unsaved changes
                  </span>
                )}
                {checklistDirty && (
                  <GhostButton
                    onClick={resetChecklist}
                    disabled={savingChecklist}
                  >
                    Discard
                  </GhostButton>
                )}
                <PrimaryButton
                  onClick={saveChecklist}
                  disabled={savingChecklist || !checklistDirty}
                >
                  {savingChecklist ? "Saving..." : "Save checklist"}
                </PrimaryButton>
              </div>
            )}
          </TimelineStep>

          {/* EXIT QUESTIONNAIRE (separate from the steps, read only) */}
          <QuestionnaireCard
            id="exit-questionnaire"
            title="Exit questionnaire"
            description="Questions answered by the employee."
            status={q.status}
            completion={q.completion ?? 0}
          >
            <ol className="space-y-3">
              {QUESTIONS.map((item, i) => {
                const value = q[item.key];
                const isBool = item.type === "boolean";
                const hasAnswer = isBool ? answered : Boolean(value?.trim?.());

                return (
                  <li
                    key={item.key}
                    className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                  >
                    <p className="text-[12px] text-gray-400">
                      Question {i + 1}
                    </p>
                    <p className="text-[12px] text-gray-800 mt-0.5">
                      {item.question}
                    </p>

                    <div className="mt-2">
                      {isBool ? (
                        <Badge
                          className={
                            !hasAnswer
                              ? "bg-gray-100 text-gray-600"
                              : value
                                ? "bg-green-100 text-green-600"
                                : "bg-red-100 text-red-600"
                          }
                        >
                          {!hasAnswer ? "Not answered" : value ? "Yes" : "No"}
                        </Badge>
                      ) : (
                        <p
                          className={`text-[12px] break-words ${
                            hasAnswer ? "text-gray-800" : "text-gray-400"
                          }`}
                        >
                          {hasAnswer ? value : "Not answered"}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </QuestionnaireCard>
        </div>
      </div>
    </div>
  );
};

export default ExitProcessDetail;
