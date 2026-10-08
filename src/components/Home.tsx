import React, { useState, useEffect } from "react";
import { Search, GraduationCap, Users, ArrowRight, ShieldCheck, HelpCircle } from "lucide-react";

interface HomeProps {
  setCurrentTab: (tab: string) => void;
  setSearchQuery: (query: string) => void;
  collegeName: string;
  departmentName: string;
}

export default function Home({ setCurrentTab, setSearchQuery, collegeName, departmentName }: HomeProps) {
  const [localQuery, setLocalQuery] = useState("");
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch total active student count from real PostgreSQL database
    fetch("/api/public/students/count")
      .then((res) => res.json())
      .then((data) => {
        setStudentCount(data.count);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load student count statistics:", err);
        setLoading(false);
      });
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (localQuery.trim()) {
      setSearchQuery(localQuery.trim());
      setCurrentTab("search");
    }
  };

  return (
    <div className="bg-neutral-50 min-h-[calc(100vh-4rem)] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8" id="home-view">
      <div className="max-w-4xl mx-auto w-full space-y-12 text-center">
        
        {/* Branding Crest Section */}
        <div className="space-y-4" id="branding-crest-section">
          <div className="mx-auto w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-md border-4 border-white ring-4 ring-blue-100 relative overflow-hidden transition-transform duration-500 hover:scale-105 hover:rotate-6">
            <img 
              src="/college_logo.jpg" 
              alt="Pragjyotish College Logo" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 tracking-wide uppercase">
              Student Records Verification Portal
            </span>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-neutral-900 tracking-tight leading-tight">
              {collegeName}
            </h1>
            <p className="text-lg sm:text-xl font-medium text-neutral-600 max-w-2xl mx-auto">
              {departmentName}
            </p>
          </div>
        </div>

        {/* Real-time Search Box Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-neutral-100 max-w-2xl mx-auto" id="search-card">
          <form onSubmit={handleSearchSubmit} className="space-y-4">
            <h2 className="text-lg font-semibold text-neutral-800 text-left">
              Quick Student Verification
            </h2>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by Name, Registration ID, or Form Number..."
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-xl border border-neutral-200 text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base shadow-inner transition-all duration-200"
                id="home-search-input"
              />
              <Search className="absolute left-4 top-4 h-6 w-6 text-neutral-400" />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={!localQuery.trim()}
                className="flex-1 bg-blue-600 text-white font-semibold px-6 py-3.5 rounded-xl transition-all duration-200 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                id="search-submit-btn"
              >
                <span>Search Student Base</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setCurrentTab("search");
                }}
                className="bg-neutral-100 text-neutral-700 hover:bg-neutral-200 font-semibold px-6 py-3.5 rounded-xl transition-colors duration-200"
                id="view-all-btn"
              >
                Browse List
              </button>
            </div>
          </form>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto pt-6" id="stats-grid">
          {/* Stat 1 */}
          <div className="bg-white p-6 rounded-xl border border-neutral-100 shadow-sm flex items-center gap-4 text-left">
            <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Total Enrolled</p>
              <h3 className="text-2xl font-bold text-neutral-800 mt-0.5">
                {loading ? (
                  <div className="h-7 w-16 bg-neutral-200 animate-pulse rounded"></div>
                ) : (
                  `${studentCount ?? 0} Students`
                )}
              </h3>
            </div>
          </div>

          {/* Stat 2 */}
          <div className="bg-white p-6 rounded-xl border border-neutral-100 shadow-sm flex items-center gap-4 text-left">
            <div className="w-12 h-12 rounded-lg bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">System Integrity</p>
              <h3 className="text-2xl font-bold text-neutral-800 mt-0.5">Verified</h3>
            </div>
          </div>

          {/* Stat 3 */}
          <div className="bg-white p-6 rounded-xl border border-neutral-100 shadow-sm flex items-center gap-4 text-left">
            <div className="w-12 h-12 rounded-lg bg-yellow-50 text-yellow-600 flex items-center justify-center flex-shrink-0">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Public Access</p>
              <h3 className="text-2xl font-bold text-neutral-800 mt-0.5">Privacy-First</h3>
            </div>
          </div>
        </div>

        {/* Privacy Advisory */}
        <div className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed border-t border-neutral-200/60 pt-6">
          <p>
            <strong>Advisory:</strong> Public search results are strictly sanitized. Student email addresses and mobile numbers are classified as private and are never exposed publicly under any search inquiry.
          </p>
        </div>

      </div>
    </div>
  );
}
