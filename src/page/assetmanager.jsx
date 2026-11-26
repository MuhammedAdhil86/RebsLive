import React, { useState, useEffect } from "react";
import DashboardLayout from "../ui/pagelayout";
import HeaderGlobal from "../ui/headerglobal";
import TabBar from "../ui/tab/tab_bar";
import PhysicalAssetTab from "../components/asset/physicalassets";
import DigitalAssetTab from "../components/asset/digitalasset";

// Tabs shown in the header, in order. TabBar reads `key` and `label`.
const TABS = [
  { key: "physical", label: "Asset Manager" },
  { key: "digital", label: "Digital Assets" },
];

const TAB_KEY = "asset_manager_active_tab";

function AssetManager({ userId, userName, onLogout }) {
  const [activeTab, setActiveTab] = useState(() => {
    let saved = null;
    try {
      saved = localStorage.getItem(TAB_KEY);
    } catch {
      /* storage unavailable */
    }
    // Ignore an old/unknown saved tab so the page never opens blank.
    return TABS.some((t) => t.key === saved) ? saved : "physical";
  });

  useEffect(() => {
    try {
      localStorage.setItem(TAB_KEY, activeTab);
    } catch {
      /* storage unavailable */
    }
  }, [activeTab]);

  return (
    <DashboardLayout userId={userId} userName={userName} onLogout={onLogout}>
      <div className="h-full flex flex-col w-full m-0 p-0">
        <div className="flex-1 overflow-y-auto w-full m-0 p-0 scrollbar-hide">
          {/* ===== Header (same as Dashboard) ===== */}
          <div className="w-full bg-white font-poppins relative">
            <HeaderGlobal userName={userName} />

            <div className="w-full px-4 sm:px-6 mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-lg sm:text-2xl font-medium">Assets</p>
                <p className="text-[10px] sm:text-[13px] text-gray-400 font-light">
                  Manage physical and digital assets in one place
                </p>
              </div>
            </div>

            {/* ===== Tabs (shared TabBar) ===== */}
            <TabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
          </div>

          {/* ===== Tab Panels (same spacing as Dashboard) ===== */}
          <div className="mt-6 flex flex-col gap-6 w-full m-0 p-0 px-4 sm:px-6 font-poppins">
            {activeTab === "physical" && <PhysicalAssetTab />}
            {activeTab === "digital" && <DigitalAssetTab />}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default AssetManager;
