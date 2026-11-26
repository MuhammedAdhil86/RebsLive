import React, { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../ui/pagelayout";
import HeaderGlobal from "../ui/headerglobal";
import avatar from "../assets/img/avatar.svg";
import {
  FiUser,
  FiInfo,
  FiLogOut,
  FiCamera,
  FiCreditCard,
  FiUsers,
  FiClock,
  FiBox,
  FiAlertTriangle,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import {
  getMyPersonalProfile,
  updateMyPersonalProfile,
  updateProfileImage,
} from "../service/employeeService";
import { getSubscriptionDetailsData } from "../service/companyService";
import { showApiError } from "../utils/apiToast";
import SettingsProfile from "../components/settingsprofile";
import LogoutConfirmationModal from "../ui/conformationmodal";
import { useAuthStore } from "../store/authStore";

/* ------------------------------------------------------------------ */
/* Shared style tokens (from UI Guidelines)                            */
/* ------------------------------------------------------------------ */
const BTN_PRIMARY =
  "px-3 sm:px-4 py-3 text-xs rounded-lg bg-black text-white hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed";
const BTN_SECONDARY =
  "px-3 sm:px-4 py-3 text-xs rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed";
const CARD = "bg-white shadow rounded-xl p-4 border border-gray-100";

const Spinner = ({ text }) => (
  <div className="flex flex-col items-center justify-center gap-2 h-[300px]">
    <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-black animate-spin" />
    {text && <p className="text-[12px] text-gray-400">{text}</p>}
  </div>
);

/* ------------------------------------------------------------------ */
/* Subscription helpers                                                */
/* ------------------------------------------------------------------ */
const fmtDate = (k) => {
  if (!k) return "-";
  const [y, m, d] = String(k).split("T")[0].split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const daysBetweenKeys = (a, b) => {
  const [y1, m1, d1] = String(a).split("T")[0].split("-").map(Number);
  const [y2, m2, d2] = String(b).split("T")[0].split("-").map(Number);
  return (
    Math.round(
      (new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000,
    ) + 1
  );
};

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

// "ACTIVE" -> "Active"
const capFirst = (s) =>
  s
    ? String(s).charAt(0).toUpperCase() + String(s).slice(1).toLowerCase()
    : "-";

const SubRow = ({ label, value }) => (
  <div className="flex justify-between gap-4 py-2.5 border-b border-gray-100 last:border-0 text-[12px]">
    <span className="text-gray-600">{label}</span>
    <span className="text-gray-800 text-right">{value}</span>
  </div>
);

const SubCard = ({ title, icon: IconCmp, children }) => (
  <div className={CARD}>
    <div className="flex items-center gap-2 mb-2">
      {IconCmp && (
        <span className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700">
          <IconCmp className="w-4 h-4" />
        </span>
      )}
      <h3 className="text-base font-medium text-gray-800">{title}</h3>
    </div>
    {children}
  </div>
);

// KPI card: pastel background, black icon circle, no hint line
const StatTile = ({ icon: IconCmp, label, value, bg }) => (
  <div
    className="rounded-lg p-3 shadow-sm flex items-center gap-3"
    style={{ backgroundColor: bg }}
  >
    <span className="min-w-10 h-10 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0">
      <IconCmp className="w-5 h-5" />
    </span>
    <div className="min-w-0">
      <p className="text-[10px] sm:text-xs uppercase font-medium text-gray-600">
        {label}
      </p>
      <p className="text-lg sm:text-xl font-medium text-gray-800 truncate">
        {value}
      </p>
    </div>
  </div>
);

// Circular progress ring showing days left
const DaysRing = ({ remaining, percentLeft, color }) => {
  const r = 44;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, percentLeft)) / 100) * c;
  return (
    <div className="relative w-32 h-32 flex-shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl text-white leading-none font-normal">
          {remaining}
        </span>
        <span className="text-[12px] text-white/60 mt-1 font-normal">
          day{remaining !== 1 ? "s" : ""} left
        </span>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* SubscriptionTab: fetches GET /subscription/details when opened      */
/* ------------------------------------------------------------------ */
const SubscriptionTab = () => {
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setFailed(false);
      const data = await getSubscriptionDetailsData();
      setSub(data);
    } catch (err) {
      setFailed(true);
      showApiError(err, "Failed to load subscription details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <Spinner text="Loading subscription details..." />;
  }

  if (failed || !sub) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] gap-3">
        <p className="text-red-500 text-xs">
          Could not load subscription details.
        </p>
        <button type="button" onClick={load} className={BTN_PRIMARY}>
          Try again
        </button>
      </div>
    );
  }

  const isActive = String(sub.status).toUpperCase() === "ACTIVE";
  const remaining = Math.max(Number(sub.days_remaining) || 0, 0);
  const totalPeriodDays =
    sub.start_date && sub.end_date
      ? daysBetweenKeys(sub.start_date, sub.end_date)
      : 0;
  const percentLeft =
    totalPeriodDays > 0 ? (remaining / totalPeriodDays) * 100 : 0;
  const expiringSoon = !sub.is_expired && remaining <= 7;

  const includedUsers = Number(sub.included_users) || 0;
  const additionalUsers = Number(sub.additional_users) || 0;
  const totalUsers =
    Number(sub.total_user_limit) || includedUsers + additionalUsers;
  const includedPct = totalUsers ? (includedUsers / totalUsers) * 100 : 0;
  const additionalPct = totalUsers ? (additionalUsers / totalUsers) * 100 : 0;

  const totalAmount =
    Number(sub.base_amount || 0) + Number(sub.additional_users_amount || 0);
  const period = String(sub.billing_period || "period").toLowerCase();

  const statusLabel = sub.is_expired ? "Expired" : capFirst(sub.status);
  const statusStyle = sub.is_expired
    ? { pill: "bg-red-400/15 text-red-300", dot: "bg-red-400" }
    : isActive
      ? { pill: "bg-emerald-400/15 text-emerald-300", dot: "bg-emerald-400" }
      : { pill: "bg-amber-400/15 text-amber-300", dot: "bg-amber-400" };

  const ringColor = sub.is_expired
    ? "#f87171"
    : expiringSoon
      ? "#fbbf24"
      : "#34d399";

  return (
    <div className="flex flex-col gap-6">
      {/* ---------- HERO ---------- */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white p-6 sm:p-7">
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-white/5" />
        <div className="absolute -right-6 -bottom-24 w-52 h-52 rounded-full bg-white/5" />

        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] ${statusStyle.pill}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot} ${
                    isActive && !sub.is_expired ? "animate-pulse" : ""
                  }`}
                />
                {statusLabel}
              </span>
              {sub.is_trial && (
                <span className="px-3 py-1 rounded-full text-[12px] bg-sky-400/15 text-sky-300">
                  Trial
                </span>
              )}
              <span className="px-3 py-1 rounded-full text-[12px] bg-white/10 text-white/80">
                {sub.billing_period}
              </span>
            </div>

            <h2 className="text-lg sm:text-2xl font-medium truncate">
              {sub.plan_name}
            </h2>
            <p className="text-[12px] text-white/60 mt-0.5">
              {sub.company_name}
            </p>

            <div className="flex flex-wrap items-center gap-2 mt-4 text-[12px]">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white/80">
                <Icon icon="solar:calendar-outline" className="w-4 h-4" />{" "}
                {fmtDate(sub.start_date)}
              </span>
              <span className="text-white/40">to</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white/80">
                <Icon icon="solar:calendar-outline" className="w-4 h-4" />{" "}
                {fmtDate(sub.end_date)}
              </span>
            </div>
          </div>

          <DaysRing
            remaining={remaining}
            percentLeft={percentLeft}
            color={ringColor}
          />
        </div>
      </div>

      {/* ---------- EXPIRY BANNER ---------- */}
      {(sub.is_expired || expiringSoon) && (
        <div
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-[12px] ${
            sub.is_expired
              ? "bg-red-50 border-red-100 text-red-600"
              : "bg-amber-50 border-amber-100 text-amber-700"
          }`}
        >
          <FiAlertTriangle className="mt-0.5 flex-shrink-0 w-4 h-4" />
          <span>
            {sub.expiry_message ||
              (sub.is_expired
                ? "Your subscription has expired."
                : "Your subscription is about to expire.")}
          </span>
        </div>
      )}

      {/* ---------- STAT TILES (KPI cards) ---------- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile
          icon={FiBox}
          label="Service"
          value={String(sub.service || "-").toUpperCase()}
          bg="#E8EFF9"
        />
        <StatTile
          icon={FiUsers}
          label="User limit"
          value={`${totalUsers} users`}
          bg="#EBFDEF"
        />
        <StatTile
          icon={FiCreditCard}
          label={`Per ${period}`}
          value={money(totalAmount)}
          bg="#FFEFE7"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ---------- PLAN ---------- */}
        <SubCard title="Plan details" icon={FiClock}>
          <SubRow label="Billing period" value={sub.billing_period || "-"} />
          <SubRow
            label="Included services"
            value={
              Array.isArray(sub.plan_services) && sub.plan_services.length
                ? sub.plan_services
                    .map((s) => String(s).toUpperCase())
                    .join(", ")
                : "-"
            }
          />
          <SubRow label="Start date" value={fmtDate(sub.start_date)} />
          <SubRow label="Base end date" value={fmtDate(sub.base_end_date)} />
          {Number(sub.extension_days) > 0 && (
            <SubRow
              label="Extension"
              value={
                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-600 text-[12px]">
                  +{sub.extension_days} days
                </span>
              }
            />
          )}
          <SubRow label="End date" value={fmtDate(sub.end_date)} />
        </SubCard>

        {/* ---------- USERS ---------- */}
        <SubCard title="User seats" icon={FiUsers}>
          <div className="flex items-end justify-between mb-3">
            <p className="text-3xl text-gray-800 font-normal leading-none">
              {totalUsers}
              <span className="text-[12px] text-gray-400 ml-1">
                total seats
              </span>
            </p>
          </div>

          <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden flex">
            <div
              className="h-full bg-black transition-all duration-500"
              style={{ width: `${includedPct}%` }}
            />
            <div
              className="h-full bg-gray-400 transition-all duration-500"
              style={{ width: `${additionalPct}%` }}
            />
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-[12px] text-gray-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-black" />
              Included: {includedUsers}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              Additional: {additionalUsers}
            </span>
          </div>

          <div className="mt-3">
            <SubRow
              label="Price per additional user"
              value={money(sub.additional_user_price)}
            />
          </div>
        </SubCard>
      </div>

      {/* ---------- BILLING ---------- */}
      <SubCard title="Billing summary" icon={FiCreditCard}>
        <SubRow label="Base amount" value={money(sub.base_amount)} />
        <SubRow
          label={`Additional users (${additionalUsers} x ${money(sub.additional_user_price)})`}
          value={money(sub.additional_users_amount)}
        />

        <div className="flex items-center justify-between mt-3 rounded-lg bg-gray-900 text-white px-4 py-3">
          <span className="text-[12px] text-white/80">Total / {period}</span>
          <span className="text-xl font-normal">{money(totalAmount)}</span>
        </div>
      </SubCard>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Settings page                                                       */
/* ------------------------------------------------------------------ */
function Settings() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem("settings_active_tab");
    return saved && saved !== "password" ? saved : "personal";
  });

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  // Avatar Image Upload States
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    jobTitle: "",
    company: "",
    phone: "",
    image: "",
    uan: "",
    aadhar: "",
    pan: "",
    epfNumber: "",
    esiNumber: "",
    dateOfBirth: "",
    maritalStatus: "",
    presentAddress: "",
    permanentAddress: "",
    bloodGroup: "",
  });

  useEffect(() => {
    localStorage.setItem("settings_active_tab", activeTab);
  }, [activeTab]);

  // Close delete modal on Escape
  useEffect(() => {
    if (!showDeleteConfirm) return;
    const onKey = (e) => {
      if (e.key === "Escape") setShowDeleteConfirm(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showDeleteConfirm]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await getMyPersonalProfile();
      const data = response.data || response;

      if (data) {
        setUserId(data._id || data.id);
        setFormData({
          firstName: data.first_name || "",
          lastName: data.last_name || "",
          email: data.email || "",
          jobTitle: data.job_title || data.designation || "",
          company: data.company || "",
          phone: data.phone_number || data.ph_no || "",
          image: data.image || "",
          uan: data.uan || "",
          aadhar: data.aadhar || "",
          pan: data.pan || "",
          epfNumber: data.epf_number || "",
          esiNumber: data.esi_number || "",
          dateOfBirth: data.date_of_birth
            ? data.date_of_birth.split("T")[0]
            : "",
          maritalStatus: data.marital_status || "",
          presentAddress: data.present_address || "",
          permanentAddress:
            data.permanant_address || data.permanent_address || "",
          bloodGroup: data.blood_group || "",
        });
      }
    } catch (error) {
      console.error("Error fetching personal profile:", error);
      toast.error("Failed to load profile data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // --- PROFILE IMAGE HANDLERS ---
  const handleAvatarClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleImageUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploadingImage(true);
      const res = await updateProfileImage(selectedFile);
      const newImageUrl = res?.data?.image || res?.image || res?.url;

      if (newImageUrl) {
        setFormData((prev) => ({
          ...prev,
          image: newImageUrl,
        }));
      } else {
        await fetchProfile();
      }

      toast.success("Profile photo updated successfully");
    } catch (error) {
      toast.error(error.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
      setSelectedFile(null);
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleCancelImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // --- PERSONAL PROFILE UPDATE HANDLER ---
  const handleUpdate = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    const rawPayload = {
      first_name: formData.firstName.trim(),
      last_name: formData.lastName.trim(),
      email: formData.email.trim(),
      phone_number: formData.phone.trim(),
      uan: formData.uan.trim(),
      aadhar: formData.aadhar.trim(),
      pan: formData.pan.trim(),
      epf_number: formData.epfNumber.trim(),
      esi_number: formData.esiNumber.trim(),
      date_of_birth: formData.dateOfBirth
        ? `${formData.dateOfBirth}T00:00:00Z`
        : null,
      marital_status: formData.maritalStatus.trim(),
      present_address: formData.presentAddress.trim(),
      permanant_address: formData.permanentAddress.trim(),
      blood_group: formData.bloodGroup.trim(),
    };

    const payload = {};
    Object.keys(rawPayload).forEach((key) => {
      if (rawPayload[key] !== "" && rawPayload[key] !== null) {
        payload[key] = rawPayload[key];
      }
    });

    try {
      const res = await updateMyPersonalProfile(payload);
      const updatedData = res?.data || res;

      setFormData((prev) => ({
        ...prev,
        firstName: updatedData.first_name || prev.firstName,
        lastName: updatedData.last_name || prev.lastName,
        email: updatedData.email || prev.email,
        phone: updatedData.phone_number || prev.phone,
        uan: updatedData.uan || prev.uan,
        aadhar: updatedData.aadhar || prev.aadhar,
        pan: updatedData.pan || prev.pan,
        epfNumber: updatedData.epf_number || prev.epfNumber,
        esiNumber: updatedData.esi_number || prev.esiNumber,
        dateOfBirth: updatedData.date_of_birth
          ? updatedData.date_of_birth.split("T")[0]
          : prev.dateOfBirth,
        maritalStatus: updatedData.marital_status || prev.maritalStatus,
        presentAddress: updatedData.present_address || prev.presentAddress,
        permanentAddress:
          updatedData.permanant_address ||
          updatedData.permanent_address ||
          prev.permanentAddress,
        bloodGroup: updatedData.blood_group || prev.bloodGroup,
      }));

      toast.success(res?.message || "Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      const errorMsg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Failed to update profile";
      toast.error(errorMsg);
      throw error;
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // --- LOGOUT / DELETE HANDLERS ---
  const handleLogoutConfirm = () => {
    setShowLogoutModal(false);
    logout();
    navigate("/", { replace: true });
  };

  const handleDeleteAccount = async () => {
    try {
      if (!userId) throw new Error("User ID not found");

      const res = await fetch(
        `${import.meta.env.VITE_API}/delete-user/${userId}`,
        { method: "DELETE" },
      );

      if (!res.ok) throw new Error("Failed to delete account");

      toast.success("Account deleted successfully");

      logout();
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err.message || "Something went wrong");
    }
  };

  const fullName =
    `${formData.firstName} ${formData.lastName}`.trim() || "User";
  const displayAvatar = imagePreview || formData.image || avatar;

  const navBtn = (active) =>
    `w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs transition ${
      active ? "bg-black text-white" : "text-gray-700 hover:bg-gray-50"
    }`;

  return (
    <DashboardLayout
      userName={fullName}
      onLogout={() => setShowLogoutModal(true)}
    >
      <div className="font-poppins w-full px-4 sm:px-6 bg-gray-50">
        <HeaderGlobal
          userName={fullName}
          userImage={formData.image || avatar}
        />

        {/* Page title + subtitle */}
        <div className="mt-6">
          <h1 className="text-lg sm:text-2xl font-medium text-gray-800">
            Settings
          </h1>
          <p className="text-[10px] sm:text-[13px] text-gray-400 font-light">
            Manage your profile, subscription and account
          </p>
        </div>

        {/* Content */}
        <div className="mt-6 flex flex-col gap-6">
          {loading ? (
            <div className={CARD}>
              <Spinner text="Loading profile settings..." />
            </div>
          ) : (
            <div className="flex flex-col md:flex-row gap-4">
              {/* LEFT NAVIGATION MENU */}
              <div
                className={`w-full md:w-72 ${CARD} flex flex-col items-center self-start`}
              >
                {/* AVATAR WITH HOVER OVERLAY */}
                <div
                  onClick={handleAvatarClick}
                  className="relative w-24 h-24 rounded-full overflow-hidden mb-3 border border-gray-100 group cursor-pointer"
                >
                  <img
                    src={displayAvatar}
                    alt="User Avatar"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center text-white text-xs">
                    <FiCamera className="w-4 h-4 mb-0.5" />
                    <span>Change</span>
                  </div>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />

                {/* INLINE IMAGE UPDATE & CANCEL BUTTONS */}
                {selectedFile && (
                  <div className="flex items-center gap-2 mb-4">
                    <button
                      type="button"
                      onClick={handleImageUpload}
                      disabled={uploadingImage}
                      className={BTN_PRIMARY}
                    >
                      {uploadingImage ? "Updating..." : "Update Image"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelImage}
                      disabled={uploadingImage}
                      className={BTN_SECONDARY}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                <h2 className="text-base font-medium text-gray-800 text-center">
                  {fullName}
                </h2>
                <p className="text-[12px] text-gray-600 mb-6 text-center break-all">
                  {formData.email}
                </p>

                <div className="w-full space-y-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("personal")}
                    className={navBtn(activeTab === "personal")}
                  >
                    <FiUser className="w-4 h-4" /> Personal Info
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("subscription")}
                    className={navBtn(activeTab === "subscription")}
                  >
                    <FiCreditCard className="w-4 h-4" /> Subscription
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("about")}
                    className={navBtn(activeTab === "about")}
                  >
                    <FiInfo className="w-4 h-4" /> About Us
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("delete")}
                    className={navBtn(activeTab === "delete")}
                  >
                    <FiTrash2 className="w-4 h-4" /> Delete Account
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowLogoutModal(true)}
                    className={navBtn(false)}
                  >
                    <FiLogOut className="w-4 h-4" /> Logout
                  </button>
                </div>
              </div>

              {/* RIGHT CONTENT TAB PANELS */}
              <div className={`flex-1 min-w-0 ${CARD} p-4 sm:p-6`}>
                {activeTab === "personal" && (
                  <SettingsProfile
                    formData={formData}
                    handleChange={handleChange}
                    handleUpdate={handleUpdate}
                  />
                )}

                {activeTab === "subscription" && <SubscriptionTab />}

                {activeTab === "about" && (
                  <div>
                    <h2 className="text-base font-medium text-gray-800 mb-2">
                      About Us
                    </h2>
                    <p className="text-[12px] text-gray-600">
                      REBS HR System is a comprehensive employee management
                      platform built for efficiency and user-friendliness.
                    </p>
                  </div>
                )}

                {activeTab === "delete" && (
                  <div>
                    <h2 className="text-base font-medium text-gray-800 mb-2">
                      Delete Account
                    </h2>
                    <p className="text-[12px] text-gray-600 mb-6">
                      This action is permanent. All your data will be deleted
                      and cannot be recovered.
                    </p>

                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className={BTN_PRIMARY}
                    >
                      Delete My Account
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DELETE CONFIRM MODAL: closes on outside click, Escape and X */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-50 px-4"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-white rounded-xl p-6 w-full max-w-sm shadow-lg border border-gray-100 font-poppins"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-base font-medium text-gray-800">
                Confirm Delete
              </h3>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="text-gray-400 hover:text-gray-800"
                aria-label="Close"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[12px] text-gray-600 mb-6">
              Are you sure you want to delete your account? This action cannot
              be undone.
            </p>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className={`${BTN_SECONDARY} w-full sm:w-auto`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                className={`${BTN_PRIMARY} w-full sm:w-auto`}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REUSABLE LOGOUT CONFIRMATION MODAL */}
      <LogoutConfirmationModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogoutConfirm}
      />
    </DashboardLayout>
  );
}

export default Settings;
