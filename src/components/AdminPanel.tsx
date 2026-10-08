import React, { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  LayoutDashboard,
  Users,
  UploadCloud,
  History,
  FileSpreadsheet,
  Settings as SettingsIcon,
  LogOut,
  Plus,
  Edit2,
  Trash2,
  Eye,
  X,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileText,
  Check,
  Lock,
  Clock,
  ArrowRight,
  Loader2,
  AlertCircle,
  TrendingUp,
  BarChart3,
  EyeOff,
  User,
  Search,
  BookOpen,
  Calendar,
  Menu
} from "lucide-react";
import { Student, ImportRecord, ActivityLog, SystemSettings } from "../types.ts";
import AnalyticsPanel from "./AnalyticsPanel.tsx";

interface AdminPanelProps {
  token: string;
  onLogout: () => void;
  collegeName: string;
  departmentName: string;
  setCollegeName: (name: string) => void;
  setDepartmentName: (name: string) => void;
  maintenanceMode: boolean;
  setMaintenanceMode: (mode: boolean) => void;
  setMaintenanceMessage: (msg: string) => void;
}

export default function AdminPanel({
  token,
  onLogout,
  collegeName,
  departmentName,
  setCollegeName,
  setDepartmentName,
  maintenanceMode,
  setMaintenanceMode,
  setMaintenanceMessage
}: AdminPanelProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"dashboard" | "students" | "upload" | "history" | "logs" | "settings" | "analytics">("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Prevent background scrolling when mobile sidebar/drawer is active
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  // Dashboard Stats States
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Student CRUD States
  const [studentsList, setStudentsList] = useState<Student[]>([]);
  const [studentsTotal, setStudentsTotal] = useState(0);
  const [studentsPage, setStudentsPage] = useState(1);
  const [studentsLimit] = useState(15);
  const [studentsSearch, setStudentsSearch] = useState("");
  const [studentsGenderFilter, setStudentsGenderFilter] = useState("");
  const [studentsCategoryFilter, setStudentsCategoryFilter] = useState("");
  const [studentsProgrammeFilter, setStudentsProgrammeFilter] = useState("");
  const [studentsMajorFilter, setStudentsMajorFilter] = useState("");
  const [studentsMinorFilter, setStudentsMinorFilter] = useState("");
  const [studentsAdmissionCategoryFilter, setStudentsAdmissionCategoryFilter] = useState("");
  const [studentsStatusFilter, setStudentsStatusFilter] = useState("");
  const [studentsLoading, setStudentsLoading] = useState(false);

  const [filterOptions, setFilterOptions] = useState<{
    programmes: string[];
    majors: string[];
    minors: string[];
    categories: string[];
    admissionCategories: string[];
    statuses: string[];
  }>({
    programmes: [],
    majors: [],
    minors: [],
    categories: [],
    admissionCategories: [],
    statuses: []
  });
  const [studentModalMode, setStudentModalMode] = useState<"add" | "edit" | "view" | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Semester & Batch filters and options
  const [studentsSemesterFilter, setStudentsSemesterFilter] = useState("");
  const [studentsBatchFilter, setStudentsBatchFilter] = useState("");
  const [batchesList, setBatchesList] = useState<{ id: number; name: string }[]>([]);
  const [newBatchName, setNewBatchName] = useState("");
  const [addingBatch, setAddingBatch] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  // Student Form State
  const [studentForm, setStudentForm] = useState<Partial<Student>>({
    name: "",
    formNumber: "",
    registrationId: "",
    rollNumber: "",
    enrollmentNumber: "",
    semester: "1st Semester",
    batch: "",
    programmeName: "BACHELOR OF COMPUTER APPLICATIONS(COMPUTER APPLICATION)",
    transactionMode: "CASH",
    admissionCategory: "GENERAL",
    majorSubject: "",
    minorSubject: "",
    gender: "MALE",
    category: "GENERAL",
    email: "",
    mobile: "",
    status: "Active"
  });
  const [studentFormError, setStudentFormError] = useState<string | null>(null);
  const [studentFormSaving, setStudentFormSaving] = useState(false);

  // PDF Upload states
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<string>("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadPreview, setUploadPreview] = useState<any>(null);
  const [previewActiveTab, setPreviewActiveTab] = useState<"new" | "updated" | "duplicate" | "invalid">("new");
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<string | null>(null);

  // Lists view states
  const [importHistory, setImportHistory] = useState<ImportRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activityLogsList, setActivityLogsList] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Settings State
  const [settingsForm, setSettingsForm] = useState<SystemSettings>({
    collegeName: "",
    departmentName: "",
    publicSearchEnabled: true,
    emailVisibleToPublic: false,
    mobileVisibleToPublic: false,
    enablePrivateFields: true,
    timezone: "Asia/Kolkata",
    maintenanceMode: false,
    maintenanceMessage: ""
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBatches = () => {
    fetch("/api/admin/batches", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setBatchesList(data);
        }
      })
      .catch((err) => console.error("Failed to load batches list:", err));
  };

  // Fetch stats on tab load
  useEffect(() => {
    fetchBatches();
    if (activeTab === "dashboard") {
      fetchDashboardStats();
    } else if (activeTab === "students") {
      fetchStudents();
      fetchFilterOptions();
    } else if (activeTab === "history") {
      fetchImportHistory();
    } else if (activeTab === "logs") {
      fetchActivityLogs();
    } else if (activeTab === "settings") {
      fetchSettings();
    }
  }, [
    activeTab, 
    studentsPage, 
    studentsGenderFilter, 
    studentsCategoryFilter,
    studentsProgrammeFilter,
    studentsMajorFilter,
    studentsMinorFilter,
    studentsAdmissionCategoryFilter,
    studentsStatusFilter,
    studentsSemesterFilter,
    studentsBatchFilter
  ]);

  // Debounced search for students in admin list
  useEffect(() => {
    if (activeTab !== "students") return;
    const delayDebounce = setTimeout(() => {
      setStudentsPage(1);
      fetchStudents();
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [studentsSearch]);

  const fetchDashboardStats = () => {
    setStatsLoading(true);
    fetch("/api/admin/stats", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setStatsLoading(false);
      })
      .catch((err) => {
        console.error("Dashboard stats load error:", err);
        setStatsLoading(false);
      });
  };

  const fetchFilterOptions = () => {
    fetch("/api/admin/filter-options", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          setFilterOptions({
            programmes: data.programmes || [],
            majors: data.majors || [],
            minors: data.minors || [],
            categories: data.categories || [],
            admissionCategories: data.admissionCategories || [],
            statuses: data.statuses || []
          });
        }
      })
      .catch((err) => console.error("Failed to load dynamic filter selections:", err));
  };

  const fetchStudents = () => {
    setStudentsLoading(true);
    const searchParam = encodeURIComponent(studentsSearch);
    const progParam = encodeURIComponent(studentsProgrammeFilter);
    const majorParam = encodeURIComponent(studentsMajorFilter);
    const minorParam = encodeURIComponent(studentsMinorFilter);
    const admCatParam = encodeURIComponent(studentsAdmissionCategoryFilter);
    const statusParam = encodeURIComponent(studentsStatusFilter);
    const semesterParam = encodeURIComponent(studentsSemesterFilter);
    const batchParam = encodeURIComponent(studentsBatchFilter);

    fetch(`/api/admin/students?search=${searchParam}&gender=${studentsGenderFilter}&category=${studentsCategoryFilter}&programme=${progParam}&major=${majorParam}&minor=${minorParam}&admissionCategory=${admCatParam}&status=${statusParam}&semester=${semesterParam}&batch=${batchParam}&page=${studentsPage}&limit=${studentsLimit}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        setStudentsList(data.students || []);
        setStudentsTotal(data.total || 0);
        setStudentsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load students list:", err);
        setStudentsLoading(false);
      });
  };

  const fetchImportHistory = () => {
    setHistoryLoading(true);
    fetch("/api/admin/imports", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        setImportHistory(data);
        setHistoryLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load import history:", err);
        setHistoryLoading(false);
      });
  };

  const fetchActivityLogs = () => {
    setLogsLoading(true);
    fetch("/api/admin/logs", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        setActivityLogsList(data);
        setLogsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load activity logs:", err);
        setLogsLoading(false);
      });
  };

  const fetchSettings = () => {
    setSettingsLoading(true);
    fetch("/api/admin/settings", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        setSettingsForm({
          collegeName: data.collegeName,
          departmentName: data.departmentName,
          publicSearchEnabled: data.publicSearchEnabled,
          emailVisibleToPublic: data.emailVisibleToPublic,
          mobileVisibleToPublic: data.mobileVisibleToPublic,
          enablePrivateFields: data.enablePrivateFields,
          timezone: data.timezone,
          maintenanceMode: data.maintenanceMode,
          maintenanceMessage: data.maintenanceMessage || ""
        });
        setSettingsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch admin settings:", err);
        setSettingsLoading(false);
      });
  };

  // Student CRUD handlers
  const handleOpenStudentModal = (mode: "add" | "edit" | "view", student?: Student) => {
    setStudentModalMode(mode);
    setStudentFormError(null);
    if (student) {
      setSelectedStudent(student);
      setStudentForm({ ...student });
    } else {
      setSelectedStudent(null);
      setStudentForm({
        name: "",
        formNumber: "",
        registrationId: "",
        rollNumber: "",
        enrollmentNumber: "",
        semester: "1st Semester",
        batch: batchesList[0]?.name || "2026–2029",
        programmeName: "BACHELOR OF COMPUTER APPLICATIONS(COMPUTER APPLICATION)",
        transactionMode: "CASH",
        admissionCategory: "GENERAL",
        majorSubject: "Computer Application",
        minorSubject: "Mathematics",
        gender: "MALE",
        category: "GENERAL",
        email: "",
        mobile: "",
        status: "Active"
      });
    }
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentFormSaving(true);
    setStudentFormError(null);

    const method = studentModalMode === "edit" ? "PUT" : "POST";
    const url = studentModalMode === "edit" ? `/api/admin/students/${selectedStudent?.id}` : "/api/admin/students";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(studentForm)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save student record");
      }

      setStudentModalMode(null);
      fetchStudents();
    } catch (err: any) {
      console.error("Save student error:", err);
      setStudentFormError(err.message || "Unable to save student.");
    } finally {
      setStudentFormSaving(false);
    }
  };

  const handleDeleteStudent = async (id: number) => {
    if (!window.confirm("Are you absolutely sure you want to permanently delete this student record? This cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/students/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete record");
      }

      fetchStudents();
    } catch (err: any) {
      alert(err.message || "Error deleting student");
    }
  };

  // PDF Upload Handlers
  const handlePdfUploadSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPdfFile(e.target.files[0]);
      setUploadError(null);
      setUploadPreview(null);
      setCommitResult(null);
    }
  };

  const handleUploadSubmit = async () => {
    if (!pdfFile) return;

    setUploading(true);
    setUploadError(null);
    setUploadPreview(null);
    setCommitResult(null);
    setUploadStep("Uploading PDF...");

    // Setup sequence for progress steps
    const steps = [
      { text: "Reading PDF...", delay: 1000 },
      { text: "Extracting student records...", delay: 2500 },
      { text: "Validating records...", delay: 4500 },
      { text: "Preparing import...", delay: 6000 },
    ];

    const timers = steps.map(step => {
      return setTimeout(() => {
        setUploadStep(step.text);
      }, step.delay);
    });

    const formData = new FormData();
    formData.append("pdf", pdfFile);

    try {
      const res = await fetch("/api/admin/import/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      // Clear scheduled step timers
      timers.forEach(t => clearTimeout(t));

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "An error occurred while uploading and analyzing the PDF.");
      }

      setUploadPreview(data);
      // Determine default active tab in preview
      if (data.newCount > 0) setPreviewActiveTab("new");
      else if (data.updatedCount > 0) setPreviewActiveTab("updated");
      else if (data.duplicateCount > 0) setPreviewActiveTab("duplicate");
      else setPreviewActiveTab("invalid");

    } catch (err: any) {
      timers.forEach(t => clearTimeout(t));
      console.error("Upload handler error:", err);
      setUploadError(err.message || "Failed to process PDF.");
    } finally {
      setUploading(false);
      setUploadStep("");
    }
  };

  const handleConfirmImport = async () => {
    if (!uploadPreview) return;

    setCommitting(true);
    setUploadError(null);

    try {
      const res = await fetch("/api/admin/import/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          fileName: uploadPreview.fileName,
          preview: uploadPreview.preview
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to finalize import transaction");
      }

      setCommitResult(data.message);
      setUploadPreview(null);
      setPdfFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      
      // Refresh all state immediately to reflect newly imported students without manual reloading
      fetchStudents();
      fetchDashboardStats();
      fetchImportHistory();
      fetchActivityLogs();
      fetchFilterOptions();
      fetchBatches();
    } catch (err: any) {
      console.error("Confirm commit error:", err);
      setUploadError(err.message || "An error occurred committing imports.");
    } finally {
      setCommitting(false);
    }
  };

  const handleCancelImport = () => {
    setPdfFile(null);
    setUploadPreview(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Settings handlers
  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsMessage(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(settingsForm)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save settings");
      }

      setSettingsMessage("Settings successfully saved!");
      setCollegeName(settingsForm.collegeName);
      setDepartmentName(settingsForm.departmentName);
      setMaintenanceMode(settingsForm.maintenanceMode);
      setMaintenanceMessage(settingsForm.maintenanceMessage || "");
    } catch (err: any) {
      alert(err.message || "Error saving settings");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    setPasswordSaving(true);

    try {
      const res = await fetch("/api/admin/settings/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(passwordForm)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to change admin password");
      }

      setPasswordSuccess("Admin password successfully updated!");
      setPasswordForm({ currentPassword: "", newPassword: "" });
    } catch (err: any) {
      console.error("Change password error:", err);
      setPasswordError(err.message || "Failed to update password");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleTabChange = (tab: "dashboard" | "students" | "upload" | "history" | "logs" | "settings" | "analytics") => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  const handleAdminLogout = () => {
    fetch("/api/admin/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    }).finally(() => {
      onLogout();
    });
  };

  return (
    <div className="bg-neutral-50 min-h-screen flex text-neutral-800 relative overflow-x-hidden" id="admin-panel-container">
      
      {/* Mobile Drawer Overlay Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-neutral-900/60 z-45 lg:hidden transition-opacity duration-300" 
          onClick={() => setSidebarOpen(false)}
          id="admin-sidebar-backdrop"
        />
      )}

      {/* SIDEBAR NAVIGATION PANEL (RESPONSIVE DRAWER & FIXED DESKTOP) */}
      <aside 
        className={`fixed inset-y-0 left-0 w-64 bg-neutral-900 text-white flex flex-col justify-between z-50 lg:z-auto lg:static lg:translate-x-0 transition-transform duration-300 ease-in-out shadow-2xl lg:shadow-none border-r border-neutral-800 flex-shrink-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`} 
        id="admin-sidebar"
      >
        <div>
          {/* Header */}
          <div className="p-6 border-b border-neutral-800 flex items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white p-0.5 flex items-center justify-center flex-shrink-0">
                <img 
                  src="/college_logo.jpg" 
                  alt="College Logo" 
                  className="w-full h-full object-contain rounded-full" 
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-xs tracking-wide leading-none text-neutral-200">Pragjyotish College</span>
                <span className="text-[9px] text-neutral-400 font-bold uppercase mt-1">BCA Admin Portal</span>
              </div>
            </div>

            {/* Mobile close button inside sidebar drawer */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
              aria-label="Close sidebar menu"
              id="close-sidebar-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav list */}
          <nav className="p-4 space-y-1.5" id="sidebar-nav">
            <button
              onClick={() => handleTabChange("dashboard")}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "dashboard"
                  ? "bg-blue-600 text-white font-bold shadow-md"
                  : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
              }`}
            >
              <LayoutDashboard className="w-4.5 h-4.5" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => handleTabChange("analytics")}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "analytics"
                  ? "bg-blue-600 text-white font-bold shadow-md"
                  : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
              }`}
            >
              <BarChart3 className="w-4.5 h-4.5" />
              <span>Search Analytics</span>
            </button>

            <button
              onClick={() => handleTabChange("students")}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "students"
                  ? "bg-blue-600 text-white font-bold shadow-md"
                  : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
              }`}
            >
              <Users className="w-4.5 h-4.5" />
              <span>Students</span>
            </button>

            <button
              onClick={() => handleTabChange("upload")}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "upload"
                  ? "bg-blue-600 text-white font-bold shadow-md"
                  : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
              }`}
            >
              <UploadCloud className="w-4.5 h-4.5" />
              <span>Upload PDF</span>
            </button>

            <button
              onClick={() => handleTabChange("history")}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "history"
                  ? "bg-blue-600 text-white font-bold shadow-md"
                  : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
              }`}
            >
              <History className="w-4.5 h-4.5" />
              <span>Import History</span>
            </button>

            <button
              onClick={() => handleTabChange("logs")}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "logs"
                  ? "bg-blue-600 text-white font-bold shadow-md"
                  : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
              }`}
            >
              <FileSpreadsheet className="w-4.5 h-4.5" />
              <span>Activity Log</span>
            </button>

            <button
              onClick={() => handleTabChange("settings")}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "settings"
                  ? "bg-blue-600 text-white font-bold shadow-md"
                  : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
              }`}
            >
              <SettingsIcon className="w-4.5 h-4.5" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Footer logout */}
        <div className="p-4 border-t border-neutral-800">
          <button
            onClick={handleAdminLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer"
            id="sidebar-logout-btn"
          >
            <LogOut className="w-4.5 h-4.5" />
            <span>Sign Out Session</span>
          </button>
        </div>
      </aside>

      {/* CORE WORKSPACE WINDOW */}
      <main className="flex-1 flex flex-col min-w-0" id="admin-workspace">
        
        {/* Top Header */}
        <header className="bg-white border-b border-neutral-100 py-4 flex items-center justify-between px-4 sm:px-8 shadow-sm gap-4 min-h-20" id="workspace-header">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger menu for mobile/tablet */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-neutral-100 text-neutral-600 transition-colors cursor-pointer flex-shrink-0"
              aria-label="Toggle Navigation Sidebar"
              id="mobile-sidebar-toggle"
            >
              <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <div className="flex items-center gap-3 text-left min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0">
                <img 
                  src="/college_logo.jpg" 
                  alt="College Logo" 
                  className="w-full h-full object-contain rounded-full border border-neutral-200" 
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex flex-col min-w-0">
                <h2 className="text-base sm:text-lg font-black text-neutral-900 leading-none uppercase tracking-tight truncate">BCA Admin</h2>
                <div className="text-[10px] sm:text-[11px] font-semibold text-neutral-500 mt-1 flex flex-col leading-tight truncate">
                  <span className="font-extrabold text-neutral-700 truncate">Pragjyotish College</span>
                  <span className="hidden xs:inline truncate">Bachelor of Computer Applications</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3.5 flex-shrink-0">
            {/* Live System Status Badge */}
            <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-black uppercase tracking-wider shadow-sm select-none transition-all duration-300 ${
              maintenanceMode 
                ? "bg-amber-50 text-amber-700 border-amber-200/80 animate-pulse" 
                : "bg-emerald-50 text-emerald-700 border-emerald-200/80"
            }`}>
              <span className={`w-2 h-2 rounded-full block ${
                maintenanceMode ? "bg-amber-500 animate-ping" : "bg-emerald-500"
              }`} />
              <span>{maintenanceMode ? "System Under Maintenance" : "System Live & Active"}</span>
            </div>

            <span className="text-[10px] sm:text-xs font-bold text-neutral-500 bg-neutral-100 px-2.5 sm:px-3 py-1.5 rounded-full truncate max-w-[120px] xs:max-w-none shadow-sm border border-neutral-100">
              admin@pragjyotishcollege.ac.in
            </span>
          </div>
        </header>

        {/* Dynamic Workspace Container */}
        <div className="p-8 flex-1 overflow-y-auto">
          
          {/* TAB 1: DASHBOARD VIEWS */}
          {activeTab === "dashboard" && (
            <div className="space-y-6" id="view-dashboard">
              
              {/* Stats Block */}
              {statsLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-neutral-400">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  <span className="text-sm font-semibold">Gathering database stats...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Grid stats */}
                  <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                    
                    {/* Stat Card 1: Total Students */}
                    <div className="bg-white p-5 rounded-xl border border-neutral-100 shadow-sm flex items-center gap-4 text-left">
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Users className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Total Students</p>
                        <h3 className="text-2xl font-black text-neutral-900 mt-0.5">{stats?.totalStudents ?? 0}</h3>
                      </div>
                    </div>

                    {/* Stat Card 2: Male Students */}
                    <div className="bg-white p-5 rounded-xl border border-neutral-100 shadow-sm flex items-center gap-4 text-left">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <User className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Male Students</p>
                        <h3 className="text-2xl font-black text-neutral-900 mt-0.5">{stats?.maleCount ?? 0}</h3>
                      </div>
                    </div>

                    {/* Stat Card 3: Female Students */}
                    <div className="bg-white p-5 rounded-xl border border-neutral-100 shadow-sm flex items-center gap-4 text-left">
                      <div className="w-12 h-12 bg-pink-50 text-pink-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <User className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Female Students</p>
                        <h3 className="text-2xl font-black text-neutral-900 mt-0.5">{stats?.femaleCount ?? 0}</h3>
                      </div>
                    </div>

                    {/* Stat Card 4: Latest Import */}
                    <div className="bg-white p-5 rounded-xl border border-neutral-100 shadow-sm flex items-center gap-4 text-left">
                      <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Latest Import</p>
                        <h3 className="text-sm font-black text-neutral-800 mt-1 truncate" title={stats?.latestImport ? `+${stats?.latestImport.newRecords} Records` : "No imports"}>
                          {stats?.latestImport ? `+${stats?.latestImport.newRecords} Recs` : "No imports"}
                        </h3>
                      </div>
                    </div>

                    {/* Stat Card 5: Total Imports */}
                    <div className="bg-white p-5 rounded-xl border border-neutral-100 shadow-sm flex items-center gap-4 text-left">
                      <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <History className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Total Imports</p>
                        <h3 className="text-2xl font-black text-neutral-900 mt-0.5">{stats?.totalImports ?? 0}</h3>
                      </div>
                    </div>

                  </div>

                  {/* Student Profile Views Frequency Chart & Most Frequent Public Search Queries */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Student Profile Views Frequency Chart */}
                    <div className="bg-white p-6 rounded-xl border border-neutral-100 shadow-sm space-y-4 text-left">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                        <div>
                          <h3 className="text-base font-bold text-neutral-800 flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-blue-600" />
                            <span>Student Record Access Frequency</span>
                          </h3>
                          <p className="text-xs text-neutral-400 mt-0.5">Top 8 most viewed student profiles across the registry.</p>
                        </div>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full uppercase tracking-wider self-start sm:self-center">
                          Real-time Analytics
                        </span>
                      </div>

                      <div className="h-[280px] w-full pt-4">
                        {stats?.topViewedStudents && stats.topViewedStudents.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={stats.topViewedStudents}
                              margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis 
                                dataKey="name" 
                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(name) => {
                                  if (name.length > 12) return name.slice(0, 10) + "...";
                                  return name;
                                }}
                              />
                              <YAxis 
                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                                axisLine={false}
                                tickLine={false}
                                allowDecimals={false}
                              />
                              <Tooltip
                                cursor={{ fill: '#f8fafc' }}
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                      <div className="bg-neutral-900 text-white p-3 rounded-xl border border-neutral-800 shadow-xl text-xs space-y-1">
                                        <p className="font-extrabold uppercase">{data.name}</p>
                                        <p className="text-[10px] text-neutral-400 font-mono">Reg ID: {data.registrationId}</p>
                                        <div className="border-t border-neutral-800 my-1 pt-1 flex justify-between gap-4">
                                          <span className="text-blue-400 font-bold">Access Freq:</span>
                                          <span className="font-mono font-bold">{data.viewCount} views</span>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Bar 
                                dataKey="viewCount" 
                                radius={[6, 6, 0, 0]}
                                maxBarSize={32}
                              >
                                {stats.topViewedStudents.map((entry: any, index: number) => {
                                  const colors = [
                                    '#1d4ed8', // Main college blue
                                    '#2563eb', 
                                    '#3b82f6', 
                                    '#60a5fa', 
                                    '#93c5fd', 
                                    '#c084fc', // Secondary accent
                                    '#a855f7', 
                                    '#e9d5ff'
                                  ];
                                  return (
                                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                                  );
                                })}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center gap-2 text-neutral-400">
                            <BarChart3 className="w-8 h-8 opacity-40 animate-pulse text-neutral-500" />
                            <span className="text-xs font-semibold">No student view records generated in this session yet.</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Most Frequent Public Search Queries */}
                    <div className="bg-white p-6 rounded-xl border border-neutral-100 shadow-sm space-y-4 text-left flex flex-col justify-between">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                        <div>
                          <h3 className="text-base font-bold text-neutral-800 flex items-center gap-2">
                            <Search className="w-5 h-5 text-indigo-600" />
                            <span>Most Popular Search Queries</span>
                          </h3>
                          <p className="text-xs text-neutral-400 mt-0.5">Top search terms (names, roll numbers, or IDs) to understand user information needs.</p>
                        </div>
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full uppercase tracking-wider self-start sm:self-center">
                          Query Insights
                        </span>
                      </div>

                      <div className="h-[280px] overflow-y-auto pr-1 flex flex-col justify-center">
                        {stats?.topSearches && stats.topSearches.length > 0 ? (
                          <div className="space-y-4">
                            {stats.topSearches.map((item: any, idx: number) => {
                              // Calculate relative progress bar width based on max count
                              const maxCount = Math.max(...stats.topSearches.map((s: any) => s.count), 1);
                              const widthPct = Math.max(8, Math.round((item.count / maxCount) * 100));
                              
                              return (
                                <div key={item.id || idx} className="space-y-1">
                                  <div className="flex items-center justify-between text-xs font-medium">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-bold text-neutral-400 w-4 text-right">#{idx + 1}</span>
                                      <span className="font-mono font-bold text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200 truncate max-w-[140px] md:max-w-[180px]" title={item.query}>
                                        "{item.query}"
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-[11px] font-black text-neutral-800">{item.count} searches</span>
                                      <span className="text-[10px] text-neutral-400 font-mono">
                                        Last: {new Date(item.lastSearchedAt).toLocaleDateString()}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                                    <div 
                                      className="bg-indigo-600 h-full rounded-full transition-all duration-500 ease-out"
                                      style={{ width: `${widthPct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center text-neutral-400 flex flex-col items-center justify-center gap-2">
                            <Search className="w-8 h-8 opacity-30 text-indigo-500" />
                            <span className="text-xs font-semibold">No public searches recorded yet.</span>
                            <p className="text-[10px] text-neutral-400 max-w-xs leading-relaxed">
                              When visitors search the public registry directory for names, roll numbers, or registration IDs, live insights will populate here.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Split Layout: Recent imports & logs */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Left Panel: Recent Logs */}
                    <div className="bg-white p-6 rounded-xl border border-neutral-100 shadow-sm lg:col-span-2 space-y-4">
                      <h3 className="text-base font-bold text-neutral-800 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-neutral-500" />
                        <span>Recent Security & Activity Logs</span>
                      </h3>
                      
                      <div className="divide-y divide-neutral-100 text-xs">
                        {stats?.recentActivities && stats.recentActivities.length > 0 ? (
                          stats.recentActivities.map((log: any) => (
                            <div key={log.id} className="py-3 flex justify-between items-start gap-4">
                              <div className="space-y-0.5">
                                <span className="font-bold text-neutral-800 uppercase text-[10px] bg-neutral-100 px-2 py-0.5 rounded mr-2">
                                  {log.action}
                                </span>
                                <span className="text-neutral-600 font-medium">{log.details}</span>
                              </div>
                              <span className="text-neutral-400 flex-shrink-0 font-medium font-mono text-[10px]">
                                {new Date(log.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="py-6 text-center text-neutral-400">No logs registered yet.</div>
                        )}
                      </div>
                    </div>

                    {/* Right Panel: Latest import summary card */}
                    <div className="bg-white p-6 rounded-xl border border-neutral-100 shadow-sm space-y-4 text-left">
                      <h3 className="text-base font-bold text-neutral-800 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-neutral-500" />
                        <span>Latest PDF Batch Ingestion</span>
                      </h3>

                      {stats?.latestImport ? (
                        <div className="space-y-4">
                          <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 space-y-1">
                            <h4 className="text-xs font-bold text-neutral-400 uppercase">File Ingested</h4>
                            <p className="text-sm font-bold text-blue-900 truncate">{stats.latestImport.fileName}</p>
                            <p className="text-[10px] text-blue-600 font-mono font-bold">
                              Date: {new Date(stats.latestImport.date).toLocaleString()}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="p-2.5 bg-neutral-50 rounded border border-neutral-100">
                              <span className="text-neutral-400 font-medium">New Records</span>
                              <p className="text-base font-extrabold text-neutral-800">{stats.latestImport.newRecords}</p>
                            </div>
                            <div className="p-2.5 bg-neutral-50 rounded border border-neutral-100">
                              <span className="text-neutral-400 font-medium">Updated Records</span>
                              <p className="text-base font-extrabold text-neutral-800">{stats.latestImport.updatedRecords}</p>
                            </div>
                            <div className="p-2.5 bg-neutral-50 rounded border border-neutral-100">
                              <span className="text-neutral-400 font-medium">Invalid Rows</span>
                              <p className="text-base font-extrabold text-neutral-800">{stats.latestImport.invalidRecords}</p>
                            </div>
                            <div className="p-2.5 bg-neutral-50 rounded border border-neutral-100">
                              <span className="text-neutral-400 font-medium">Total Tracked</span>
                              <p className="text-base font-extrabold text-neutral-800">{stats.latestImport.totalRecords}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-12 text-center text-neutral-400 flex flex-col items-center justify-center gap-2">
                          <AlertTriangle className="w-8 h-8 text-neutral-300" />
                          <p className="text-xs">No PDF records have been imported yet. Head to the <strong>Upload PDF</strong> tab to seed your database.</p>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: STUDENTS VIEW (CRUD PANEL) */}
          {activeTab === "students" && (
            <div className="space-y-6" id="view-students">
              
              {/* Header Action Controls */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-col text-left">
                    <h3 className="text-base font-bold text-neutral-800">Student Profiles Directory</h3>
                    <p className="text-xs text-neutral-400">View and update academic files, manually insert or edit student records.</p>
                  </div>

                  <button
                    onClick={() => handleOpenStudentModal("add")}
                    className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow hover:bg-blue-700 transition-colors self-start md:self-auto"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Student Profile</span>
                  </button>
                </div>

                {/* Advanced Filter Panel */}
                <div className="bg-neutral-50/50 p-4 rounded-xl border border-neutral-200/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wide flex items-center gap-2">
                      <Filter className="w-3.5 h-3.5 text-neutral-500" />
                      <span>Advanced Search Filters</span>
                    </h4>
                    {(studentsGenderFilter || studentsCategoryFilter || studentsProgrammeFilter || studentsMajorFilter || studentsMinorFilter || studentsAdmissionCategoryFilter || studentsStatusFilter || studentsSemesterFilter || studentsBatchFilter || studentsSearch) && (
                      <button
                        onClick={() => {
                          setStudentsGenderFilter("");
                          setStudentsCategoryFilter("");
                          setStudentsProgrammeFilter("");
                          setStudentsMajorFilter("");
                          setStudentsMinorFilter("");
                          setStudentsAdmissionCategoryFilter("");
                          setStudentsStatusFilter("");
                          setStudentsSemesterFilter("");
                          setStudentsBatchFilter("");
                          setStudentsSearch("");
                          setStudentsPage(1);
                        }}
                        className="text-[11px] text-blue-600 font-bold hover:underline bg-transparent border-none cursor-pointer"
                      >
                        Reset All Filters
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs text-left">
                    {/* Search Query */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search by name, IDs, email, phone..."
                        value={studentsSearch}
                        onChange={(e) => setStudentsSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-neutral-200 text-neutral-800 placeholder-neutral-400 text-xs bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                    </div>

                    {/* Programme Name */}
                    <div>
                      <select
                        value={studentsProgrammeFilter}
                        onChange={(e) => { setStudentsProgrammeFilter(e.target.value); setStudentsPage(1); }}
                        className="bg-white border border-neutral-200 rounded-lg text-xs text-neutral-700 px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">All Programmes</option>
                        {filterOptions.programmes.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    {/* Major Subject */}
                    <div>
                      <select
                        value={studentsMajorFilter}
                        onChange={(e) => { setStudentsMajorFilter(e.target.value); setStudentsPage(1); }}
                        className="bg-white border border-neutral-200 rounded-lg text-xs text-neutral-700 px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">All Major Subjects</option>
                        {filterOptions.majors.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    {/* Minor Subject */}
                    <div>
                      <select
                        value={studentsMinorFilter}
                        onChange={(e) => { setStudentsMinorFilter(e.target.value); setStudentsPage(1); }}
                        className="bg-white border border-neutral-200 rounded-lg text-xs text-neutral-700 px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">All Minor Subjects</option>
                        {filterOptions.minors.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    {/* Admission Category */}
                    <div>
                      <select
                        value={studentsAdmissionCategoryFilter}
                        onChange={(e) => { setStudentsAdmissionCategoryFilter(e.target.value); setStudentsPage(1); }}
                        className="bg-white border border-neutral-200 rounded-lg text-xs text-neutral-700 px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">All Admission Categories</option>
                        {filterOptions.admissionCategories.map((ac) => (
                          <option key={ac} value={ac}>{ac}</option>
                        ))}
                      </select>
                    </div>

                    {/* Social Category */}
                    <div>
                      <select
                        value={studentsCategoryFilter}
                        onChange={(e) => { setStudentsCategoryFilter(e.target.value); setStudentsPage(1); }}
                        className="bg-white border border-neutral-200 rounded-lg text-xs text-neutral-700 px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">All Social Categories</option>
                        <option value="GENERAL">GENERAL</option>
                        <option value="OBC / MOBC">OBC / MOBC</option>
                        <option value="SCHEDULE TRIBE (PLAINS)">SCHEDULE TRIBE (PLAINS)</option>
                        <option value="SCHEDULED CASTE (SC)">SCHEDULED CASTE (SC)</option>
                        <option value="EWS">EWS</option>
                        {filterOptions.categories.filter(c => !["GENERAL", "OBC / MOBC", "SCHEDULE TRIBE (PLAINS)", "SCHEDULED CASTE (SC)", "EWS"].includes(c)).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    {/* Gender */}
                    <div>
                      <select
                        value={studentsGenderFilter}
                        onChange={(e) => { setStudentsGenderFilter(e.target.value); setStudentsPage(1); }}
                        className="bg-white border border-neutral-200 rounded-lg text-xs text-neutral-700 px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">All Genders</option>
                        <option value="MALE">MALE</option>
                        <option value="FEMALE">FEMALE</option>
                      </select>
                    </div>

                    {/* Status */}
                    <div>
                      <select
                        value={studentsStatusFilter}
                        onChange={(e) => { setStudentsStatusFilter(e.target.value); setStudentsPage(1); }}
                        className="bg-white border border-neutral-200 rounded-lg text-xs text-neutral-700 px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">All Statuses</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        {filterOptions.statuses.filter(s => !["Active", "Inactive"].includes(s)).map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    {/* Semester */}
                    <div>
                      <select
                        value={studentsSemesterFilter}
                        onChange={(e) => { setStudentsSemesterFilter(e.target.value); setStudentsPage(1); }}
                        className="bg-white border border-neutral-200 rounded-lg text-xs text-neutral-700 px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">All Semesters</option>
                        <option value="1st Semester">1st Semester</option>
                        <option value="3rd Semester">3rd Semester</option>
                        <option value="5th Semester">5th Semester</option>
                      </select>
                    </div>

                    {/* Batch */}
                    <div>
                      <select
                        value={studentsBatchFilter}
                        onChange={(e) => { setStudentsBatchFilter(e.target.value); setStudentsPage(1); }}
                        className="bg-white border border-neutral-200 rounded-lg text-xs text-neutral-700 px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">All Batches</option>
                        {batchesList.map((b) => (
                          <option key={b.id} value={b.name}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Students grid table */}
              <div className="bg-white rounded-xl border border-neutral-100 shadow-sm overflow-hidden">
                {studentsLoading ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-3 text-neutral-400">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <span className="text-sm font-semibold">Retrieving records directory...</span>
                  </div>
                ) : studentsList.length === 0 ? (
                  <div className="py-20 text-center text-neutral-400 flex flex-col items-center gap-2">
                    <Users className="w-12 h-12 text-neutral-200" />
                    <h3 className="font-bold text-neutral-700">No student records match filters</h3>
                    <p className="text-xs max-w-sm">Try modifying your query text or search criteria to locate students.</p>
                  </div>
                ) : (
                  <div>
                    {/* Mobile Student Cards List */}
                    <div className="block lg:hidden divide-y divide-neutral-100">
                      {studentsList.map((student) => (
                        <div key={student.id} className="p-4 bg-white space-y-3 text-left">
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                              <h4 className="font-bold text-sm text-neutral-900 truncate">{student.name}</h4>
                              <p className="text-[10px] text-neutral-400 font-bold uppercase mt-0.5 truncate">
                                {student.programmeName || "BCA Programme"}
                              </p>
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                              student.status === "Active" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                            }`}>
                              {student.status || "Active"}
                            </span>
                          </div>

                          {/* Academic Info Grid */}
                          <div className="grid grid-cols-2 gap-2 text-xs text-neutral-600 bg-neutral-50/70 p-2.5 rounded-lg border border-neutral-100">
                            <div>
                              <span className="text-[9px] font-extrabold text-neutral-400 block uppercase tracking-wider">Roll No</span>
                              <span className="font-mono font-bold text-neutral-800">{student.rollNumber || "—"}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-extrabold text-neutral-400 block uppercase tracking-wider">Enroll No</span>
                              <span className="font-mono font-bold text-neutral-800 text-xs truncate block">{student.enrollmentNumber || "—"}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-extrabold text-neutral-400 block uppercase tracking-wider">Semester</span>
                              <span className="font-extrabold text-blue-700">{student.semester || "—"}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-extrabold text-neutral-400 block uppercase tracking-wider">Batch</span>
                              <span className="font-bold text-neutral-800">{student.batch || "—"}</span>
                            </div>
                          </div>

                          {/* Contact Details */}
                          <div className="text-[11px] text-neutral-500 space-y-0.5 bg-neutral-50/30 p-2 rounded-lg">
                            <p className="truncate">Email: <span className="font-semibold text-neutral-700">{student.email || "—"}</span></p>
                            <p>Mobile: <span className="font-semibold text-neutral-700">{student.mobile || "—"}</span></p>
                          </div>

                          {/* Actions */}
                          <div className="flex justify-between items-center pt-2 border-t border-neutral-100">
                            <span className="text-[9px] font-extrabold text-neutral-400 uppercase tracking-wider">
                              Reg: <span className="font-mono text-neutral-700 font-bold">{student.registrationId || "—"}</span>
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleOpenStudentModal("view", student)}
                                className="p-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors cursor-pointer"
                                title="View Profile"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenStudentModal("edit", student)}
                                className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                                title="Edit Profile"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(student.id)}
                                className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
                                title="Delete Profile"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop compact student directory table */}
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="min-w-full divide-y divide-neutral-100 text-left text-xs">
                        <thead>
                          <tr className="bg-neutral-50/50 text-neutral-400 font-bold uppercase tracking-wider">
                            <th className="px-6 py-3.5">Name</th>
                            <th className="px-6 py-3.5">Roll & Enrollment No</th>
                            <th className="px-6 py-3.5">Form No & Reg ID</th>
                            <th className="px-6 py-3.5">Semester & Batch</th>
                            <th className="px-6 py-3.5">Contact Coordinates</th>
                            <th className="px-6 py-3.5">Major / Minor</th>
                            <th className="px-6 py-3.5">Admission Cat</th>
                            <th className="px-6 py-3.5">Gender</th>
                            <th className="px-6 py-3.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 text-neutral-700">
                          {studentsList.map((student) => (
                            <tr key={student.id} className="hover:bg-neutral-50/20 transition-colors">
                              <td className="px-6 py-4 font-bold text-neutral-900">{student.name}</td>
                              <td className="px-6 py-4">
                                <div className="space-y-0.5">
                                  <p className="font-mono text-neutral-800 font-semibold">Roll: {student.rollNumber || "—"}</p>
                                  <p className="font-mono text-neutral-500">Enroll: {student.enrollmentNumber || "—"}</p>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="space-y-0.5">
                                  <p className="font-mono text-neutral-500">F: {student.formNumber}</p>
                                  <p className="font-mono font-semibold text-neutral-800">R: {student.registrationId}</p>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="space-y-0.5">
                                  <p className="text-neutral-800 font-bold">{student.semester || "—"}</p>
                                  <p className="text-neutral-500 font-medium">Batch: {student.batch || "—"}</p>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="space-y-0.5">
                                  <p className="text-neutral-600 font-semibold">{student.email || "—"}</p>
                                  <p className="text-neutral-500 font-mono">{student.mobile || "—"}</p>
                                </div>
                              </td>
                              <td className="px-6 py-4 font-medium">
                                <div className="space-y-0.5">
                                  <p className="text-neutral-800">M: {student.majorSubject || "None"}</p>
                                  <p className="text-neutral-400">Mi: {student.minorSubject || "None"}</p>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-700">
                                  {student.admissionCategory || "GENERAL"}
                                </span>
                              </td>
                              <td className="px-6 py-4 uppercase font-medium">{student.gender || "—"}</td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    onClick={() => handleOpenStudentModal("view", student)}
                                    className="p-1.5 bg-neutral-100 rounded text-neutral-600 hover:bg-neutral-200 cursor-pointer"
                                    title="View detailed record"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenStudentModal("edit", student)}
                                    className="p-1.5 bg-blue-50 rounded text-blue-600 hover:bg-blue-100 cursor-pointer"
                                    title="Edit record"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteStudent(student.id)}
                                    className="p-1.5 bg-red-50 rounded text-red-600 hover:bg-red-100 cursor-pointer"
                                    title="Delete record"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Paginated Footer */}
                    {studentsTotal > studentsLimit && (
                      <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50/30 flex items-center justify-between text-xs font-semibold">
                        <span className="text-neutral-500">Showing {studentsList.length} of {studentsTotal} Student Records</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setStudentsPage(p => Math.max(1, p - 1))}
                            disabled={studentsPage === 1}
                            className="px-3 py-2 border rounded-lg hover:bg-white disabled:opacity-50"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => setStudentsPage(p => p + 1)}
                            disabled={studentsPage * studentsLimit >= studentsTotal}
                            className="px-3 py-2 border rounded-lg hover:bg-white disabled:opacity-50"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* STUDENT MODALS (ADD, EDIT, VIEW FULL DETAIL) */}
              {studentModalMode && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
                  <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-neutral-100 flex flex-col">
                    
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
                      <h3 className="font-bold text-neutral-800 text-base">
                        {studentModalMode === "add" && "Create Student Profile"}
                        {studentModalMode === "edit" && `Modify Student Profile: ${selectedStudent?.name}`}
                        {studentModalMode === "view" && `Student Credentials: ${selectedStudent?.name}`}
                      </h3>
                      <button onClick={() => setStudentModalMode(null)} className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* View/Edit form body */}
                    <form onSubmit={handleSaveStudent} className="p-6 space-y-4">
                      {studentFormError && (
                        <div className="bg-red-50 border border-red-100 text-red-700 p-3 rounded-lg text-xs font-medium flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                          <span>{studentFormError}</span>
                        </div>
                      )}

                      {/* Mode: VIEW FULL DETAILS ONLY */}
                      {studentModalMode === "view" ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium text-neutral-700 leading-normal" id="view-only-details">
                          <div className="p-3 bg-neutral-50 rounded border border-neutral-100">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">Name</span>
                            <span className="text-sm font-bold text-neutral-900">{selectedStudent?.name}</span>
                          </div>
                          <div className="p-3 bg-neutral-50 rounded border border-neutral-100">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">Roll Number</span>
                            <span className="text-sm font-bold text-neutral-900 font-mono">{selectedStudent?.rollNumber || "—"}</span>
                          </div>
                          <div className="p-3 bg-neutral-50 rounded border border-neutral-100">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">Enrollment Number</span>
                            <span className="text-sm font-bold text-neutral-900 font-mono">{selectedStudent?.enrollmentNumber || "—"}</span>
                          </div>
                          <div className="p-3 bg-neutral-50 rounded border border-neutral-100">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">Semester</span>
                            <span className="text-sm font-bold text-neutral-900">{selectedStudent?.semester || "—"}</span>
                          </div>
                          <div className="p-3 bg-neutral-50 rounded border border-neutral-100">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">Batch / Year</span>
                            <span className="text-sm font-bold text-neutral-900">{selectedStudent?.batch || "—"}</span>
                          </div>
                          <div className="p-3 bg-neutral-50 rounded border border-neutral-100">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">Registration ID</span>
                            <span className="text-sm font-bold text-neutral-900 font-mono">{selectedStudent?.registrationId}</span>
                          </div>
                          <div className="p-3 bg-neutral-50 rounded border border-neutral-100">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">Admission Form Number</span>
                            <span className="text-sm font-bold text-neutral-900 font-mono">{selectedStudent?.formNumber}</span>
                          </div>
                          <div className="p-3 bg-neutral-50 rounded border border-neutral-100">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">Programme</span>
                            <span className="text-xs text-neutral-800">{selectedStudent?.programmeName}</span>
                          </div>
                          <div className="p-3 bg-neutral-50 rounded border border-neutral-100">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">Subject Set</span>
                            <p className="text-neutral-800"><strong>Major:</strong> {selectedStudent?.majorSubject || "None"}</p>
                            <p className="text-neutral-800 mt-1"><strong>Minor:</strong> {selectedStudent?.minorSubject || "None"}</p>
                          </div>
                          <div className="p-3 bg-neutral-50 rounded border border-neutral-100">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">Admission Category</span>
                            <span className="text-xs text-neutral-800">{selectedStudent?.admissionCategory || "GENERAL"}</span>
                          </div>
                          <div className="p-3 bg-blue-50/50 rounded border border-blue-100">
                            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block mb-0.5">Private Email Address</span>
                            <span className="text-xs font-bold text-blue-900">{selectedStudent?.email || "—"}</span>
                          </div>
                          <div className="p-3 bg-blue-50/50 rounded border border-blue-100">
                            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block mb-0.5">Private Mobile Number</span>
                            <span className="text-xs font-bold text-blue-900 font-mono">{selectedStudent?.mobile || "—"}</span>
                          </div>
                          <div className="p-3 bg-neutral-50 rounded border border-neutral-100">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">Gender</span>
                            <span className="text-xs text-neutral-800 uppercase">{selectedStudent?.gender}</span>
                          </div>
                          <div className="p-3 bg-neutral-50 rounded border border-neutral-100">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">Social Category</span>
                            <span className="text-xs text-neutral-800 uppercase">{selectedStudent?.category}</span>
                          </div>
                        </div>
                      ) : (
                        // Mode: EDIT/ADD FORM FIELDS
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-neutral-600">
                          {/* Name */}
                          <div>
                            <label className="block mb-1">Student Name *</label>
                            <input
                              type="text"
                              required
                              value={studentForm.name || ""}
                              onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                              className="w-full p-2.5 border rounded-lg text-xs"
                            />
                          </div>

                          {/* Roll Number */}
                          <div>
                            <label className="block mb-1">Roll Number *</label>
                            <input
                              type="text"
                              required
                              value={studentForm.rollNumber || ""}
                              onChange={(e) => setStudentForm({ ...studentForm, rollNumber: e.target.value })}
                              className="w-full p-2.5 border rounded-lg text-xs font-mono"
                              placeholder="e.g. US-211-135-0010"
                            />
                          </div>

                          {/* Enrollment Number */}
                          <div>
                            <label className="block mb-1">Enrollment Number *</label>
                            <input
                              type="text"
                              required
                              value={studentForm.enrollmentNumber || ""}
                              onChange={(e) => setStudentForm({ ...studentForm, enrollmentNumber: e.target.value })}
                              className="w-full p-2.5 border rounded-lg text-xs font-mono"
                              placeholder="e.g. 211350010"
                            />
                          </div>

                          {/* Registration ID */}
                          <div>
                            <label className="block mb-1">Registration ID *</label>
                            <input
                              type="text"
                              required
                              value={studentForm.registrationId || ""}
                              onChange={(e) => setStudentForm({ ...studentForm, registrationId: e.target.value })}
                              className="w-full p-2.5 border rounded-lg font-mono text-xs"
                            />
                          </div>

                          {/* Form Number */}
                          <div>
                            <label className="block mb-1">Form Number *</label>
                            <input
                              type="text"
                              required
                              value={studentForm.formNumber || ""}
                              onChange={(e) => setStudentForm({ ...studentForm, formNumber: e.target.value })}
                              className="w-full p-2.5 border rounded-lg font-mono text-xs"
                            />
                          </div>

                          {/* Semester */}
                          <div>
                            <label className="block mb-1">Semester *</label>
                            <select
                              required
                              value={studentForm.semester || "1st Semester"}
                              onChange={(e) => setStudentForm({ ...studentForm, semester: e.target.value })}
                              className="w-full p-2.5 border rounded-lg text-xs bg-white"
                            >
                              <option value="1st Semester">1st Semester</option>
                              <option value="2nd Semester">2nd Semester</option>
                              <option value="3rd Semester">3rd Semester</option>
                              <option value="4th Semester">4th Semester</option>
                              <option value="5th Semester">5th Semester</option>
                              <option value="6th Semester">6th Semester</option>
                            </select>
                          </div>

                          {/* Batch / Year */}
                          <div>
                            <label className="block mb-1">Batch / Academic Year *</label>
                            <select
                              required
                              value={studentForm.batch || ""}
                              onChange={(e) => setStudentForm({ ...studentForm, batch: e.target.value })}
                              className="w-full p-2.5 border rounded-lg text-xs bg-white"
                            >
                              <option value="">Select Batch</option>
                              {batchesList.map((b) => (
                                <option key={b.id} value={b.name}>{b.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Programme */}
                          <div>
                            <label className="block mb-1">Programme Name</label>
                            <input
                              type="text"
                              value={studentForm.programmeName || ""}
                              onChange={(e) => setStudentForm({ ...studentForm, programmeName: e.target.value })}
                              className="w-full p-2.5 border rounded-lg text-xs"
                            />
                          </div>

                          {/* Major */}
                          <div>
                            <label className="block mb-1">Major Subject</label>
                            <input
                              type="text"
                              value={studentForm.majorSubject || ""}
                              onChange={(e) => setStudentForm({ ...studentForm, majorSubject: e.target.value })}
                              className="w-full p-2.5 border rounded-lg text-xs"
                            />
                          </div>

                          {/* Minor */}
                          <div>
                            <label className="block mb-1">Minor Subject</label>
                            <input
                              type="text"
                              value={studentForm.minorSubject || ""}
                              onChange={(e) => setStudentForm({ ...studentForm, minorSubject: e.target.value })}
                              className="w-full p-2.5 border rounded-lg text-xs"
                            />
                          </div>

                          {/* Email */}
                          <div>
                            <label className="block mb-1 text-blue-600">Email Address (Private)</label>
                            <input
                              type="email"
                              value={studentForm.email || ""}
                              onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                              className="w-full p-2.5 border rounded-lg text-xs text-blue-900 bg-blue-50/10 focus:bg-white"
                            />
                          </div>

                          {/* Mobile */}
                          <div>
                            <label className="block mb-1 text-blue-600">Mobile Number (Private)</label>
                            <input
                              type="text"
                              value={studentForm.mobile || ""}
                              onChange={(e) => setStudentForm({ ...studentForm, mobile: e.target.value })}
                              className="w-full p-2.5 border rounded-lg text-xs text-blue-900 bg-blue-50/10 focus:bg-white"
                            />
                          </div>

                          {/* Gender */}
                          <div>
                            <label className="block mb-1">Gender</label>
                            <select
                              value={studentForm.gender || "MALE"}
                              onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value })}
                              className="w-full p-2.5 border rounded-lg text-xs bg-white"
                            >
                              <option value="MALE">Male</option>
                              <option value="FEMALE">Female</option>
                            </select>
                          </div>

                          {/* Category */}
                          <div>
                            <label className="block mb-1">Category</label>
                            <input
                              type="text"
                              value={studentForm.category || "GENERAL"}
                              onChange={(e) => setStudentForm({ ...studentForm, category: e.target.value })}
                              className="w-full p-2.5 border rounded-lg text-xs"
                            />
                          </div>
                        </div>
                      )}

                      {/* Footer actions */}
                      <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 -mx-6 -mb-6 flex justify-end gap-2.5 rounded-b-2xl">
                        <button
                          type="button"
                          onClick={() => setStudentModalMode(null)}
                          className="px-4 py-2 bg-white border rounded-lg text-xs font-semibold hover:bg-neutral-50"
                        >
                          Cancel
                        </button>
                        {studentModalMode !== "view" && (
                          <button
                            type="submit"
                            disabled={studentFormSaving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
                          >
                            {studentFormSaving ? (
                              <span className="flex items-center gap-1">
                                <Loader2 className="w-3 animate-spin" />
                                <span>Saving...</span>
                              </span>
                            ) : (
                              <span>Save Record</span>
                            )}
                          </button>
                        )}
                      </div>

                    </form>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 3: UPLOAD PDF & WORKFLOW REVIEW & INGEST */}
          {activeTab === "upload" && (
            <div className="space-y-6" id="view-upload">
              
              {/* Alert success banner */}
              {commitResult && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3 shadow-sm text-xs font-bold leading-normal">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <span>{commitResult}</span>
                </div>
              )}

              {/* Upload Card Area */}
              <div className="bg-white p-8 rounded-2xl border border-neutral-100 shadow-sm max-w-xl mx-auto text-center space-y-4">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <UploadCloud className="w-8 h-8" />
                </div>
                
                <div className="space-y-1">
                  <h3 className="font-bold text-neutral-800 text-base">Upload BCA PDF Student List</h3>
                  <p className="text-xs text-neutral-500">Supports standard collegiate admission PDF spreadsheets.</p>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="border-2 border-dashed border-neutral-200 rounded-xl p-6 bg-neutral-50 hover:bg-neutral-50/50 cursor-pointer relative transition-all duration-150">
                    <input
                      type="file"
                      accept=".pdf"
                      ref={fileInputRef}
                      onChange={handlePdfUploadSelect}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-blue-600">
                      {pdfFile ? pdfFile.name : "Choose PDF File or Drag & Drop"}
                    </span>
                    {pdfFile && (
                      <p className="text-[10px] text-neutral-400 mt-1 font-mono">Size: {(pdfFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                    )}
                  </div>

                  {uploading ? (
                    <div className="bg-neutral-50 border border-neutral-100 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-center gap-2 text-xs font-bold text-blue-600">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="animate-pulse">{uploadStep}</span>
                      </div>
                      {/* Dynamic loading progress bar visual */}
                      <div className="w-full bg-neutral-200 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                          style={{
                            width: uploadStep === "Uploading PDF..." ? "20%" :
                                   uploadStep === "Reading PDF..." ? "40%" :
                                   uploadStep === "Extracting student records..." ? "65%" :
                                   uploadStep === "Validating records..." ? "85%" : "95%"
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleUploadSubmit}
                      disabled={!pdfFile || uploading}
                      className="w-full inline-flex items-center justify-center gap-1.5 bg-blue-600 text-white font-bold text-xs px-4 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow transition-colors"
                    >
                      <span>Extract & Analyze PDF Records</span>
                      <ArrowRight className="w-4.5 h-4.5" />
                    </button>
                  )}

                  {uploadError && (
                    <div className="bg-red-50 border border-red-100 text-red-700 p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <span>{uploadError}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* STAGE: PARSED PREVIEW & CONFLICT RESOLUTION */}
              {uploadPreview && (
                <div className="space-y-6" id="preview-section">
                  
                  {/* Summary statistics bar */}
                  <div className="bg-white p-6 rounded-xl border border-neutral-100 shadow-sm space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-neutral-800">Review Extraction: "{uploadPreview.fileName}"</h3>
                        <p className="text-xs text-neutral-500 mt-0.5">Please review Gemini's extracted student roster and duplicates check before finalizing database insert.</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <button
                          onClick={handleCancelImport}
                          disabled={committing}
                          className="inline-flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold px-4 py-2.5 rounded-lg transition-colors border border-neutral-200"
                        >
                          Cancel Import
                        </button>
                        <button
                          onClick={handleConfirmImport}
                          disabled={committing}
                          className="inline-flex items-center gap-1 bg-green-600 text-white text-xs font-bold px-5 py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors shadow"
                        >
                          {committing ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Saving records...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-4.5 h-4.5" />
                              <span>Confirm and Import to DB</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Stats Pill blocks */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {/* total */}
                      <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-100 text-left">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase">Total Records</span>
                        <p className="text-xl font-extrabold text-neutral-800 mt-0.5">{uploadPreview.totalRecords}</p>
                      </div>
                      {/* new */}
                      <button
                        onClick={() => setPreviewActiveTab("new")}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          previewActiveTab === "new"
                            ? "bg-blue-50 border-blue-200 ring-2 ring-blue-100"
                            : "bg-neutral-50 border-neutral-100 hover:bg-neutral-100/50"
                        }`}
                      >
                        <span className="text-[10px] font-bold text-blue-500 uppercase">New Records</span>
                        <p className="text-xl font-extrabold text-blue-800 mt-0.5">{uploadPreview.newCount}</p>
                      </button>
                      {/* updated */}
                      <button
                        onClick={() => setPreviewActiveTab("updated")}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          previewActiveTab === "updated"
                            ? "bg-amber-50 border-amber-200 ring-2 ring-amber-100"
                            : "bg-neutral-50 border-neutral-100 hover:bg-neutral-100/50"
                        }`}
                      >
                        <span className="text-[10px] font-bold text-amber-500 uppercase">To Update</span>
                        <p className="text-xl font-extrabold text-amber-800 mt-0.5">{uploadPreview.updatedCount}</p>
                      </button>
                      {/* duplicates */}
                      <button
                        onClick={() => setPreviewActiveTab("duplicate")}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          previewActiveTab === "duplicate"
                            ? "bg-neutral-100 border-neutral-200 ring-2 ring-neutral-200"
                            : "bg-neutral-50 border-neutral-100 hover:bg-neutral-100/50"
                        }`}
                      >
                        <span className="text-[10px] font-bold text-neutral-400 uppercase">Identical Duplicates</span>
                        <p className="text-xl font-extrabold text-neutral-700 mt-0.5">{uploadPreview.duplicateCount}</p>
                      </button>
                      {/* invalid */}
                      <button
                        onClick={() => setPreviewActiveTab("invalid")}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          previewActiveTab === "invalid"
                            ? "bg-red-50 border-red-100 ring-2 ring-red-100"
                            : "bg-neutral-50 border-neutral-100 hover:bg-neutral-100/50"
                        }`}
                      >
                        <span className="text-[10px] font-bold text-red-500 uppercase">Invalid Rows</span>
                        <p className="text-xl font-extrabold text-red-800 mt-0.5">{uploadPreview.invalidCount}</p>
                      </button>
                    </div>
                  </div>

                  {/* List items inside the selected preview category */}
                  <div className="bg-white rounded-xl border border-neutral-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-neutral-50 border-b border-neutral-100 text-xs font-bold text-neutral-600">
                      Preview Category: {previewActiveTab === "new" && "New Records to Insert"}
                      {previewActiveTab === "updated" && "Existing records that have changed and will be updated"}
                      {previewActiveTab === "duplicate" && "Identical duplicates that will be skipped/kept"}
                      {previewActiveTab === "invalid" && "Rogue spreadsheet rows missing necessary details"}
                    </div>

                    <div className="overflow-x-auto text-xs text-neutral-700">
                      <table className="min-w-full divide-y divide-neutral-100 text-left">
                        <thead>
                          <tr className="bg-neutral-50/20 text-neutral-400 font-bold uppercase tracking-wider">
                            <th className="px-6 py-3">Student Name</th>
                            <th className="px-6 py-3">Roll & Enrollment No</th>
                            <th className="px-6 py-3">Form & Reg ID</th>
                            <th className="px-6 py-3">Semester & Batch</th>
                            <th className="px-6 py-3">Private Email & Mobile</th>
                            <th className="px-6 py-3">Major / Minor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {previewActiveTab === "new" && uploadPreview.preview.newRecords.map((r: any, i: number) => (
                            <tr key={i} className="hover:bg-neutral-50/40">
                              <td className="px-6 py-3.5 font-bold text-neutral-800">{r.name}</td>
                              <td className="px-6 py-3.5">
                                <div className="space-y-0.5">
                                  <p className="font-mono text-neutral-800 font-semibold">Roll: {r.rollNumber || "—"}</p>
                                  <p className="font-mono text-neutral-500">Enroll: {r.enrollmentNumber || "—"}</p>
                                </div>
                              </td>
                              <td className="px-6 py-3.5">
                                <div className="space-y-0.5 font-mono">
                                  <p>F: {r.formNumber}</p>
                                  <p className="font-semibold text-neutral-800">R: {r.registrationId}</p>
                                </div>
                              </td>
                              <td className="px-6 py-3.5">
                                <div className="space-y-0.5">
                                  <p className="font-semibold text-neutral-800">{r.semester || "—"}</p>
                                  <p className="text-neutral-500">Batch: {r.batch || "—"}</p>
                                </div>
                              </td>
                              <td className="px-6 py-3.5">
                                <div className="space-y-0.5">
                                  <p>{r.email || "—"}</p>
                                  <p className="font-mono text-neutral-500">{r.mobile || "—"}</p>
                                </div>
                              </td>
                              <td className="px-6 py-3.5">M: {r.majorSubject || "None"} / Mi: {r.minorSubject || "None"}</td>
                            </tr>
                          ))}

                          {previewActiveTab === "updated" && uploadPreview.preview.updatedRecords.map((r: any, i: number) => (
                            <tr key={i} className="hover:bg-neutral-50/40 bg-amber-50/10">
                              <td className="px-6 py-3.5 font-bold text-neutral-800">
                                <div>
                                  <p>{r.name}</p>
                                  <p className="text-[10px] text-amber-600 font-medium mt-0.5">Existing: {r.existingRecord?.name}</p>
                                </div>
                              </td>
                              <td className="px-6 py-3.5">
                                <div className="space-y-0.5">
                                  <p className="font-mono text-neutral-800 font-semibold">Roll: {r.rollNumber || "—"}</p>
                                  <p className="font-mono text-neutral-500">Enroll: {r.enrollmentNumber || "—"}</p>
                                </div>
                              </td>
                              <td className="px-6 py-3.5">
                                <div className="space-y-0.5 font-mono">
                                  <p>F: {r.formNumber}</p>
                                  <p className="font-semibold text-neutral-800">R: {r.registrationId}</p>
                                </div>
                              </td>
                              <td className="px-6 py-3.5">
                                <div className="space-y-0.5">
                                  <p className="font-semibold text-neutral-800">{r.semester || "—"}</p>
                                  <p className="text-neutral-500">Batch: {r.batch || "—"}</p>
                                </div>
                              </td>
                              <td className="px-6 py-3.5">
                                <div className="space-y-0.5">
                                  <p>{r.email || "—"}</p>
                                  <p className="font-mono text-neutral-500">{r.mobile || "—"}</p>
                                </div>
                              </td>
                              <td className="px-6 py-3.5">M: {r.majorSubject || "None"} / Mi: {r.minorSubject || "None"}</td>
                            </tr>
                          ))}

                          {previewActiveTab === "duplicate" && uploadPreview.preview.duplicateRecords.map((r: any, i: number) => (
                            <tr key={i} className="hover:bg-neutral-50/40 opacity-60">
                              <td className="px-6 py-3.5 font-bold text-neutral-800">{r.name}</td>
                              <td className="px-6 py-3.5">
                                <div className="space-y-0.5">
                                  <p className="font-mono text-neutral-800 font-semibold">Roll: {r.rollNumber || "—"}</p>
                                  <p className="font-mono text-neutral-500">Enroll: {r.enrollmentNumber || "—"}</p>
                                </div>
                              </td>
                              <td className="px-6 py-3.5">
                                <div className="space-y-0.5 font-mono">
                                  <p>F: {r.formNumber}</p>
                                  <p className="font-semibold text-neutral-800">R: {r.registrationId}</p>
                                </div>
                              </td>
                              <td className="px-6 py-3.5">
                                <div className="space-y-0.5">
                                  <p className="font-semibold text-neutral-800">{r.semester || "—"}</p>
                                  <p className="text-neutral-500">Batch: {r.batch || "—"}</p>
                                </div>
                              </td>
                              <td className="px-6 py-3.5">
                                <div className="space-y-0.5">
                                  <p>{r.email || "—"}</p>
                                  <p className="font-mono text-neutral-500">{r.mobile || "—"}</p>
                                </div>
                              </td>
                              <td className="px-6 py-3.5">M: {r.majorSubject || "None"} / Mi: {r.minorSubject || "None"}</td>
                            </tr>
                          ))}

                          {previewActiveTab === "invalid" && uploadPreview.preview.invalidRecords.map((r: any, i: number) => (
                            <tr key={i} className="hover:bg-neutral-50/40 bg-red-50/10">
                              <td className="px-6 py-3.5 font-bold text-red-800">{r.name || "UNNAMED"}</td>
                              <td className="px-6 py-3.5" colSpan={4}>
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded">
                                  {r.errorReason}
                                </span>
                              </td>
                              <td className="px-6 py-3.5">M: {r.majorSubject || "None"} / Mi: {r.minorSubject || "None"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}

          {/* TAB 4: IMPORT HISTORY */}
          {activeTab === "history" && (
            <div className="space-y-6" id="view-history">
              <div className="bg-white rounded-xl border border-neutral-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-neutral-50 border-b border-neutral-100">
                  <h3 className="font-bold text-neutral-800 text-sm">PDF Ingestion History Logs</h3>
                </div>

                {historyLoading ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-3 text-neutral-400">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <span className="text-sm font-semibold">Loading history logs...</span>
                  </div>
                ) : importHistory.length === 0 ? (
                  <div className="py-20 text-center text-neutral-400">
                    <History className="w-12 h-12 text-neutral-200 mx-auto mb-2" />
                    <p className="font-semibold text-neutral-700">No import history matches</p>
                    <p className="text-xs">Once you process PDF spreadsheets, the logs appear here.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto text-xs">
                    <table className="min-w-full divide-y divide-neutral-100 text-left">
                      <thead>
                        <tr className="bg-neutral-50/30 text-neutral-400 font-bold uppercase tracking-wider">
                          <th className="px-6 py-3.5">File Name</th>
                          <th className="px-6 py-3.5">Date Ingested</th>
                          <th className="px-6 py-3.5">Admin Email</th>
                          <th className="px-6 py-3.5">Metrics Breakdown (New / Updated / Duplicate / Invalid)</th>
                          <th className="px-6 py-3.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 text-neutral-700">
                        {importHistory.map((hist) => (
                          <tr key={hist.id} className="hover:bg-neutral-50/20">
                            <td className="px-6 py-4 font-bold text-neutral-800">{hist.fileName}</td>
                            <td className="px-6 py-4 font-mono">{new Date(hist.date).toLocaleString()}</td>
                            <td className="px-6 py-4">{hist.adminEmail}</td>
                            <td className="px-6 py-4">
                              <div className="flex gap-2 font-mono font-semibold">
                                <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded" title="Inserted">+{hist.newRecords}</span>
                                <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded" title="Updated">~{hist.updatedRecords}</span>
                                <span className="text-purple-600 bg-purple-50 px-2 py-0.5 rounded" title="Duplicate (Skipped)">={hist.duplicateRecords || 0}</span>
                                <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded" title="Invalid">!{hist.invalidRecords}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 uppercase">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{hist.status}</span>
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: ACTIVITY LOG */}
          {activeTab === "logs" && (
            <div className="space-y-6" id="view-logs">
              <div className="bg-white rounded-xl border border-neutral-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-neutral-50 border-b border-neutral-100">
                  <h3 className="font-bold text-neutral-800 text-sm">Security & Audit Activity Logs</h3>
                </div>

                {logsLoading ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-3 text-neutral-400">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <span className="text-sm font-semibold">Loading security audit...</span>
                  </div>
                ) : activityLogsList.length === 0 ? (
                  <div className="py-20 text-center text-neutral-400">
                    <p className="font-semibold text-neutral-700">No activity logs recorded yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto text-xs text-neutral-700 font-medium">
                    <table className="min-w-full divide-y divide-neutral-100 text-left">
                      <thead>
                        <tr className="bg-neutral-50/20 text-neutral-400 font-bold uppercase tracking-wider">
                          <th className="px-6 py-3.5">Action Event</th>
                          <th className="px-6 py-3.5">Admin Email</th>
                          <th className="px-6 py-3.5">Audit Context Details</th>
                          <th className="px-6 py-3.5">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 font-medium">
                        {activityLogsList.map((log) => (
                          <tr key={log.id} className="hover:bg-neutral-50/20">
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded font-bold uppercase text-[9px] bg-neutral-100 text-neutral-800 border">
                                {log.action}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-semibold text-neutral-600">{log.adminEmail}</td>
                            <td className="px-6 py-4 font-semibold text-neutral-800">{log.details}</td>
                            <td className="px-6 py-4 font-mono text-[10px] text-neutral-400">
                              {new Date(log.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: SETTINGS */}
          {activeTab === "settings" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="view-settings">
              
              {/* Box Left: College Information Settings */}
              <div className="bg-white p-6 rounded-xl border border-neutral-100 shadow-sm space-y-4 text-left">
                <h3 className="text-base font-bold text-neutral-800 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-neutral-500" />
                  <span>College & Search Management</span>
                </h3>

                {settingsLoading ? (
                  <div className="py-12 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                ) : (
                  <form onSubmit={handleUpdateSettings} className="space-y-4 text-xs font-semibold text-neutral-600">
                    
                    {settingsMessage && (
                      <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-2.5 rounded-lg font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>{settingsMessage}</span>
                      </div>
                    )}

                    <div>
                      <label className="block mb-1">College/Institution Title</label>
                      <input
                        type="text"
                        required
                        value={settingsForm.collegeName}
                        onChange={(e) => setSettingsForm({ ...settingsForm, collegeName: e.target.value })}
                        className="w-full p-2.5 border rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="block mb-1">Department/Course Title</label>
                      <input
                        type="text"
                        required
                        value={settingsForm.departmentName}
                        onChange={(e) => setSettingsForm({ ...settingsForm, departmentName: e.target.value })}
                        className="w-full p-2.5 border rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="block mb-1">System Timezone</label>
                      <input
                        type="text"
                        disabled
                        value={settingsForm.timezone}
                        className="w-full p-2.5 border bg-neutral-100 rounded-lg text-xs font-mono opacity-80 cursor-not-allowed"
                      />
                      <p className="text-[10px] text-neutral-400 mt-1 font-medium">Locked to Indian Standard Time (Asia/Kolkata).</p>
                    </div>

                    {/* Checkboxes for Search visibility options */}
                    <div className="space-y-2.5 pt-2">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settingsForm.publicSearchEnabled}
                          onChange={(e) => setSettingsForm({ ...settingsForm, publicSearchEnabled: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-xs text-neutral-800">Enable Public Student Search</span>
                      </label>

                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settingsForm.emailVisibleToPublic}
                          onChange={(e) => setSettingsForm({ ...settingsForm, emailVisibleToPublic: e.target.checked })}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs text-neutral-800">Show Student Email on Public Search Page</span>
                      </label>

                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settingsForm.mobileVisibleToPublic}
                          onChange={(e) => setSettingsForm({ ...settingsForm, mobileVisibleToPublic: e.target.checked })}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs text-neutral-800">Show Student Mobile/Phone on Public Search Page</span>
                      </label>

                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settingsForm.enablePrivateFields}
                          onChange={(e) => setSettingsForm({ ...settingsForm, enablePrivateFields: e.target.checked })}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs text-neutral-800 font-bold">Enable Email & Mobile (Admin Only) Viewing/Editing</span>
                      </label>
                    </div>

                     {/* Maintenance Mode Configuration */}
                    <div className="border-t border-neutral-200 pt-4 mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-neutral-800">System Maintenance Mode</h4>
                          <p className="text-[10px] text-neutral-400 font-medium">When active, public search features are completely hidden and replaced with a notice.</p>
                        </div>
                        <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg shadow-sm border transition-all duration-300 ${
                          settingsForm.maintenanceMode 
                            ? "bg-amber-50 text-amber-800 border-amber-200 animate-pulse" 
                            : "bg-emerald-50 text-emerald-800 border-emerald-200"
                        }`}>
                          {settingsForm.maintenanceMode ? "⚠️ Under Maintenance" : "🟢 System Active / Public"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 pt-1">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settingsForm.maintenanceMode}
                            onChange={(e) => setSettingsForm({ ...settingsForm, maintenanceMode: e.target.checked })}
                            className="sr-only peer"
                            id="maintenance-toggle"
                          />
                          <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                          <span className="ml-2 text-xs font-semibold text-neutral-800">Enable Maintenance Mode</span>
                        </label>
                      </div>

                      <div>
                        <label className="block mb-1 text-neutral-600 font-semibold">Custom Maintenance Message (Optional)</label>
                        <textarea
                          rows={2}
                          placeholder="We are currently updating the student records system. Please check back later."
                          value={settingsForm.maintenanceMessage || ""}
                          onChange={(e) => setSettingsForm({ ...settingsForm, maintenanceMessage: e.target.value })}
                          className="w-full p-2.5 border rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 bg-neutral-50/10"
                          id="maintenance-message"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full inline-flex justify-center bg-blue-600 text-white font-bold text-xs py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Save Configuration
                    </button>
                  </form>
                )}
              </div>

              {/* Box Right: Password change options */}
              <div className="bg-white p-6 rounded-xl border border-neutral-100 shadow-sm space-y-4 text-left">
                <h3 className="text-base font-bold text-neutral-800 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-neutral-500" />
                  <span>Update Admin Password</span>
                </h3>

                <form onSubmit={handleChangePassword} className="space-y-4 text-xs font-semibold text-neutral-600">
                  
                  {passwordError && (
                    <div className="bg-red-50 border border-red-100 text-red-700 p-2.5 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span>{passwordError}</span>
                    </div>
                  )}

                  {passwordSuccess && (
                    <div className="bg-green-50 border border-green-100 text-green-800 p-2.5 rounded-lg flex items-center gap-2 font-bold">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span>{passwordSuccess}</span>
                    </div>
                  )}

                  <div>
                    <label className="block mb-1">Current Password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      className="w-full p-2.5 border rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block mb-1">New Administrator Password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      className="w-full p-2.5 border rounded-lg text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="w-full inline-flex justify-center bg-neutral-900 text-white font-bold text-xs py-2.5 rounded-lg hover:bg-neutral-850 transition-colors disabled:opacity-50"
                  >
                    {passwordSaving ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Updating credentials...</span>
                      </span>
                    ) : (
                      <span>Change Password</span>
                    )}
                  </button>
                </form>
              </div>

              {/* Box Bottom: Dynamic Batch Management */}
              <div className="bg-white p-6 rounded-xl border border-neutral-100 shadow-sm space-y-4 text-left md:col-span-2">
                <h3 className="text-base font-bold text-neutral-800 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-neutral-500" />
                  <span>Dynamic Academic Batches / Years</span>
                </h3>
                <p className="text-xs text-neutral-400">
                  Manage the official academic batches. When you add a new batch here, it instantly syncs to the database and populates in the Student Manual form, search filters, and statistics.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                  {/* Form to Add Batch */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wide">Add New Batch</h4>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newBatchName.trim()) return;
                      setAddingBatch(true);
                      setBatchError(null);
                      try {
                        const res = await fetch("/api/admin/batches", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`
                          },
                          body: JSON.stringify({ name: newBatchName.trim() })
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          throw new Error(data.error || "Failed to add batch");
                        }
                        setNewBatchName("");
                        fetchBatches();
                      } catch (err: any) {
                        setBatchError(err.message);
                      } finally {
                        setAddingBatch(false);
                      }
                    }} className="space-y-3 text-xs font-semibold text-neutral-600">
                      <div>
                        <label className="block mb-1">Batch / Academic Year Title</label>
                        <input
                          type="text"
                          required
                          value={newBatchName}
                          onChange={(e) => setNewBatchName(e.target.value)}
                          placeholder="e.g. 2026–2029"
                          className="w-full p-2.5 border rounded-lg text-xs"
                        />
                        <p className="text-[10px] text-neutral-400 mt-1 font-medium">Use standardized dashes (e.g. 2026–2029).</p>
                      </div>

                      {batchError && (
                        <p className="text-red-600 text-xs font-bold">{batchError}</p>
                      )}

                      <button
                        type="submit"
                        disabled={addingBatch}
                        className="w-full inline-flex justify-center bg-blue-600 text-white font-bold text-xs py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {addingBatch ? "Adding..." : "Add Academic Batch"}
                      </button>
                    </form>
                  </div>

                  {/* List of Existing Batches */}
                  <div className="md:col-span-2 space-y-3">
                    <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wide">Current Academic Batches</h4>
                    <div className="border border-neutral-100 rounded-lg overflow-hidden divide-y divide-neutral-100 max-h-60 overflow-y-auto">
                      {batchesList.length === 0 ? (
                        <p className="p-4 text-xs text-neutral-400 text-center font-medium">No batches created. Use the form to add the first batch.</p>
                      ) : (
                        batchesList.map((b) => (
                          <div key={b.id} className="p-3 bg-neutral-50/50 hover:bg-neutral-50 flex items-center justify-between text-xs">
                            <span className="font-bold text-neutral-800">{b.name}</span>
                            <button
                              onClick={async () => {
                                if (!confirm(`Are you sure you want to delete batch ${b.name}?`)) return;
                                try {
                                  const res = await fetch(`/api/admin/batches/${b.id}`, {
                                    method: "DELETE",
                                    headers: { Authorization: `Bearer ${token}` }
                                  });
                                  if (res.ok) {
                                    fetchBatches();
                                  } else {
                                    const errData = await res.json();
                                    alert(errData.error || "Failed to delete batch");
                                  }
                                } catch (err) {
                                  console.error("Delete batch error:", err);
                                }
                              }}
                              className="text-[10px] text-red-600 font-bold hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 7: ANALYTICS & INSIGHTS */}
          {activeTab === "analytics" && (
            <AnalyticsPanel token={token} />
          )}

        </div>
      </main>

    </div>
  );
}
