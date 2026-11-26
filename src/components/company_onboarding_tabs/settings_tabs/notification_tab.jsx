import React, { useState, useEffect, useCallback } from "react";
import { Icon } from "@iconify/react";
import { toast } from "react-toastify";
import announceService from "../../service/announceService";
import {
  resolveApiSuccess,
  resolveApiError,
  showApiError,
} from "../../utils/apiToast";

// No toast container here: toasts use the shared apiToast helpers
// (backend message as the title, backend data underneath) and show in the
// page's single container (UI guideline §4).

// This app is the web client, so notifications always use source=web
const SOURCE = "web";

// Solar linear (line) icon per notification type key
const TYPE_ICONS = {
  announcement: "solar:chat-square-linear",
  event: "solar:calendar-linear",
  leave: "solar:suitcase-linear",
  shift_swap: "solar:transfer-horizontal-linear",
  attendance_reminder: "solar:clock-circle-linear",
  celebration: "solar:gift-linear",
  insurance: "solar:shield-check-linear",
  chat: "solar:chat-round-dots-linear",
  project_allocation: "solar:case-round-linear",
};

// "shift_swap" -> "Shift swap"
const typeLabel = (key) => {
  const text = String(key || "")
    .replace(/_/g, " ")
    .trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/* ---------- Pieces ---------- */

const Spinner = () => (
  <div className="flex items-center justify-center gap-3 py-10">
    <span className="w-5 h-5 rounded-full border-2 border-gray-200 border-t-black animate-spin" />
    <span className="text-[12px] text-gray-400">Loading notifications...</span>
  </div>
);

// Black when on, gray when off
const Toggle = ({ checked, disabled, busy, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled || busy}
    onClick={onChange}
    className={`relative w-10 h-6 rounded-full shrink-0 transition-colors focus:outline-none ${
      checked ? "bg-black" : "bg-gray-200"
    } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center transition-transform ${
        checked ? "translate-x-4" : "translate-x-0"
      }`}
    >
      {busy && (
        <span className="w-3 h-3 rounded-full border-2 border-gray-200 border-t-black animate-spin" />
      )}
    </span>
  </button>
);

const Row = ({ item, busy, onToggle }) => {
  const locked = Boolean(item.is_mandatory);
  return (
    <li className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-b-0">
      <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center shrink-0">
        <Icon
          icon={TYPE_ICONS[item.type] || "solar:bell-linear"}
          className="w-5 h-5"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[12px] text-gray-800">{typeLabel(item.type)}</p>
          {locked && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-[11px]">
              <Icon icon="solar:lock-linear" className="w-3 h-3" />
              Required
            </span>
          )}
        </div>
        <p className="text-[12px] text-gray-400 mt-0.5">{item.description}</p>
      </div>

      <Toggle
        checked={Boolean(item.enabled)}
        disabled={locked}
        busy={busy}
        label={`${typeLabel(item.type)} notifications`}
        onChange={() => onToggle(item)}
      />
    </li>
  );
};

const Card = ({ title, description, aside, children }) => (
  <section className="bg-white shadow rounded-xl p-4 border border-gray-100">
    <div className="flex items-start justify-between gap-3 mb-2">
      <div>
        <h3 className="text-base font-medium text-gray-800">{title}</h3>
        {description && (
          <p className="text-[12px] text-gray-400 mt-0.5">{description}</p>
        )}
      </div>
      {aside}
    </div>
    {children}
  </section>
);

/* ---------- Tab ---------- */

export default function NotificationsTab() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setTypes(await announceService.getNotificationTypes(SOURCE));
    } catch (err) {
      setTypes([]);
      setLoadError(
        err?.response?.data?.message || "Failed to load notifications",
      );
      showApiError(err, "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = (id, enabled) =>
    setTypes((prev) => prev.map((t) => (t.id === id ? { ...t, enabled } : t)));

  const handleToggle = async (item) => {
    // Mandatory types are enforced by the system
    if (item.is_mandatory || busyId === item.id) return;

    const next = !item.enabled;
    setBusyId(item.id);
    patch(item.id, next); // optimistic

    const tid = toast.loading("Saving preference...");
    try {
      const res = await announceService.setMyNotificationPreference(
        item.id,
        next,
      );
      patch(item.id, res?.data?.enabled ?? next);
      // Backend message becomes the toast title
      resolveApiSuccess(tid, res, "Notification preference updated");
    } catch (err) {
      patch(item.id, item.enabled); // roll back
      // Backend message + data (or error) from error.response.data
      resolveApiError(tid, err, "Failed to update notification preference");
    } finally {
      setBusyId(null);
    }
  };

  const optional = types.filter((t) => !t.is_mandatory);
  const required = types.filter((t) => t.is_mandatory);
  const enabledCount = types.filter((t) => t.enabled).length;

  return (
    <div className="flex flex-col gap-4 font-poppins text-[12px]">
      {/* Title */}
      <div>
        <h2 className="text-lg sm:text-2xl font-medium text-gray-800">
          Notifications
        </h2>
        <p className="text-[10px] sm:text-[13px] text-gray-400 font-light">
          Choose which updates you receive
        </p>
      </div>

      {loading ? (
        <Card title="Preferences">
          <Spinner />
        </Card>
      ) : loadError ? (
        <Card title="Preferences">
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="text-red-500 text-xs">{loadError}</p>
            <button
              type="button"
              onClick={load}
              className="px-3 sm:px-4 py-3 text-xs rounded-lg bg-black text-white hover:bg-gray-800"
            >
              Try again
            </button>
          </div>
        </Card>
      ) : (
        <>
          <Card
            title="Preferences"
            description="Turn these on or off any time"
            aside={
              <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-[11px] whitespace-nowrap">
                {enabledCount} of {types.length} on
              </span>
            }
          >
            {optional.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-gray-400">
                No optional notifications found
              </p>
            ) : (
              <ul>
                {optional.map((item) => (
                  <Row
                    key={item.id}
                    item={item}
                    busy={busyId === item.id}
                    onToggle={handleToggle}
                  />
                ))}
              </ul>
            )}
          </Card>

          {required.length > 0 && (
            <Card
              title="Required notifications"
              description="Set by the system, these can't be turned off"
            >
              <ul>
                {required.map((item) => (
                  <Row
                    key={item.id}
                    item={item}
                    busy={false}
                    onToggle={handleToggle}
                  />
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
