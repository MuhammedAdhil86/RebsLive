import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Toaster } from "react-hot-toast";
import { ToastContainer } from "react-toastify"; // for LeaveRequestes toasts (remove if DashboardLayout already has one)
import DashboardLayout from "../ui/pagelayout";
import HeaderGlobal from "../ui/headerglobal";
import TabBar from "../ui/tab/tab_bar";
import WfhTab from "../components/requests_tab/wtf_tab";
import RegularizationTab from "../components/requests_tab/regularization_tab";
import DeviceRequestTab from "../components/requests_tab/device_tab";
import ClaimsRequestTab from "../components/requests_tab/claims_tab";
import InsuranceClaimTab from "../components/requests_tab/insuranceclaim";
import AdvanceSalaryReqTab from "../components/requests_tab/AdvanceSalaryReqTab";
import ShiftSwapTab from "../components/requests_tab/shift_swap_tab";
import LeaveRequestes from "../components/tables/leaverequests";
import DeviceApprovalModal from "../ui/devicestatusmodal";
import InsuranceApprovalModal from "../ui/insurancestatusmodal";

// Tabs shown in the header, in order.
const TABS = [
  { key: "wfh", label: "Work From Home" },
  { key: "leave", label: "Leave Requests" },
  { key: "regularization", label: "Regularization" },
  { key: "device", label: "Change Device" },
  { key: "claims", label: "Expense Claim" },
  { key: "insurance", label: "Insurance Claim" },
  { key: "advance", label: "Advance Salary" },
  { key: "shiftswap", label: "Shift Swap" },
];

function Requests() {
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem("requests_active_tab");
    // Ignore an old/unknown saved tab so the page never opens blank.
    return TABS.some((t) => t.key === saved) ? saved : "wfh";
  });

  const [selectedDeviceRow, setSelectedDeviceRow] = useState(null);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);

  const [selectedInsuranceRow, setSelectedInsuranceRow] = useState(null);
  const [isInsuranceModalOpen, setIsInsuranceModalOpen] = useState(false);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    localStorage.setItem("requests_active_tab", activeTab);
  }, [activeTab]);

  const handleDeviceRowClick = (rowData) => {
    setSelectedDeviceRow(rowData);
    setIsDeviceModalOpen(true);
  };

  const handleInsuranceRowClick = (rowData) => {
    setSelectedInsuranceRow(rowData);
    setIsInsuranceModalOpen(true);
  };

  const handleSuccessReload = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <DashboardLayout userName="Admin" onLogout={() => {}}>
      {/* Page-level toasters */}
      <Toaster position="top-right" />
      <ToastContainer position="top-right" />

      <div className="h-full flex flex-col w-full m-0 p-0">
        <div className="flex-1 overflow-y-auto w-full m-0 p-0 scrollbar-hide">
          {/* ===== Header (same as Dashboard) ===== */}
          <div className="w-full bg-white font-poppins relative">
            <HeaderGlobal userName="Admin" />

            <div className="w-full sm:px-6 mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-lg sm:text-2xl font-medium">
                  Admin’s Requests
                </p>
                <p className="text-[10px] sm:text-[13px] text-gray-400 font-light">
                  Review and manage all employee requests here
                </p>
              </div>
            </div>

            {/* ===== Tabs (same TabBar as Dashboard) ===== */}
            <TabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
          </div>

          {/* ===== Tab Panels (same spacing as Dashboard) ===== */}
          <div className="mt-6 flex flex-col gap-6 w-full m-0 p-0">
            {activeTab === "wfh" && <WfhTab />}
            {activeTab === "leave" && <LeaveRequestes />}
            {activeTab === "regularization" && <RegularizationTab />}
            {activeTab === "device" && (
              <DeviceRequestTab
                key={`device-${refreshTrigger}`}
                onRowClick={handleDeviceRowClick}
              />
            )}
            {activeTab === "claims" && <ClaimsRequestTab />}
            {activeTab === "insurance" && (
              <InsuranceClaimTab
                key={`insurance-${refreshTrigger}`}
                onRowClick={handleInsuranceRowClick}
              />
            )}
            {activeTab === "advance" && <AdvanceSalaryReqTab />}
            {activeTab === "shiftswap" && <ShiftSwapTab />}
          </div>
        </div>
      </div>

      {/* Same hidden-scrollbar helper the Dashboard uses.
          Move this to index.css once and delete it from both pages. */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Device Review Modal */}
      {isDeviceModalOpen &&
        selectedDeviceRow &&
        createPortal(
          <DeviceApprovalModal
            open={isDeviceModalOpen}
            data={selectedDeviceRow}
            onClose={() => {
              setIsDeviceModalOpen(false);
              setSelectedDeviceRow(null);
            }}
            onSuccess={handleSuccessReload}
            onOptimisticUpdate={(id, nextStatus) => {
              console.log(
                `Optimistic update targeted toward request #${id} changing to status: ${nextStatus}`,
              );
            }}
          />,
          document.body,
        )}

      {/* Insurance Review Modal */}
      {isInsuranceModalOpen &&
        selectedInsuranceRow &&
        createPortal(
          <InsuranceApprovalModal
            open={isInsuranceModalOpen}
            data={selectedInsuranceRow}
            onClose={() => {
              setIsInsuranceModalOpen(false);
              setSelectedInsuranceRow(null);
            }}
            onSuccess={handleSuccessReload}
            onOptimisticUpdate={(id, nextStatus) => {
              console.log(
                `Optimistic update targeted toward insurance claim #${id} changing to status: ${nextStatus}`,
              );
            }}
          />,
          document.body,
        )}
    </DashboardLayout>
  );
}

export default Requests;
