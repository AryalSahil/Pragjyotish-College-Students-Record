export interface Student {
  id: number;
  formNumber: string;
  registrationId: string;
  rollNumber?: string | null;
  enrollmentNumber?: string | null;
  semester?: string | null;
  batch?: string | null;
  programmeName: string | null;
  transactionMode: string | null;
  admissionCategory: string | null;
  majorSubject: string | null;
  minorSubject: string | null;
  name: string;
  gender: string | null;
  category: string | null;
  email?: string;
  mobile?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  importId?: number | null;
}

export interface ImportRecord {
  id: number;
  fileName: string;
  date: string;
  adminEmail: string;
  totalRecords: number;
  newRecords: number;
  updatedRecords: number;
  duplicateRecords: number;
  invalidRecords: number;
  status: string;
}

export interface ActivityLog {
  id: number;
  adminEmail: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface SystemSettings {
  collegeName: string;
  departmentName: string;
  publicSearchEnabled: boolean;
  emailVisibleToPublic: boolean;
  mobileVisibleToPublic: boolean;
  enablePrivateFields: boolean;
  timezone: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
}

export interface ImportPreview {
  fileName: string;
  totalRecords: number;
  newCount: number;
  updatedCount: number;
  duplicateCount: number;
  invalidCount: number;
  preview: {
    newRecords: Omit<Student, 'id' | 'status'>[];
    updatedRecords: (Omit<Student, 'id' | 'status'> & { existingId: number; existingRecord: Partial<Student> })[];
    duplicateRecords: (Omit<Student, 'id' | 'status'> & { existingId: number })[];
    invalidRecords: any[];
  };
}
