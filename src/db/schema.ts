import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';

// 1. Imports Table
export const imports = pgTable('imports', {
  id: serial('id').primaryKey(),
  fileName: text('file_name').notNull(),
  date: timestamp('date').defaultNow().notNull(),
  adminEmail: text('admin_email').notNull(),
  totalRecords: integer('total_records').default(0).notNull(),
  newRecords: integer('new_records').default(0).notNull(),
  updatedRecords: integer('updated_records').default(0).notNull(),
  duplicateRecords: integer('duplicate_records').default(0).notNull(),
  invalidRecords: integer('invalid_records').default(0).notNull(),
  status: text('status').notNull(), // 'Success', 'Failed'
});

// 2. Students Table
export const students = pgTable('students', {
  id: serial('id').primaryKey(),
  formNumber: text('form_number').notNull(),
  registrationId: text('registration_id').notNull(),
  rollNumber: text('roll_number'),
  enrollmentNumber: text('enrollment_number'),
  semester: text('semester'),
  batch: text('batch'),
  programmeName: text('programme_name'),
  transactionMode: text('transaction_mode'),
  admissionCategory: text('admission_category'),
  majorSubject: text('major_subject'),
  minorSubject: text('minor_subject'),
  name: text('name').notNull(),
  gender: text('gender'),
  category: text('category'),
  email: text('email'),
  mobile: text('mobile'),
  viewCount: integer('view_count').default(0).notNull(),
  status: text('status').default('Active').notNull(), // 'Active', 'Inactive'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  importId: integer('import_id').references(() => imports.id),
}, (table) => {
  return {
    nameIdx: index('students_name_idx').on(table.name),
    regIdx: index('students_reg_idx').on(table.registrationId),
    formIdx: index('students_form_idx').on(table.formNumber),
    rollIdx: index('students_roll_idx').on(table.rollNumber),
    enrollIdx: index('students_enroll_idx').on(table.enrollmentNumber),
    semIdx: index('students_sem_idx').on(table.semester),
    batchIdx: index('students_batch_idx').on(table.batch),
  };
});

// 2.5 Batches Table
export const batches = pgTable('batches', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(), // e.g. "2026–2029"
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Activity Logs Table
export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  adminEmail: text('admin_email').notNull(),
  action: text('action').notNull(), // 'Login', 'Logout', 'PDF Upload', 'Import', 'Student Created', 'Student Updated', 'Student Deleted', 'Settings Updated'
  details: text('details').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// 4. Settings Table
export const settings = pgTable('settings', {
  id: integer('id').primaryKey(), // Always 1
  collegeName: text('college_name').default('Pragjyotish College').notNull(),
  departmentName: text('department_name').default('Department of Computer Application (BCA)').notNull(),
  publicSearchEnabled: boolean('public_search_enabled').default(true).notNull(),
  emailVisibleToPublic: boolean('email_visible_to_public').default(false).notNull(),
  mobileVisibleToPublic: boolean('mobile_visible_to_public').default(false).notNull(),
  enablePrivateFields: boolean('enable_private_fields').default(true).notNull(),
  adminPasswordHash: text('admin_password_hash').notNull(),
  timezone: text('timezone').default('Asia/Kolkata').notNull(),
  maintenanceMode: boolean('maintenance_mode').default(false).notNull(),
  maintenanceMessage: text('maintenance_message').default('We are currently updating the student records system. Please check back later.'),
});

// Define Relationships
export const importsRelations = relations(imports, ({ many }) => ({
  students: many(students),
}));

export const studentsRelations = relations(students, ({ one }) => ({
  importBatch: one(imports, {
    fields: [students.importId],
    references: [imports.id],
  }),
}));

// 5. Search Queries Analytics Table
export const searchQueries = pgTable('search_queries', {
  id: serial('id').primaryKey(),
  query: text('query').notNull(),
  count: integer('count').default(1).notNull(),
  lastSearchedAt: timestamp('last_searched_at').defaultNow().notNull(),
}, (table) => {
  return {
    queryUniqueIdx: uniqueIndex('search_queries_query_idx').on(table.query),
  };
});

// 6. Search Events Table
export const searchEvents = pgTable('search_events', {
  id: serial('id').primaryKey(),
  query: text('query').notNull(),
  searchType: text('search_type').notNull(), // 'name', 'roll_number', 'registration_id', 'form_number', 'all'
  matchedStudentId: integer('matched_student_id').references(() => students.id),
  resultCount: integer('result_count').default(0).notNull(),
  isSuccessful: boolean('is_successful').default(false).notNull(),
  visitorHash: text('visitor_hash').notNull(),
  sessionId: text('session_id').notNull(),
  deviceType: text('device_type').notNull(),
  browser: text('browser').notNull(),
  os: text('os').notNull(),
  referrer: text('referrer'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    matchedStudentIdIdx: index('search_events_matched_student_idx').on(table.matchedStudentId),
    searchTypeIdx: index('search_events_search_type_idx').on(table.searchType),
    createdAtIdx: index('search_events_created_at_idx').on(table.createdAt),
    visitorHashIdx: index('search_events_visitor_hash_idx').on(table.visitorHash),
    queryIdx: index('search_events_query_idx').on(table.query),
  };
});

// 7. Profile View Events Table
export const profileViewEvents = pgTable('profile_view_events', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').references(() => students.id).notNull(),
  visitorHash: text('visitor_hash').notNull(),
  sessionId: text('session_id').notNull(),
  deviceType: text('device_type').notNull(),
  browser: text('browser').notNull(),
  os: text('os').notNull(),
  referrer: text('referrer'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    studentIdIdx: index('profile_view_events_student_idx').on(table.studentId),
    createdAtIdx: index('profile_view_events_created_at_idx').on(table.createdAt),
    visitorHashIdx: index('profile_view_events_visitor_hash_idx').on(table.visitorHash),
  };
});

