import React, { useState } from "react";
import DashboardLayout from "../ui/pagelayout";
import HeaderGlobal from "../ui/headerglobal";
import ExitProcessList from "../components/exitprocess/ExitProcessList";
import ExitProcessDetail from "../components/exitprocess/ExitProcessDetail";

/* ---------- page: list <-> detail ---------- */

function ExitProcess() {
  const [selectedId, setSelectedId] = useState(null);
  // bumped when coming back from a detail so the list shows fresh progress
  const [listKey, setListKey] = useState(0);

  const closeDetail = () => {
    setSelectedId(null);
    setListKey((k) => k + 1);
  };

  return (
    <DashboardLayout userName="Admin" onLogout={() => {}}>
      <div className="h-full flex flex-col w-full m-0 p-0">
        <div className="flex-1 overflow-y-auto w-full m-0 p-0 scrollbar-hide">
          {/* ===== Header (same as Dashboard / Requests) ===== */}
          <div className="w-full bg-white font-poppins relative">
            <HeaderGlobal userName="Admin" />

            <div className="w-full sm:px-6 mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-lg sm:text-2xl font-medium">
                  Admin’s Exit Process
                </p>
                <p className="text-[10px] sm:text-[13px] text-gray-400 font-light">
                  Track and manage employee exits here
                </p>
              </div>
            </div>
          </div>

          {/* ===== Content (same spacing as Dashboard / Requests) ===== */}
          <div className="mt-6 flex flex-col gap-6 w-full m-0 p-0 font-poppins">
            {selectedId ? (
              <ExitProcessDetail id={selectedId} onBack={closeDetail} />
            ) : (
              <ExitProcessList key={listKey} onOpen={setSelectedId} />
            )}
          </div>
        </div>
      </div>

      {/* Same hidden-scrollbar helper the Dashboard uses.
          Move this to index.css once and delete it from every page. */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </DashboardLayout>
  );
}

export default ExitProcess;
