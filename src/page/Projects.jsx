import React, { useState, useEffect } from "react";
import DashboardLayout from "../ui/pagelayout";
import HeaderGlobal from "../ui/headerglobal";
import TabBar from "../ui/tab/tab_bar"; // shared tab bar
import OverviewView from "../components/team/OverviewView";
import ProjectsView from "../components/team/ProjectsView";
import Timelog from "../components/team/TimeLog";

// TabBar reads `key` and `label`, so use `key` instead of `id`
const TABS = [
  {
    key: "overview",
    label: "Overview",
    title: "Projects Overview",
    subtitle: "Tasks, team members and workload across all projects",
  },
  {
    key: "projects",
    label: "Projects",
    title: "Projects",
    subtitle: "Task status by project, employee and period",
  },
  {
    key: "timelog",
    label: "Timelog",
    title: "Timelog",
    subtitle: "Time logged by employees, projects and days",
  },
];

const TAB_KEY = "team_active_tab";

function Projects({ userId, userName, onLogout }) {
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem(TAB_KEY);
    return TABS.some((t) => t.key === saved) ? saved : "overview";
  });

  useEffect(() => {
    localStorage.setItem(TAB_KEY, activeTab);
  }, [activeTab]);

  const activeTabInfo = TABS.find((t) => t.key === activeTab);

  return (
    <DashboardLayout userId={userId} userName={userName} onLogout={onLogout}>
      <div className="h-full flex flex-col w-full m-0 p-0">
        <div className="flex-1 overflow-y-auto w-full m-0 p-0 scrollbar-hide">
          {/* Header: same block as Dashboard / Requests */}
          <div className="w-full bg-white font-poppins relative">
            <HeaderGlobal userName={userName} />

            <div className="w-full px-4 sm:px-6 mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-lg sm:text-2xl font-medium">
                  {activeTabInfo?.title}
                </p>
                <p className="text-[10px] sm:text-[13px] text-gray-400 font-light">
                  {activeTabInfo?.subtitle}
                </p>
              </div>
            </div>

            <TabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
          </div>

          {/* Tab panels: same spacing as Dashboard */}
          <div className="mt-6 flex flex-col gap-6 w-full m-0 p-0 px-4 sm:px-6">
            {activeTab === "overview" && <OverviewView />}
            {activeTab === "projects" && <ProjectsView />}
            {activeTab === "timelog" && <Timelog />}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default Projects;
