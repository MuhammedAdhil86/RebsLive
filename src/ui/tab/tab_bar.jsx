import React, { useRef, useEffect } from "react";
import { Icon } from "@iconify/react";

/**
 * Shared TabBar — the single tab style for every page.
 *
 * Props
 *  tabs       [{ key, label, count?, icon? }]
 *               key    unique id (an `id` field also works)
 *               label  text shown on the tab
 *               count  optional small number badge (e.g. pending requests)
 *               icon   optional lined Solar icon name, e.g. "solar:folder-outline"
 *  activeTab  key of the active tab
 *  onChange   (key) => void
 *
 * Look (same as the Dashboard): white bar, text-sm, active tab = black text,
 * font-medium and a 2px black underline; inactive tabs = #AFAFAF.
 *
 * Behaviour: one row that scrolls sideways on small screens (no wrapping, no
 * visible scrollbar), the active tab is scrolled into view, and the arrow keys
 * move between tabs.
 */
function TabBar({ tabs = [], activeTab, onChange }) {
  const listRef = useRef(null);

  const idOf = (tab) => tab.key ?? tab.id;

  // keep the active tab visible when there are many tabs
  useEffect(() => {
    const el = listRef.current?.querySelector('[aria-selected="true"]');
    el?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [activeTab]);

  const onKeyDown = (e, index) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next =
      e.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : (index - 1 + tabs.length) % tabs.length;
    onChange(idOf(tabs[next]));
    listRef.current?.querySelectorAll('[role="tab"]')[next]?.focus();
  };

  return (
    <section className="bg-white mt-4 sm:mt-6 w-full px-4 sm:px-6 font-poppins">
      <div
        ref={listRef}
        role="tablist"
        className="border-b flex flex-nowrap gap-4 sm:gap-6 pt-4 text-sm overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab, index) => {
          const id = idOf(tab);
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(id)}
              onKeyDown={(e) => onKeyDown(e, index)}
              className={`pb-2 shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 transition-all focus:outline-none focus-visible:text-black ${
                active
                  ? "border-b-2 border-black font-medium text-black"
                  : "text-[#AFAFAF] hover:text-gray-600"
              }`}
            >
              {tab.icon && (
                <Icon icon={tab.icon} className="w-4 h-4 shrink-0" />
              )}
              {tab.label}
              {tab.count !== undefined && tab.count !== null && (
                <span
                  className={`min-w-4 px-1.5 rounded-full text-[10px] leading-4 text-center ${
                    active ? "bg-black text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default TabBar;
