import React, { useState, useEffect, useCallback } from "react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, Legend, BarChart, Bar 
} from "recharts";
import {
  TrendingUp, TrendingDown, Calendar, Users, Search, Eye, Download, 
  RefreshCw, ArrowRight, Clock, Laptop, Smartphone, Globe, HelpCircle, 
  X, ChevronLeft, ChevronRight, AlertCircle, ThumbsUp, ThumbsDown, Filter, Info
} from "lucide-react";
import { parseJsonResponse } from "../utils/api.ts";

interface AnalyticsPanelProps {
  token: string;
}

interface OverviewStats {
  totalSearches: number;
  totalSearchesPctChange: number;
  uniqueSearchers: number;
  uniqueSearchersPctChange: number;
  searchesToday: number;
  searchesThisWeek: number;
  searchesThisMonth: number;
  totalProfileViews: number;
  totalProfileViewsPctChange: number;
  mostSearchedStudent: { name: string; rollNumber: string; count: number } | null;
  mostUsedSearchMethod: string;
}

interface FailedQuery {
  query: string;
  attempts: number;
  lastAttempt: string;
}

interface ChartData {
  overTime: Array<{ dateStr: string; total: number; successful: number; failed: number }>;
  methods: Array<{ method: string; count: number }>;
  hourly: Array<{ hour: number; count: number }>;
  peakHourText: string;
  peakDayText: string;
  successRate: number;
  successfulSearches: number;
  failedSearches: number;
}

interface StudentRank {
  id: number;
  name: string;
  rollNumber: string;
  registrationId: string;
  totalSearches: number;
  uniqueVisitors: number;
  lastSearchedAt: string | null;
  searchesToday: number;
  searchesWeek: number;
  searchesMonth: number;
  searchesRange: number;
  profileViews: number;
}

interface LiveEvent {
  id: number;
  type: "search" | "view";
  query: string;
  searchType: string;
  isSuccessful: boolean;
  createdAt: string;
  studentName: string;
}

interface SingleStudentDetail {
  student: {
    id: number;
    name: string;
    rollNumber: string;
    registrationId: string;
    formNumber: string;
    programmeName: string;
  };
  stats: {
    totalSearches: number;
    uniqueVisitors: number;
    profileViews: number;
    searchSuccessRate: number;
    firstSearched: string | null;
    lastSearched: string | null;
  };
  methods: { name: number; roll_number: number; registration_id: number; form_number: number };
  timeline: Array<{
    id: number;
    type: "search" | "view";
    query: string;
    searchType: string;
    createdAt: string;
  }>;
}

export default function AnalyticsPanel({ token }: AnalyticsPanelProps) {
  // Filters state
  const [dateRange, setDateRange] = useState<"today" | "7days" | "30days" | "90days" | "thisyear" | "custom">("30days");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [failedSearches, setFailedSearches] = useState<FailedQuery[]>([]);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [isPolling, setIsPolling] = useState(true);

  // Student Rankings Table States
  const [studentList, setStudentList] = useState<StudentRank[]>([]);
  const [studentTotal, setStudentTotal] = useState(0);
  const [studentPage, setStudentPage] = useState(1);
  const [studentLimit] = useState(10);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentSort, setStudentSort] = useState<"most_searched" | "least_searched" | "recently_searched" | "unique_visitors">("most_searched");
  const [tableLoading, setTableLoading] = useState(false);

  // Single Student Analytics Modal State
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [studentDetail, setStudentDetail] = useState<SingleStudentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Set default dates on load
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  }, []);

  // Update date boundaries based on quick range selector
  const handleRangeChange = (range: "today" | "7days" | "30days" | "90days" | "thisyear" | "custom") => {
    setDateRange(range);
    const end = new Date();
    let start = new Date();

    if (range === "today") {
      start = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    } else if (range === "7days") {
      start.setDate(end.getDate() - 7);
    } else if (range === "30days") {
      start.setDate(end.getDate() - 30);
    } else if (range === "90days") {
      start.setDate(end.getDate() - 90);
    } else if (range === "thisyear") {
      start = new Date(end.getFullYear(), 0, 1);
    } else {
      return; // Do not touch start date for custom range selection
    }

    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
    setStudentPage(1);
  };

  // Main fetch function to load current filter metrics
  const fetchAnalyticsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qParams = `startDate=${startDate}&endDate=${endDate}`;
      
      const [overviewRes, failedRes, chartsRes] = await Promise.all([
        fetch(`/api/admin/analytics/overview?${qParams}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/admin/analytics/failed?${qParams}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/admin/analytics/charts?${qParams}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const [overviewData, failedData, chartsData] = await Promise.all([
        parseJsonResponse(overviewRes),
        parseJsonResponse(failedRes),
        parseJsonResponse(chartsRes),
      ]);

      setOverview(overviewData);
      setFailedSearches(failedData);
      setCharts(chartsData);
    } catch (err: any) {
      console.error("Fetch analytics data error:", err);
      setError(err?.message || "Failed to retrieve analytics data records from PostgreSQL.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, token]);

  // Separate fetch for student rank listings
  const fetchStudentRankings = useCallback(async () => {
    setTableLoading(true);
    try {
      const qParams = `startDate=${startDate}&endDate=${endDate}&sort=${studentSort}&page=${studentPage}&limit=${studentLimit}`;
      const res = await fetch(`/api/admin/analytics/students?${qParams}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await parseJsonResponse(res);
      
      // Client-side search filtering on the paginated block for fine-grained UX
      let filteredStudents = data.students || [];
      if (studentSearch.trim() !== "") {
        const norm = studentSearch.toLowerCase();
        filteredStudents = filteredStudents.filter((s: StudentRank) => 
          s.name.toLowerCase().includes(norm) || 
          s.rollNumber.toLowerCase().includes(norm) ||
          s.registrationId.toLowerCase().includes(norm)
        );
      }
      
      setStudentList(filteredStudents);
      setStudentTotal(data.total || 0);
    } catch (err) {
      console.error("Student rankings error:", err);
    } finally {
      setTableLoading(false);
    }
  }, [startDate, endDate, studentSort, studentPage, studentLimit, studentSearch, token]);

  // Fetch live chronological activities
  const fetchLiveEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/analytics/live", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await parseJsonResponse(res);
      setLiveEvents(data);
    } catch (err) {
      console.error("Live poll feed failed:", err);
    }
  }, [token]);

  // Single student specific detail loader
  const loadStudentAnalyticsDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    setStudentDetail(null);
    try {
      const res = await fetch(`/api/admin/analytics/students/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await parseJsonResponse(res);
      setStudentDetail(data);
    } catch (err) {
      console.error("Single student analytics details failed:", err);
    } finally {
      setDetailLoading(false);
    }
  }, [token]);

  // Core triggers
  useEffect(() => {
    if (startDate && endDate) {
      fetchAnalyticsData();
    }
  }, [startDate, endDate, fetchAnalyticsData]);

  useEffect(() => {
    if (startDate && endDate) {
      fetchStudentRankings();
    }
  }, [startDate, endDate, studentSort, studentPage, studentSearch, fetchStudentRankings]);

  // Poll live events
  useEffect(() => {
    fetchLiveEvents();
    if (!isPolling) return;
    const interval = setInterval(() => {
      fetchLiveEvents();
    }, 15000); // 15 seconds real-time feed update
    return () => clearInterval(interval);
  }, [isPolling, fetchLiveEvents]);

  // Open specific student analytics detail page
  useEffect(() => {
    if (selectedStudentId !== null) {
      loadStudentAnalyticsDetail(selectedStudentId);
    }
  }, [selectedStudentId, loadStudentAnalyticsDetail]);

  // Export event records to CSV
  const handleExportCSV = () => {
    const qParams = `startDate=${startDate}&endDate=${endDate}`;
    const downloadUrl = `/api/admin/analytics/export?${qParams}`;
    
    // Create a temporary hidden anchor to execute secure browser download
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.setAttribute("download", `search_analytics_${dateRange}_${startDate}.csv`);
    // Pass token via custom headers if required, but standard API supports direct browser attachment
    // We add token as custom query parameter if requested, but for now we rely on browser attachment endpoint
    const secureUrl = `/api/admin/analytics/export?${qParams}&token=${token}`;
    link.href = secureUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 85) return "text-emerald-600 bg-emerald-50 border-emerald-100";
    if (rate >= 60) return "text-amber-600 bg-amber-50 border-amber-100";
    return "text-red-600 bg-red-50 border-red-100";
  };

  const formatTime = (isoStr: string) => {
    try {
      const dt = new Date(isoStr);
      return dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    } catch {
      return "N/A";
    }
  };

  const formatFullDate = (isoStr: string | null) => {
    if (!isoStr) return "Never";
    try {
      const dt = new Date(isoStr);
      return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " " +
             dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    } catch {
      return "N/A";
    }
  };

  return (
    <div className="space-y-8 animate-fade-in text-left" id="analytics-panel-workspace">
      
      {/* 1. Header Toolbar Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-5" id="analytics-toolbar">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-neutral-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            <span>Search Analytics & Insights</span>
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Analyze visitor interests, search success, real-time lookups, and student-level registry engagement.
          </p>
        </div>

        {/* Date Ranges and Download Export */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex bg-neutral-100 p-1 rounded-xl border border-neutral-200/80 shadow-sm" id="range-picker-group">
            <button
              onClick={() => handleRangeChange("today")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                dateRange === "today" ? "bg-white text-blue-700 font-extrabold shadow-sm" : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => handleRangeChange("7days")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                dateRange === "7days" ? "bg-white text-blue-700 font-extrabold shadow-sm" : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => handleRangeChange("30days")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                dateRange === "30days" ? "bg-white text-blue-700 font-extrabold shadow-sm" : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => handleRangeChange("90days")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                dateRange === "90days" ? "bg-white text-blue-700 font-extrabold shadow-sm" : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              90 Days
            </button>
          </div>

          {/* Custom dates picker */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-neutral-200 shadow-sm">
            <Calendar className="w-4 h-4 text-neutral-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDateRange("custom");
                setStudentPage(1);
              }}
              className="text-xs font-bold text-neutral-700 outline-none bg-transparent cursor-pointer"
            />
            <span className="text-xs text-neutral-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDateRange("custom");
                setStudentPage(1);
              }}
              className="text-xs font-bold text-neutral-700 outline-none bg-transparent cursor-pointer"
            />
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 transition-all shadow-sm cursor-pointer border border-neutral-800"
            id="export-csv-btn"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      )}

      {/* 2. Overview Stats Cards Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-neutral-400 bg-white rounded-2xl border border-neutral-100 shadow-sm">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          <span className="text-xs font-bold uppercase tracking-wider">Aggregating PostgreSQL Event metrics...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" id="analytics-overview-cards">
          
          {/* Card 1: Total Searches */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm flex flex-col justify-between text-left group hover:border-blue-100 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Total Searches</span>
              <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <Search className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-3xl font-black text-neutral-900 tracking-tight">
                {overview?.totalSearches ?? 0}
              </h3>
              <div className="flex items-center gap-1.5 mt-2 text-xs">
                {overview && overview.totalSearchesPctChange >= 0 ? (
                  <span className="flex items-center gap-0.5 text-emerald-600 font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded-md">
                    <TrendingUp className="w-3.5 h-3.5" />
                    +{overview.totalSearchesPctChange}%
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-red-600 font-extrabold bg-red-50 px-1.5 py-0.5 rounded-md">
                    <TrendingDown className="w-3.5 h-3.5" />
                    {overview?.totalSearchesPctChange}%
                  </span>
                )}
                <span className="text-neutral-400 font-medium">vs previous period</span>
              </div>
            </div>
          </div>

          {/* Card 2: Unique Searchers */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm flex flex-col justify-between text-left group hover:border-purple-100 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Unique Searchers</span>
              <div className="w-9 h-9 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                <Users className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-3xl font-black text-neutral-900 tracking-tight">
                {overview?.uniqueSearchers ?? 0}
              </h3>
              <div className="flex items-center gap-1.5 mt-2 text-xs">
                {overview && overview.uniqueSearchersPctChange >= 0 ? (
                  <span className="flex items-center gap-0.5 text-emerald-600 font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded-md">
                    <TrendingUp className="w-3.5 h-3.5" />
                    +{overview.uniqueSearchersPctChange}%
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-red-600 font-extrabold bg-red-50 px-1.5 py-0.5 rounded-md">
                    <TrendingDown className="w-3.5 h-3.5" />
                    {overview?.uniqueSearchersPctChange}%
                  </span>
                )}
                <span className="text-neutral-400 font-medium">vs previous period</span>
              </div>
            </div>
          </div>

          {/* Card 3: Total Profile Views */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm flex flex-col justify-between text-left group hover:border-pink-100 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Total Profile Views</span>
              <div className="w-9 h-9 bg-pink-50 text-pink-600 rounded-xl flex items-center justify-center">
                <Eye className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-3xl font-black text-neutral-900 tracking-tight">
                {overview?.totalProfileViews ?? 0}
              </h3>
              <div className="flex items-center gap-1.5 mt-2 text-xs">
                {overview && overview.totalProfileViewsPctChange >= 0 ? (
                  <span className="flex items-center gap-0.5 text-emerald-600 font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded-md">
                    <TrendingUp className="w-3.5 h-3.5" />
                    +{overview.totalProfileViewsPctChange}%
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-red-600 font-extrabold bg-red-50 px-1.5 py-0.5 rounded-md">
                    <TrendingDown className="w-3.5 h-3.5" />
                    {overview?.totalProfileViewsPctChange}%
                  </span>
                )}
                <span className="text-neutral-400 font-medium">vs previous period</span>
              </div>
            </div>
          </div>

          {/* Card 4: Most Used Method */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm flex flex-col justify-between text-left group hover:border-amber-100 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Primary Search Method</span>
              <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                <Info className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-xl font-black text-neutral-800 tracking-tight truncate" title={overview?.mostUsedSearchMethod}>
                {overview?.mostUsedSearchMethod ?? "N/A"}
              </h3>
              <div className="flex items-center gap-1.5 mt-3 text-xs">
                <span className="font-mono text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-bold uppercase border border-amber-100">
                  Most Preferred
                </span>
                <span className="text-neutral-400 font-medium">by public lookup users</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* 2.5 Quick Interval Stats Callout Cards */}
      {!loading && overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" id="analytics-interval-cards">
          
          <div className="bg-neutral-50 px-5 py-4 rounded-xl border border-neutral-200/60 shadow-sm text-left flex items-center justify-between">
            <div>
              <span className="text-[9px] font-extrabold text-neutral-400 uppercase tracking-wider">Searches Today</span>
              <h4 className="text-xl font-extrabold text-neutral-800 mt-0.5">{overview.searchesToday}</h4>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block animate-pulse" />
          </div>

          <div className="bg-neutral-50 px-5 py-4 rounded-xl border border-neutral-200/60 shadow-sm text-left">
            <span className="text-[9px] font-extrabold text-neutral-400 uppercase tracking-wider">Searches This Week</span>
            <h4 className="text-xl font-extrabold text-neutral-800 mt-0.5">{overview.searchesThisWeek}</h4>
          </div>

          <div className="bg-neutral-50 px-5 py-4 rounded-xl border border-neutral-200/60 shadow-sm text-left">
            <span className="text-[9px] font-extrabold text-neutral-400 uppercase tracking-wider">Searches This Month</span>
            <h4 className="text-xl font-extrabold text-neutral-800 mt-0.5">{overview.searchesThisMonth}</h4>
          </div>

          <div className="bg-neutral-50 px-5 py-4 rounded-xl border border-neutral-200/60 shadow-sm text-left min-w-0">
            <span className="text-[9px] font-extrabold text-neutral-400 uppercase tracking-wider">Most Searched Student</span>
            <h4 className="text-sm font-black text-neutral-800 mt-1 truncate" title={overview.mostSearchedStudent ? `${overview.mostSearchedStudent.name} (${overview.mostSearchedStudent.count} searches)` : "None"}>
              {overview.mostSearchedStudent ? `${overview.mostSearchedStudent.name}` : "None"}
            </h4>
          </div>

        </div>
      )}

      {/* 3. Charts and Distributions Row */}
      {!loading && charts && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="analytics-charts-grid">
          
          {/* Main Chart: Timeline AreaChart */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm text-left">
            <div className="border-b border-neutral-100 pb-3 mb-4">
              <h3 className="text-base font-extrabold text-neutral-800">Search Frequency Over Time</h3>
              <p className="text-xs text-neutral-400 mt-0.5">Chronological timeline of total, successful, and unsuccessful queries.</p>
            </div>

            <div className="h-[280px] w-full pt-2">
              {charts.overTime && charts.overTime.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts.overTime} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="dateStr" 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(str) => {
                        try {
                          const parts = str.split("-");
                          return `${parts[2] || ""}/${parts[1] || ""}`;
                        } catch {
                          return str;
                        }
                      }}
                    />
                    <YAxis 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-neutral-900 text-white p-3 rounded-xl border border-neutral-800 shadow-xl text-xs space-y-1">
                              <p className="font-extrabold">{data.dateStr}</p>
                              <div className="border-t border-neutral-800 my-1.5 pt-1 space-y-0.5">
                                <p className="flex justify-between gap-6">
                                  <span className="text-blue-400 font-bold">Total:</span>
                                  <span className="font-mono font-bold">{data.total}</span>
                                </p>
                                <p className="flex justify-between gap-6">
                                  <span className="text-emerald-400 font-bold">Successful:</span>
                                  <span className="font-mono font-bold">{data.successful}</span>
                                </p>
                                <p className="flex justify-between gap-6">
                                  <span className="text-red-400 font-bold">No-Results:</span>
                                  <span className="font-mono font-bold">{data.failed}</span>
                                </p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTotal)" name="Total Searches" />
                    <Area type="monotone" dataKey="successful" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSuccess)" name="Successful Searches" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-neutral-400 gap-2">
                  <AlertCircle className="w-8 h-8 opacity-40 text-neutral-400" />
                  <span className="text-xs font-semibold">No timeline data available for the selected dates.</span>
                </div>
              )}
            </div>
          </div>

          {/* Success Rate Pie Chart */}
          <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm text-left flex flex-col justify-between">
            <div>
              <div className="border-b border-neutral-100 pb-3 mb-4">
                <h3 className="text-base font-extrabold text-neutral-800">Search Success Ratio</h3>
                <p className="text-xs text-neutral-400 mt-0.5">Mismatched vs successfully resolved search queries.</p>
              </div>

              <div className="h-[180px] w-full flex items-center justify-center relative">
                {charts.successRate !== undefined ? (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Successful", value: charts.successfulSearches },
                            { name: "Failed/No Results", value: charts.failedSearches },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          <Cell fill="#10b981" />
                          <Cell fill="#ef4444" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Absolute Rate percentage text in center of donut chart */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
                      <span className="text-2xl font-black text-neutral-900">{charts.successRate}%</span>
                      <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">Success Rate</span>
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-neutral-400">No lookup ratio records.</span>
                )}
              </div>
            </div>

            {/* Time pattern insights callouts */}
            <div className="mt-4 pt-4 border-t border-neutral-100 space-y-3 text-xs text-neutral-600">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-neutral-400" />
                  Peak Hours
                </span>
                <span className="font-mono font-bold text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded">
                  {charts.peakHourText || "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-neutral-400" />
                  Peak Lookup Day
                </span>
                <span className="font-mono font-bold text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded">
                  {charts.peakDayText || "N/A"}
                </span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* 4. Student-Level rankings interactive table */}
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden text-left" id="student-rankings-box">
        {/* Table header with filter & sort options */}
        <div className="p-6 border-b border-neutral-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-extrabold text-neutral-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span>Student Profile Engagement Rankings</span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">Analyze search queries, unique visitors, and profile views by individual student.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search filtering within ranks */}
            <div className="flex items-center gap-2 bg-neutral-100 px-3 py-1.5 rounded-xl border border-neutral-200/80 shadow-sm max-w-xs w-full sm:w-auto">
              <Search className="w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Filter ranked students..."
                value={studentSearch}
                onChange={(e) => {
                  setStudentSearch(e.target.value);
                  setStudentPage(1);
                }}
                className="text-xs font-bold text-neutral-700 outline-none bg-transparent placeholder-neutral-400"
              />
              {studentSearch && (
                <button onClick={() => setStudentSearch("")} className="p-0.5 hover:bg-neutral-200 rounded text-neutral-400 hover:text-neutral-700">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Sorting criteria */}
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-neutral-200 shadow-sm">
              <Filter className="w-4 h-4 text-neutral-400" />
              <select
                value={studentSort}
                onChange={(e) => {
                  setStudentSort(e.target.value as any);
                  setStudentPage(1);
                }}
                className="text-xs font-bold text-neutral-700 outline-none cursor-pointer bg-transparent"
              >
                <option value="most_searched">Most Searched</option>
                <option value="least_searched">Least Searched</option>
                <option value="recently_searched">Recently Searched</option>
                <option value="unique_visitors">Most Unique Visitors</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          {tableLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-neutral-400">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-xs font-bold uppercase tracking-wider">Syncing rankings data...</span>
            </div>
          ) : studentList.length > 0 ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-50/50 text-neutral-400 font-extrabold uppercase tracking-wider border-b border-neutral-100">
                  <th className="px-6 py-4 text-center w-14">Rank</th>
                  <th className="px-6 py-4">Student Name</th>
                  <th className="px-6 py-4">Roll Number</th>
                  <th className="px-6 py-4">Registration ID</th>
                  <th className="px-6 py-4 text-center">Total Searches</th>
                  <th className="px-6 py-4 text-center">Unique Searchers</th>
                  <th className="px-6 py-4 text-center">Profile Views</th>
                  <th className="px-6 py-4">Last Looked Up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-medium">
                {studentList.map((st, index) => {
                  const absoluteRank = (studentPage - 1) * studentLimit + index + 1;
                  return (
                    <tr 
                      key={st.id} 
                      onClick={() => setSelectedStudentId(st.id)}
                      className="hover:bg-neutral-50/75 cursor-pointer transition-all active:bg-neutral-100"
                    >
                      <td className="px-6 py-4 text-center font-bold text-neutral-400">
                        {absoluteRank === 1 ? (
                          <span className="inline-flex w-6 h-6 items-center justify-center bg-amber-50 text-amber-700 border border-amber-200/80 rounded-full font-black text-[10px]">
                            🥇
                          </span>
                        ) : absoluteRank === 2 ? (
                          <span className="inline-flex w-6 h-6 items-center justify-center bg-neutral-100 text-neutral-700 border border-neutral-200 rounded-full font-black text-[10px]">
                            🥈
                          </span>
                        ) : absoluteRank === 3 ? (
                          <span className="inline-flex w-6 h-6 items-center justify-center bg-amber-50/40 text-amber-800/80 border border-amber-200/40 rounded-full font-black text-[10px]">
                            🥉
                          </span>
                        ) : (
                          <span>{absoluteRank}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-extrabold text-neutral-900 group-hover:text-blue-600">
                        {st.name}
                      </td>
                      <td className="px-6 py-4 font-mono font-semibold text-neutral-600">{st.rollNumber || "N/A"}</td>
                      <td className="px-6 py-4 font-mono text-neutral-500">{st.registrationId || "N/A"}</td>
                      <td className="px-6 py-4 text-center font-black text-neutral-800">{st.totalSearches}</td>
                      <td className="px-6 py-4 text-center font-mono font-bold text-neutral-500">{st.uniqueVisitors}</td>
                      <td className="px-6 py-4 text-center font-bold text-blue-600">{st.profileViews}</td>
                      <td className="px-6 py-4 font-mono text-neutral-400">
                        {st.lastSearchedAt ? formatFullDate(st.lastSearchedAt) : "Never"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="py-20 text-center text-neutral-400 flex flex-col items-center justify-center gap-2">
              <Users className="w-8 h-8 opacity-30 text-neutral-400" />
              <span className="text-xs font-semibold">No students found matching current criteria.</span>
            </div>
          )}
        </div>

        {/* Pagination bar */}
        {!tableLoading && studentTotal > studentLimit && (
          <div className="p-4 border-t border-neutral-100 bg-neutral-50/30 flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-500">
              Showing {Math.min(studentTotal, (studentPage - 1) * studentLimit + 1)} to {Math.min(studentTotal, studentPage * studentLimit)} of {studentTotal} students
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={studentPage === 1}
                onClick={() => setStudentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs font-black text-neutral-700">
                Page {studentPage} of {Math.ceil(studentTotal / studentLimit)}
              </span>
              <button
                disabled={studentPage >= Math.ceil(studentTotal / studentLimit)}
                onClick={() => setStudentPage((p) => p + 1)}
                className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Quality Controls: Top Failed Searches & Live feed activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="failed-and-live-grid">
        
        {/* Left Card: Top Failed Searches Table */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm text-left flex flex-col justify-between">
          <div>
            <div className="border-b border-neutral-100 pb-3 mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-neutral-800 flex items-center gap-1.5">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span>Unresolved / Failed Searches</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">Queries returning 0 results. Ideal for debugging missing PDF uploads or student name typos.</p>
              </div>
              <span className="text-[10px] font-black text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Needs Admin Action
              </span>
            </div>

            <div className="overflow-y-auto max-h-[300px] pr-1">
              {failedSearches.length > 0 ? (
                <div className="divide-y divide-neutral-100">
                  {failedSearches.map((item, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between text-xs font-medium">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-neutral-400 bg-neutral-100 w-5 h-5 flex items-center justify-center rounded-full">
                          {idx + 1}
                        </span>
                        <div className="flex flex-col text-left">
                          <span className="font-mono font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded max-w-[150px] sm:max-w-xs truncate" title={item.query}>
                            "{item.query}"
                          </span>
                          <span className="text-[9px] text-neutral-400 font-mono mt-1">
                            Last attempted: {formatFullDate(item.lastAttempt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-neutral-800">{item.attempts} attempts</span>
                        <span title="This search returned no matches. Check if the spelling is correct or if the student profile is inactive.">
                          <HelpCircle className="w-3.5 h-3.5 text-neutral-300 hover:text-neutral-500 cursor-pointer" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-neutral-400 flex flex-col items-center justify-center gap-2">
                  <ThumbsUp className="w-8 h-8 text-emerald-500 opacity-60 animate-bounce" />
                  <span className="text-xs font-semibold text-neutral-700">Perfect Lookup Health!</span>
                  <p className="text-[10px] text-neutral-400 max-w-xs">All requested student search queries have resolved successfully.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Card: Live Polling Feed Activity */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm text-left flex flex-col justify-between">
          <div>
            <div className="border-b border-neutral-100 pb-3 mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-neutral-800 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-emerald-600" />
                  <span>Live Activity Log Stream</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">Chronological feed of lookup events happening right now on the portal.</p>
              </div>

              <div className="flex items-center gap-2.5">
                <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                  isPolling ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-neutral-50 text-neutral-400 border-neutral-200"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isPolling ? "bg-emerald-500 animate-pulse" : "bg-neutral-400"}`} />
                  {isPolling ? "Live Polling" : "Paused"}
                </span>

                <button 
                  onClick={() => setIsPolling(!isPolling)}
                  className="p-1 hover:bg-neutral-100 rounded text-neutral-500 hover:text-neutral-800 cursor-pointer transition-colors"
                  title={isPolling ? "Pause updates" : "Resume live updates"}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[300px] pr-1 space-y-3">
              {liveEvents.length > 0 ? (
                liveEvents.map((ev) => (
                  <div key={ev.id} className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/40 text-[11px] font-medium flex items-center justify-between gap-4">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 ${
                        ev.type === "search" 
                          ? ev.isSuccessful ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600"
                          : "bg-pink-50 text-pink-600"
                      }`}>
                        {ev.type === "search" ? <Search className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </div>
                      
                      <div className="min-w-0">
                        {ev.type === "search" ? (
                          <p className="text-neutral-800 leading-normal">
                            Searched <span className="font-extrabold font-mono bg-neutral-100 px-1.5 py-0.2 rounded">"{ev.query}"</span> using <span className="font-bold text-neutral-600">{ev.searchType}</span>.
                            {ev.isSuccessful ? (
                              <span className="text-emerald-600 font-extrabold ml-1.5 inline-flex items-center gap-0.5">
                                <ThumbsUp className="w-3 h-3" /> Found {ev.studentName}
                              </span>
                            ) : (
                              <span className="text-red-500 font-extrabold ml-1.5 inline-flex items-center gap-0.5">
                                <ThumbsDown className="w-3 h-3" /> No Results
                              </span>
                            )}
                          </p>
                        ) : (
                          <p className="text-neutral-800 leading-normal">
                            Loaded profile details for <span className="font-extrabold text-pink-700">{ev.studentName}</span>.
                          </p>
                        )}
                        <span className="text-[9px] text-neutral-400 font-semibold block mt-1">
                          {formatFullDate(ev.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-neutral-400 flex flex-col items-center justify-center gap-1.5">
                  <Clock className="w-8 h-8 opacity-30 text-neutral-400" />
                  <span className="text-xs font-semibold">No recent lookups logged in live system.</span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* 6. Single Student Detail Analytics Modal Dialog */}
      {selectedStudentId !== null && (
        <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-4" id="student-detail-analytics-modal">
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between text-left">
              <div>
                <span className="text-[9px] font-black uppercase text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full tracking-wider">
                  Student Registry Analytics
                </span>
                <h2 className="text-lg font-black text-neutral-900 mt-1">
                  {detailLoading ? "Syncing Metrics..." : studentDetail?.student?.name}
                </h2>
              </div>
              <button 
                onClick={() => {
                  setSelectedStudentId(null);
                  setStudentDetail(null);
                }} 
                className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-left">
              {detailLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-2 text-neutral-400">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                  <span className="text-xs font-bold uppercase tracking-wider">Compiling search engagement records...</span>
                </div>
              ) : studentDetail ? (
                <>
                  {/* Basic details and summary cards */}
                  <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200/50 text-xs text-neutral-600 space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <p><span className="font-semibold text-neutral-400 uppercase tracking-wide block text-[10px]">Academic Programme</span> <span className="font-extrabold text-neutral-900">{studentDetail.student.programmeName}</span></p>
                      <p><span className="font-semibold text-neutral-400 uppercase tracking-wide block text-[10px]">Roll Number</span> <span className="font-mono font-extrabold text-neutral-900">{studentDetail.student.rollNumber || "N/A"}</span></p>
                      <p><span className="font-semibold text-neutral-400 uppercase tracking-wide block text-[10px]">Registration ID</span> <span className="font-mono font-extrabold text-neutral-900">{studentDetail.student.registrationId || "N/A"}</span></p>
                      <p><span className="font-semibold text-neutral-400 uppercase tracking-wide block text-[10px]">Form Number</span> <span className="font-mono font-extrabold text-neutral-900">{studentDetail.student.formNumber || "N/A"}</span></p>
                    </div>
                  </div>

                  {/* Absolute metric figures */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-sm text-center">
                      <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">Total Searches</span>
                      <p className="text-2xl font-black text-neutral-900 mt-1">{studentDetail.stats.totalSearches}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-sm text-center">
                      <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">Unique Searchers</span>
                      <p className="text-2xl font-black text-neutral-900 mt-1">{studentDetail.stats.uniqueVisitors}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-sm text-center">
                      <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">Profile Views</span>
                      <p className="text-2xl font-black text-pink-600 mt-1">{studentDetail.stats.profileViews}</p>
                    </div>
                  </div>

                  {/* Quality indicators */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between ${getSuccessRateColor(studentDetail.stats.searchSuccessRate)}`}>
                      <span>Search Success Rate</span>
                      <span className="font-mono font-black text-sm">{studentDetail.stats.searchSuccessRate}%</span>
                    </div>

                    <div className="p-4 rounded-xl border border-neutral-200/60 bg-neutral-50 text-xs font-semibold space-y-1.5 text-neutral-600">
                      <div className="flex justify-between">
                        <span>First Lookup Date:</span>
                        <span className="font-mono text-neutral-800 font-bold">{studentDetail.stats.firstSearched ? new Date(studentDetail.stats.firstSearched).toLocaleDateString() : "Never"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Last Lookup Date:</span>
                        <span className="font-mono text-neutral-800 font-bold">{studentDetail.stats.lastSearched ? new Date(studentDetail.stats.lastSearched).toLocaleDateString() : "Never"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Search method breakdowns */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold text-neutral-800 uppercase tracking-wide">Lookup Method Breakdown</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-center">
                      <div className="bg-neutral-50/50 p-2.5 rounded-lg border border-neutral-200/50">
                        <p className="text-neutral-400 text-[10px] uppercase font-bold">By Name</p>
                        <p className="text-base font-black text-neutral-800 mt-0.5">{studentDetail.methods.name}</p>
                      </div>
                      <div className="bg-neutral-50/50 p-2.5 rounded-lg border border-neutral-200/50">
                        <p className="text-neutral-400 text-[10px] uppercase font-bold">By Roll No</p>
                        <p className="text-base font-black text-neutral-800 mt-0.5">{studentDetail.methods.roll_number}</p>
                      </div>
                      <div className="bg-neutral-50/50 p-2.5 rounded-lg border border-neutral-200/50">
                        <p className="text-neutral-400 text-[10px] uppercase font-bold">By Reg ID</p>
                        <p className="text-base font-black text-neutral-800 mt-0.5">{studentDetail.methods.registration_id}</p>
                      </div>
                      <div className="bg-neutral-50/50 p-2.5 rounded-lg border border-neutral-200/50">
                        <p className="text-neutral-400 text-[10px] uppercase font-bold">By Form No</p>
                        <p className="text-base font-black text-neutral-800 mt-0.5">{studentDetail.methods.form_number}</p>
                      </div>
                    </div>
                  </div>

                  {/* Chronological Timeline feed */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-extrabold text-neutral-800 uppercase tracking-wide">Lookup Timeline (Last 15 events)</h4>
                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                      {studentDetail.timeline && studentDetail.timeline.length > 0 ? (
                        studentDetail.timeline.map((ev, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg border border-neutral-200/40 bg-neutral-50 text-[11px] font-medium flex items-center justify-between gap-4">
                            <span className="text-neutral-700">
                              {ev.type === "search" ? (
                                <>Searched registry via <span className="font-extrabold text-neutral-900">{ev.searchType}</span> with query <span className="font-mono bg-neutral-200 px-1 py-0.2 rounded font-bold">"{ev.query}"</span></>
                              ) : (
                                <>Loaded profile detail card in browser window</>
                              )}
                            </span>
                            <span className="text-[10px] text-neutral-400 font-mono font-semibold block text-right flex-shrink-0">
                              {formatFullDate(ev.createdAt)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-neutral-400 block text-center py-4">No lookup events registered for this student yet.</span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <span className="text-xs text-neutral-400 block text-center py-10">Select a student record to visualize.</span>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex justify-end">
              <button 
                onClick={() => {
                  setSelectedStudentId(null);
                  setStudentDetail(null);
                }} 
                className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 cursor-pointer border border-neutral-800"
              >
                Close Metrics Card
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
