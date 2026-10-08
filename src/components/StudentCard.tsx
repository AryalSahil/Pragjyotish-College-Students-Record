import { useState, useEffect } from "react";
import { GraduationCap, ChevronRight, QrCode } from "lucide-react";
import { motion } from "motion/react";
import QRCode from "qrcode";
import { Student } from "../types.ts";

interface StudentCardProps {
  student: Student;
  onViewDetails: (id: number) => void;
  key?: any;
}

export default function StudentCard({ student, onViewDetails }: StudentCardProps) {
  const [qrUrl, setQrUrl] = useState("");
  const [showQr, setShowQr] = useState(false);

  // Safe properties with fallbacks
  const studentId = student?.id ?? 0;
  const studentName = String(student?.name ?? "Unknown Student").trim() || "Unknown Student";
  const registrationId = String(student?.registrationId ?? "").trim() || "N/A";
  const formNumber = String(student?.formNumber ?? "").trim() || "N/A";
  const programmeName = String(student?.programmeName ?? "Bachelor of Computer Applications").trim() || "Bachelor of Computer Applications";
  const majorSubject = String(student?.majorSubject ?? "Computer Application").trim() || "Computer Application";
  const minorSubject = String(student?.minorSubject ?? "Mathematics").trim() || "Mathematics";
  const gender = String(student?.gender ?? "MALE").trim() || "MALE";
  const category = String(student?.category ?? "GENERAL").trim() || "GENERAL";
  const admissionCategory = String(student?.admissionCategory ?? "GENERAL").trim() || "GENERAL";
  const rollNumber = student?.rollNumber ? String(student.rollNumber).trim() : null;
  const enrollmentNumber = student?.enrollmentNumber ? String(student.enrollmentNumber).trim() : null;
  const semester = student?.semester ? String(student.semester).trim() : null;
  const batch = student?.batch ? String(student.batch).trim() : null;

  useEffect(() => {
    if (!studentId) return;
    const profileUrl = `${window.location.origin}/students/${studentId}`;
    QRCode.toDataURL(profileUrl, { width: 180, margin: 1, color: { dark: "#1e3a8a", light: "#ffffff" } })
      .then(url => setQrUrl(url))
      .catch(err => console.error("QR Code generation error:", err));
  }, [studentId]);

  // Robust initials extractor that never throws on any input type
  const getInitials = (nameVal: any): string => {
    if (!nameVal) return "??";
    const str = String(nameVal).trim();
    if (!str) return "??";
    const parts = str.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "??";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase() || "??";
    const firstInitial = parts[0]?.[0] || "";
    const lastInitial = parts[parts.length - 1]?.[0] || "";
    return (firstInitial + lastInitial).toUpperCase() || "??";
  };

  if (!student) {
    return null;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, translateY: -4 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col justify-between max-w-sm mx-auto w-full group relative"
      id={`student-card-${studentId}`}
    >
      {/* QR Code Overlay */}
      {showQr && (
        <div className="absolute inset-0 bg-white/95 z-20 flex flex-col items-center justify-center p-6 text-center transition-all duration-300">
          <button 
            type="button"
            onClick={() => setShowQr(false)}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-neutral-100 text-neutral-500 transition-colors cursor-pointer"
          >
            <span className="sr-only">Close</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          
          <h4 className="text-xs font-black text-blue-900 uppercase tracking-wider mb-1">Scan to Open Profile</h4>
          <p className="text-[10px] text-neutral-500 font-medium mb-4 max-w-[200px]">Use any mobile camera to instantly access {studentName}'s verified college record.</p>
          
          {qrUrl ? (
            <div className="bg-white p-2.5 rounded-2xl border-2 border-blue-100 shadow-md">
              <img src={qrUrl} alt="Student Profile QR Code" className="w-32 h-32 object-contain" />
            </div>
          ) : (
            <div className="w-32 h-32 bg-neutral-100 animate-pulse rounded-2xl border flex items-center justify-center text-xs text-neutral-400">
              Generating...
            </div>
          )}
          
          <span className="text-[9px] font-mono font-bold text-neutral-600 mt-4 bg-neutral-100 px-3 py-1 rounded-full border">
            ID: {registrationId}
          </span>
        </div>
      )}

      {/* College Header Card Band */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-800 text-white p-4 text-center border-b border-blue-900 relative">
        <div className="absolute top-3 left-3 opacity-15">
          <GraduationCap className="w-10 h-10 text-white" />
        </div>
        <h4 className="text-[11px] font-extrabold tracking-widest uppercase text-blue-100">Pragjyotish College</h4>
        <h3 className="text-xs font-bold tracking-wider uppercase text-white mt-0.5">Department of BCA</h3>
        <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-white/20 text-white uppercase tracking-wider">
          Student ID Card
        </span>
      </div>

      {/* Avatar & Core Profile Name Block */}
      <div className="p-5 text-center flex flex-col items-center">
        {/* Student Avatar */}
        <div className="w-16 h-16 bg-blue-50 border-2 border-blue-100 rounded-full flex items-center justify-center text-blue-700 font-extrabold text-lg tracking-wider shadow-inner mb-3 group-hover:scale-105 transition-transform duration-300">
          {getInitials(studentName)}
        </div>

        {/* Student Name */}
        <h2 className="text-base font-bold text-neutral-800 uppercase tracking-tight group-hover:text-blue-700 transition-colors">
          {studentName}
        </h2>
        <p className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest mt-0.5">
          BCA Student
        </p>
      </div>

      {/* Highlighted Credentials (Registration ID & Form Number) */}
      <div className="px-5 pb-3">
        <div className="grid grid-cols-2 gap-2 bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
          <div>
            <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Registration ID</p>
            <p className="font-mono text-xs font-bold text-neutral-800 mt-0.5">{registrationId}</p>
          </div>
          <div className="border-l border-neutral-200 pl-3">
            <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Form Number</p>
            <p className="font-mono text-xs font-bold text-neutral-800 mt-0.5">{formNumber}</p>
          </div>
        </div>
      </div>

      {/* Organized Detailed Information Fields */}
      <div className="px-5 py-3 space-y-2 text-xs border-t border-neutral-100/70 bg-neutral-50/20 flex-grow">
        <div className="flex justify-between items-baseline gap-2">
          <span className="text-neutral-400 font-bold uppercase text-[9px] tracking-wider w-24">Programme</span>
          <span className="text-neutral-700 font-semibold text-right truncate max-w-[180px]" title={programmeName}>
            {programmeName}
          </span>
        </div>

        <div className="flex justify-between items-baseline gap-2">
          <span className="text-neutral-400 font-bold uppercase text-[9px] tracking-wider w-24">Major Subject</span>
          <span className="text-neutral-700 font-bold text-right">
            {majorSubject}
          </span>
        </div>

        <div className="flex justify-between items-baseline gap-2">
          <span className="text-neutral-400 font-bold uppercase text-[9px] tracking-wider w-24">Minor Subject</span>
          <span className="text-neutral-700 font-semibold text-right">
            {minorSubject}
          </span>
        </div>

        <div className="flex justify-between items-baseline gap-2">
          <span className="text-neutral-400 font-bold uppercase text-[9px] tracking-wider w-24">Gender</span>
          <span className="text-neutral-700 font-medium capitalize text-right">
            {gender.toLowerCase()}
          </span>
        </div>

        <div className="flex justify-between items-baseline gap-2">
          <span className="text-neutral-400 font-bold uppercase text-[9px] tracking-wider w-24">Category</span>
          <span className="text-neutral-700 font-medium text-right truncate max-w-[180px]">
            {category}
          </span>
        </div>

        <div className="flex justify-between items-baseline gap-2">
          <span className="text-neutral-400 font-bold uppercase text-[9px] tracking-wider w-24">Admission Cat</span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-800">
            {admissionCategory}
          </span>
        </div>

        {rollNumber && (
          <div className="flex justify-between items-baseline gap-2">
            <span className="text-neutral-400 font-bold uppercase text-[9px] tracking-wider w-24">Roll Number</span>
            <span className="text-neutral-700 font-mono font-bold text-right">
              {rollNumber}
            </span>
          </div>
        )}

        {enrollmentNumber && (
          <div className="flex justify-between items-baseline gap-2">
            <span className="text-neutral-400 font-bold uppercase text-[9px] tracking-wider w-24">Enrollment No</span>
            <span className="text-neutral-700 font-mono text-right">
              {enrollmentNumber}
            </span>
          </div>
        )}

        {semester && (
          <div className="flex justify-between items-baseline gap-2">
            <span className="text-neutral-400 font-bold uppercase text-[9px] tracking-wider w-24">Semester</span>
            <span className="text-blue-700 font-bold text-right">
              {semester}
            </span>
          </div>
        )}

        {batch && (
          <div className="flex justify-between items-baseline gap-2">
            <span className="text-neutral-400 font-bold uppercase text-[9px] tracking-wider w-24">Batch / Year</span>
            <span className="text-neutral-700 font-bold text-right">
              {batch}
            </span>
          </div>
        )}

        {student?.mobile && (
          <div className="flex justify-between items-baseline gap-2" id={`student-card-mobile-${studentId}`}>
            <span className="text-neutral-400 font-bold uppercase text-[9px] tracking-wider w-24">Mobile Number</span>
            <span className="text-neutral-700 font-mono font-bold text-right text-xs">
              {student.mobile}
            </span>
          </div>
        )}

        {student?.email && (
          <div className="flex justify-between items-baseline gap-2" id={`student-card-email-${studentId}`}>
            <span className="text-neutral-400 font-bold uppercase text-[9px] tracking-wider w-24">Email Address</span>
            <span className="text-neutral-700 font-semibold text-right text-xs truncate max-w-[180px]" title={student.email}>
              {student.email}
            </span>
          </div>
        )}
      </div>

      {/* View Full Details Footer Button */}
      <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onViewDetails(studentId)}
          className="flex-1 inline-flex items-center justify-center gap-1 py-2 px-4 bg-white hover:bg-blue-50 border border-neutral-200 hover:border-blue-200 text-xs font-bold text-neutral-700 hover:text-blue-700 rounded-xl transition-all shadow-sm cursor-pointer"
          id={`view-details-btn-${studentId}`}
        >
          <span>View Details</span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
        <button
          type="button"
          onClick={() => setShowQr(!showQr)}
          className={`p-2 rounded-xl border transition-all shadow-sm cursor-pointer ${
            showQr 
              ? "bg-blue-600 text-white border-blue-600" 
              : "bg-white hover:bg-neutral-50 text-neutral-500 border-neutral-200 hover:text-blue-600 hover:border-blue-200"
          }`}
          title="Toggle QR Code Lookup"
          id={`toggle-qr-btn-${studentId}`}
        >
          <QrCode className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
