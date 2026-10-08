/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { Wrench } from "lucide-react";
import Navbar from "./components/Navbar.tsx";
import Home from "./components/Home.tsx";
import SearchStudents from "./components/SearchStudents.tsx";
import AdminLogin from "./components/AdminLogin.tsx";
import AdminPanel from "./components/AdminPanel.tsx";
import StudentProfile from "./components/StudentProfile.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import { parseJsonResponse } from "./utils/api.ts";

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>("home");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Configurations
  const [collegeName, setCollegeName] = useState("Pragjyotish College");
  const [departmentName, setDepartmentName] = useState("Department of Computer Application (BCA)");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");

  // Authentication State
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<{ email: string; role: string } | null>(null);

  // Active student profile route parameter state
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);

  // Sync routing from URL path on startup and popstate back/forward triggers
  useEffect(() => {
    const syncRouteFromPath = () => {
      const path = window.location.pathname;
      const studentMatch = path.match(/^\/students\/(\d+)$/);
      
      if (studentMatch) {
        setSelectedStudentId(parseInt(studentMatch[1], 10));
      } else {
        setSelectedStudentId(null);
        if (path === "/search") {
          setCurrentTab("search");
        } else if (path === "/admin") {
          setCurrentTab("admin");
        } else {
          setCurrentTab("home");
        }
      }
    };

    // Load public configurations
    fetch("/api/public/config")
      .then((res) => parseJsonResponse(res))
      .then((data) => {
        if (data.collegeName) setCollegeName(data.collegeName);
        if (data.departmentName) setDepartmentName(data.departmentName);
        if (typeof data.maintenanceMode === "boolean") setMaintenanceMode(data.maintenanceMode);
        if (data.maintenanceMessage) setMaintenanceMessage(data.maintenanceMessage);
      })
      .catch((err) => console.error("Failed to load initial configs:", err));

    // Validate admin session token if present
    const storedToken = sessionStorage.getItem("adminToken");
    if (storedToken) {
      fetch("/api/admin/verify", {
        headers: { Authorization: `Bearer ${storedToken}` },
      })
        .then((res) => parseJsonResponse(res))
        .then((data) => {
          if (data.valid) {
            setToken(storedToken);
            setAdmin(data.admin);
            // If they are on admin tab, let them remain on it
            if (window.location.pathname === "/admin") {
              setCurrentTab("admin");
            }
          }
        })
        .catch(() => {
          sessionStorage.removeItem("adminToken");
        });
    }

    // Sync current path routing
    syncRouteFromPath();
    window.addEventListener("popstate", syncRouteFromPath);
    return () => window.removeEventListener("popstate", syncRouteFromPath);
  }, []);

  // Sync navigation tab state and update history pathname
  const handleSetTab = (tab: string) => {
    window.history.pushState(null, "", tab === "home" ? "/" : `/${tab}`);
    setSelectedStudentId(null);
    setCurrentTab(tab);
  };

  const handleViewStudentDetails = (id: number) => {
    window.history.pushState(null, "", `/students/${id}`);
    setSelectedStudentId(id);
  };

  const handleProfileBack = () => {
    // Navigate back in history if possible, otherwise default to search
    if (window.history.state !== null) {
      window.history.back();
    } else {
      handleSetTab("search");
    }
  };

  const handleLoginSuccess = (newToken: string, newAdmin: { email: string; role: string }) => {
    sessionStorage.setItem("adminToken", newToken);
    setToken(newToken);
    setAdmin(newAdmin);
    handleSetTab("admin");
  };

  const handleLogout = () => {
    sessionStorage.removeItem("adminToken");
    setToken(null);
    setAdmin(null);
    handleSetTab("home");
  };

  const showMaintenance = maintenanceMode && currentTab !== "admin" && currentTab !== "login";

  if (showMaintenance) {
    return (
      <div className="min-h-screen flex flex-col font-sans bg-neutral-50" id="main-application">
        <Navbar
          currentTab="maintenance"
          setCurrentTab={() => {}}
          collegeName={collegeName}
          departmentName={departmentName}
        />
        <main className="flex-grow flex items-center justify-center p-6">
          <div className="w-full max-w-xl bg-white border border-neutral-200/60 rounded-2xl shadow-xl p-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center">
              <Wrench className="w-8 h-8 text-amber-500 animate-pulse" />
            </div>
            
            <div className="space-y-2">
              <p className="text-xs font-bold text-neutral-400 tracking-wider uppercase font-mono">{collegeName}</p>
              <h2 className="text-xl font-extrabold text-neutral-800 tracking-tight">{departmentName} Student Records</h2>
            </div>

            <div className="border-t border-b border-neutral-100 py-6">
              <h3 className="text-lg font-bold text-neutral-800 mb-2">Website Under Maintenance</h3>
              <p className="text-neutral-500 text-sm leading-relaxed font-medium">
                {maintenanceMessage || "We are currently updating the student records system. Please check back later."}
              </p>
            </div>

            <div className="pt-2 text-xs text-neutral-400 font-medium">
              Are you an administrator? <span onClick={() => handleSetTab("login")} className="text-blue-600 hover:underline font-bold cursor-pointer">Login to Admin Panel</span>
            </div>
          </div>
        </main>
        
        <footer className="bg-white border-t border-neutral-100 py-8 w-full mt-auto">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3.5">
              <img 
                src="/college_logo.jpg" 
                alt="Pragjyotish College Logo" 
                className="w-14 h-14 rounded-full object-contain border border-neutral-200 p-0.5 bg-white shadow-sm"
                referrerPolicy="no-referrer"
              />
              <div className="text-left">
                <h4 className="text-sm font-extrabold text-neutral-800 tracking-tight">{collegeName}</h4>
                <p className="text-xs text-neutral-500 font-medium mt-0.5">{departmentName}</p>
                <p className="text-[10px] text-neutral-400 font-mono mt-1">Official Student Records Registry Portal</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-blue-700 tracking-wider uppercase bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
              Built by Sahil 1st Sem BCA
            </span>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans bg-neutral-50" id="main-application">
      {/* Conditionally hide standard header navbar when in full admin dashboard */}
      {currentTab !== "admin" && (
        <Navbar
          currentTab={currentTab}
          setCurrentTab={handleSetTab}
          collegeName={collegeName}
          departmentName={departmentName}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-grow">
        <ErrorBoundary fallbackTitle="An unexpected application error occurred">
          {selectedStudentId !== null ? (
            <StudentProfile
              studentId={selectedStudentId}
              token={token}
              isAdmin={!!token}
              onBack={handleProfileBack}
              onEditSuccess={() => {
                // Trigger reload in search component if it ever is persistent
              }}
              onDeleteSuccess={() => {
                setSelectedStudentId(null);
                handleSetTab("search");
              }}
            />
          ) : (
            <>
              {currentTab === "home" && (
                <Home
                  setCurrentTab={handleSetTab}
                  setSearchQuery={setSearchQuery}
                  collegeName={collegeName}
                  departmentName={departmentName}
                />
              )}

              {currentTab === "search" && (
                <SearchStudents
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  collegeName={collegeName}
                  departmentName={departmentName}
                  onViewDetails={handleViewStudentDetails}
                />
              )}

              {currentTab === "login" && (
                <AdminLogin
                  onLoginSuccess={handleLoginSuccess}
                  collegeName={collegeName}
                />
              )}

              {currentTab === "admin" && token && (
                <AdminPanel
                  token={token}
                  onLogout={handleLogout}
                  collegeName={collegeName}
                  departmentName={departmentName}
                  setCollegeName={setCollegeName}
                  setDepartmentName={setDepartmentName}
                  maintenanceMode={maintenanceMode}
                  setMaintenanceMode={setMaintenanceMode}
                  setMaintenanceMessage={setMaintenanceMessage}
                />
              )}
            </>
          )}
        </ErrorBoundary>
      </main>
      
      <footer className="bg-white border-t border-neutral-100 py-8 mt-auto w-full">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3.5">
            <img 
              src="/college_logo.jpg" 
              alt="Pragjyotish College Logo" 
              className="w-14 h-14 rounded-full object-contain border border-neutral-200 p-0.5 bg-white shadow-sm"
              referrerPolicy="no-referrer"
            />
            <div className="text-left">
              <h4 className="text-sm font-extrabold text-neutral-800 tracking-tight">{collegeName}</h4>
              <p className="text-xs text-neutral-500 font-medium mt-0.5">{departmentName}</p>
              <p className="text-[10px] text-neutral-400 font-mono mt-1">Official Student Records Registry Portal</p>
            </div>
          </div>
          <div className="flex flex-col md:items-end text-center md:text-right gap-1.5 border-t md:border-t-0 border-neutral-100 pt-4 md:pt-0 w-full md:w-auto">
            <span className="text-[11px] font-bold text-blue-700 tracking-wider uppercase bg-blue-50 px-3 py-1 rounded-full border border-blue-100 w-fit mx-auto md:mr-0">
              Built by Sahil 1st Sem BCA
            </span>
            <p className="text-[10px] text-neutral-400 font-medium">Pragjyotish College Department of BCA © {new Date().getFullYear()}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

