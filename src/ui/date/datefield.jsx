import React from "react";
import { Icon } from "@iconify/react";

export default function DateField({
  value,
  onChange,
  min,
  max,
  disabled = false,
  ariaLabel = "Select date",
}) {
  return (
    <div className="relative w-full">
      <input
        type="date"
        value={value || ""}
        min={min}
        max={max}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pr-9 cursor-pointer border border-gray-200 rounded-lg bg-white px-2.5 py-1.5 text-[10px] sm:text-xs text-gray-800 focus:outline-none focus:border-black disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
        onClick={(e) => {
          try {
            e.currentTarget.showPicker?.();
          } catch {}
        }}
      />
      <Icon
        icon="solar:calendar-outline"
        className="w-4 h-4 text-gray-700 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
      />
    </div>
  );
}
