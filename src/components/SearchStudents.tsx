import { useState, useEffect, useRef } from "react";
import { Search, Loader2, AlertCircle, AlertTriangle, ChevronLeft, ChevronRight, EyeOff, LayoutGrid, List, RotateCcw } from "lucide-react";
import { Student } from "../types.ts";
import StudentCard from "./StudentCard.tsx";
import ErrorBoundary from "./ErrorBoundary.tsx";

// Helper to generate anonymous visitor/session IDs
export const getVisitorIds = () => {
  if (typeof window === "undefined") return { visitorHash: "anon", sessionId: "anon" };
  let visitorHash = localStorage.getItem("visitorHash");
  if (!visitorHash) {
    visitorHash = "vh_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem("visitorHash", visitorHash);
  }
  let sessionId = sessionStorage.getItem("sessionId");
  if (!sessionId) {
    sessionId = "sh_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    sessionStorage.setItem("sessionId", sessionId);
  }
  return { visitorHash, sessionId };
};

interface SearchStudentsProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  collegeName: string;
  departmentName: string;
  onViewDetails: (id: number) => void;
}

export default function SearchStudents({ 
  searchQuery = "", 
  setSearchQuery, 
  collegeName, 
  departmentName, 
  onViewDetails 
}: SearchStudentsProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Layout mode state ("grid" = Cards, "table" = Table)
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [batches, setBatches] = useState<{ id: number; name: string }[]>([]);
  const [semesterFilter, setSemesterFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState("");

  const semesters = [
    "1st Semester",
    "2nd Semester",
    "3rd Semester",
    "4th Semester",
    "5th Semester",
    "6th Semester",
  ];

  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  // Track latest fetch request to avoid race conditions
  const activeFetchId = useRef(0);

  // Load public batches for filter dropdown
  useEffect(() => {
    fetch("/api/public/batches")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load batches");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setBatches(data);
        }
      })
      .catch((err) => console.error("Failed to load public batches:", err));
  }, []);

  // Safe search trigger
  const triggerSearch = () => {
    const currentFetchId = ++activeFetchId.current;
    setLoading(true);
    setError(null);

    const safeQuery = String(searchQuery ?? "").trim();
    const safeSemester = String(semesterFilter ?? "").trim();
    const safeBatch = String(batchFilter ?? "").trim();

    const url = `/api/public/students/search?query=${encodeURIComponent(safeQuery)}&semester=${encodeURIComponent(safeSemester)}&batch=${encodeURIComponent(safeBatch)}&page=${page}&limit=${limit}`;

    const { visitorHash, sessionId } = getVisitorIds();
    const headers: Record<string, string> = {
      "x-visitor-hash": visitorHash,
      "x-session-id": sessionId
    };

    fetch(url, { headers })
      .then(async (res) => {
        if (!res.ok) {
          let errMsg = "Unable to load students. Please try again.";
          try {
            const errData = await res.json();
            if (errData?.error) errMsg = errData.error;
          } catch {
            // Ignore JSON parse error on non-200 responses
          }
          throw new Error(errMsg);
        }
        return res.json();
      })
      .then((data) => {
        // Discard stale responses from earlier queries
        if (currentFetchId !== activeFetchId.current) return;

        const rawList = Array.isArray(data?.students) ? data.students : [];
        // Sanitize every student item to prevent undefined fields
        const safeList: Student[] = rawList.map((s: any, idx: number) => ({
          id: typeof s?.id === "number" ? s.id : idx + 1,
          name: String(s?.name ?? "Unknown Student").trim() || "Unknown Student",
          registrationId: String(s?.registrationId ?? "").trim() || "N/A",
          formNumber: String(s?.formNumber ?? "").trim() || "N/A",
          rollNumber: s?.rollNumber ? String(s.rollNumber).trim() : null,
          enrollmentNumber: s?.enrollmentNumber ? String(s.enrollmentNumber).trim() : null,
          semester: s?.semester ? String(s.semester).trim() : null,
          batch: s?.batch ? String(s.batch).trim() : null,
          programmeName: String(s?.programmeName ?? "Bachelor of Computer Applications").trim() || "Bachelor of Computer Applications",
          majorSubject: String(s?.majorSubject ?? "Computer Application").trim() || "Computer Application",
          minorSubject: String(s?.minorSubject ?? "Mathematics").trim() || "Mathematics",
          gender: String(s?.gender ?? "MALE").trim() || "MALE",
          category: String(s?.category ?? "GENERAL").trim() || "GENERAL",
          admissionCategory: String(s?.admissionCategory ?? "GENERAL").trim() || "GENERAL",
          transactionMode: s?.transactionMode ? String(s.transactionMode).trim() : "CASH",
          email: s?.email ? String(s.email).trim() : undefined,
          mobile: s?.mobile ? String(s.mobile).trim() : undefined,
          status: String(s?.status ?? "Active"),
        }));

        setStudents(safeList);
        setTotal(typeof data?.total === "number" ? data.total : safeList.length);
        setLoading(false);
      })
      .catch((err: any) => {
        if (currentFetchId !== activeFetchId.current) return;
        console.error("Search API error:", err);
        setError(err.message || "Unable to load students. Please try again.");
        setStudents([]);
        setTotal(0);
        setLoading(false);
      });
  };

  // Fetch results when search query, page, or filters change (with 300ms debounce)
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      triggerSearch();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, semesterFilter, batchFilter, page]);

  // Reset page to 1 when a new search query is typed
  const handleSearchChange = (val: string) => {
    setSearchQuery(val ?? "");
    setPage(1);
  };

  // Clear all filters & query
  const handleClearFilters = () => {
    setSearchQuery("");
    setSemesterFilter("");
    setBatchFilter("");
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasActiveFilter = Boolean(String(searchQuery ?? "").trim() || semesterFilter || batchFilter);

  return (
    <ErrorBoundary fallbackTitle="Error loading Search Directory">
      <div className="bg-neutral-50 min-h-[calc(100vh-4rem)] py-8 px-4 sm:px-6 lg:px-8" id="search-view">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Banner with college logo */}
          <div className="bg-white p-6 rounded-xl border border-neutral-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
              <img 
                src="/college_logo.jpg" 
                alt="Pragjyotish College Logo" 
                className="w-14 h-14 rounded-full border border-neutral-100 p-0.5 object-contain bg-white shadow-sm flex-shrink-0"
                referrerPolicy="no-referrer"
              />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-neutral-800 tracking-tight">Search Students Directory</h1>
                <p className="text-xs text-neutral-500 mt-1">{collegeName} — {departmentName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-lg max-w-md">
              <EyeOff className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span><strong>Privacy Notice:</strong> Contact coordinates (Email, Mobile/Phone) are restricted under college registry privacy rules.</span>
            </div>
          </div>

          {/* Search Bar & Filter Controls */}
          <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search Input */}
              <div className="relative flex-grow min-w-0">
                <input
                  type="text"
                  placeholder="Search name, registration ID, roll number, form number..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-lg border border-neutral-200 text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  id="search-input"
                />
                <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-neutral-400" />
              </div>

              {/* Semester Filter */}
              <div className="w-full md:w-48 flex-shrink-0">
                <select
                  value={semesterFilter}
                  onChange={(e) => {
                    setSemesterFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-3 rounded-lg border border-neutral-200 text-neutral-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold cursor-pointer"
                  id="search-semester-filter"
                >
                  <option value="">All Semesters</option>
                  {semesters.map((sem) => (
                    <option key={sem} value={sem}>{sem}</option>
                  ))}
                </select>
              </div>

              {/* Batch Filter */}
              <div className="w-full md:w-48 flex-shrink-0">
                <select
                  value={batchFilter}
                  onChange={(e) => {
                    setBatchFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-3 rounded-lg border border-neutral-200 text-neutral-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold cursor-pointer"
                  id="search-batch-filter"
                >
                  <option value="">All Batches</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.name}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Clear filters button */}
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-neutral-900 rounded-lg text-sm font-bold transition-colors cursor-pointer flex-shrink-0"
                  id="search-clear-filters-btn"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear Filters</span>
                </button>
              )}
            </div>
          </div>

          {/* Search Results Render Section */}
          <div className="bg-white rounded-xl border border-neutral-100 shadow-sm overflow-hidden" id="results-container">
            
            {/* Loading State */}
            {loading && (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-neutral-500" id="search-loading-state">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="text-sm font-medium">Loading students...</span>
              </div>
            )}

            {/* Error State */}
            {!loading && error && (
              <div className="py-12 px-6 flex flex-col items-center text-center gap-3 text-red-600" id="search-error-state">
                <AlertCircle className="w-10 h-10" />
                <h3 className="font-semibold text-base">Unable to load students. Please try again.</h3>
                <p className="text-xs text-neutral-500 max-w-md">{error}</p>
                <button
                  type="button"
                  onClick={triggerSearch}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  id="search-retry-btn"
                >
                  <span>Retry Search</span>
                </button>
              </div>
            )}

            {/* No Matching Records Found */}
            {!loading && !error && students.length === 0 && (
              <div className="py-20 flex flex-col items-center text-center gap-2 text-neutral-500" id="search-empty-state">
                <AlertTriangle className="w-10 h-10 text-amber-500" />
                <h3 className="font-semibold text-neutral-800 text-base">No students found.</h3>
                <p className="text-xs max-w-sm text-neutral-500">
                  {hasActiveFilter 
                    ? `We couldn't find any student matching the current search criteria. Try checking spelling or clearing filters.`
                    : `No student records are currently available in the database.`}
                </p>
                {hasActiveFilter && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="mt-3 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    id="search-empty-clear-btn"
                  >
                    View All Students
                  </button>
                )}
              </div>
            )}

            {/* Populated Search Results */}
            {!loading && !error && students.length > 0 && (
              <div className="flex flex-col" id="search-results-list">
                
                {/* Header summary info & layout toggle */}
                <div className="px-6 py-4 bg-neutral-50/50 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-neutral-500 font-medium">
                  <div>
                    <span>Showing <strong>{students.length}</strong> of <strong>{total}</strong> students found</span>
                    {searchQuery.trim() && (
                      <span className="text-blue-600 ml-2 font-semibold">Search: "{searchQuery.trim()}"</span>
                    )}
                    {semesterFilter && (
                      <span className="text-neutral-700 ml-2 font-semibold bg-neutral-200/60 px-2 py-0.5 rounded text-[11px]">{semesterFilter}</span>
                    )}
                    {batchFilter && (
                      <span className="text-neutral-700 ml-1.5 font-semibold bg-neutral-200/60 px-2 py-0.5 rounded text-[11px]">{batchFilter}</span>
                    )}
                  </div>
                  
                  {/* View switcher controls */}
                  <div className="flex items-center gap-1.5 bg-neutral-100 p-1 rounded-lg border border-neutral-200 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setViewMode("grid")}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        viewMode === "grid"
                          ? "bg-white text-blue-700 shadow-sm"
                          : "text-neutral-500 hover:text-neutral-800"
                      }`}
                      title="Grid of Academic Identity Cards"
                      id="view-mode-grid-btn"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span>Cards</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("table")}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        viewMode === "table"
                          ? "bg-white text-blue-700 shadow-sm"
                          : "text-neutral-500 hover:text-neutral-800"
                      }`}
                      title="Compact Directory Table"
                      id="view-mode-table-btn"
                    >
                      <List className="w-3.5 h-3.5" />
                      <span>Table</span>
                    </button>
                  </div>
                </div>

                {/* Dynamic View Modes (Grid of cards vs Table list) */}
                {viewMode === "grid" ? (
                  <div className="p-6 bg-neutral-50/30">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" id="student-cards-grid">
                      {students.map((student) => (
                        <ErrorBoundary key={student.id} fallbackTitle="Error loading card">
                          <StudentCard
                            student={student}
                            onViewDetails={onViewDetails}
                          />
                        </ErrorBoundary>
                      ))}
                    </div>
                  </div>
                ) : (
                  (() => {
                    const showEmailColumn = students.some((s) => Boolean(s?.email));
                    const showMobileColumn = students.some((s) => Boolean(s?.mobile));
                    
                    return (
                      <div className="overflow-x-auto" id="student-table-view">
                        <table className="min-w-full divide-y divide-neutral-100 text-left">
                          <thead>
                            <tr className="bg-neutral-50/40 text-neutral-400 text-[11px] font-bold uppercase tracking-wider">
                              <th className="px-6 py-3.5">Student Name</th>
                              <th className="px-6 py-3.5">Roll No</th>
                              <th className="px-6 py-3.5">Registration ID</th>
                              <th className="px-6 py-3.5">Semester & Batch</th>
                              {showEmailColumn && <th className="px-6 py-3.5">Email</th>}
                              {showMobileColumn && <th className="px-6 py-3.5">Mobile</th>}
                              <th className="px-6 py-3.5">Subject Set</th>
                              <th className="px-6 py-3.5">Gender</th>
                              <th className="px-6 py-3.5">Category</th>
                              <th className="px-6 py-3.5 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100 text-sm text-neutral-700">
                            {students.map((student) => (
                              <tr key={student.id} className="hover:bg-neutral-50/40 transition-colors" id={`student-row-${student.id}`}>
                                <td className="px-6 py-4 font-bold text-neutral-900">
                                  {student.name}
                                </td>
                                <td className="px-6 py-4 font-mono text-xs font-bold text-neutral-800">
                                  {student.rollNumber || "—"}
                                </td>
                                <td className="px-6 py-4 font-mono text-xs text-neutral-600">
                                  {student.registrationId}
                                </td>
                                <td className="px-6 py-4 text-xs">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-semibold text-blue-700">{student.semester || "1st Sem"}</span>
                                    <span className="text-[11px] text-neutral-500">{student.batch || "2026–2029"}</span>
                                  </div>
                                </td>
                                {showEmailColumn && <td className="px-6 py-4 text-xs font-semibold text-neutral-800">{student.email || "—"}</td>}
                                {showMobileColumn && <td className="px-6 py-4 font-mono text-xs">{student.mobile || "—"}</td>}
                                <td className="px-6 py-4">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-xs font-semibold text-neutral-800">M: {student.majorSubject || "Computer Application"}</span>
                                    <span className="text-[11px] text-neutral-500">Mi: {student.minorSubject || "Mathematics"}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-xs uppercase">{student.gender || "MALE"}</td>
                                <td className="px-6 py-4 text-xs">{student.category || "GENERAL"}</td>
                                <td className="px-6 py-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => onViewDetails(student.id)}
                                    className="text-xs font-extrabold text-blue-600 hover:text-blue-800 cursor-pointer"
                                    id={`view-profile-table-btn-${student.id}`}
                                  >
                                    View Profile
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()
                )}

                {/* Pagination controls */}
                {totalPages > 1 && (
                  <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-between" id="search-pagination">
                    <span className="text-xs text-neutral-500 font-medium">Page {page} of {totalPages}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="inline-flex items-center gap-1 px-3 py-2 border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        id="search-prev-page-btn"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Previous</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="inline-flex items-center gap-1 px-3 py-2 border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        id="search-next-page-btn"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>

        </div>
      </div>
    </ErrorBoundary>
  );
}
