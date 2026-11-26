import React, { useState, useEffect, useRef, useMemo } from "react";
import { Icon } from "@iconify/react";
import DateField from "../date/datefield";

const ICONS = {
  search: "lucide:search",
  filter: "lucide:filter",
  close: "lucide:x",
  chevronDown: "lucide:chevron-down",
};

/* ---------- Checkbox list with search, capped at 200 rows ---------- */
function CheckList({ options, value = [], onChange }) {
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
            className="w-full pl-8 pr-2.5 py-1.5 border border-gray-200 rounded-lg text-[10px] sm:text-xs text-gray-800 focus:outline-none focus:border-black"
          />
        </div>
      )}
      <div className="max-h-36 overflow-y-auto flex flex-col gap-1">
        {rows.length === 0 && (
          <p className="text-[10px] sm:text-xs text-gray-400 py-1">
            No results
          </p>
        )}
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
}

/* ---------- FilterMenu ---------- */
/**
- fields: [{ key, label, type: "select" | "date" | "checkbox",
-            options?: [{ value, label }],
-            visible?: (draft) => boolean,
-            min?: (draft) => string, max?: (draft) => string,
-            loading?: boolean }]
- filters / setFilters : applied filters (parent state)
- defaults             : default filter values (used for reset + active count)
- onApply(nextFilters) : called after Apply with the draft values
- onReset(defaults)    : optional; called after Reset all
- context              : readout text, e.g. "12 Nov 2026 – 12 Nov 2026"
- shown / totalCount   : result count readout
 */
export default function FilterMenu({
  fields,
  filters,
  setFilters,
  defaults,
  onApply,
  onReset,
  context,
  shown,
  totalCount,
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const wrapRef = useRef(null);

  // Sync the draft with applied filters whenever the panel opens
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  // Close on outside click and Esc
  useEffect(() => {
    if (!open) return;
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
    onReset ? onReset(defaults) : onApply?.(defaults);
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-3 min-w-0" ref={wrapRef}>
      {/* readout */}
      <div className="min-w-0 text-right">
        {context && (
          <p className="text-[10px] sm:text-xs text-gray-500 truncate">
            {context}
          </p>
        )}
        {totalCount != null && (
          <p className="text-[10px] sm:text-xs text-gray-400">
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
          className={`relative w-9 h-9 rounded-lg border flex items-center justify-center ${
            open || activeCount > 0
              ? "bg-black text-white border-black"
              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
          }`}
        >
          <Icon icon={ICONS.filter} className="w-4 h-4" />
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-11 z-30 w-[calc(100vw-2rem)] sm:w-[22rem] max-h-[75vh] flex flex-col bg-white rounded-lg border border-gray-200 shadow-lg">
            {/* sticky header */}
            <div className="sticky top-0 bg-white rounded-t-lg flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-800">Filters</p>
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
              {fields
                .filter((fl) => !fl.visible || fl.visible(draft))
                .map((fl) => (
                  <div key={fl.key} className="flex flex-col gap-1.5 min-w-0">
                    <label className="text-[10px] sm:text-xs uppercase font-semibold text-gray-400">
                      {fl.label}
                    </label>

                    {fl.type === "select" && (
                      <div className="relative">
                        <select
                          value={draft[fl.key] ?? ""}
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
}
