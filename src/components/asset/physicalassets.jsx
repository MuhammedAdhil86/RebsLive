import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { Icon } from "@iconify/react";
import { toast } from "react-toastify";
import {
  fetchDashboard,
  fetchAssets,
  removeAsset,
} from "../../service/assetservice";
import { showApiSuccess, showApiError } from "../../utils/apiToast";

import UniversalTable from "../../ui/universal_table"; // adjust path/file name if different
import AssetDetailDrawer from "./assetdeatailsdrawer";
import CreateAssetDrawer from "./createasset";
import UpdateAssetDrawer from "./updateassetdrawer";
import UniversalActionMenu from "./universalmenu";
import DeleteConfirmationModal from "../../ui/deletemodal";

/* =====================================================================
   STYLE TOKENS  (same scale as the Dashboard / UI guideline)
   ===================================================================== */
const T = {
  card: "bg-white rounded-lg shadow-sm border border-gray-100",
  cardTitle: "text-sm font-medium text-gray-800",
  subtitle: "text-[10px] sm:text-[13px] text-gray-400 font-light",
  label: "text-[10px] sm:text-xs uppercase font-normal text-gray-400",
  body: "text-xs sm:text-sm text-gray-800",
  muted: "text-[10px] sm:text-xs text-gray-400",
  input:
    "border border-gray-200 rounded-lg bg-white px-2.5 py-1.5 text-[10px] sm:text-xs text-gray-800 focus:outline-none focus:border-black",
};

/* Same palette as the dashboard KPI cards */
const COLORS = {
  green: "#EBFDEF",
  blue: "#E8EFF9",
  orange: "#FFEFE7",
  yellow: "#FFFBDB",
  red: "#FFDADA",
};

/* Lined (outline) icons only — Solar set through Iconify */
const IC = {
  filter: "solar:filter-outline",
  calendar: "solar:calendar-outline",
  close: "solar:close-circle-outline",
  search: "solar:magnifer-outline",
  add: "material-symbols:add-rounded",
  edit: "solar:pen-outline",
  trash: "solar:trash-bin-trash-outline",
  refresh: "solar:refresh-outline",
  warning: "solar:danger-triangle-outline",
  box: "solar:box-outline",
  allocated: "solar:user-check-outline",
  available: "solar:box-minimalistic-outline",
  maintenance: "solar:settings-outline",
  damaged: "solar:danger-circle-outline",
};

const Ico = ({ name, className = "w-4 h-4" }) => (
  <Icon icon={name} className={className} />
);

/* ---------- helpers ---------- */

const humanize = (s) => {
  if (!s) return "—";
  const t = String(s).replace(/_/g, " ").trim().toLowerCase();
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

const toggleIn = (list, value) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

/* Date field: native date input + lined calendar icon on the right.
   The browser's own picker icon is hidden and stretched over the field so a
   click anywhere opens the calendar. */
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

/* long text is cut with "…" so a cell can never stretch its row */
const Cell = ({ children }) => (
  <span
    className="min-w-0 max-w-full truncate"
    title={typeof children === "string" ? children : undefined}
  >
    {children || "—"}
  </span>
);

const StatusBadge = ({ allocated }) => (
  <span
    className={`inline-flex items-center gap-1.5 max-w-full truncate px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-normal whitespace-nowrap ${
      allocated ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-gray-600"
    }`}
  >
    <span
      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
        allocated ? "bg-emerald-500" : "bg-gray-400"
      }`}
    />
    {allocated ? "Allocated" : "Unallocated"}
  </span>
);

/* StatCard — dashboard style: pastel bg + black round lined icon */
const StatCard = ({ icon, label, value, bg, loading }) => (
  <div
    className="shadow-sm rounded-lg p-3 flex items-center gap-3 min-w-0 last:col-span-2 lg:last:col-span-1"
    style={{ backgroundColor: bg }}
  >
    <div className="flex items-center justify-center min-w-10 h-10 rounded-full bg-black text-white">
      <Ico name={icon} className="w-[18px] h-[18px]" />
    </div>
    <div className="overflow-hidden">
      <p className="text-gray-500 text-[10px] sm:text-xs truncate uppercase font-normal">
        {label}
      </p>
      <h2 className="text-lg sm:text-xl font-medium text-gray-800">
        {loading ? "…" : (value ?? 0)}
      </h2>
    </div>
  </div>
);

/* Primary action (same glowing button as the dashboard) */
function GlowButton({ children, onClick }) {
  return (
    <button
      type="button"
      className="chat-btn relative overflow-visible rounded-lg px-5 py-3 text-xs font-poppins font-normal bg-black text-white flex items-center gap-2"
      onClick={onClick}
    >
      {children}
      <span className="glow" />
      <style>{`
        .chat-btn { position: relative; overflow: visible; cursor: pointer; transition: transform 180ms cubic-bezier(.22, .61, .36, 1); }
        .chat-btn::before { content: ""; position: absolute; inset: 0; padding: 0px 0px 3px 0px; border-radius: 8px; background: linear-gradient(90deg, #6d7cff, #a855f7, #ec4899, #6d7cff); background-size: 300% 100%; animation: slide 3s linear infinite; transition: padding 180ms cubic-bezier(.22, .61, .36, 1); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; }
        .chat-btn:hover::before { padding: 1px 1px 5px 1px; }
        .glow { position: absolute; left: 12%; right: 12%; bottom: -8px; height: 10px; border-radius: 9999px; background: linear-gradient(90deg, #6d7cff, #a855f7, #ec4899, #6d7cff); background-size: 300% 100%; animation: slide 3s linear infinite; filter: blur(16px); opacity: 0.55; transition: opacity 180ms ease; }
        @keyframes slide { from { background-position: 0% 0; } to { background-position: 300% 0; } }
      `}</style>
    </button>
  );
}

/* =====================================================================
   FILTERS — every filter lives inside the one filter icon
   (the table's own search box stays next to it)
   ===================================================================== */

const SORT_OPTIONS = [
  { value: "", label: "Default order" },
  { value: "asset_name", label: "Asset name" },
  { value: "asset_type", label: "Type" },
  { value: "purchase_date", label: "Purchase date" },
];

const EMPTY_FILTERS = {
  status: "all", // all | allocated | available
  types: [],
  conditions: [],
  from: "",
  to: "",
  sortKey: "",
  sortDir: "ascending",
};

const countActive = (f) =>
  (f.status !== "all" ? 1 : 0) +
  (f.types.length ? 1 : 0) +
  (f.conditions.length ? 1 : 0) +
  (f.from || f.to ? 1 : 0) +
  (f.sortKey ? 1 : 0);

const FilterGroup = ({ title, children }) => (
  <div className="py-3 border-b border-gray-100 last:border-b-0">
    <p className={`${T.label} mb-2`}>{title}</p>
    {children}
  </div>
);

const Chip = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`max-w-full truncate px-3 py-1.5 rounded-full border text-[10px] sm:text-xs transition-colors ${
      active
        ? "bg-black text-white border-black"
        : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
    }`}
  >
    {children}
  </button>
);

const FilterMenu = ({ filters, setFilters, options }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const activeCount = countActive(filters);

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

  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
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
            <FilterGroup title="Allocation">
              <div className="flex flex-wrap gap-2">
                {[
                  ["all", "All"],
                  ["allocated", "Allocated"],
                  ["available", "Unallocated"],
                ].map(([v, l]) => (
                  <Chip
                    key={v}
                    active={filters.status === v}
                    onClick={() => set({ status: v })}
                  >
                    {l}
                  </Chip>
                ))}
              </div>
            </FilterGroup>

            <FilterGroup title="Type">
              <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                {options.types.length === 0 ? (
                  <p className={T.muted}>No types</p>
                ) : (
                  options.types.map((t) => (
                    <Chip
                      key={t}
                      active={filters.types.includes(t)}
                      onClick={() => set({ types: toggleIn(filters.types, t) })}
                    >
                      {humanize(t)}
                    </Chip>
                  ))
                )}
              </div>
            </FilterGroup>

            <FilterGroup title="Condition">
              <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                {options.conditions.length === 0 ? (
                  <p className={T.muted}>No conditions</p>
                ) : (
                  options.conditions.map((c) => (
                    <Chip
                      key={c}
                      active={filters.conditions.includes(c)}
                      onClick={() =>
                        set({ conditions: toggleIn(filters.conditions, c) })
                      }
                    >
                      {humanize(c)}
                    </Chip>
                  ))
                )}
              </div>
            </FilterGroup>

            <FilterGroup title="Purchased between">
              <div className="grid grid-cols-2 gap-2">
                <DateField
                  value={filters.from}
                  max={filters.to || undefined}
                  ariaLabel="From date"
                  onChange={(e) => set({ from: e.target.value })}
                />
                <DateField
                  value={filters.to}
                  min={filters.from || undefined}
                  ariaLabel="To date"
                  onChange={(e) => set({ to: e.target.value })}
                />
              </div>
            </FilterGroup>

            <FilterGroup title="Sort by">
              <select
                value={filters.sortKey}
                onChange={(e) => set({ sortKey: e.target.value })}
                aria-label="Sort by"
                className={`w-full ${T.input}`}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {filters.sortKey && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <Chip
                    active={filters.sortDir === "ascending"}
                    onClick={() => set({ sortDir: "ascending" })}
                  >
                    Ascending
                  </Chip>
                  <Chip
                    active={filters.sortDir === "descending"}
                    onClick={() => set({ sortDir: "descending" })}
                  >
                    Descending
                  </Chip>
                </div>
              )}
            </FilterGroup>
          </div>

          {/* footer */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              disabled={!activeCount}
              className="text-[10px] sm:text-xs text-gray-500 hover:text-black disabled:opacity-40 disabled:hover:text-gray-500"
            >
              Reset all
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-xs sm:text-sm rounded-lg bg-black text-white hover:bg-black/80 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* =====================================================================
   PHYSICAL ASSET TAB
   ===================================================================== */

function PhysicalAssetTab() {
  const [assets, setAssets] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [editingAsset, setEditingAsset] = useState(null);

  const [deleteModal, setDeleteModal] = useState({ isOpen: false, data: null });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [assetData, stats] = await Promise.all([
        fetchAssets(),
        fetchDashboard(),
      ]);

      // PHYSICAL tab: exclude "DIGITAL ASSET"
      const physicalOnly = Array.isArray(assetData)
        ? assetData.filter((a) => a.asset_type !== "DIGITAL ASSET")
        : [];

      setAssets(physicalOnly);
      setDashboardData(stats);
    } catch (e) {
      console.error(e);
      setError(
        e?.response?.data?.message || e?.message || "Failed to load inventory.",
      );
      showApiError(e, "Failed to load inventory data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConfirmDelete = async () => {
    const row = deleteModal.data;
    if (!row) return;

    setDeleteModal({ isOpen: false, data: null });
    const loadingToast = toast.loading("Deleting asset...");

    try {
      const res = await removeAsset(row.id);
      toast.dismiss(loadingToast);
      showApiSuccess(res, "Asset deleted successfully");
      loadData();
    } catch (err) {
      toast.dismiss(loadingToast);
      showApiError(err, "Deletion failed");
    }
  };

  /* UniversalTable columns: first column left, the rest centered.
     Widths add up to 100% so header and body always line up. */
  const columns = useMemo(
    () => [
      {
        key: "asset_name",
        label: "Asset Name",
        width: "22%",
        render: (val) => <Cell>{val}</Cell>,
      },
      {
        key: "asset_type",
        label: "Type",
        width: "14%",
        render: (val) => <Cell>{val}</Cell>,
      },
      {
        key: "condition",
        label: "Condition",
        width: "12%",
        render: (val) => <Cell>{val}</Cell>,
      },
      {
        key: "purchase_date",
        label: "Purchase Date",
        width: "17%",
        render: (val) =>
          val ? (
            <span className="inline-flex items-center gap-1.5 text-gray-600 font-normal whitespace-nowrap">
              <Ico name={IC.calendar} className="w-4 h-4 text-gray-500" />
              {formatDate(val)}
            </span>
          ) : (
            "—"
          ),
      },
      {
        key: "staff_name",
        label: "Staff Name",
        width: "16%",
        render: (val) => <Cell>{val}</Cell>,
      },
      {
        key: "asset_status",
        label: "Status",
        width: "13%",
        render: (val) => (
          // normalise so both 'allocated' and 'Allocated' match
          <StatusBadge allocated={val?.toLowerCase() === "allocated"} />
        ),
      },
      {
        key: "actions",
        label: "Action",
        width: "6%",
        render: (_, row) => (
          // stop the click so opening the menu doesn't also open the drawer
          <div onClick={(e) => e.stopPropagation()}>
            <UniversalActionMenu
              row={row}
              actions={[
                {
                  label: "Edit Asset",
                  icon: <Ico name={IC.edit} className="w-4 h-4" />,
                  onClick: (rowData) => {
                    setEditingAsset(rowData);
                    setIsUpdateOpen(true);
                  },
                },
                {
                  label: "Delete Asset",
                  icon: <Ico name={IC.trash} className="w-4 h-4" />,
                  onClick: (rowData) =>
                    setDeleteModal({ isOpen: true, data: rowData }),
                  isDelete: true,
                },
              ]}
            />
          </div>
        ),
      },
    ],
    [],
  );

  /* options shown inside the filter menu */
  const options = useMemo(() => {
    const types = new Set();
    const conditions = new Set();
    assets.forEach((a) => {
      if (a.asset_type) types.add(a.asset_type);
      if (a.condition) conditions.add(a.condition);
    });
    return {
      types: [...types].sort(),
      conditions: [...conditions].sort(),
    };
  }, [assets]);

  const processedAssets = useMemo(() => {
    const { status, types, conditions, from, to, sortKey, sortDir } = filters;
    const fromD = from ? new Date(`${from}T00:00:00`) : null;
    const toD = to ? new Date(`${to}T23:59:59`) : null;
    const term = search.toLowerCase().trim();

    const filtered = assets.filter((asset) => {
      const isAllocated = asset.asset_status?.toLowerCase() === "allocated";

      if (status === "allocated" && !isAllocated) return false;
      if (status === "available" && isAllocated) return false;
      if (types.length && !types.includes(asset.asset_type)) return false;
      if (conditions.length && !conditions.includes(asset.condition))
        return false;

      if (fromD || toD) {
        const d = new Date(asset.purchase_date);
        if (Number.isNaN(d.getTime())) return false;
        if (fromD && d < fromD) return false;
        if (toD && d > toD) return false;
      }

      if (!term) return true;
      return Object.values(asset).some(
        (val) => val && val.toString().toLowerCase().includes(term),
      );
    });

    if (sortKey) {
      filtered.sort((a, b) => {
        const aVal = a[sortKey] || "";
        const bVal = b[sortKey] || "";
        if (aVal < bVal) return sortDir === "ascending" ? -1 : 1;
        if (aVal > bVal) return sortDir === "ascending" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [assets, filters, search]);

  const damagedCount = assets.filter(
    (a) => a.condition?.toLowerCase() === "damaged",
  ).length;

  const statCards = [
    {
      label: "Total Assets",
      value: dashboardData?.total_assets,
      bg: COLORS.green,
      icon: IC.box,
    },
    {
      label: "Allocated",
      value: dashboardData?.allocated_assets,
      bg: COLORS.blue,
      icon: IC.allocated,
    },
    {
      label: "Available",
      value: dashboardData?.unallocated_assets,
      bg: COLORS.orange,
      icon: IC.available,
    },
    {
      label: "Maintenance",
      value: dashboardData?.assets_under_maintanance,
      bg: COLORS.yellow,
      icon: IC.maintenance,
    },
    {
      label: "Damaged",
      value: damagedCount,
      bg: COLORS.red,
      icon: IC.damaged,
    },
  ];

  const activeFilterCount = countActive(filters);

  return (
    <div className="space-y-6 min-w-0 max-w-full font-poppins font-normal">
      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, data: null })}
        onConfirm={handleConfirmDelete}
        itemName={deleteModal.data?.asset_name || "this asset"}
      />

      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-lg sm:text-2xl font-medium">
            Physical Asset Inventory
          </p>
          <p className={T.subtitle}>
            Track and manage all physical assets here
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GlowButton onClick={() => setIsCreateOpen(true)}>
            <Ico name={IC.add} className="w-4 h-4" /> Physical Asset
          </GlowButton>
        </div>
      </div>

      {/* KPI CARDS */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-4 w-full">
        {statCards.map((stat) => (
          <StatCard key={stat.label} {...stat} loading={isLoading} />
        ))}
      </section>

      {/* FILTER AREA (separate from the table, no white card) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className={T.cardTitle}>Assets</h3>
          <p className={T.muted}>
            {processedAssets.length} of {assets.length} assets
            {activeFilterCount > 0 || search.trim() ? " · filtered" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none sm:w-64">
            <Ico
              name={IC.search}
              className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets…"
              aria-label="Search assets"
              className={`w-full pl-8 ${T.input}`}
            />
          </div>
          <FilterMenu
            filters={filters}
            setFilters={setFilters}
            options={options}
          />
        </div>
      </div>

      {/* TABLE AREA: the shared UniversalTable on its own (no extra wrapper) */}
      {error ? (
        <div className="py-16 text-center px-4">
          <Ico
            name={IC.warning}
            className="w-6 h-6 text-gray-400 mx-auto mb-2"
          />
          <p className={T.body}>Could not load assets</p>
          <p className={`${T.muted} mt-1 break-words`}>{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm rounded-lg bg-black text-white hover:bg-black/80 transition-colors"
          >
            <Ico name={IC.refresh} className="w-4 h-4" />
            Try again
          </button>
        </div>
      ) : (
        <UniversalTable
          columns={columns}
          data={processedAssets}
          rowsPerPage={10}
          rowClickHandler={(row) => setSelectedAsset(row)}
          loading={isLoading}
          searchable={false}
          emptyText={
            assets.length === 0
              ? "No assets yet. Add a physical asset to get started."
              : "No assets match your filters or search."
          }
        />
      )}

      <CreateAssetDrawer
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onAssetCreated={loadData}
      />
      <UpdateAssetDrawer
        open={isUpdateOpen}
        asset={editingAsset}
        onClose={() => {
          setIsUpdateOpen(false);
          setEditingAsset(null);
        }}
        onAssetUpdated={loadData}
      />
      <AssetDetailDrawer
        asset={selectedAsset}
        onClose={() => setSelectedAsset(null)}
        onRefresh={loadData}
      />
    </div>
  );
}

export default PhysicalAssetTab;
