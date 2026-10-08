import { GraduationCap, ShieldAlert, Search, Home as HomeIcon } from "lucide-react";

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  collegeName: string;
  departmentName: string;
}

export default function Navbar({ currentTab, setCurrentTab, collegeName, departmentName }: NavbarProps) {
  return (
    <header className="bg-white border-b border-neutral-100 sticky top-0 z-50 shadow-sm" id="public-header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo & Brand */}
          <div 
            className="flex items-center gap-3 cursor-pointer group" 
            onClick={() => setCurrentTab("home")}
            id="brand-container"
          >
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-neutral-100 shadow-sm overflow-hidden transition-all duration-300 group-hover:scale-105">
              <img 
                src="/college_logo.jpg" 
                alt="College Logo" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-neutral-800 text-sm sm:text-base leading-tight tracking-tight">
                {collegeName}
              </span>
              <span className="text-xs text-neutral-500 font-medium">
                {departmentName}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-2 sm:gap-4" id="nav-menu">
            <button
              onClick={() => setCurrentTab("home")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentTab === "home"
                  ? "bg-blue-50 text-blue-600"
                  : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
              }`}
              id="nav-home-btn"
            >
              <HomeIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Home</span>
            </button>

            <button
              onClick={() => setCurrentTab("search")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentTab === "search"
                  ? "bg-blue-50 text-blue-600"
                  : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
              }`}
              id="nav-search-btn"
            >
              <Search className="w-4 h-4" />
              <span>Search Students</span>
            </button>

            <button
              onClick={() => setCurrentTab("login")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentTab === "login" || currentTab.startsWith("admin")
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-800 text-white hover:bg-neutral-900"
              }`}
              id="nav-login-btn"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Admin Portal</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
