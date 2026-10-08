import React, { useState, useEffect } from "react";
import { 
  GraduationCap, User, ArrowLeft, Edit, Trash, Loader2, AlertCircle, 
  Calendar, Shield, Mail, Phone, FileText, CheckCircle2, Clock, Check, EyeOff, QrCode
} from "lucide-react";
import QRCode from "qrcode";
import { Student } from "../types.ts";
import { getVisitorIds } from "./SearchStudents.tsx";

interface StudentProfileProps {
  studentId: number;
  token: string | null;
  isAdmin: boolean;
  onBack: () => void;
  onEditSuccess?: () => void;
  onDeleteSuccess?: () => void;
}

export default function StudentProfile({ 
  studentId, 
  token, 
  isAdmin, 
  onBack, 
  onEditSuccess,
  onDeleteSuccess 
}: StudentProfileProps) {
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileQrUrl, setProfileQrUrl] = useState<string>("");

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Student>>({});
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [enablePrivateFields, setEnablePrivateFields] = useState<boolean>(true);

  // Generate QR code URL
  useEffect(() => {
    if (student) {
      const profileUrl = `${window.location.origin}/students/${student.id}`;
      QRCode.toDataURL(profileUrl, { width: 160, margin: 1, color: { dark: "#1e3a8a", light: "#ffffff" } })
        .then(url => setProfileQrUrl(url))
        .catch(err => console.error("Error generating profile QR code:", err));
    }
  }, [student]);

  // Load configuration
  useEffect(() => {
    fetch("/api/public/config")
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.enablePrivateFields !== "undefined") {
          setEnablePrivateFields(data.enablePrivateFields);
        }
      })
      .catch((err) => console.error("Error loading config inside profile:", err));
  }, []);

  // Load student records
  const loadStudentProfile = () => {
    setLoading(true);
    setError(null);

    const url = isAdmin 
      ? `/api/admin/students/${studentId}` 
      : `/api/public/students/${studentId}`;

    const headers: Record<string, string> = {};
    if (isAdmin && token) {
      headers["Authorization"] = `Bearer ${token}`;
    } else {
      const { visitorHash, sessionId } = getVisitorIds();
      headers["x-visitor-hash"] = visitorHash;
      headers["x-session-id"] = sessionId;
    }

    fetch(url, { headers })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to load student details");
        }
        return res.json();
      })
      .then((data) => {
        setStudent(data);
        setEditForm(data);
        setLoading(false);
      })
      .catch((err: any) => {
        console.error("Fetch profile error:", err);
        setError(err.message || "An unexpected error occurred while loading this student profile.");
        setLoading(false);
      });
  };

  useEffect(() => {
    loadStudentProfile();
  }, [studentId, isAdmin]);

  const handleEditToggle = () => {
    if (student) {
      setEditForm({ ...student });
    }
    setIsEditing(!isEditing);
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !isAdmin) return;

    setSaveLoading(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/admin/students/${studentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update student records");
      }

      setSaveSuccess(true);
      setIsEditing(false);
      
      // Refresh local profile state
      loadStudentProfile();

      if (onEditSuccess) {
        onEditSuccess();
      }
    } catch (err: any) {
      console.error("Save profile error:", err);
      setSaveError(err.message || "Unable to save edits.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteTrigger = async () => {
    if (!token || !isAdmin) return;

    if (!window.confirm("Are you absolutely sure you want to permanently delete this student record? This cannot be undone and will be logged in the system.")) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/students/${studentId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete student record");
      }

      if (onDeleteSuccess) {
        onDeleteSuccess();
      }
      onBack();
    } catch (err: any) {
      console.error("Delete record error:", err);
      setError(err.message || "Failed to delete this record.");
      setLoading(false);
    }
  };

  // Generate student initials
  const getInitials = (name: string) => {
    if (!name) return "??";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-neutral-500 min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        <span className="text-sm font-semibold text-neutral-700">Retrieving official profile details...</span>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-4">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto border border-red-100 shadow-sm">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-neutral-800">Profile Loading Failed</h2>
        <p className="text-sm text-neutral-500 max-w-md mx-auto">{error || "The student record you are trying to access does not exist or has been archived."}</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Directory</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6" id="student-full-profile">
      
      {/* Back button action banner */}
      <div className="mb-6 flex justify-between items-center">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-600 hover:text-blue-700 transition-colors bg-white px-3.5 py-2 rounded-xl border border-neutral-200 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to List</span>
        </button>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-100 text-blue-800">
              <Shield className="w-3 h-3" />
              <span>Administrator Mode</span>
            </span>
            <button
              onClick={handleEditToggle}
              className={`inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                isEditing 
                  ? "bg-neutral-100 text-neutral-700 border-neutral-300" 
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
              }`}
            >
              <Edit className="w-3.5 h-3.5" />
              <span>{isEditing ? "Cancel Edit" : "Edit Student"}</span>
            </button>
            <button
              onClick={handleDeleteTrigger}
              className="inline-flex items-center gap-1 px-3.5 py-2 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-xl text-xs font-bold transition-all"
            >
              <Trash className="w-3.5 h-3.5" />
              <span>Delete Student</span>
            </button>
          </div>
        )}
      </div>

      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl mb-6 flex items-center gap-3 text-xs font-bold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>Student profile updated successfully in the college registry.</span>
        </div>
      )}

      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl mb-6 flex items-center gap-3 text-xs font-bold">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span>Error saving: {saveError}</span>
        </div>
      )}

      {/* Main Panel Card container */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-md overflow-hidden">
        
        {/* Academic Identity Badge Strip */}
        <div className="bg-gradient-to-r from-blue-800 to-indigo-900 text-white px-8 py-6 text-center sm:text-left flex flex-col sm:flex-row sm:items-center justify-between gap-5 border-b border-blue-950">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center border-4 border-white/20 text-white font-extrabold text-2xl tracking-widest shadow-inner relative flex-shrink-0">
              {getInitials(student.name)}
            </div>
            <div className="space-y-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight uppercase">{student.name}</h1>
                <span className="inline-flex max-w-fit items-center px-2 py-0.5 rounded text-[9px] font-bold bg-white/20 text-white tracking-widest uppercase">
                  BCA Student
                </span>
              </div>
              <p className="text-xs text-blue-200 font-bold tracking-wider uppercase">Pragjyotish College — Department of BCA</p>
              <p className="text-[11px] text-blue-100 font-mono">Registration ID: <span className="font-extrabold text-white">{student.registrationId || "N/A"}</span></p>
            </div>
          </div>
          
          {/* Dynamic Mobile QR Access Code */}
          <div className="bg-white p-1.5 rounded-xl border border-white/10 shadow-lg flex-shrink-0 flex flex-col items-center gap-1 mx-auto sm:mx-0">
            {profileQrUrl ? (
              <img src={profileQrUrl} alt="Quick scan look up" className="w-16 h-16 object-contain" />
            ) : (
              <div className="w-16 h-16 bg-blue-900/30 animate-pulse rounded-lg" />
            )}
            <span className="text-[8px] font-extrabold text-blue-900 font-mono tracking-wider uppercase px-1.5 py-0.5 text-center bg-blue-50 rounded">Scan Access</span>
          </div>
        </div>

        {/* Dynamic Details Body (Editing vs Viewing) */}
        {isEditing ? (
          <form onSubmit={handleSaveSubmit} className="p-6 sm:p-8 space-y-6">
            <h3 className="text-sm font-bold text-neutral-800 border-b border-neutral-200 pb-2">Modify Registration Credentials</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-semibold text-neutral-600">
              <div>
                <label className="block mb-1 text-neutral-500">Student Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.name || ""}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block mb-1 text-neutral-500">Roll Number</label>
                <input
                  type="text"
                  value={editForm.rollNumber || ""}
                  onChange={(e) => setEditForm({ ...editForm, rollNumber: e.target.value })}
                  className="w-full p-2.5 border rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. BCA/26/01"
                />
              </div>

              <div>
                <label className="block mb-1 text-neutral-500">Enrollment Number</label>
                <input
                  type="text"
                  value={editForm.enrollmentNumber || ""}
                  onChange={(e) => setEditForm({ ...editForm, enrollmentNumber: e.target.value })}
                  className="w-full p-2.5 border rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. GAU/2026/BCA/001"
                />
              </div>

              <div>
                <label className="block mb-1 text-neutral-500">Semester</label>
                <select
                  value={editForm.semester || "1st Semester"}
                  onChange={(e) => setEditForm({ ...editForm, semester: e.target.value })}
                  className="w-full p-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="1st Semester">1st Semester</option>
                  <option value="2nd Semester">2nd Semester</option>
                  <option value="3rd Semester">3rd Semester</option>
                  <option value="4th Semester">4th Semester</option>
                  <option value="5th Semester">5th Semester</option>
                  <option value="6th Semester">6th Semester</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 text-neutral-500">Batch / Academic Year</label>
                <select
                  value={editForm.batch || "2026–2029"}
                  onChange={(e) => setEditForm({ ...editForm, batch: e.target.value })}
                  className="w-full p-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="2024–2027">2024–2027</option>
                  <option value="2025–2028">2025–2028</option>
                  <option value="2026–2029">2026–2029</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 text-neutral-500">Registration ID *</label>
                <input
                  type="text"
                  required
                  value={editForm.registrationId || ""}
                  onChange={(e) => setEditForm({ ...editForm, registrationId: e.target.value })}
                  className="w-full p-2.5 border rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block mb-1 text-neutral-500">Form Number *</label>
                <input
                  type="text"
                  required
                  value={editForm.formNumber || ""}
                  onChange={(e) => setEditForm({ ...editForm, formNumber: e.target.value })}
                  className="w-full p-2.5 border rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block mb-1 text-neutral-500">Programme Name</label>
                <input
                  type="text"
                  value={editForm.programmeName || ""}
                  onChange={(e) => setEditForm({ ...editForm, programmeName: e.target.value })}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block mb-1 text-neutral-500">Major Subject</label>
                <input
                  type="text"
                  value={editForm.majorSubject || ""}
                  onChange={(e) => setEditForm({ ...editForm, majorSubject: e.target.value })}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block mb-1 text-neutral-500">Minor Subject</label>
                <input
                  type="text"
                  value={editForm.minorSubject || ""}
                  onChange={(e) => setEditForm({ ...editForm, minorSubject: e.target.value })}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block mb-1 text-neutral-500">Transaction Mode</label>
                <select
                  value={editForm.transactionMode || "CASH"}
                  onChange={(e) => setEditForm({ ...editForm, transactionMode: e.target.value })}
                  className="w-full p-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="CASH">CASH</option>
                  <option value="ONLINE">ONLINE</option>
                  <option value="DEMAND DRAFT">DEMAND DRAFT</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 text-neutral-500">Admission Category</label>
                <input
                  type="text"
                  value={editForm.admissionCategory || "GENERAL"}
                  onChange={(e) => setEditForm({ ...editForm, admissionCategory: e.target.value })}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block mb-1 text-neutral-500">Gender</label>
                <select
                  value={editForm.gender || "MALE"}
                  onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                  className="w-full p-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 text-neutral-500">Category</label>
                <input
                  type="text"
                  value={editForm.category || "GENERAL"}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {enablePrivateFields ? (
                <>
                  <div>
                    <label className="block mb-1 text-blue-600">Private Email Address</label>
                    <input
                      type="email"
                      value={editForm.email || ""}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full p-2.5 border border-blue-200 bg-blue-50/5 text-neutral-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block mb-1 text-blue-600">Private Mobile Number</label>
                    <input
                      type="text"
                      value={editForm.mobile || ""}
                      onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                      className="w-full p-2.5 border border-blue-200 bg-blue-50/5 text-neutral-800 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </>
              ) : null}

              <div>
                <label className="block mb-1 text-neutral-500">Record Status</label>
                <select
                  value={editForm.status || "Active"}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full p-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-neutral-100 pt-5">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-5 py-2 border rounded-lg text-xs font-bold hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveLoading}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-md transition-colors"
              >
                {saveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Save Database Record</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 sm:p-8 space-y-8" id="profile-view-sections">
            
            {/* GRID SECTIONS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* SECTION A: STUDENT INFO */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-neutral-100 pb-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-extrabold text-neutral-800 uppercase tracking-widest">Student Information</h3>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div>
                    <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider block">Full Name</span>
                    <span className="text-neutral-800 font-extrabold text-sm uppercase mt-0.5 block">{student.name}</span>
                  </div>
                  
                  <div>
                    <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider block">Gender</span>
                    <span className="text-neutral-800 font-bold uppercase mt-0.5 block">{student.gender || "MALE"}</span>
                  </div>

                  <div>
                    <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider block">Category / Tribe</span>
                    <span className="text-neutral-800 font-bold mt-0.5 block">{student.category || "GENERAL"}</span>
                  </div>

                  {student.mobile && !isAdmin && (
                    <div id="public-profile-mobile">
                      <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider block">Mobile Number</span>
                      <span className="text-neutral-800 font-bold font-mono text-sm mt-0.5 block">{student.mobile}</span>
                    </div>
                  )}

                  {student.email && !isAdmin && (
                    <div id="public-profile-email">
                      <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider block">Email Address</span>
                      <span className="text-neutral-800 font-semibold text-sm mt-0.5 block">{student.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION B: ACADEMIC INFO */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-neutral-100 pb-2">
                  <GraduationCap className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-extrabold text-neutral-800 uppercase tracking-widest">Academic Information</h3>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="col-span-2">
                    <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider block">Course / Programme</span>
                    <span className="text-neutral-800 font-bold mt-0.5 block text-sm">{student.programmeName || "Bachelor of Computer Applications"}</span>
                  </div>

                  <div>
                    <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider block">Roll Number</span>
                    <span className="font-mono text-neutral-900 font-extrabold text-sm block mt-0.5 bg-neutral-100 px-2.5 py-1 rounded-lg border border-neutral-200/60 w-fit">{student.rollNumber || "Not Assigned"}</span>
                  </div>

                  <div>
                    <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider block">Enrollment Number</span>
                    <span className="font-mono text-neutral-900 font-extrabold text-sm block mt-0.5 bg-neutral-100 px-2.5 py-1 rounded-lg border border-neutral-200/60 w-fit">{student.enrollmentNumber || "Not Assigned"}</span>
                  </div>

                  <div>
                    <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider block">Semester</span>
                    <span className="text-blue-700 font-extrabold text-sm block mt-0.5">{student.semester || "1st Semester"}</span>
                  </div>

                  <div>
                    <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider block">Batch / Academic Year</span>
                    <span className="text-neutral-800 font-bold text-sm block mt-0.5">{student.batch || "2026–2029"}</span>
                  </div>

                  <div>
                    <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider block">Registration ID</span>
                    <span className="font-mono text-neutral-900 font-extrabold text-sm block mt-0.5 bg-neutral-100 px-2.5 py-1 rounded-lg border border-neutral-200/60 w-fit">{student.registrationId || "N/A"}</span>
                  </div>

                  <div>
                    <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider block">Form Number</span>
                    <span className="font-mono text-neutral-900 font-extrabold text-sm block mt-0.5 bg-neutral-100 px-2.5 py-1 rounded-lg border border-neutral-200/60 w-fit">{student.formNumber || "N/A"}</span>
                  </div>

                  <div>
                    <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider block">Major Subject</span>
                    <span className="text-neutral-800 font-bold mt-0.5 block">{student.majorSubject || "Computer Application"}</span>
                  </div>

                  <div>
                    <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider block">Minor Subject</span>
                    <span className="text-neutral-800 font-bold mt-0.5 block">{student.minorSubject || "Mathematics"}</span>
                  </div>

                  <div>
                    <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider block">Admission Category</span>
                    <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded text-[11px] font-extrabold bg-blue-50 text-blue-800 border border-blue-100">
                      {student.admissionCategory || "GENERAL"}
                    </span>
                  </div>

                  <div>
                    <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider block">Transaction Mode</span>
                    <span className="text-neutral-800 font-bold mt-0.5 block uppercase">{student.transactionMode || "CASH"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Optional contact coordinates under public rules */}
            {(student.email || student.mobile) && !isAdmin && (
              <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-100 space-y-3">
                <h4 className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest border-b pb-1.5">Public Student Contacts</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-neutral-700">
                  {student.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-neutral-400" />
                      <span>{student.email}</span>
                    </div>
                  )}
                  {student.mobile && (
                    <div className="flex items-center gap-2 font-mono">
                      <Phone className="w-4 h-4 text-neutral-400" />
                      <span>{student.mobile}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SECTION C: ADMIN METADATA PANEL (Private records) */}
            {isAdmin && (
              <div className="border-t border-neutral-200 pt-6 space-y-4 bg-neutral-50 -mx-6 -mb-6 p-6 sm:-mx-8 sm:-mb-8 sm:p-8">
                <div className="flex items-center gap-2 border-b border-neutral-200 pb-2">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-extrabold text-neutral-800 uppercase tracking-widest">Administrative Records (Locked Private)</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 text-xs font-medium text-neutral-700">
                  {enablePrivateFields ? (
                    <>
                      <div>
                        <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider block">Private Email Coordinates</span>
                        <span className="text-blue-700 font-bold block mt-1">{student.email || "—"}</span>
                      </div>

                      <div>
                        <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider block">Private Phone/Mobile Coordinates</span>
                        <span className="text-blue-700 font-bold font-mono block mt-1">{student.mobile || "—"}</span>
                      </div>
                    </>
                  ) : null}

                  <div>
                    <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider block">Record Database ID</span>
                    <span className="text-neutral-800 font-mono font-bold block mt-1">#{student.id}</span>
                  </div>

                  <div>
                    <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider block">Import Source File Ref</span>
                    <span className="text-neutral-800 font-bold block mt-1">
                      {student.importId ? `Batch Import #${student.importId}` : "Manually Provisioned"}
                    </span>
                  </div>

                  <div>
                    <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider block">Date Record Created</span>
                    <span className="text-neutral-800 font-bold block mt-1">
                      {student.createdAt ? new Date(student.createdAt).toLocaleString("en-US", { timeZone: "Asia/Kolkata" }) : "—"}
                    </span>
                  </div>

                  <div>
                    <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider block">Last Updated Date</span>
                    <span className="text-neutral-800 font-bold block mt-1">
                      {student.updatedAt ? new Date(student.updatedAt).toLocaleString("en-US", { timeZone: "Asia/Kolkata" }) : "—"}
                    </span>
                  </div>

                  <div>
                    <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider block">Record Registry Status</span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-1 rounded text-[11px] font-bold ${
                      student.status === "Active" 
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200" 
                        : "bg-neutral-100 text-neutral-600 border border-neutral-300"
                    }`}>
                      <Clock className="w-3 h-3" />
                      <span>{student.status || "Active"}</span>
                    </span>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
