import express from "express";
import path from "path";
import multer from "multer";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { eq, like, or, and, sql, desc, asc, ilike, gt, gte, lt, lte } from "drizzle-orm";
import { GoogleGenAI, Type } from "@google/genai";
import nodemailer from "nodemailer";
import * as pdf from "pdf-parse";

import { db } from "./src/db/index.ts";
import { students, imports, activityLogs, settings, batches, searchQueries, searchEvents, profileViewEvents } from "./src/db/schema.ts";

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "pragjyotish_bca_secret_key_123";

// URL normalization for Vercel Serverless Function compatibility
app.use((req, res, next) => {
  if (req.url) {
    if (req.url.startsWith("/api/index")) {
      req.url = req.url.replace(/^\/api\/index/, "/api");
    } else if (req.originalUrl && req.originalUrl.startsWith("/api") && !req.url.startsWith("/api")) {
      req.url = req.originalUrl;
    } else if (!req.url.startsWith("/api") && req.originalUrl?.includes("/api/")) {
      req.url = req.originalUrl;
    }
  }
  next();
});

// Configure body-parser
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Prevent any API response caching to ensure real-time accuracy
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});

// Heuristic User-Agent Parser for Privacy-preserving Device, Browser & OS insights
function parseUserAgent(uaString: string) {
  let browser = "Unknown Browser";
  let os = "Unknown OS";
  let deviceType = "Desktop";

  const ua = uaString || "";

  // Device Type classification
  if (/mobi|android|iphone|ipad|ipod/i.test(ua)) {
    if (/ipad/i.test(ua)) {
      deviceType = "Tablet";
    } else {
      deviceType = "Mobile";
    }
  } else {
    deviceType = "Desktop";
  }

  // Operating System classification
  if (/windows/i.test(ua)) {
    os = "Windows";
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = "MacOS";
  } else if (/android/i.test(ua)) {
    os = "Android";
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = "iOS";
  } else if (/linux/i.test(ua)) {
    os = "Linux";
  }

  // Browser classification
  if (/firefox|iceweasel/i.test(ua)) {
    browser = "Firefox";
  } else if (/chrome|crios/i.test(ua)) {
    browser = "Chrome";
  } else if (/safari/i.test(ua)) {
    browser = "Safari";
  } else if (/msie|trident/i.test(ua)) {
    browser = "Internet Explorer";
  } else if (/edge|edg/i.test(ua)) {
    browser = "Edge";
  }

  return { browser, os, deviceType };
}

// Configure file upload with memory storage (no dependency on local file system)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Initialize Gemini SDK lazily to avoid startup crashes if key is missing
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Custom request interface for JWT authenticated routes
interface AuthRequest extends express.Request {
  admin?: {
    email: string;
    role: string;
  };
}

// JWT Authentication Middleware
const requireJWT = (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  let token: string | null = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (typeof req.query.token === "string" && req.query.token.length > 0) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { email: string; role: string };
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
  }
};

// HELPER: Log activities easily
async function logActivity(email: string, action: string, details: string) {
  try {
    await db.insert(activityLogs).values({
      adminEmail: email,
      action,
      details,
    });
  } catch (err) {
    console.error("Failed to insert activity log:", err);
  }
}

// HELPER: Send SMTP Email Notifications for Critical Events
async function sendAdminNotification(subject: string, text: string, html?: string) {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || `"Pragjyotish College Alerts" <no-reply@pragjyotishcollege.ac.in>`;
  const to = process.env.ADMIN_NOTIFICATION_EMAIL || "sahil265064@gmail.com";

  if (!host || !user || !pass) {
    console.warn(`[SMTP Warning] Skipped sending email alert: "${subject}". SMTP credentials are not configured.`);
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });

    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html: html || text.replace(/\n/g, "<br>"),
    });

    console.log(`[SMTP Success] Sent administrative email alert to ${to}: "${subject}"`);
  } catch (err) {
    console.error(`[SMTP Error] Failed to send email alert:`, err);
  }
}

// ---------------------------------------------------------
// 1. PUBLIC ENDPOINTS (No Auth Required)
// ---------------------------------------------------------

// GET College Name, Department and Search Settings
app.get("/api/public/config", async (req, res) => {
  try {
    const records = await db.select().from(settings).where(eq(settings.id, 1));
    if (records.length === 0) {
      return res.json({
        collegeName: "Pragjyotish College",
        departmentName: "Department of Computer Application (BCA)",
        publicSearchEnabled: true,
        emailVisibleToPublic: false,
        mobileVisibleToPublic: false,
        enablePrivateFields: true,
        timezone: "Asia/Kolkata",
        maintenanceMode: false,
        maintenanceMessage: "We are currently updating the student records system. Please check back later.",
      });
    }
    const s = records[0];
    res.json({
      collegeName: s.collegeName,
      departmentName: s.departmentName,
      publicSearchEnabled: s.publicSearchEnabled,
      emailVisibleToPublic: s.emailVisibleToPublic,
      mobileVisibleToPublic: s.mobileVisibleToPublic,
      enablePrivateFields: s.enablePrivateFields,
      timezone: s.timezone,
      maintenanceMode: s.maintenanceMode,
      maintenanceMessage: s.maintenanceMessage,
    });
  } catch (err: any) {
    console.error("Error fetching public config:", err);
    res.status(500).json({ error: "Failed to load site configurations" });
  }
});

// GET Public Settings directly
app.get("/api/public/settings", async (req, res) => {
  try {
    const records = await db.select().from(settings).where(eq(settings.id, 1));
    if (records.length === 0) {
      return res.json({
        collegeName: "Pragjyotish College",
        departmentName: "Department of Computer Application (BCA)",
        publicSearchEnabled: true,
        emailVisibleToPublic: false,
        mobileVisibleToPublic: false,
        enablePrivateFields: true,
        timezone: "Asia/Kolkata",
        maintenanceMode: false,
        maintenanceMessage: "We are currently updating the student records system. Please check back later.",
      });
    }
    const s = records[0];
    res.json({
      collegeName: s.collegeName,
      departmentName: s.departmentName,
      publicSearchEnabled: s.publicSearchEnabled,
      emailVisibleToPublic: s.emailVisibleToPublic,
      mobileVisibleToPublic: s.mobileVisibleToPublic,
      enablePrivateFields: s.enablePrivateFields,
      timezone: s.timezone,
      maintenanceMode: s.maintenanceMode,
      maintenanceMessage: s.maintenanceMessage,
    });
  } catch (err: any) {
    console.error("Error fetching public settings:", err);
    res.status(500).json({ error: "Failed to load public settings" });
  }
});

// GET Total Student Count
app.get("/api/public/students/count", async (req, res) => {
  try {
    // Check if public search is disabled
    const configRecords = await db.select().from(settings).where(eq(settings.id, 1));
    if (configRecords.length > 0 && !configRecords[0].publicSearchEnabled) {
      return res.json({ count: 0 });
    }

    const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(students).where(eq(students.status, "Active"));
    const count = countResult[0]?.count || 0;
    res.json({ count });
  } catch (err: any) {
    console.error("Error fetching student count:", err);
    res.status(500).json({ error: "Failed to load student statistics" });
  }
});

// GET Public Academic Batches
app.get("/api/public/batches", async (req, res) => {
  try {
    let list = await db.select().from(batches).orderBy(asc(batches.name));
    if (list.length === 0) {
      const defaultBatches = ["2024–2027", "2025–2028", "2026–2029"];
      for (const bName of defaultBatches) {
        await db.insert(batches).values({ name: bName }).onConflictDoNothing();
      }
      list = await db.select().from(batches).orderBy(asc(batches.name));
    }
    res.json(list);
  } catch (err: any) {
    console.error("Fetch public batches error:", err);
    res.status(500).json({ error: "Failed to fetch academic batches" });
  }
});

// PUBLIC Search Students (Strictly Sanitized - Never Expose Email/Mobile)
app.get("/api/public/students/search", async (req, res) => {
  try {
    const configRecords = await db.select().from(settings).where(eq(settings.id, 1));
    const publicSearchEnabled = configRecords.length === 0 || configRecords[0].publicSearchEnabled;
    const emailVisibleToPublic = configRecords.length > 0 && configRecords[0].emailVisibleToPublic;
    const mobileVisibleToPublic = configRecords.length > 0 && configRecords[0].mobileVisibleToPublic;

    if (!publicSearchEnabled) {
      return res.status(403).json({ error: "Public search has been disabled by the administrator" });
    }

    const queryVal = req.query.query;
    const queryStr = typeof queryVal === "string" ? queryVal.trim() : "";

    // Track search query analytics (2 to 100 characters, ignoring whitespace-only or single-character noise)
    if (queryStr && queryStr.length >= 2 && queryStr.length <= 100) {
      const normalizedQuery = queryStr.toLowerCase();
      db.select().from(searchQueries).where(eq(searchQueries.query, normalizedQuery))
        .then(async (existing) => {
          if (existing.length > 0) {
            await db.update(searchQueries)
              .set({
                count: existing[0].count + 1,
                lastSearchedAt: new Date(),
              })
              .where(eq(searchQueries.id, existing[0].id));
          } else {
            await db.insert(searchQueries).values({
              query: normalizedQuery,
              count: 1,
              lastSearchedAt: new Date(),
            });
          }
        })
        .catch((err) => {
          console.error("Failed to log search query analytics:", err);
        });
    }

    const semesterVal = req.query.semester;
    const semester = typeof semesterVal === "string" ? semesterVal.trim() : "";

    const batchVal = req.query.batch;
    const batch = typeof batchVal === "string" ? batchVal.trim() : "";

    let pageNum = parseInt(req.query.page as string, 10);
    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

    let limitNum = parseInt(req.query.limit as string, 10);
    if (isNaN(limitNum) || limitNum < 1) limitNum = 10;

    const offset = (pageNum - 1) * limitNum;

    // If no query, semester, or batch is provided, default to listing all active students
    const conditions: any[] = [eq(students.status, "Active")];

    if (queryStr) {
      conditions.push(
        or(
          ilike(students.name, `%${queryStr}%`),
          ilike(students.registrationId, `%${queryStr}%`),
          ilike(students.formNumber, `%${queryStr}%`),
          ilike(students.rollNumber, `%${queryStr}%`),
          ilike(students.enrollmentNumber, `%${queryStr}%`)
        )
      );
    }

    if (semester) {
      conditions.push(eq(students.semester, semester));
    }

    if (batch) {
      conditions.push(eq(students.batch, batch));
    }

    // Build the query filter for partial/case-insensitive search
    let totalQuery = db.select({ count: sql<number>`count(*)::int` }).from(students);
    let itemsQuery = db.select().from(students);

    if (conditions.length > 0) {
      const cond = and(...conditions);
      totalQuery = totalQuery.where(cond) as any;
      itemsQuery = itemsQuery.where(cond) as any;
    }

    // Get total matches count
    const [countRow] = await totalQuery;
    const total = countRow ? countRow.count : 0;

    // Fetch paginated slice from the database
    const paginatedRecords = await itemsQuery
      .orderBy(desc(students.id))
      .limit(limitNum)
      .offset(offset);

    // Sanitize records to enforce absolute privacy rule
    const sanitizedStudents = paginatedRecords.map((s) => ({
      id: s.id,
      name: s.name || "Unknown Student",
      registrationId: s.registrationId || "",
      formNumber: s.formNumber || "",
      rollNumber: s.rollNumber || null,
      enrollmentNumber: s.enrollmentNumber || null,
      semester: s.semester || null,
      batch: s.batch || null,
      programmeName: s.programmeName || "Bachelor of Computer Applications",
      majorSubject: s.majorSubject || "Computer Application",
      minorSubject: s.minorSubject || "Mathematics",
      gender: s.gender || "MALE",
      category: s.category || "GENERAL",
      admissionCategory: s.admissionCategory || "GENERAL",
      transactionMode: s.transactionMode || "CASH",
      email: emailVisibleToPublic ? s.email : undefined,
      mobile: mobileVisibleToPublic ? s.mobile : undefined,
      status: s.status || "Active",
    }));

    res.json({
      students: sanitizedStudents,
      total,
      page: pageNum,
      limit: limitNum,
    });

    // Track search event if a query exists
    if (queryStr) {
      const userAgent = req.headers["user-agent"] || "";
      const { browser, os, deviceType } = parseUserAgent(userAgent);
      const visitorHash = (req.headers["x-visitor-hash"] || req.query.visitorHash || "anon_" + Math.random().toString(36).substring(2, 12)) as string;
      const sessionId = (req.headers["x-session-id"] || req.query.sessionId || "sess_" + Math.random().toString(36).substring(2, 12)) as string;
      const referrer = (req.headers["referer"] || req.headers["referrer"] || "") as string;

      let searchType = "Name";
      let matchedStudentId: number | null = null;

      if (paginatedRecords.length > 0) {
        const first = paginatedRecords[0];
        matchedStudentId = first.id;

        const normQuery = queryStr.toLowerCase();
        if (first.rollNumber && first.rollNumber.toLowerCase().includes(normQuery)) {
          searchType = "Roll Number";
        } else if (first.registrationId && first.registrationId.toLowerCase().includes(normQuery)) {
          searchType = "Registration ID";
        } else if (first.formNumber && first.formNumber.toLowerCase().includes(normQuery)) {
          searchType = "Form Number";
        } else if (first.enrollmentNumber && first.enrollmentNumber.toLowerCase().includes(normQuery)) {
          searchType = "Roll Number";
        } else if (first.name && first.name.toLowerCase().includes(normQuery)) {
          searchType = "Name";
        } else {
          if (/^\d+$/.test(queryStr)) {
            searchType = queryStr.length <= 5 ? "Roll Number" : "Form Number";
          } else if (/[/\-]/.test(queryStr)) {
            searchType = "Registration ID";
          } else {
            searchType = "Name";
          }
        }
      } else {
        if (/^\d+$/.test(queryStr)) {
          searchType = queryStr.length <= 5 ? "Roll Number" : "Form Number";
        } else if (/[/\-]/.test(queryStr)) {
          searchType = "Registration ID";
        } else {
          searchType = "Name";
        }
      }

      db.insert(searchEvents).values({
        query: queryStr,
        searchType: searchType,
        matchedStudentId: matchedStudentId,
        resultCount: total,
        isSuccessful: total > 0,
        visitorHash: visitorHash,
        sessionId: sessionId,
        deviceType: deviceType,
        browser: browser,
        os: os,
        referrer: referrer || null,
        createdAt: new Date(),
      })
      .catch((err) => {
        console.error("Async search event insert failed:", err);
      });
    }
  } catch (err: any) {
    console.error("Public search error:", err);
    res.status(500).json({ 
      error: "Failed to perform search query", 
      message: err?.message, 
      stack: err?.stack 
    });
  }
});

// GET public student details by ID (Strictly Sanitized unless settings allow public contact visibility)
app.get("/api/public/students/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const configRecords = await db.select().from(settings).where(eq(settings.id, 1));
    const publicSearchEnabled = configRecords.length === 0 || configRecords[0].publicSearchEnabled;
    const emailVisibleToPublic = configRecords.length > 0 && configRecords[0].emailVisibleToPublic;
    const mobileVisibleToPublic = configRecords.length > 0 && configRecords[0].mobileVisibleToPublic;

    if (!publicSearchEnabled) {
      return res.status(403).json({ error: "Public student directory view is currently disabled by the administrator" });
    }

    const record = await db.select().from(students).where(eq(students.id, parseInt(id, 10)));
    if (record.length === 0) {
      return res.status(404).json({ error: "Student record not found" });
    }

    const s = record[0];
    if (s.status !== "Active") {
      return res.status(403).json({ error: "This student profile is currently inactive" });
    }

    // Check for visitor session identifiers
    const visitorHash = (req.headers["x-visitor-hash"] || req.query.visitorHash || "anon_" + Math.random().toString(36).substring(2, 12)) as string;
    const sessionId = (req.headers["x-session-id"] || req.query.sessionId || "sess_" + Math.random().toString(36).substring(2, 12)) as string;
    const userAgent = req.headers["user-agent"] || "";
    const { browser, os, deviceType } = parseUserAgent(userAgent);
    const referrer = (req.headers["referer"] || req.headers["referrer"] || "") as string;

    // Prevent double counting of view events for the same session within 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentView = await db.select()
      .from(profileViewEvents)
      .where(
        and(
          eq(profileViewEvents.studentId, s.id),
          eq(profileViewEvents.sessionId, sessionId),
          gt(profileViewEvents.createdAt, fiveMinutesAgo)
        )
      )
      .limit(1);

    if (recentView.length === 0) {
      // Increment profile view count in students table
      await db.update(students)
        .set({ viewCount: sql`${students.viewCount} + 1` })
        .where(eq(students.id, s.id));

      // Log profile view event in database
      await db.insert(profileViewEvents).values({
        studentId: s.id,
        visitorHash,
        sessionId,
        deviceType,
        browser,
        os,
        referrer: referrer || null,
        createdAt: new Date()
      }).catch((err) => {
        console.error("Failed to insert profile view event:", err);
      });
    }

    const sanitizedStudent = {
      id: s.id,
      name: s.name || "Unknown Student",
      registrationId: s.registrationId || "",
      formNumber: s.formNumber || "",
      rollNumber: s.rollNumber || null,
      enrollmentNumber: s.enrollmentNumber || null,
      semester: s.semester || null,
      batch: s.batch || null,
      programmeName: s.programmeName || "Bachelor of Computer Applications",
      majorSubject: s.majorSubject || "Computer Application",
      minorSubject: s.minorSubject || "Mathematics",
      gender: s.gender || "MALE",
      category: s.category || "GENERAL",
      admissionCategory: s.admissionCategory || "GENERAL",
      transactionMode: s.transactionMode || "CASH",
      status: s.status || "Active",
      email: emailVisibleToPublic ? s.email : undefined,
      mobile: mobileVisibleToPublic ? s.mobile : undefined,
    };

    res.json(sanitizedStudent);
  } catch (err: any) {
    console.error("Public get student error:", err);
    res.status(500).json({ error: "Failed to load student profile details" });
  }
});

// Admin Authentication Login
app.post("/api/public/login", async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: "Secure administrative password is required" });
  }

  try {
    const isMatch = password === "782447";

    if (isMatch) {
      const token = jwt.sign(
        { email: "admin@pragjyotishcollege.ac.in", role: "administrator" },
        JWT_SECRET,
        { expiresIn: "8h" }
      );
      await logActivity("admin@pragjyotishcollege.ac.in", "Login", "Successfully signed into the admin portal using secure administrative key.");
      return res.json({ token, admin: { email: "admin@pragjyotishcollege.ac.in", role: "administrator" } });
    }

    await logActivity("anonymous", "Login Failed", `Unauthorized access attempt to admin panel using incorrect security key.`);
    
    // Trigger security alert email for unauthorized login attempt
    const sub = `⚠️ SECURITY ALERT: Unauthorized Admin Login Attempt`;
    const body = `An unauthorized login attempt was detected on the Pragjyotish College Student Records Admin Portal.\n\nDetails:\n- Date/Time: ${new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })} (IST)\n- Client IP: ${req.ip || "Unknown"}\n- Status: Rejected (Invalid Security Key)`;
    sendAdminNotification(sub, body).catch(console.error);

    res.status(401).json({ error: "Incorrect administrative password" });
  } catch (err: any) {
    console.error("Login route error:", err);
    res.status(500).json({ error: "An unexpected error occurred during sign-in" });
  }
});

// ---------------------------------------------------------
// 2. PROTECTED ADMIN ENDPOINTS (requireJWT Auth)
// ---------------------------------------------------------

// Verify JWT token validity
app.get("/api/admin/verify", requireJWT, (req: AuthRequest, res) => {
  res.json({ valid: true, admin: req.admin });
});

// Admin Log Out Trigger
app.post("/api/admin/logout", requireJWT, async (req: AuthRequest, res) => {
  const email = req.admin?.email || "admin";
  await logActivity(email, "Logout", "Logged out of administrator session.");
  res.json({ success: true });
});

// Admin Settings fetching
app.get("/api/admin/settings", requireJWT, async (req: AuthRequest, res) => {
  try {
    const records = await db.select().from(settings).where(eq(settings.id, 1));
    if (records.length === 0) {
      return res.status(404).json({ error: "Settings not found." });
    }
    res.json(records[0]);
  } catch (err: any) {
    console.error("Admin load settings error:", err);
    res.status(500).json({ error: "Failed to load settings" });
  }
});

// Admin Settings update
app.put("/api/admin/settings", requireJWT, async (req: AuthRequest, res) => {
  const email = req.admin?.email || "admin";
  const { collegeName, departmentName, publicSearchEnabled, emailVisibleToPublic, mobileVisibleToPublic, enablePrivateFields, timezone, maintenanceMode, maintenanceMessage } = req.body;
  
  try {
    await db.update(settings)
      .set({
        collegeName,
        departmentName,
        publicSearchEnabled: !!publicSearchEnabled,
        emailVisibleToPublic: !!emailVisibleToPublic,
        mobileVisibleToPublic: !!mobileVisibleToPublic,
        enablePrivateFields: !!enablePrivateFields,
        timezone: timezone || "Asia/Kolkata",
        maintenanceMode: !!maintenanceMode,
        maintenanceMessage: maintenanceMessage || "We are currently updating the student records system. Please check back later.",
      })
      .where(eq(settings.id, 1));

    await logActivity(email, "Settings Updated", `System configuration updated (Timezone: ${timezone}, Search: ${publicSearchEnabled}, Maintenance Mode: ${maintenanceMode}).`);
    res.json({ success: true, message: "Settings updated successfully" });
  } catch (err: any) {
    console.error("Update settings error:", err);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// Admin Update Password
app.put("/api/admin/settings/password", requireJWT, async (req: AuthRequest, res) => {
  const email = req.admin?.email || "admin";
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current password and new password are required" });
  }

  try {
    const records = await db.select().from(settings).where(eq(settings.id, 1));
    if (records.length === 0) {
      return res.status(404).json({ error: "System settings not found" });
    }

    const systemConfig = records[0];
    const isMatch = await bcrypt.compare(currentPassword, systemConfig.adminPasswordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect current password" });
    }

    const newHashed = await bcrypt.hash(newPassword, 10);
    await db.update(settings).set({ adminPasswordHash: newHashed }).where(eq(settings.id, 1));

    await logActivity(email, "Settings Updated", "Administrator password updated successfully.");
    res.json({ success: true, message: "Password updated successfully" });
  } catch (err: any) {
    console.error("Password update error:", err);
    res.status(500).json({ error: "Failed to update admin password" });
  }
});

// Admin Activity Log view
app.get("/api/admin/logs", requireJWT, async (req, res) => {
  try {
    const logs = await db.select().from(activityLogs).orderBy(desc(activityLogs.timestamp)).limit(100);
    res.json(logs);
  } catch (err: any) {
    console.error("Fetch logs error:", err);
    res.status(500).json({ error: "Failed to load activity log logs" });
  }
});

// Admin Import History view
app.get("/api/admin/imports", requireJWT, async (req, res) => {
  try {
    const history = await db.select().from(imports).orderBy(desc(imports.date));
    res.json(history);
  } catch (err: any) {
    console.error("Fetch import history error:", err);
    res.status(500).json({ error: "Failed to fetch import history" });
  }
});

// Admin Dashboard stats view
app.get("/api/admin/stats", requireJWT, async (req, res) => {
  try {
    // 1. Total student count
    const totalResult = await db.select({ count: sql<number>`count(*)::int` }).from(students);
    const totalStudents = totalResult[0]?.count || 0;

    // 2. Gender distribution count
    const maleResult = await db.select({ count: sql<number>`count(*)::int` }).from(students).where(eq(sql`lower(${students.gender})`, "male"));
    const femaleResult = await db.select({ count: sql<number>`count(*)::int` }).from(students).where(eq(sql`lower(${students.gender})`, "female"));
    
    const maleCount = maleResult[0]?.count || 0;
    const femaleCount = femaleResult[0]?.count || 0;
    const otherCount = Math.max(0, totalStudents - (maleCount + femaleCount));

    // 3. Latest import metadata
    const latestImportResult = await db.select().from(imports).orderBy(desc(imports.date)).limit(1);
    const latestImport = latestImportResult[0] || null;

    // 3.5 Total imports count
    const totalImportsResult = await db.select({ count: sql<number>`count(*)::int` }).from(imports);
    const totalImports = totalImportsResult[0]?.count || 0;

    // 4. Recent activities
    const recentLogs = await db.select().from(activityLogs).orderBy(desc(activityLogs.timestamp)).limit(6);

    // 5. Fetch top viewed students for the frequency bar chart
    const topViewedStudents = await db.select({
      id: students.id,
      name: students.name,
      registrationId: students.registrationId,
      viewCount: students.viewCount,
    })
    .from(students)
    .orderBy(desc(students.viewCount))
    .limit(8);

    // 6. Fetch top searched queries for the search analytics widget
    const topSearches = await db.select({
      id: searchQueries.id,
      query: searchQueries.query,
      count: searchQueries.count,
      lastSearchedAt: searchQueries.lastSearchedAt,
    })
    .from(searchQueries)
    .orderBy(desc(searchQueries.count))
    .limit(8);

    res.json({
      totalStudents,
      maleCount,
      femaleCount,
      otherCount,
      latestImport,
      totalImports,
      recentActivities: recentLogs,
      topViewedStudents,
      topSearches,
    });
  } catch (err: any) {
    console.error("Fetch dashboard stats error:", err);
    res.status(500).json({ error: "Failed to load database stats" });
  }
});

// Helper for dynamic analytics date-range periods
function getPeriods(startDateStr: any, endDateStr: any) {
  let start = new Date();
  let end = new Date();

  if (startDateStr && typeof startDateStr === "string") {
    start = new Date(startDateStr);
  } else {
    start.setDate(start.getDate() - 30); // Default to last 30 days
  }
  
  if (endDateStr && typeof endDateStr === "string") {
    end = new Date(endDateStr);
  }

  // Set standard times for the start & end day boundaries
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const durationMs = end.getTime() - start.getTime() + 1;
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(start.getTime() - durationMs);

  return { start, end, prevStart, prevEnd };
}

// 1. Overview analytics counters & period comparisons (Admin-only)
app.get("/api/admin/analytics/overview", requireJWT as any, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { start, end, prevStart, prevEnd } = getPeriods(startDate, endDate);

    // Current period total searches
    const currentSearches = await db.select({ count: sql<number>`count(*)::int` })
      .from(searchEvents)
      .where(and(gte(searchEvents.createdAt, start), lte(searchEvents.createdAt, end)));
    const totalSearches = currentSearches[0]?.count || 0;

    // Current period unique visitors
    const currentUnique = await db.select({ count: sql<number>`count(distinct ${searchEvents.visitorHash})::int` })
      .from(searchEvents)
      .where(and(gte(searchEvents.createdAt, start), lte(searchEvents.createdAt, end)));
    const uniqueSearchers = currentUnique[0]?.count || 0;

    // Current period profile views
    const currentViews = await db.select({ count: sql<number>`count(*)::int` })
      .from(profileViewEvents)
      .where(and(gte(profileViewEvents.createdAt, start), lte(profileViewEvents.createdAt, end)));
    const totalProfileViews = currentViews[0]?.count || 0;

    // Previous period stats (for trend lines / percentages)
    const prevSearches = await db.select({ count: sql<number>`count(*)::int` })
      .from(searchEvents)
      .where(and(gte(searchEvents.createdAt, prevStart), lte(searchEvents.createdAt, prevEnd)));
    const totalSearchesPrev = prevSearches[0]?.count || 0;

    const prevUnique = await db.select({ count: sql<number>`count(distinct ${searchEvents.visitorHash})::int` })
      .from(searchEvents)
      .where(and(gte(searchEvents.createdAt, prevStart), lte(searchEvents.createdAt, prevEnd)));
    const uniqueSearchersPrev = prevUnique[0]?.count || 0;

    const prevViews = await db.select({ count: sql<number>`count(*)::int` })
      .from(profileViewEvents)
      .where(and(gte(profileViewEvents.createdAt, prevStart), lte(profileViewEvents.createdAt, prevEnd)));
    const totalViewsPrev = prevViews[0]?.count || 0;

    // Absolute interval counts (Today, Week, Month) in local boundaries
    const nowKolkata = new Date();
    const todayStart = new Date(nowKolkata.getFullYear(), nowKolkata.getMonth(), nowKolkata.getDate());
    
    const weekStart = new Date(nowKolkata);
    weekStart.setDate(nowKolkata.getDate() - nowKolkata.getDay()); // Sunday
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(nowKolkata.getFullYear(), nowKolkata.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    const searchesTodayRes = await db.select({ count: sql<number>`count(*)::int` })
      .from(searchEvents)
      .where(gte(searchEvents.createdAt, todayStart));
    const searchesToday = searchesTodayRes[0]?.count || 0;

    const searchesThisWeekRes = await db.select({ count: sql<number>`count(*)::int` })
      .from(searchEvents)
      .where(gte(searchEvents.createdAt, weekStart));
    const searchesThisWeek = searchesThisWeekRes[0]?.count || 0;

    const searchesThisMonthRes = await db.select({ count: sql<number>`count(*)::int` })
      .from(searchEvents)
      .where(gte(searchEvents.createdAt, monthStart));
    const searchesThisMonth = searchesThisMonthRes[0]?.count || 0;

    // Most searched student details
    const mostSearchedStudentRes = await db.select({
      studentId: searchEvents.matchedStudentId,
      count: sql<number>`count(*)::int`,
      name: students.name,
      rollNumber: students.rollNumber
    })
    .from(searchEvents)
    .innerJoin(students, eq(searchEvents.matchedStudentId, students.id))
    .where(and(gte(searchEvents.createdAt, start), lte(searchEvents.createdAt, end)))
    .groupBy(searchEvents.matchedStudentId, students.name, students.rollNumber)
    .orderBy(desc(sql`count(*)`))
    .limit(1);

    const mostSearchedStudent = mostSearchedStudentRes[0] ? {
      name: mostSearchedStudentRes[0].name,
      rollNumber: mostSearchedStudentRes[0].rollNumber,
      count: mostSearchedStudentRes[0].count
    } : null;

    // Most frequent search type (method)
    const mostUsedMethodRes = await db.select({
      searchType: searchEvents.searchType,
      count: sql<number>`count(*)::int`
    })
    .from(searchEvents)
    .where(and(gte(searchEvents.createdAt, start), lte(searchEvents.createdAt, end)))
    .groupBy(searchEvents.searchType)
    .orderBy(desc(sql`count(*)`))
    .limit(1);

    const mostUsedSearchMethod = mostUsedMethodRes[0] ? mostUsedMethodRes[0].searchType : "N/A";

    const calcPctChange = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    res.json({
      totalSearches,
      totalSearchesPctChange: calcPctChange(totalSearches, totalSearchesPrev),
      uniqueSearchers,
      uniqueSearchersPctChange: calcPctChange(uniqueSearchers, uniqueSearchersPrev),
      searchesToday,
      searchesThisWeek,
      searchesThisMonth,
      totalProfileViews,
      totalProfileViewsPctChange: calcPctChange(totalProfileViews, totalViewsPrev),
      mostSearchedStudent,
      mostUsedSearchMethod
    });
  } catch (err: any) {
    console.error("Overview analytics error:", err);
    res.status(500).json({ error: "Failed to generate analytics overview" });
  }
});

// 2. Failed / No-Result Searches ranking table (Admin-only)
app.get("/api/admin/analytics/failed", requireJWT as any, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { start, end } = getPeriods(startDate, endDate);

    const failedSearches = await db.select({
      query: searchEvents.query,
      attempts: sql<number>`count(*)::int`,
      lastAttempt: sql<Date>`max(${searchEvents.createdAt})`
    })
    .from(searchEvents)
    .where(and(
      eq(searchEvents.isSuccessful, false),
      gte(searchEvents.createdAt, start),
      lte(searchEvents.createdAt, end)
    ))
    .groupBy(searchEvents.query)
    .orderBy(desc(sql`count(*)`))
    .limit(20);

    res.json(failedSearches);
  } catch (err: any) {
    console.error("Failed searches analytics error:", err);
    res.status(500).json({ error: "Failed to fetch failed search records" });
  }
});

// 3. Analytics Chart Feed (Admin-only)
app.get("/api/admin/analytics/charts", requireJWT as any, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { start, end } = getPeriods(startDate, endDate);

    // Timeline search counts over time (YYYY-MM-DD grouping)
    const overTimeRes = await db.select({
      dateStr: sql<string>`to_char(${searchEvents.createdAt}, 'YYYY-MM-DD')`,
      total: sql<number>`count(*)::int`,
      successful: sql<number>`sum(case when ${searchEvents.isSuccessful} = true then 1 else 0 end)::int`,
      failed: sql<number>`sum(case when ${searchEvents.isSuccessful} = false then 1 else 0 end)::int`
    })
    .from(searchEvents)
    .where(and(gte(searchEvents.createdAt, start), lte(searchEvents.createdAt, end)))
    .groupBy(sql`to_char(${searchEvents.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(asc(sql`to_char(${searchEvents.createdAt}, 'YYYY-MM-DD')`));

    // Search methods proportions
    const methodsBreakdown = await db.select({
      method: searchEvents.searchType,
      count: sql<number>`count(*)::int`
    })
    .from(searchEvents)
    .where(and(gte(searchEvents.createdAt, start), lte(searchEvents.createdAt, end)))
    .groupBy(searchEvents.searchType)
    .orderBy(desc(sql`count(*)`));

    // Hourly peak activity patterns
    const hourlyRes = await db.select({
      hour: sql<number>`extract(hour from ${searchEvents.createdAt})::int`,
      count: sql<number>`count(*)::int`
    })
    .from(searchEvents)
    .where(and(gte(searchEvents.createdAt, start), lte(searchEvents.createdAt, end)))
    .groupBy(sql`extract(hour from ${searchEvents.createdAt})`)
    .orderBy(asc(sql`extract(hour from ${searchEvents.createdAt})`));

    let peakHourText = "N/A";
    if (hourlyRes.length > 0) {
      const sortedHourly = [...hourlyRes].sort((a,b) => b.count - a.count);
      const peakHr = sortedHourly[0].hour;
      const ampm = peakHr >= 12 ? "PM" : "AM";
      const formattedHour = peakHr % 12 === 0 ? 12 : peakHr % 12;
      const nextHour = (peakHr + 1) % 12 === 0 ? 12 : (peakHr + 1) % 12;
      const nextAmpm = (peakHr + 1) >= 12 ? "PM" : "AM";
      peakHourText = `${formattedHour}:00 ${ampm} – ${nextHour}:00 ${nextAmpm}`;
    }

    // Day of week pattern analysis
    const dowRes = await db.select({
      dow: sql<number>`extract(dow from ${searchEvents.createdAt})::int`,
      count: sql<number>`count(*)::int`
    })
    .from(searchEvents)
    .where(and(gte(searchEvents.createdAt, start), lte(searchEvents.createdAt, end)))
    .groupBy(sql`extract(dow from ${searchEvents.createdAt})`)
    .orderBy(asc(sql`extract(dow from ${searchEvents.createdAt})`));

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let peakDayText = "N/A";
    if (dowRes.length > 0) {
      const sortedDow = [...dowRes].sort((a,b) => b.count - a.count);
      peakDayText = dayNames[sortedDow[0].dow] || "N/A";
    }

    // Success vs failed percentages
    const successRes = await db.select({
      successful: sql<number>`sum(case when ${searchEvents.isSuccessful} = true then 1 else 0 end)::int`,
      failed: sql<number>`sum(case when ${searchEvents.isSuccessful} = false then 1 else 0 end)::int`,
      total: sql<number>`count(*)::int`
    })
    .from(searchEvents)
    .where(and(gte(searchEvents.createdAt, start), lte(searchEvents.createdAt, end)));

    const successSummary = successRes[0] || { successful: 0, failed: 0, total: 0 };
    const successRate = successSummary.total > 0 ? Math.round((successSummary.successful / successSummary.total) * 100) : 100;

    res.json({
      overTime: overTimeRes,
      methods: methodsBreakdown,
      hourly: hourlyRes,
      peakHourText,
      peakDayText,
      successRate,
      successfulSearches: successSummary.successful || 0,
      failedSearches: successSummary.failed || 0
    });
  } catch (err: any) {
    console.error("Charts analytics API error:", err);
    res.status(500).json({ error: "Failed to generate charts analytics data" });
  }
});

// 4. Student-Level search details table & rankings (Admin-only)
app.get("/api/admin/analytics/students", requireJWT as any, async (req, res) => {
  try {
    const { startDate, endDate, sort, page, limit } = req.query;
    const { start, end } = getPeriods(startDate, endDate);

    let pageNum = parseInt(page as string, 10);
    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

    let limitNum = parseInt(limit as string, 10);
    if (isNaN(limitNum) || limitNum < 1) limitNum = 10;

    const offset = (pageNum - 1) * limitNum;

    // Total active students count
    const totalStudentsRes = await db.select({ count: sql<number>`count(*)::int` })
      .from(students)
      .where(eq(students.status, "Active"));
    const total = totalStudentsRes[0]?.count || 0;

    // Resolve sorting rules
    let orderBySql = sql`total_searches desc`;
    if (sort === "least_searched") {
      orderBySql = sql`total_searches asc`;
    } else if (sort === "recently_searched") {
      orderBySql = sql`last_searched_at desc nulls last`;
    } else if (sort === "unique_visitors") {
      orderBySql = sql`unique_visitors desc`;
    }

    const nowKolkata = new Date();
    const todayStart = new Date(nowKolkata.getFullYear(), nowKolkata.getMonth(), nowKolkata.getDate());
    
    const weekStart = new Date(nowKolkata);
    weekStart.setDate(nowKolkata.getDate() - nowKolkata.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    const monthStart = new Date(nowKolkata.getFullYear(), nowKolkata.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    const studentListQuery = sql`
      with search_summary as (
        select 
          matched_student_id,
          count(*)::int as total_searches,
          count(distinct visitor_hash)::int as unique_visitors,
          max(created_at) as last_searched_at,
          sum(case when created_at >= ${todayStart} then 1 else 0 end)::int as searches_today,
          sum(case when created_at >= ${weekStart} then 1 else 0 end)::int as searches_week,
          sum(case when created_at >= ${monthStart} then 1 else 0 end)::int as searches_month,
          sum(case when created_at >= ${start} and created_at <= ${end} then 1 else 0 end)::int as searches_range
        from ${searchEvents}
        group by matched_student_id
      ),
      view_summary as (
        select
          student_id,
          count(*)::int as profile_views
        from ${profileViewEvents}
        group by student_id
      )
      select 
        s.id,
        s.name,
        s.roll_number as "rollNumber",
        s.registration_id as "registrationId",
        coalesce(ss.total_searches, 0) as "totalSearches",
        coalesce(ss.unique_visitors, 0) as "uniqueVisitors",
        coalesce(ss.last_searched_at, null) as "lastSearchedAt",
        coalesce(ss.searches_today, 0) as "searchesToday",
        coalesce(ss.searches_week, 0) as "searchesWeek",
        coalesce(ss.searches_month, 0) as "searchesMonth",
        coalesce(ss.searches_range, 0) as "searchesRange",
        coalesce(vs.profile_views, 0) as "profileViews"
      from ${students} s
      left join search_summary ss on s.id = ss.matched_student_id
      left join view_summary vs on s.id = vs.student_id
      where s.status = 'Active'
      order by ${orderBySql}
      limit ${limitNum} offset ${offset}
    `;

    const records = await db.execute(studentListQuery);

    res.json({
      students: records.rows,
      total,
      page: pageNum,
      limit: limitNum
    });
  } catch (err: any) {
    console.error("Student-level analytics retrieve failed:", err);
    res.status(500).json({ error: "Failed to load student-level analytics" });
  }
});

// 5. Live Feed Events Poll (Admin-only)
app.get("/api/admin/analytics/live", requireJWT as any, async (req, res) => {
  try {
    const searchLogs = await db.select({
      id: searchEvents.id,
      type: sql<string>`'search'`,
      query: searchEvents.query,
      searchType: searchEvents.searchType,
      isSuccessful: searchEvents.isSuccessful,
      createdAt: searchEvents.createdAt,
      matchedStudentId: searchEvents.matchedStudentId
    })
    .from(searchEvents)
    .orderBy(desc(searchEvents.createdAt))
    .limit(20);

    const viewLogs = await db.select({
      id: profileViewEvents.id,
      type: sql<string>`'view'`,
      query: sql<string>`''`,
      searchType: sql<string>`''`,
      isSuccessful: sql<boolean>`true`,
      createdAt: profileViewEvents.createdAt,
      matchedStudentId: profileViewEvents.studentId
    })
    .from(profileViewEvents)
    .orderBy(desc(profileViewEvents.createdAt))
    .limit(20);

    const combined = [...searchLogs, ...viewLogs]
      .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);

    const decorated = await Promise.all(combined.map(async (item) => {
      let studentName = "";
      if (item.matchedStudentId) {
        const row = await db.select({ name: students.name }).from(students).where(eq(students.id, item.matchedStudentId)).limit(1);
        if (row.length > 0) {
          studentName = row[0].name;
        }
      }
      return {
        ...item,
        studentName
      };
    }));

    res.json(decorated);
  } catch (err: any) {
    console.error("Live activity feed failed:", err);
    res.status(500).json({ error: "Failed to load live activity stream" });
  }
});

// 6. Single Student-level analytics detailed modal/page (Admin-only)
app.get("/api/admin/analytics/students/:id", requireJWT as any, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10);
    if (isNaN(studentId)) {
      return res.status(400).json({ error: "Invalid student identifier" });
    }

    const studentRecord = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
    if (studentRecord.length === 0) {
      return res.status(404).json({ error: "Student not found in PostgreSQL" });
    }

    const s = studentRecord[0];

    const totalSearchesRes = await db.select({ count: sql<number>`count(*)::int` })
      .from(searchEvents)
      .where(eq(searchEvents.matchedStudentId, studentId));
    const totalSearches = totalSearchesRes[0]?.count || 0;

    const uniqueVisitorsRes = await db.select({ count: sql<number>`count(distinct ${searchEvents.visitorHash})::int` })
      .from(searchEvents)
      .where(eq(searchEvents.matchedStudentId, studentId));
    const uniqueVisitors = uniqueVisitorsRes[0]?.count || 0;

    const totalViewsRes = await db.select({ count: sql<number>`count(*)::int` })
      .from(profileViewEvents)
      .where(eq(profileViewEvents.studentId, studentId));
    const profileViews = totalViewsRes[0]?.count || 0;

    const searchTimeline = await db.select({
      firstSearched: sql<Date>`min(${searchEvents.createdAt})`,
      lastSearched: sql<Date>`max(${searchEvents.createdAt})`
    })
    .from(searchEvents)
    .where(eq(searchEvents.matchedStudentId, studentId));

    const firstSearched = searchTimeline[0]?.firstSearched || null;
    const lastSearched = searchTimeline[0]?.lastSearched || null;

    const successRes = await db.select({
      successful: sql<number>`sum(case when ${searchEvents.isSuccessful} = true then 1 else 0 end)::int`,
      total: sql<number>`count(*)::int`
    })
    .from(searchEvents)
    .where(eq(searchEvents.matchedStudentId, studentId));

    const successTotal = successRes[0]?.total || 0;
    const successCount = successRes[0]?.successful || 0;
    const searchSuccessRate = successTotal > 0 ? Math.round((successCount / successTotal) * 100) : 100;

    const methodsBreakdown = await db.select({
      method: searchEvents.searchType,
      count: sql<number>`count(*)::int`
    })
    .from(searchEvents)
    .where(eq(searchEvents.matchedStudentId, studentId))
    .groupBy(searchEvents.searchType);

    const methodCounts = { name: 0, roll_number: 0, registration_id: 0, form_number: 0 };
    methodsBreakdown.forEach((m) => {
      const type = m.method.toLowerCase();
      if (type.includes("name")) methodCounts.name += m.count;
      else if (type.includes("roll")) methodCounts.roll_number += m.count;
      else if (type.includes("registration")) methodCounts.registration_id += m.count;
      else if (type.includes("form")) methodCounts.form_number += m.count;
    });

    const searchEventsChronology = await db.select({
      id: searchEvents.id,
      type: sql<string>`'search'`,
      query: searchEvents.query,
      searchType: searchEvents.searchType,
      createdAt: searchEvents.createdAt,
    })
    .from(searchEvents)
    .where(eq(searchEvents.matchedStudentId, studentId))
    .orderBy(desc(searchEvents.createdAt))
    .limit(15);

    const viewEventsChronology = await db.select({
      id: profileViewEvents.id,
      type: sql<string>`'view'`,
      query: sql<string>`''`,
      searchType: sql<string>`''`,
      createdAt: profileViewEvents.createdAt,
    })
    .from(profileViewEvents)
    .where(eq(profileViewEvents.studentId, studentId))
    .orderBy(desc(profileViewEvents.createdAt))
    .limit(15);

    const timeline = [...searchEventsChronology, ...viewEventsChronology]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 15);

    res.json({
      student: {
        id: s.id,
        name: s.name,
        rollNumber: s.rollNumber,
        registrationId: s.registrationId,
        formNumber: s.formNumber,
        programmeName: s.programmeName || "Bachelor of Computer Applications"
      },
      stats: {
        totalSearches,
        uniqueVisitors,
        profileViews,
        searchSuccessRate,
        firstSearched,
        lastSearched
      },
      methods: methodCounts,
      timeline
    });
  } catch (err: any) {
    console.error("Student analytics detail error:", err);
    res.status(500).json({ error: "Failed to generate student analytics record" });
  }
});

// 7. Export detailed search event records to CSV (Admin-only)
app.get("/api/admin/analytics/export", requireJWT as any, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { start, end } = getPeriods(startDate, endDate);

    const events = await db.select({
      createdAt: searchEvents.createdAt,
      query: searchEvents.query,
      searchType: searchEvents.searchType,
      isSuccessful: searchEvents.isSuccessful,
      resultCount: searchEvents.resultCount,
      deviceType: searchEvents.deviceType,
      browser: searchEvents.browser,
      os: searchEvents.os,
      studentName: students.name,
      rollNumber: students.rollNumber
    })
    .from(searchEvents)
    .leftJoin(students, eq(searchEvents.matchedStudentId, students.id))
    .where(and(gte(searchEvents.createdAt, start), lte(searchEvents.createdAt, end)))
    .orderBy(desc(searchEvents.createdAt))
    .limit(5000); // safety boundary

    let csv = "Date,Time,Query,Search Type,Search Success,Result Count,Device,Browser,OS,Matched Student,Roll Number\n";
    
    events.forEach((ev) => {
      const dt = new Date(ev.createdAt);
      const dateStr = dt.toLocaleDateString("en-US", { year: 'numeric', month: '2-digit', day: '2-digit' });
      const timeStr = dt.toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      
      const queryClean = (ev.query || "").replace(/"/g, '""');
      const studentClean = (ev.studentName || "").replace(/"/g, '""');
      const rollClean = (ev.rollNumber || "").replace(/"/g, '""');

      csv += `"${dateStr}","${timeStr}","${queryClean}","${ev.searchType}","${ev.isSuccessful ? "SUCCESS" : "FAILED"}",${ev.resultCount},"${ev.deviceType}","${ev.browser}","${ev.os}","${studentClean}","${rollClean}"\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=search_analytics_${Date.now()}.csv`);
    res.status(200).send(csv);
  } catch (err: any) {
    console.error("Export csv analytics failed:", err);
    res.status(500).json({ error: "Failed to generate CSV export file" });
  }
});

// GET dynamic search/filter options populated from existing records
app.get("/api/admin/filter-options", requireJWT, async (req, res) => {
  try {
    const programmes = await db.selectDistinct({ value: students.programmeName }).from(students);
    const majors = await db.selectDistinct({ value: students.majorSubject }).from(students);
    const minors = await db.selectDistinct({ value: students.minorSubject }).from(students);
    const categories = await db.selectDistinct({ value: students.category }).from(students);
    const admissionCategories = await db.selectDistinct({ value: students.admissionCategory }).from(students);
    const statuses = await db.selectDistinct({ value: students.status }).from(students);

    res.json({
      programmes: programmes.map(p => p.value).filter(Boolean),
      majors: majors.map(m => m.value).filter(Boolean),
      minors: minors.map(m => m.value).filter(Boolean),
      categories: categories.map(c => c.value).filter(Boolean),
      admissionCategories: admissionCategories.map(a => a.value).filter(Boolean),
      statuses: statuses.map(s => s.value).filter(Boolean),
    });
  } catch (err: any) {
    console.error("Failed to load filter options:", err);
    res.status(500).json({ error: "Failed to load dynamic filter selections" });
  }
});

// GET all batches
app.get("/api/admin/batches", requireJWT, async (req, res) => {
  try {
    let list = await db.select().from(batches).orderBy(asc(batches.name));
    if (list.length === 0) {
      // Seed default batches
      const defaultBatches = ["2024–2027", "2025–2028", "2026–2029"];
      for (const bName of defaultBatches) {
        await db.insert(batches).values({ name: bName }).onConflictDoNothing();
      }
      list = await db.select().from(batches).orderBy(asc(batches.name));
    }
    res.json(list);
  } catch (err: any) {
    console.error("Fetch batches error:", err);
    res.status(500).json({ error: "Failed to fetch academic batches" });
  }
});

// POST add dynamic batch
app.post("/api/admin/batches", requireJWT, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Batch name is required" });
    }
    const cleanName = name.trim();
    // Check if duplicate exists
    const existing = await db.select().from(batches).where(eq(batches.name, cleanName));
    if (existing.length > 0) {
      return res.status(400).json({ error: "This batch already exists" });
    }
    await db.insert(batches).values({ name: cleanName });
    res.json({ success: true, message: "Batch added successfully" });
  } catch (err: any) {
    console.error("Add batch error:", err);
    res.status(500).json({ error: "Failed to add academic batch" });
  }
});

// DELETE batch
app.delete("/api/admin/batches/:id", requireJWT, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid batch ID" });
    }
    await db.delete(batches).where(eq(batches.id, id));
    res.json({ success: true, message: "Batch deleted successfully" });
  } catch (err: any) {
    console.error("Delete batch error:", err);
    res.status(500).json({ error: "Failed to delete academic batch" });
  }
});

// Admin View all students with pagination/filters/sorting
app.get("/api/admin/students", requireJWT, async (req, res) => {
  try {
    const searchVal = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const programmeFilter = typeof req.query.programme === "string" ? req.query.programme.trim() : "";
    const genderFilter = typeof req.query.gender === "string" ? req.query.gender.trim() : "";
    const categoryFilter = typeof req.query.category === "string" ? req.query.category.trim() : "";
    const majorFilter = typeof req.query.major === "string" ? req.query.major.trim() : "";
    const minorFilter = typeof req.query.minor === "string" ? req.query.minor.trim() : "";
    const admissionCategoryFilter = typeof req.query.admissionCategory === "string" ? req.query.admissionCategory.trim() : "";
    const statusFilter = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const semesterFilter = typeof req.query.semester === "string" ? req.query.semester.trim() : "";
    const batchFilter = typeof req.query.batch === "string" ? req.query.batch.trim() : "";
    
    let pageNum = parseInt(req.query.page as string, 10);
    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

    let limitNum = parseInt(req.query.limit as string, 10);
    if (isNaN(limitNum) || limitNum < 1) limitNum = 25;

    const offset = (pageNum - 1) * limitNum;

    let baseQuery = db.select().from(students);
    let conditions = [];

    if (searchVal) {
      conditions.push(
        or(
          ilike(students.name, `%${searchVal}%`),
          ilike(students.registrationId, `%${searchVal}%`),
          ilike(students.formNumber, `%${searchVal}%`),
          ilike(students.rollNumber, `%${searchVal}%`),
          ilike(students.enrollmentNumber, `%${searchVal}%`),
          ilike(students.email, `%${searchVal}%`),
          ilike(students.mobile, `%${searchVal}%`)
        )
      );
    }

    if (programmeFilter) {
      conditions.push(eq(students.programmeName, programmeFilter));
    }
    if (genderFilter) {
      conditions.push(ilike(students.gender, genderFilter));
    }
    if (categoryFilter) {
      conditions.push(eq(students.category, categoryFilter));
    }
    if (majorFilter) {
      conditions.push(eq(students.majorSubject, majorFilter));
    }
    if (minorFilter) {
      conditions.push(eq(students.minorSubject, minorFilter));
    }
    if (admissionCategoryFilter) {
      conditions.push(eq(students.admissionCategory, admissionCategoryFilter));
    }
    if (statusFilter) {
      conditions.push(eq(students.status, statusFilter));
    }
    if (semesterFilter) {
      conditions.push(eq(students.semester, semesterFilter));
    }
    if (batchFilter) {
      conditions.push(eq(students.batch, batchFilter));
    }

    let totalResultQuery = db.select({ count: sql<number>`count(*)::int` }).from(students);
    let itemsQuery = db.select().from(students);

    if (conditions.length > 0) {
      const cond = and(...conditions);
      totalResultQuery = totalResultQuery.where(cond) as any;
      itemsQuery = itemsQuery.where(cond) as any;
    }

    const [countRow] = await totalResultQuery;
    const total = countRow ? countRow.count : 0;

    const paginatedSlice = await itemsQuery
      .orderBy(desc(students.id))
      .limit(limitNum)
      .offset(offset);

    res.json({
      students: paginatedSlice,
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (err: any) {
    console.error("Admin fetch students error:", err);
    res.status(500).json({ error: "Failed to fetch student records" });
  }
});

// GET /api/admin/students/export - Export student records as CSV for administrative backups
app.get("/api/admin/students/export", requireJWT as any, async (req: AuthRequest, res) => {
  try {
    const scope = typeof req.query.scope === "string" ? req.query.scope : "filtered";
    const searchVal = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const programmeFilter = typeof req.query.programme === "string" ? req.query.programme.trim() : "";
    const genderFilter = typeof req.query.gender === "string" ? req.query.gender.trim() : "";
    const categoryFilter = typeof req.query.category === "string" ? req.query.category.trim() : "";
    const majorFilter = typeof req.query.major === "string" ? req.query.major.trim() : "";
    const minorFilter = typeof req.query.minor === "string" ? req.query.minor.trim() : "";
    const admissionCategoryFilter = typeof req.query.admissionCategory === "string" ? req.query.admissionCategory.trim() : "";
    const statusFilter = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const semesterFilter = typeof req.query.semester === "string" ? req.query.semester.trim() : "";
    const batchFilter = typeof req.query.batch === "string" ? req.query.batch.trim() : "";

    let itemsQuery = db.select().from(students);
    let conditions = [];

    // If scope !== "all", apply active filter conditions
    if (scope !== "all") {
      if (searchVal) {
        conditions.push(
          or(
            ilike(students.name, `%${searchVal}%`),
            ilike(students.registrationId, `%${searchVal}%`),
            ilike(students.formNumber, `%${searchVal}%`),
            ilike(students.rollNumber, `%${searchVal}%`),
            ilike(students.enrollmentNumber, `%${searchVal}%`),
            ilike(students.email, `%${searchVal}%`),
            ilike(students.mobile, `%${searchVal}%`)
          )
        );
      }
      if (programmeFilter) {
        conditions.push(eq(students.programmeName, programmeFilter));
      }
      if (genderFilter) {
        conditions.push(ilike(students.gender, genderFilter));
      }
      if (categoryFilter) {
        conditions.push(eq(students.category, categoryFilter));
      }
      if (majorFilter) {
        conditions.push(eq(students.majorSubject, majorFilter));
      }
      if (minorFilter) {
        conditions.push(eq(students.minorSubject, minorFilter));
      }
      if (admissionCategoryFilter) {
        conditions.push(eq(students.admissionCategory, admissionCategoryFilter));
      }
      if (statusFilter) {
        conditions.push(eq(students.status, statusFilter));
      }
      if (semesterFilter) {
        conditions.push(eq(students.semester, semesterFilter));
      }
      if (batchFilter) {
        conditions.push(eq(students.batch, batchFilter));
      }
    }

    if (conditions.length > 0) {
      itemsQuery = itemsQuery.where(and(...conditions)) as any;
    }

    const records = await itemsQuery.orderBy(asc(students.id));

    // Log the backup activity
    const adminEmail = req.admin?.email || "admin";
    await logActivity(
      adminEmail,
      "EXPORT_STUDENTS_CSV",
      `Exported ${records.length} student records (${scope === "all" ? "Full database backup" : "Filtered records"}) to CSV`
    );

    // CSV Headers
    const headers = [
      "ID",
      "Form Number",
      "Registration ID",
      "Roll Number",
      "Enrollment Number",
      "Student Name",
      "Gender",
      "Social Category",
      "Admission Category",
      "Programme",
      "Major Subject",
      "Minor Subject",
      "Semester",
      "Batch",
      "Email",
      "Mobile",
      "Transaction Mode",
      "Status",
      "Profile Views",
      "Created At",
      "Updated At"
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    let csvContent = "\uFEFF"; // UTF-8 BOM for MS Excel compatibility
    csvContent += headers.map(h => `"${h}"`).join(",") + "\r\n";

    for (const s of records) {
      const row = [
        s.id,
        s.formNumber || "",
        s.registrationId || "",
        s.rollNumber || "",
        s.enrollmentNumber || "",
        s.name || "",
        s.gender || "",
        s.category || "",
        s.admissionCategory || "",
        s.programmeName || "",
        s.majorSubject || "",
        s.minorSubject || "",
        s.semester || "",
        s.batch || "",
        s.email || "",
        s.mobile || "",
        s.transactionMode || "",
        s.status || "Active",
        s.viewCount ?? 0,
        s.createdAt ? new Date(s.createdAt).toISOString() : "",
        s.updatedAt ? new Date(s.updatedAt).toISOString() : ""
      ];
      csvContent += row.map(escapeCsv).join(",") + "\r\n";
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `students_${scope === "all" ? "full_backup" : "export"}_${timestamp}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (err: any) {
    console.error("Export students CSV error:", err);
    res.status(500).json({ error: "Failed to generate student records CSV backup" });
  }
});

// ---------------------------------------------------------
// 2.8. STUDENT CSV UPLOAD & IMPORT WORKFLOW
// ---------------------------------------------------------

// Helper: RFC 4180 compliant CSV Parser
function parseCsvContent(text: string): { headers: string[]; rows: string[][] } {
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (insideQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = "";
      } else if (char === '\r') {
        if (nextChar === '\n') i++;
        currentRow.push(currentField.trim());
        currentField = "";
        if (currentRow.some((col) => col.length > 0)) {
          lines.push(currentRow);
        }
        currentRow = [];
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        currentField = "";
        if (currentRow.some((col) => col.length > 0)) {
          lines.push(currentRow);
        }
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((col) => col.length > 0)) {
      lines.push(currentRow);
    }
  }

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = lines[0].map((h) => h.trim());
  const rows = lines.slice(1);
  return { headers, rows };
}

// Helper: Map CSV row headers into student object
function mapCsvRowToStudentRecord(headers: string[], row: string[]): any {
  const normKey = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, "");
  const record: any = {};

  headers.forEach((header, idx) => {
    const key = normKey(header);
    const val = (row[idx] || "").trim();

    if (key === "formnumber" || key === "formno" || key === "form" || key === "formnum") {
      record.formNumber = val;
    } else if (key === "registrationid" || key === "regid" || key === "regno" || key === "registrationno" || key === "registration") {
      record.registrationId = val;
    } else if (key === "rollnumber" || key === "rollno" || key === "roll") {
      record.rollNumber = val;
    } else if (key === "enrollmentnumber" || key === "enrollmentno" || key === "enrollno" || key === "enrollment") {
      record.enrollmentNumber = val;
    } else if (key === "name" || key === "fullname" || key === "studentname" || key === "candidatename") {
      record.name = val;
    } else if (key === "gender" || key === "sex") {
      record.gender = val;
    } else if (key === "category" || key === "caste") {
      record.category = val;
    } else if (key === "admissioncategory" || key === "admcategory") {
      record.admissionCategory = val;
    } else if (key === "programmename" || key === "programme" || key === "course" || key === "program") {
      record.programmeName = val;
    } else if (key === "majorsubject" || key === "major" || key === "honours") {
      record.majorSubject = val;
    } else if (key === "minorsubject" || key === "minor") {
      record.minorSubject = val;
    } else if (key === "semester" || key === "sem") {
      record.semester = val;
    } else if (key === "batch" || key === "session" || key === "academicyear") {
      record.batch = val;
    } else if (key === "email" || key === "emailaddress" || key === "emailid" || key === "emailaddress") {
      record.email = val;
    } else if (key === "mobile" || key === "mobilenumber" || key === "phone" || key === "phonenumber" || key === "contact") {
      record.mobile = val;
    } else if (key === "transactionmode" || key === "paymentmode" || key === "feemode") {
      record.transactionMode = val;
    } else if (key === "status") {
      record.status = val;
    }
  });

  // Fallbacks if one required ID is provided but not both
  if (record.formNumber && !record.registrationId) {
    record.registrationId = record.formNumber;
  } else if (record.registrationId && !record.formNumber) {
    record.formNumber = record.registrationId;
  }

  return record;
}

// GET /api/admin/students/csv-template - Download starter CSV template for student records
app.get("/api/admin/students/csv-template", requireJWT as any, (req, res) => {
  const headers = [
    "Form Number",
    "Registration ID",
    "Roll Number",
    "Enrollment Number",
    "Full Name",
    "Gender",
    "Category",
    "Admission Category",
    "Programme",
    "Major Subject",
    "Minor Subject",
    "Semester",
    "Batch",
    "Email Address",
    "Mobile Number",
    "Transaction Mode",
    "Status"
  ];

  const sampleRows = [
    [
      "PC-BCA-2026-001",
      "REG-2026-101",
      "BCA-01",
      "EN-2026-001",
      "RAHUL SHARMA",
      "MALE",
      "GENERAL",
      "GENERAL",
      "BACHELOR OF COMPUTER APPLICATIONS(COMPUTER APPLICATION)",
      "Computer Science",
      "Mathematics",
      "1st Semester",
      "2026–2029",
      "rahul.sharma@example.com",
      "9876543210",
      "ONLINE",
      "Active"
    ],
    [
      "PC-BCA-2026-002",
      "REG-2026-102",
      "BCA-02",
      "EN-2026-002",
      "PRIYA DEVI",
      "FEMALE",
      "OBC",
      "GENERAL",
      "BACHELOR OF COMPUTER APPLICATIONS(COMPUTER APPLICATION)",
      "Computer Science",
      "Statistics",
      "1st Semester",
      "2026–2029",
      "priya.devi@example.com",
      "9876543211",
      "CASH",
      "Active"
    ]
  ];

  const escapeCsv = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;
  let csv = "\uFEFF";
  csv += headers.map(escapeCsv).join(",") + "\r\n";
  for (const row of sampleRows) {
    csv += row.map(escapeCsv).join(",") + "\r\n";
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="student_import_template.csv"');
  res.status(200).send(csv);
});

// POST /api/admin/students/upload-csv-preview - Parse and validate CSV data before committing
app.post("/api/admin/students/upload-csv-preview", requireJWT as any, upload.single("file"), async (req: AuthRequest, res) => {
  try {
    let csvText = "";
    let fileName = "students.csv";

    if (req.file && req.file.buffer) {
      csvText = req.file.buffer.toString("utf-8");
      fileName = req.file.originalname || "students.csv";
    } else if (typeof req.body.rawCsv === "string") {
      csvText = req.body.rawCsv;
      if (req.body.fileName) fileName = req.body.fileName;
    }

    if (!csvText || !csvText.trim()) {
      return res.status(400).json({ error: "No CSV content or file provided. Please select a valid CSV file." });
    }

    const { headers, rows } = parseCsvContent(csvText);

    if (headers.length === 0 || rows.length === 0) {
      return res.status(400).json({ error: "The uploaded CSV file is empty or missing headers." });
    }

    // Fetch existing students for duplicate / update detection
    const existing = await db.select({
      id: students.id,
      formNumber: students.formNumber,
      registrationId: students.registrationId,
      name: students.name,
      rollNumber: students.rollNumber,
      enrollmentNumber: students.enrollmentNumber,
      semester: students.semester,
      batch: students.batch,
      programmeName: students.programmeName,
      majorSubject: students.majorSubject,
      minorSubject: students.minorSubject,
      gender: students.gender,
      category: students.category,
      admissionCategory: students.admissionCategory,
      transactionMode: students.transactionMode,
      email: students.email,
      mobile: students.mobile,
      status: students.status,
    }).from(students);

    const existingByForm = new Map<string, typeof existing[0]>();
    const existingByReg = new Map<string, typeof existing[0]>();
    existing.forEach((s) => {
      if (s.formNumber) existingByForm.set(s.formNumber.trim().toLowerCase(), s);
      if (s.registrationId) existingByReg.set(s.registrationId.trim().toLowerCase(), s);
    });

    const cleanString = (val: any) => {
      if (val === null || val === undefined) return "";
      const s = String(val).replace(/\s+/g, " ").trim();
      const lower = s.toLowerCase();
      if (lower === "" || lower === "null" || lower === "undefined" || lower === "n/a" || lower === "-" || lower === "none") {
        return "";
      }
      return s;
    };

    const newRecords: any[] = [];
    const updatedRecords: any[] = [];
    const duplicateRecords: any[] = [];
    const invalidRecords: any[] = [];

    rows.forEach((row, idx) => {
      const rec = mapCsvRowToStudentRecord(headers, row);

      // Clean fields
      rec.name = cleanString(rec.name);
      rec.formNumber = cleanString(rec.formNumber);
      rec.registrationId = cleanString(rec.registrationId);
      rec.rollNumber = cleanString(rec.rollNumber);
      rec.enrollmentNumber = cleanString(rec.enrollmentNumber);
      rec.semester = cleanString(rec.semester);
      rec.batch = cleanString(rec.batch);
      rec.programmeName = cleanString(rec.programmeName) || "BACHELOR OF COMPUTER APPLICATIONS(COMPUTER APPLICATION)";
      rec.majorSubject = cleanString(rec.majorSubject);
      rec.minorSubject = cleanString(rec.minorSubject);
      rec.gender = cleanString(rec.gender) || "MALE";
      rec.category = cleanString(rec.category) || "GENERAL";
      rec.admissionCategory = cleanString(rec.admissionCategory) || "GENERAL";
      rec.transactionMode = cleanString(rec.transactionMode) || "CASH";
      rec.email = cleanString(rec.email);
      rec.mobile = cleanString(rec.mobile);
      rec.status = cleanString(rec.status) === "Inactive" ? "Inactive" : "Active";

      // Validate mandatory fields
      if (!rec.name || !rec.formNumber || !rec.registrationId) {
        invalidRecords.push({
          ...rec,
          rowIndex: idx + 2, // 1-based, accounting for header
          errorReason: !rec.name
            ? "Student Name is required"
            : "Form Number or Registration ID is missing",
        });
        return;
      }

      // Check existing matches
      const formKey = rec.formNumber.toLowerCase();
      const regKey = rec.registrationId.toLowerCase();
      const existingMatch = existingByReg.get(regKey) || existingByForm.get(formKey);

      if (existingMatch) {
        // Compare fields to determine if there is an actual update
        const changes: { field: string; from: string; to: string }[] = [];

        if (rec.name && rec.name.toLowerCase() !== (existingMatch.name || "").toLowerCase()) {
          changes.push({ field: "Name", from: existingMatch.name || "", to: rec.name });
        }
        if (rec.rollNumber && rec.rollNumber !== (existingMatch.rollNumber || "")) {
          changes.push({ field: "Roll Number", from: existingMatch.rollNumber || "", to: rec.rollNumber });
        }
        if (rec.email && rec.email.toLowerCase() !== (existingMatch.email || "").toLowerCase()) {
          changes.push({ field: "Email", from: existingMatch.email || "", to: rec.email });
        }
        if (rec.mobile && rec.mobile !== (existingMatch.mobile || "")) {
          changes.push({ field: "Mobile", from: existingMatch.mobile || "", to: rec.mobile });
        }
        if (rec.batch && rec.batch !== (existingMatch.batch || "")) {
          changes.push({ field: "Batch", from: existingMatch.batch || "", to: rec.batch });
        }
        if (rec.semester && rec.semester !== (existingMatch.semester || "")) {
          changes.push({ field: "Semester", from: existingMatch.semester || "", to: rec.semester });
        }
        if (rec.majorSubject && rec.majorSubject !== (existingMatch.majorSubject || "")) {
          changes.push({ field: "Major", from: existingMatch.majorSubject || "", to: rec.majorSubject });
        }
        if (rec.minorSubject && rec.minorSubject !== (existingMatch.minorSubject || "")) {
          changes.push({ field: "Minor", from: existingMatch.minorSubject || "", to: rec.minorSubject });
        }
        if (rec.status && rec.status !== (existingMatch.status || "Active")) {
          changes.push({ field: "Status", from: existingMatch.status || "Active", to: rec.status });
        }

        if (changes.length > 0) {
          updatedRecords.push({
            ...rec,
            rowIndex: idx + 2,
            existingId: existingMatch.id,
            existingRecord: existingMatch,
            changes,
          });
        } else {
          duplicateRecords.push({
            ...rec,
            rowIndex: idx + 2,
            existingId: existingMatch.id,
          });
        }
      } else {
        newRecords.push({
          ...rec,
          rowIndex: idx + 2,
        });
      }
    });

    res.json({
      fileName,
      totalRecords: rows.length,
      newCount: newRecords.length,
      updatedCount: updatedRecords.length,
      duplicateCount: duplicateRecords.length,
      invalidCount: invalidRecords.length,
      preview: {
        newRecords,
        updatedRecords,
        duplicateRecords,
        invalidRecords,
      },
    });
  } catch (err: any) {
    console.error("CSV preview analysis error:", err);
    res.status(500).json({ error: err.message || "Failed to process and analyze CSV file" });
  }
});

// POST /api/admin/students/upload-csv-confirm - Commit validated CSV student records to PostgreSQL
app.post("/api/admin/students/upload-csv-confirm", requireJWT as any, async (req: AuthRequest, res) => {
  const email = req.admin?.email || "admin";
  const { fileName, preview } = req.body;

  if (!preview) {
    return res.status(400).json({ error: "No student records preview provided" });
  }

  const newRecords: any[] = preview.newRecords || [];
  const updatedRecords: any[] = preview.updatedRecords || [];
  const duplicateRecordsList: any[] = preview.duplicateRecords || [];
  const invalidCount = (preview.invalidRecords || []).length;
  const duplicatesCount = duplicateRecordsList.length;

  try {
    let importId = 0;

    await db.transaction(async (tx) => {
      // 1. Create entry in imports table
      const newImport = await tx.insert(imports).values({
        fileName: fileName || "students_upload.csv",
        adminEmail: email,
        totalRecords: newRecords.length + updatedRecords.length + duplicatesCount + invalidCount,
        newRecords: newRecords.length,
        updatedRecords: updatedRecords.length,
        duplicateRecords: duplicatesCount,
        invalidRecords: invalidCount,
        status: "Success",
      }).returning();

      if (newImport && newImport.length > 0) {
        importId = newImport[0].id;
      }

      const batchesSeen = new Set<string>();

      // 2. Insert new student records
      for (const rec of newRecords) {
        const batchName = rec.batch ? String(rec.batch).trim() : "";
        if (batchName) batchesSeen.add(batchName);

        await tx.insert(students).values({
          formNumber: String(rec.formNumber).trim(),
          registrationId: String(rec.registrationId).trim(),
          rollNumber: rec.rollNumber ? String(rec.rollNumber).trim() : "",
          enrollmentNumber: rec.enrollmentNumber ? String(rec.enrollmentNumber).trim() : "",
          semester: rec.semester ? String(rec.semester).trim() : "",
          batch: batchName,
          programmeName: rec.programmeName || "BACHELOR OF COMPUTER APPLICATIONS(COMPUTER APPLICATION)",
          transactionMode: rec.transactionMode || "CASH",
          admissionCategory: rec.admissionCategory || "GENERAL",
          majorSubject: rec.majorSubject || "",
          minorSubject: rec.minorSubject || "",
          name: String(rec.name).trim(),
          gender: rec.gender ? String(rec.gender).trim().toUpperCase() : "MALE",
          category: rec.category ? String(rec.category).trim().toUpperCase() : "GENERAL",
          email: rec.email ? String(rec.email).trim() : "",
          mobile: rec.mobile ? String(rec.mobile).trim() : "",
          status: rec.status === "Inactive" ? "Inactive" : "Active",
          importId: importId || null,
        });
      }

      // 3. Update existing student records
      for (const rec of updatedRecords) {
        const batchName = rec.batch ? String(rec.batch).trim() : "";
        if (batchName) batchesSeen.add(batchName);

        await tx.update(students)
          .set({
            name: String(rec.name).trim(),
            formNumber: String(rec.formNumber).trim(),
            registrationId: String(rec.registrationId).trim(),
            email: rec.email ? String(rec.email).trim() : "",
            mobile: rec.mobile ? String(rec.mobile).trim() : "",
            rollNumber: rec.rollNumber ? String(rec.rollNumber).trim() : "",
            enrollmentNumber: rec.enrollmentNumber ? String(rec.enrollmentNumber).trim() : "",
            semester: rec.semester ? String(rec.semester).trim() : "",
            batch: batchName,
            programmeName: rec.programmeName || "BACHELOR OF COMPUTER APPLICATIONS(COMPUTER APPLICATION)",
            transactionMode: rec.transactionMode || "CASH",
            admissionCategory: rec.admissionCategory || "GENERAL",
            majorSubject: rec.majorSubject || "",
            minorSubject: rec.minorSubject || "",
            gender: rec.gender ? String(rec.gender).trim().toUpperCase() : "MALE",
            category: rec.category ? String(rec.category).trim().toUpperCase() : "GENERAL",
            status: rec.status === "Inactive" ? "Inactive" : "Active",
            updatedAt: new Date(),
            importId: importId || null,
          })
          .where(eq(students.id, rec.existingId));
      }

      // 4. Auto-register any new batches in the batches table
      for (const b of batchesSeen) {
        try {
          const existingBatch = await tx.select().from(batches).where(eq(batches.name, b)).limit(1);
          if (existingBatch.length === 0) {
            await tx.insert(batches).values({ name: b });
          }
        } catch {
          // Ignore unique collision
        }
      }

      // 5. Activity log
      await tx.insert(activityLogs).values({
        adminEmail: email,
        action: "CSV Import",
        details: `Imported student records from "${fileName || "students.csv"}". Added: ${newRecords.length}, Updated: ${updatedRecords.length}, Duplicates skipped: ${duplicatesCount}.`,
      });
    });

    res.json({
      success: true,
      importId,
      totalProcessed: newRecords.length + updatedRecords.length,
      newCount: newRecords.length,
      updatedCount: updatedRecords.length,
      duplicateCount: duplicatesCount,
      invalidCount,
      message: `Successfully processed ${newRecords.length + updatedRecords.length} student records from CSV.`,
    });
  } catch (err: any) {
    console.error("CSV import confirm error:", err);
    res.status(500).json({ error: err.message || "Failed to commit CSV records to database" });
  }
});

// GET single student details (including private fields)
app.get("/api/admin/students/:id", requireJWT as any, async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  const { id } = req.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) {
    return next();
  }
  try {
    const record = await db.select().from(students).where(eq(students.id, numId));
    if (record.length === 0) {
      return res.status(404).json({ error: "Student record not found" });
    }
    const s = record[0];
    
    // Increment profile view count
    await db.update(students)
      .set({ viewCount: sql`${students.viewCount} + 1` })
      .where(eq(students.id, s.id));
      
    s.viewCount = s.viewCount + 1;
    res.json(s);
  } catch (err: any) {
    console.error("Fetch single student error:", err);
    res.status(500).json({ error: "Failed to load student details" });
  }
});

// POST Manual creation of student
app.post("/api/admin/students", requireJWT, async (req: AuthRequest, res) => {
  const email = req.admin?.email || "admin";
  const studentData = req.body;

  if (!studentData.name || !studentData.formNumber || !studentData.registrationId) {
    return res.status(400).json({ error: "Name, Form Number, and Registration ID are required fields" });
  }

  try {
    // Duplicate check
    const existing = await db.select().from(students).where(
      or(
        eq(students.formNumber, studentData.formNumber),
        eq(students.registrationId, studentData.registrationId)
      )
    );

    if (existing.length > 0) {
      // Trigger notification for duplicate student creation failure
      const sub = `⚠️ DATABASE ALERT: Duplicate Student Creation Prevented`;
      const body = `An administrator attempted to manually create a duplicate student record, which was successfully blocked.\n\nDetails:\n- Name: ${studentData.name}\n- Form Number: ${studentData.formNumber}\n- Registration ID: ${studentData.registrationId}\n- Attempted By: ${email}\n- Date/Time: ${new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })} (IST)`;
      sendAdminNotification(sub, body).catch(console.error);

      return res.status(409).json({ error: "A student record with the same Form Number or Registration ID already exists" });
    }

    // Duplicate check for Roll Number
    if (studentData.rollNumber && studentData.rollNumber.trim()) {
      const existingRoll = await db.select().from(students).where(eq(students.rollNumber, studentData.rollNumber.trim()));
      if (existingRoll.length > 0) {
        return res.status(400).json({ error: "Duplicate Roll Number: A student with this Roll Number already exists" });
      }
    }

    // Duplicate check for Enrollment Number
    if (studentData.enrollmentNumber && studentData.enrollmentNumber.trim()) {
      const existingEnroll = await db.select().from(students).where(eq(students.enrollmentNumber, studentData.enrollmentNumber.trim()));
      if (existingEnroll.length > 0) {
        return res.status(400).json({ error: "Duplicate Enrollment Number: A student with this Enrollment Number already exists" });
      }
    }

    // Helper to sanitize semester format consistently
    const sanitizeSemester = (sem: string): string => {
      if (!sem) return "";
      const s = sem.toLowerCase().trim();
      if (s.includes("1") || s.includes("first")) return "1st Semester";
      if (s.includes("2") || s.includes("second")) return "2nd Semester";
      if (s.includes("3") || s.includes("third")) return "3rd Semester";
      if (s.includes("4") || s.includes("fourth")) return "4th Semester";
      if (s.includes("5") || s.includes("fifth")) return "5th Semester";
      if (s.includes("6") || s.includes("sixth")) return "6th Semester";
      return sem;
    };

    const newStudent = await db.insert(students).values({
      formNumber: studentData.formNumber,
      registrationId: studentData.registrationId,
      rollNumber: studentData.rollNumber ? studentData.rollNumber.trim() : "",
      enrollmentNumber: studentData.enrollmentNumber ? studentData.enrollmentNumber.trim() : "",
      semester: sanitizeSemester(studentData.semester || ""),
      batch: studentData.batch || "",
      programmeName: studentData.programmeName || "BACHELOR OF COMPUTER APPLICATIONS(COMPUTER APPLICATION)",
      transactionMode: studentData.transactionMode || "CASH",
      admissionCategory: studentData.admissionCategory || "GENERAL",
      majorSubject: studentData.majorSubject || "",
      minorSubject: studentData.minorSubject || "",
      name: studentData.name,
      gender: studentData.gender || "MALE",
      category: studentData.category || "GENERAL",
      email: studentData.email || "",
      mobile: studentData.mobile || "",
      status: "Active",
    }).returning();

    await logActivity(email, "Student Created", `Created student record for ${studentData.name} (ID: ${studentData.registrationId}).`);
    res.status(201).json({ success: true, student: newStudent[0] });
  } catch (err: any) {
    console.error("Add student error:", err);
    res.status(500).json({ error: "Failed to create new student record" });
  }
});

// PUT Manual editing of student
app.put("/api/admin/students/:id", requireJWT, async (req: AuthRequest, res) => {
  const email = req.admin?.email || "admin";
  const { id } = req.params;
  const studentData = req.body;

  if (!studentData.name || !studentData.formNumber || !studentData.registrationId) {
    return res.status(400).json({ error: "Name, Form Number, and Registration ID are required" });
  }

  try {
    const existing = await db.select().from(students).where(eq(students.id, parseInt(id, 10)));
    if (existing.length === 0) {
      return res.status(404).json({ error: "Student record not found" });
    }

    // Check unique constraints for other rows
    const duplicate = await db.select().from(students).where(
      and(
        sql`id != ${parseInt(id, 10)}`,
        or(
          eq(students.formNumber, studentData.formNumber),
          eq(students.registrationId, studentData.registrationId)
        )
      )
    );

    if (duplicate.length > 0) {
      // Trigger notification for duplicate student update failure
      const sub = `⚠️ DATABASE ALERT: Duplicate Student Update Prevented`;
      const body = `An administrator attempted to update an existing student to duplicate credentials, which was successfully blocked.\n\nDetails:\n- Student ID: ${id}\n- Name: ${studentData.name}\n- Requested Form Number: ${studentData.formNumber}\n- Requested Registration ID: ${studentData.registrationId}\n- Attempted By: ${email}\n- Date/Time: ${new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })} (IST)`;
      sendAdminNotification(sub, body).catch(console.error);

      return res.status(409).json({ error: "Another student record already uses this Form Number or Registration ID" });
    }

    // Duplicate check for Roll Number on other rows
    if (studentData.rollNumber && studentData.rollNumber.trim()) {
      const duplicateRoll = await db.select().from(students).where(
        and(
          sql`id != ${parseInt(id, 10)}`,
          eq(students.rollNumber, studentData.rollNumber.trim())
        )
      );
      if (duplicateRoll.length > 0) {
        return res.status(400).json({ error: "Duplicate Roll Number: Another student already has this Roll Number" });
      }
    }

    // Duplicate check for Enrollment Number on other rows
    if (studentData.enrollmentNumber && studentData.enrollmentNumber.trim()) {
      const duplicateEnroll = await db.select().from(students).where(
        and(
          sql`id != ${parseInt(id, 10)}`,
          eq(students.enrollmentNumber, studentData.enrollmentNumber.trim())
        )
      );
      if (duplicateEnroll.length > 0) {
        return res.status(400).json({ error: "Duplicate Enrollment Number: Another student already has this Enrollment Number" });
      }
    }

    // Helper to sanitize semester format consistently
    const sanitizeSemester = (sem: string): string => {
      if (!sem) return "";
      const s = sem.toLowerCase().trim();
      if (s.includes("1") || s.includes("first")) return "1st Semester";
      if (s.includes("2") || s.includes("second")) return "2nd Semester";
      if (s.includes("3") || s.includes("third")) return "3rd Semester";
      if (s.includes("4") || s.includes("fourth")) return "4th Semester";
      if (s.includes("5") || s.includes("fifth")) return "5th Semester";
      if (s.includes("6") || s.includes("sixth")) return "6th Semester";
      return sem;
    };

    await db.update(students)
      .set({
        name: studentData.name,
        formNumber: studentData.formNumber,
        registrationId: studentData.registrationId,
        rollNumber: studentData.rollNumber ? studentData.rollNumber.trim() : "",
        enrollmentNumber: studentData.enrollmentNumber ? studentData.enrollmentNumber.trim() : "",
        semester: sanitizeSemester(studentData.semester || ""),
        batch: studentData.batch || "",
        programmeName: studentData.programmeName,
        transactionMode: studentData.transactionMode,
        admissionCategory: studentData.admissionCategory,
        majorSubject: studentData.majorSubject,
        minorSubject: studentData.minorSubject,
        gender: studentData.gender,
        category: studentData.category,
        email: studentData.email,
        mobile: studentData.mobile,
        status: studentData.status || "Active",
        updatedAt: new Date(),
      })
      .where(eq(students.id, parseInt(id, 10)));

    await logActivity(email, "Student Updated", `Modified details for student ${studentData.name} (ID: ${studentData.registrationId}).`);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Edit student error:", err);
    res.status(500).json({ error: "Failed to update student record" });
  }
});

// DELETE delete student
app.delete("/api/admin/students/:id", requireJWT, async (req: AuthRequest, res) => {
  const email = req.admin?.email || "admin";
  const { id } = req.params;

  try {
    const existing = await db.select().from(students).where(eq(students.id, parseInt(id, 10)));
    if (existing.length === 0) {
      return res.status(404).json({ error: "Student record not found" });
    }

    const studentName = existing[0].name;
    const studentReg = existing[0].registrationId;

    await db.delete(students).where(eq(students.id, parseInt(id, 10)));

    await logActivity(email, "Student Deleted", `Deleted student record of ${studentName} (ID: ${studentReg}).`);
    res.json({ success: true, message: "Student record deleted successfully" });
  } catch (err: any) {
    console.error("Delete student error:", err);
    res.status(500).json({ error: "Failed to delete student record" });
  }
});

// ---------------------------------------------------------
// 3. PDF PARSING AND INGESTION WORKFLOW
// ---------------------------------------------------------

// POST Upload PDF for Analysis & Preview
app.post("/api/admin/import/upload", requireJWT, upload.single("pdf"), async (req: AuthRequest, res) => {
  const email = req.admin?.email || "admin";

  if (!req.file) {
    return res.status(400).json({ error: "No PDF file uploaded" });
  }

  try {
    const ai = getAiClient();
    const pdfBase64 = req.file.buffer.toString("base64");

    await logActivity(email, "PDF Upload", `Uploaded student records PDF: "${req.file.originalname}". Processing with pdf-parse and Gemini...`);

    // Step 1: Parse PDF text locally using pdf-parse to handle multi-page documents and dynamic headers robustly
    let extractedText = "";
    try {
      console.log(`[PDF-Parse] Starting text extraction for file: ${req.file.originalname}`);
      const pdfParser = ((pdf as any).default || pdf) as any;
      const pdfData = await pdfParser(req.file.buffer);
      extractedText = pdfData.text || "";
      console.log(`[PDF-Parse] Successfully extracted ${extractedText.length} characters of raw text.`);
    } catch (parseErr: any) {
      console.warn("[PDF-Parse] Local text extraction failed, falling back to direct LLM parsing:", parseErr);
    }

    // Perform LLM Parsing with robust retry-on-503 & multi-model fallback cascade
    let response: any = null;
    let attempts = 0;
    const maxAttempts = 3;
    let lastError: any = null;
    
    // Model try order: start with highly stable standard flash, then go to ultra-light flash-lite, then latest preview
    const modelsToTry = ["gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-3.8-flash"];

    while (attempts < maxAttempts) {
      const modelToUse = modelsToTry[attempts] || "gemini-flash-latest";
      try {
        attempts++;
        console.log(`[Gemini PDF Ingestion] Attempt ${attempts} using model ${modelToUse}...`);
        
        // Build contents depending on whether text was extracted
        const contents: any[] = [];
        if (extractedText && extractedText.trim().length > 20) {
          contents.push({
            text: `You are an expert data parser. Below is the raw text extracted from a Pragjyotish College BCA admission/student list PDF (which may have multiple pages and dynamic table headers).
Please parse this text, understand its table structure, and extract all student records. Output as a JSON array of student objects. Each object MUST strictly follow this JSON schema:

{
  "formNumber": "string containing the Form Number (e.g., 2632862)",
  "registrationId": "string containing the Registration ID (e.g., 26011453)",
  "rollNumber": "string containing the Roll Number (e.g., 2401, 2405, etc.) if visible in the document",
  "enrollmentNumber": "string containing the Enrollment Number (e.g., PC/2024/005, etc.) if visible in the document",
  "semester": "string containing Semester (e.g., '1st Semester', '3rd Semester', '5th Semester'). Try to map/normalize values like '1st', 'sem 1', 'first sem' to '1st Semester', etc.",
  "batch": "string containing the Batch/Academic Year (e.g., '2024–2027', '2025–2028', '2026–2029') if found or can be inferred",
  "programmeName": "string containing the Programme Name (usually BACHELOR OF COMPUTER APPLICATIONS(COMPUTER APPLICATION))",
  "transactionMode": "string containing Transaction Mode (usually CASH or ONLINE)",
  "admissionCategory": "string containing Admission Category (usually GENERAL)",
  "majorSubject": "string containing Major Subject",
  "minorSubject": "string containing Minor Subject",
  "name": "string containing Name of the Applicant",
  "gender": "string containing Gender (MALE or FEMALE)",
  "category": "string containing Category (e.g. GENERAL, OBC / MOBC, SCHEDULE TRIBE, SCHEDULED CASTE, EWS)",
  "email": "string containing Email Address",
  "mobile": "string containing Mobile/Phone Number"
}

Extract as many rows as possible from the provided text. Match values accurately under their corresponding dynamic headers. Return ONLY a valid JSON array of objects. Do not include any text other than the JSON output.

--- EXTRACTED PDF TEXT ---
${extractedText}`
          });
        } else {
          // Fallback to sending raw PDF
          contents.push({
            inlineData: {
              mimeType: "application/pdf",
              data: pdfBase64,
            },
          });
          contents.push({
            text: "You are an expert data parser. Please extract all student records from this Pragjyotish College BCA admission/student list PDF. Output as a JSON array of student objects. Each object MUST strictly follow this JSON schema:\n\n" +
                  "{\n" +
                  "  \"formNumber\": \"string containing the Form Number (e.g., 2632862)\",\n" +
                  "  \"registrationId\": \"string containing the Registration ID (e.g., 26011453)\",\n" +
                  "  \"rollNumber\": \"string containing the Roll Number if present\",\n" +
                  "  \"enrollmentNumber\": \"string containing the Enrollment Number if present\",\n" +
                  "  \"semester\": \"string containing Semester (e.g., 1st Semester, 3rd Semester, 5th Semester)\",\n" +
                  "  \"batch\": \"string containing the Batch/Year (e.g., 2024–2027)\",\n" +
                  "  \"programmeName\": \"string containing the Programme Name (usually BACHELOR OF COMPUTER APPLICATIONS(COMPUTER APPLICATION))\",\n" +
                  "  \"transactionMode\": \"string containing Transaction Mode (usually CASH or ONLINE)\",\n" +
                  "  \"admissionCategory\": \"string containing Admission Category (usually GENERAL)\",\n" +
                  "  \"majorSubject\": \"string containing Major Subject\",\n" +
                  "  \"minorSubject\": \"string containing Minor Subject\",\n" +
                  "  \"name\": \"string containing Name of the Applicant\",\n" +
                  "  \"gender\": \"string containing Gender (MALE or FEMALE)\",\n" +
                  "  \"category\": \"string containing Category (e.g. GENERAL, OBC / MOBC, SCHEDULE TRIBE, SCHEDULED CASTE, EWS)\",\n" +
                  "  \"email\": \"string containing Email Address\",\n" +
                  "  \"mobile\": \"string containing Mobile/Phone Number\"\n" +
                  "}\n\n" +
                  "Extract as many rows as possible from all pages of the document. Return ONLY a valid JSON array. Do not wrap in markdown codeblocks. Do not include any text other than the JSON output."
          });
        }

        response = await ai.models.generateContent({
          model: modelToUse,
          contents: contents,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  formNumber: { type: Type.STRING },
                  registrationId: { type: Type.STRING },
                  rollNumber: { type: Type.STRING },
                  enrollmentNumber: { type: Type.STRING },
                  semester: { type: Type.STRING },
                  batch: { type: Type.STRING },
                  programmeName: { type: Type.STRING },
                  transactionMode: { type: Type.STRING },
                  admissionCategory: { type: Type.STRING },
                  majorSubject: { type: Type.STRING },
                  minorSubject: { type: Type.STRING },
                  name: { type: Type.STRING },
                  gender: { type: Type.STRING },
                  category: { type: Type.STRING },
                  email: { type: Type.STRING },
                  mobile: { type: Type.STRING },
                },
                required: ["formNumber", "registrationId", "name"],
              },
            },
          },
        });

        // Successful parse! Exit the retry loop.
        console.log(`[Gemini PDF Ingestion] Success on attempt ${attempts} using ${modelToUse}.`);
        break;
      } catch (err: any) {
        lastError = err;
        const errString = err.message || JSON.stringify(err);
        console.warn(`[Gemini PDF Ingestion] Attempt ${attempts} failed:`, errString);

        // Check if the error is a rate limit or 503 / overloaded error
        const isRetryable = 
          errString.includes("503") || 
          errString.includes("429") ||
          errString.toLowerCase().includes("unavailable") || 
          errString.toLowerCase().includes("high demand") || 
          errString.toLowerCase().includes("overloaded") ||
          errString.toLowerCase().includes("rate limit") ||
          errString.toLowerCase().includes("resource exhausted");

        if (isRetryable && attempts < maxAttempts) {
          const delayTime = attempts * 1500; // 1500ms, then 3000ms progressive delay
          console.log(`[Gemini PDF Ingestion] Transient error detected. Retrying in ${delayTime}ms with backup model...`);
          await new Promise((resolve) => setTimeout(resolve, delayTime));
        } else {
          // If it's a fatal non-transient error, throw immediately to avoid wasting time
          throw err;
        }
      }
    }

    if (!response) {
      throw lastError || new Error("Failed to extract data from PDF after multiple model attempts.");
    }

    const parsedText = response.text || "[]";
    let rawRecords: any[] = [];
    try {
      rawRecords = JSON.parse(parsedText.trim());
    } catch (parseErr) {
      console.error("Failed to parse Gemini JSON output:", parsedText);
      return res.status(500).json({ error: "Gemini did not return valid JSON. Please try uploading the PDF again." });
    }

    if (!Array.isArray(rawRecords)) {
      rawRecords = [];
    }

    // ---------------------------------------------------------
    // Duplicate detection, validation, update preview
    // ---------------------------------------------------------
    
    // Fetch all current student identifiers
    const existing = await db.select({
      id: students.id,
      formNumber: students.formNumber,
      registrationId: students.registrationId,
      name: students.name,
      email: students.email,
      mobile: students.mobile,
      programmeName: students.programmeName,
      transactionMode: students.transactionMode,
      admissionCategory: students.admissionCategory,
      majorSubject: students.majorSubject,
      minorSubject: students.minorSubject,
      gender: students.gender,
      category: students.category,
    }).from(students);

    // Index by formNumber and registrationId
    const existingByForm = new Map<string, typeof existing[0]>();
    const existingByReg = new Map<string, typeof existing[0]>();
    existing.forEach((s) => {
      if (s.formNumber) existingByForm.set(s.formNumber, s);
      if (s.registrationId) existingByReg.set(s.registrationId, s);
    });

    // Normalize whitespace, line breaks, and empty values inside the values
    const cleanString = (val: any) => {
      if (val === null || val === undefined) return "";
      const s = String(val).replace(/\s+/g, ' ').trim();
      const lower = s.toLowerCase();
      if (lower === "" || lower === "null" || lower === "undefined" || lower === "n/a" || lower === "-" || lower === "none") {
        return "";
      }
      return s;
    };

    let totalRecords = rawRecords.length;
    let newRecords: any[] = [];
    let updatedRecords: any[] = [];
    let duplicateRecords: any[] = [];
    let invalidRecords: any[] = [];

    rawRecords.forEach((rec, idx) => {
      // Normalize all record fields
      rec.name = cleanString(rec.name);
      rec.formNumber = cleanString(rec.formNumber);
      rec.registrationId = cleanString(rec.registrationId);
      rec.rollNumber = cleanString(rec.rollNumber);
      rec.enrollmentNumber = cleanString(rec.enrollmentNumber);
      rec.semester = cleanString(rec.semester);
      rec.batch = cleanString(rec.batch);
      rec.programmeName = cleanString(rec.programmeName);
      rec.transactionMode = cleanString(rec.transactionMode);
      rec.admissionCategory = cleanString(rec.admissionCategory);
      rec.majorSubject = cleanString(rec.majorSubject);
      rec.minorSubject = cleanString(rec.minorSubject);
      rec.gender = cleanString(rec.gender);
      rec.category = cleanString(rec.category);
      rec.email = cleanString(rec.email);
      rec.mobile = cleanString(rec.mobile);

      // Validate required database non-nullable identifiers
      if (!rec.name || !rec.formNumber || !rec.registrationId) {
        invalidRecords.push({
          ...rec,
          index: idx,
          errorReason: "Missing required identifier: Name, Form Number or Registration ID.",
        });
        return;
      }

      // Check duplicate matching (Primary: registrationId, Secondary: formNumber)
      const matchByReg = rec.registrationId ? existingByReg.get(rec.registrationId) : null;
      const matchByForm = rec.formNumber ? existingByForm.get(rec.formNumber) : null;
      const existingMatch = matchByReg || matchByForm;

      if (existingMatch) {
        // Compare values to see if any fields updated or if it is exactly identical
        const hasDiff = 
          (rec.name && rec.name.toLowerCase() !== (existingMatch.name || "").toLowerCase()) ||
          (rec.email && rec.email.toLowerCase() !== (existingMatch.email || "").toLowerCase()) ||
          (rec.mobile && rec.mobile !== existingMatch.mobile) ||
          (rec.majorSubject && rec.majorSubject !== existingMatch.majorSubject) ||
          (rec.minorSubject && rec.minorSubject !== existingMatch.minorSubject) ||
          (rec.category && rec.category !== existingMatch.category);

        if (hasDiff) {
          updatedRecords.push({
            ...rec,
            existingId: existingMatch.id,
            existingRecord: existingMatch,
          });
        } else {
          duplicateRecords.push({
            ...rec,
            existingId: existingMatch.id,
          });
        }
      } else {
        newRecords.push(rec);
      }
    });

    res.json({
      fileName: req.file.originalname,
      totalRecords,
      newCount: newRecords.length,
      updatedCount: updatedRecords.length,
      duplicateCount: duplicateRecords.length,
      invalidCount: invalidRecords.length,
      preview: {
        newRecords,
        updatedRecords,
        duplicateRecords,
        invalidRecords,
      },
    });
  } catch (err: any) {
    console.error("PDF upload/analysis error:", err);
    
    // Trigger notification for failed PDF parsing/import
    const sub = `❌ SYSTEM ALERT: Failed PDF Import / Parsing Error`;
    const body = `An error occurred while parsing student records from a PDF file upload.\n\nDetails:\n- File Name: ${req.file?.originalname || "Unknown"}\n- Uploaded By: ${email}\n- Date/Time: ${new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })} (IST)\n- Error details: ${err.message || err}`;
    sendAdminNotification(sub, body).catch(console.error);

    res.status(500).json({ error: err.message || "An error occurred during PDF parsing" });
  }
});

// POST Confirm and Commit parsed records to database
app.post("/api/admin/import/confirm", requireJWT, async (req: AuthRequest, res) => {
  const email = req.admin?.email || "admin";
  const { fileName, preview } = req.body;

  if (!preview) {
    return res.status(400).json({ error: "No student student records preview provided" });
  }

  const newRecords: any[] = preview.newRecords || [];
  const updatedRecords: any[] = preview.updatedRecords || [];
  const duplicateRecordsList: any[] = preview.duplicateRecords || [];
  const invalidCount = (preview.invalidRecords || []).length;
  const duplicatesCount = duplicateRecordsList.length;

  try {
    // Log start of import activity
    await logActivity(email, "Import started", `Started confirming student import from "${fileName || "manual_upload.pdf"}".`);

    let importId: number = 0;

    // Use a real database transaction
    await db.transaction(async (tx) => {
      // 1. Create a new Import batch record
      const newImportResult = await tx.insert(imports).values({
        fileName: fileName || "manual_upload.pdf",
        adminEmail: email,
        totalRecords: newRecords.length + updatedRecords.length + duplicatesCount + invalidCount,
        newRecords: newRecords.length,
        updatedRecords: updatedRecords.length,
        duplicateRecords: duplicatesCount,
        invalidRecords: invalidCount,
        status: "Success",
      }).returning();

      if (!newImportResult || newImportResult.length === 0) {
        throw new Error("Failed to insert the import history record.");
      }

      importId = newImportResult[0].id;

      // 2. Insert new student records
      for (const rec of newRecords) {
        await tx.insert(students).values({
          formNumber: String(rec.formNumber),
          registrationId: String(rec.registrationId),
          rollNumber: rec.rollNumber ? String(rec.rollNumber).trim() : "",
          enrollmentNumber: rec.enrollmentNumber ? String(rec.enrollmentNumber).trim() : "",
          semester: rec.semester ? String(rec.semester).trim() : "",
          batch: rec.batch ? String(rec.batch).trim() : "",
          programmeName: rec.programmeName || "BACHELOR OF COMPUTER APPLICATIONS(COMPUTER APPLICATION)",
          transactionMode: rec.transactionMode || "CASH",
          admissionCategory: rec.admissionCategory || "GENERAL",
          majorSubject: rec.majorSubject || "",
          minorSubject: rec.minorSubject || "",
          name: rec.name,
          gender: rec.gender || "MALE",
          category: rec.category || "GENERAL",
          email: rec.email || "",
          mobile: rec.mobile || "",
          status: "Active",
          importId: importId,
        });

        // Activity log for student insertion
        await tx.insert(activityLogs).values({
          adminEmail: email,
          action: "Students inserted",
          details: `Inserted student record of ${rec.name} (Registration ID: ${rec.registrationId}, Form: ${rec.formNumber}) via PDF import.`,
        });
      }

      // 3. Update changed student records
      for (const rec of updatedRecords) {
        await tx.update(students)
          .set({
            name: rec.name,
            email: rec.email || "",
            mobile: rec.mobile || "",
            rollNumber: rec.rollNumber ? String(rec.rollNumber).trim() : "",
            enrollmentNumber: rec.enrollmentNumber ? String(rec.enrollmentNumber).trim() : "",
            semester: rec.semester ? String(rec.semester).trim() : "",
            batch: rec.batch ? String(rec.batch).trim() : "",
            programmeName: rec.programmeName,
            transactionMode: rec.transactionMode,
            admissionCategory: rec.admissionCategory,
            majorSubject: rec.majorSubject,
            minorSubject: rec.minorSubject,
            gender: rec.gender,
            category: rec.category,
            updatedAt: new Date(),
            importId: importId,
          })
          .where(eq(students.id, rec.existingId));

        // Activity log for student update
        await tx.insert(activityLogs).values({
          adminEmail: email,
          action: "Students updated",
          details: `Updated student record of ${rec.name} (Registration ID: ${rec.registrationId}, Form: ${rec.formNumber}) via PDF import.`,
        });
      }
    });

    // Log complete action
    await logActivity(
      email,
      "Import completed",
      `Committed PDF import (Import ID: ${importId}). Inserted: ${newRecords.length}, Updated: ${updatedRecords.length}, Duplicates skipped: ${duplicatesCount}.`
    );

    res.json({
      success: true,
      importId,
      total: newRecords.length + updatedRecords.length + duplicatesCount + invalidCount,
      inserted: newRecords.length,
      updated: updatedRecords.length,
      duplicates: duplicatesCount,
      invalid: invalidCount,
      message: `Successfully imported ${newRecords.length} new records, updated ${updatedRecords.length} records, skipped ${duplicatesCount} duplicates.`,
    });
  } catch (err: any) {
    console.error("Confirm Import Error:", err);
    
    // Log failure action
    await logActivity(email, "Import failed", `Import of "${fileName || "manual_upload.pdf"}" failed to save: ${err.message || err}`);

    // Trigger notification for failed PDF import database commit
    const sub = `❌ SYSTEM ALERT: Failed PDF Import / Database Commit Failure`;
    const body = `A database error occurred while committing the parsed PDF records.\n\nDetails:\n- File Name: ${fileName || "manual_upload.pdf"}\n- Confirmed By: ${email}\n- Date/Time: ${new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })} (IST)\n- Error details: ${err.message || err}`;
    sendAdminNotification(sub, body).catch(console.error);

    res.status(500).json({ error: err.message || "Failed to save imported records to the database" });
  }
});

// ---------------------------------------------------------
// 4. FRONTEND SERVING & VITE SETUP
// ---------------------------------------------------------

// ---------------------------------------------------------
// 4. FRONTEND SERVING & VITE SETUP
// ---------------------------------------------------------

async function startServer() {
  // In production, serve the compiled static build files. In development, mount Vite middleware.
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global server listening
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully booted and listening on host 0.0.0.0, port ${PORT}`);
  });
}

// Only start standalone HTTP server when executed directly and not in Vercel Serverless Function environment
const isDirectRun = Boolean(
  process.argv[1] && (
    process.argv[1].endsWith("server.ts") ||
    process.argv[1].endsWith("server.cjs") ||
    process.argv[1].endsWith("server.js")
  )
);

if (!process.env.VERCEL && isDirectRun) {
  startServer().catch((err) => {
    console.error("Failed to bootstrap server instance:", err);
  });
}

export { app };
export default app;

