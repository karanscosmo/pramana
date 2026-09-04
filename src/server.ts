import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma, initDb } from "./db.js";
import { orchestrator } from "./orchestrator.js";
import { DEMO_SCENARIOS } from "./demo/scenarios.js";
import { DocType } from "./types/index.js";
import { answerQueryWithRAG } from "./agents/ragAgent.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || "pramana_merchants_secret_2026";

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

function authMiddleware(req: AuthenticatedRequest, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: Missing authentication token" });
    return;
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
  }
}

function optionalAuthMiddleware(req: AuthenticatedRequest, _res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
      req.user = decoded;
    } catch {
      // Ignore invalid token for optional auth
    }
  }
  next();
}

// Configure uploads directory (use /tmp/uploads on Vercel where root filesystem is read-only)
const UPLOADS_DIR = process.env.VERCEL
  ? path.join("/tmp", "uploads")
  : path.resolve(process.cwd(), "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch (e) {
    console.warn("[Pramana] Could not create uploads dir:", e);
  }
}

// Multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
});

app.use(cors({ origin: "*" }));
app.use(express.json());

// Database auto-connection middleware for serverless invocations
app.use(async (_req: Request, _res: Response, next: () => void) => {
  try {
    await initDb();
  } catch (err) {
    console.error("[Pramana] Database initialization error:", err);
  }
  next();
});

const PUBLIC_DIR = path.resolve(process.cwd(), "public");
app.use(express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOADS_DIR));

/**
 * Root API service directory
 */
app.get("/api", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    service: "Pramana KYB Verification Agent",
    version: "1.0.0",
    claudeVisionAvailable: Boolean(ANTHROPIC_API_KEY),
    endpoints: {
      health: "/api/health",
      scenarios: "/api/demo/scenarios",
      demoRun: "/api/demo/run",
      session: "/api/session",
      auth: {
        signup: "/api/auth/signup",
        login: "/api/auth/login",
        me: "/api/auth/me",
      },
    },
  });
});

/**
 * Health check endpoint
 */
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    service: "Pramana KYB Verification Agent",
    timestamp: new Date().toISOString(),
    claudeVisionAvailable: Boolean(ANTHROPIC_API_KEY),
  });
});

/**
 * ============================================================================
 * AUTHENTICATION & USER DASHBOARD ROUTES
 * ============================================================================
 */

/**
 * POST /api/auth/signup — Register new merchant with comprehensive business details
 */
app.post("/api/auth/signup", async (req: Request, res: Response) => {
  try {
    const { fullName, phone, email, password, businessName, businessType, city, state } = req.body;

    if (!fullName || !phone || !email || !password || !businessName || !businessType || !city || !state) {
      res.status(400).json({ error: "All personal and registered business fields are required" });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      res.status(409).json({ error: "An account with this email address already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: cleanEmail,
        passwordHash,
        businessName: businessName.trim(),
        businessType: businessType.trim(),
        city: city.trim(),
        state: state.trim(),
      },
    });

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        businessName: user.businessName,
        businessType: user.businessType,
        phone: user.phone,
        city: user.city,
        state: user.state,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create merchant account", message: error.message });
  }
});

/**
 * POST /api/auth/login — Merchant sign in
 */
app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        businessName: user.businessName,
        businessType: user.businessType,
        phone: user.phone,
        city: user.city,
        state: user.state,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Sign in failed", message: error.message });
  }
});

/**
 * GET /api/auth/me — Current merchant profile
 */
app.get("/api/auth/me", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        businessName: true,
        businessType: true,
        phone: true,
        city: true,
        state: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "Merchant not found" });
      return;
    }

    res.json({ user });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch profile", message: error.message });
  }
});

/**
 * GET /api/user/dashboard — Custom dashboard metrics and sessions for the logged-in merchant
 */
app.get("/api/user/dashboard", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        businessName: true,
        businessType: true,
        phone: true,
        city: true,
        state: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "Merchant not found" });
      return;
    }

    const sessions = await prisma.verificationSession.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: "desc" },
      include: {
        checks: true,
        documents: true,
      },
    });

    const total = sessions.length;
    const verified = sessions.filter((s) => s.overallResult === "verified").length;
    const flagged = sessions.filter((s) => s.overallResult === "flagged").length;

    res.json({
      user,
      stats: {
        total,
        verified,
        flagged,
      },
      recentSessions: sessions.slice(0, 15),
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to load dashboard data", message: error.message });
  }
});

async function resolveValidUserId(req: AuthenticatedRequest): Promise<string | null> {
  if (!req.user?.userId) return null;
  try {
    let user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true },
    });
    if (user) return user.id;

    // In serverless environments, if a user holds a valid signed JWT but the ephemeral SQLite DB rotated, re-seed merchant record
    if (req.user.email) {
      user = await prisma.user.create({
        data: {
          id: req.user.userId,
          email: req.user.email,
          passwordHash: "serverless_session_token",
          fullName: "Verified Merchant",
          businessName: "Business Enterprise",
          businessType: "sole_proprietorship",
          phone: "9800000000",
          city: "India",
          state: "India",
        },
        select: { id: true },
      });
      return user.id;
    }
  } catch (err) {
    console.warn("[Pramana] User resolution safe fallback to anonymous session:", err);
  }
  return null;
}

/**
 * POST /api/session — Create a new verification session (scoped to user if logged in)
 */
app.post("/api/session", optionalAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validUserId = await resolveValidUserId(req);
    const session = await prisma.verificationSession.create({
      data: {
        status: "PROCESSING",
        userId: validUserId,
      },
    });

    res.status(201).json({
      sessionId: session.id,
      status: session.status,
      createdAt: session.createdAt,
    });
  } catch (error: any) {
    console.error("[Pramana Session] Creation error:", error);
    res.status(500).json({ error: "Failed to create verification session", message: error.message });
  }
});

/**
 * GET /api/session/:id/stream — SSE stream of live extraction + verification progress
 */
app.get("/api/session/:id/stream", async (req: Request, res: Response) => {
  const id = req.params.id as string;

  // Validate session existence
  const session = await prisma.verificationSession.findUnique({
    where: { id },
  });

  if (!session) {
    res.status(404).json({ error: `Session '${id}' not found` });
    return;
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  orchestrator.registerSseClient(id, res);

  // Keep-alive heartbeat every 15 seconds
  const heartbeatInterval = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeatInterval);
  });
});

/**
 * POST /api/session/:id/document — Upload one document (multipart), triggers extraction and verification
 */
app.post("/api/session/:id/document", upload.single("document"), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const docType = req.body.docType as DocType;

  if (!req.file) {
    res.status(400).json({ error: "Missing document file in multipart upload ('document' field required)" });
    return;
  }

  const validDocTypes: DocType[] = ["gst_certificate", "pan_card", "cancelled_cheque", "bank_proof"];
  if (!docType || !validDocTypes.includes(docType)) {
    res.status(400).json({
      error: `Invalid or missing docType. Must be one of: ${validDocTypes.join(", ")}`,
    });
    return;
  }

  try {
    let session = await prisma.verificationSession.findUnique({ where: { id } });
    if (!session) {
      session = await prisma.verificationSession.create({
        data: { id, status: "PROCESSING" },
      });
    }

    orchestrator.broadcast(id, {
      type: "doc_uploaded",
      sessionId: id,
      payload: {
        fileName: req.file.originalname,
        docType,
        size: req.file.size,
        mimeType: req.file.mimetype,
      },
    });

    const docRecord = await orchestrator.processDocument(
      id,
      docType,
      req.file.path,
      req.file.mimetype,
      ANTHROPIC_API_KEY,
      req.file.originalname
    );

    res.status(200).json({
      success: true,
      documentId: docRecord.id,
      docType: docRecord.docType,
      confidence: docRecord.extractionConfidence,
      extractedFields: JSON.parse(docRecord.extractedFields),
    });
  } catch (error: any) {
    orchestrator.broadcast(id, {
      type: "error",
      sessionId: id,
      payload: { message: error.message },
    });
    res.status(500).json({ error: "Document processing failed", message: error.message });
  }
});

/**
 * Helper to generate full verification report for a session
 */
async function getFormattedReport(id: string) {
  let session = await prisma.verificationSession.findUnique({
    where: { id },
  });

  if (!session) {
    return null;
  }

  const documents = await prisma.document.findMany({
    where: { sessionId: id },
    orderBy: { createdAt: "asc" },
  });

  const checks = await prisma.verificationCheck.findMany({
    where: { sessionId: id },
    orderBy: { createdAt: "asc" },
  });

  return {
    sessionId: session.id,
    createdAt: session.createdAt,
    status: session.status,
    overallResult: session.overallResult,
    narrativeSummary: session.narrativeSummary || null,
    documentsCount: documents.length,
    checksCount: checks.length,
    documents: documents.map((d) => ({
      id: d.id,
      docType: d.docType,
      rawFileUrl: d.rawFileUrl,
      extractionConfidence: d.extractionConfidence,
      extractedFields: JSON.parse(d.extractedFields),
      tamperRisk: d.tamperRisk || "low",
      tamperFlags: d.tamperFlags ? JSON.parse(d.tamperFlags) : [],
      tamperSummary: d.tamperSummary || null,
      createdAt: d.createdAt,
    })),
    checks: checks.map((c) => ({
      id: c.id,
      checkType: c.checkType,
      result: c.result,
      detail: c.detail,
      evidence: JSON.parse(c.evidence),
      createdAt: c.createdAt,
    })),
  };
}

/**
 * POST /api/session/:id/verify-bundle — Atomic verification of all uploaded documents together in one execution
 * Guarantees cross-document state persistence and sub-second execution on serverless Vercel & local
 */
app.post("/api/session/:id/verify-bundle", upload.any(), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const files = (req.files as Express.Multer.File[]) || [];

  if (files.length === 0) {
    res.status(400).json({ error: "No document files provided in bundle" });
    return;
  }

  try {
    let session = await prisma.verificationSession.findUnique({ where: { id } });
    if (!session) {
      session = await prisma.verificationSession.create({
        data: { id, status: "PROCESSING" },
      });
    }

    // Process all documents in this container's session
    for (const file of files) {
      let docType: DocType = "bank_proof";
      const field = file.fieldname.toLowerCase();
      const orig = file.originalname.toLowerCase();

      if (field.includes("gst") || orig.includes("gst")) docType = "gst_certificate";
      else if (field.includes("pan") || orig.includes("pan")) docType = "pan_card";
      else if (field.includes("cheque") || orig.includes("cheque") || field.includes("bank") || orig.includes("bank")) docType = "cancelled_cheque";

      await orchestrator.processDocument(
        id,
        docType,
        file.path,
        file.mimetype,
        ANTHROPIC_API_KEY,
        file.originalname
      );
    }

    // Fetch the full final report
    const report = await getFormattedReport(id);

    res.status(200).json({
      success: true,
      sessionId: id,
      report,
    });
  } catch (error: any) {
    console.error("[Pramana Bundle] Error:", error);
    res.status(500).json({ error: "Bundle verification failed", message: error.message });
  }
});

/**
 * GET /api/session/:id/report — Full verification report: all fields, all checks, evidence, overall result
 */
app.get("/api/session/:id/report", async (req: Request, res: Response) => {
  const id = req.params.id as string;

  try {
    const formattedReport = await getFormattedReport(id);

    if (!formattedReport) {
      res.json({
        sessionId: id,
        status: "PROCESSING",
        documentsCount: 0,
        checksCount: 0,
        documents: [],
        checks: [],
      });
      return;
    }

    res.json(formattedReport);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate report", message: error.message });
  }
});

/**
 * GET /api/session/:id/narrative — returns the underwriter narrative once generated
 */
app.get("/api/session/:id/narrative", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  try {
    const session = await prisma.verificationSession.findUnique({
      where: { id },
      select: { id: true, status: true, overallResult: true, narrativeSummary: true },
    });

    if (!session) {
      res.status(404).json({ error: `Session '${id}' not found` });
      return;
    }

    res.json({
      sessionId: session.id,
      status: session.status,
      overallResult: session.overallResult,
      narrative: session.narrativeSummary || "Underwriter narrative pending completion of verification pipeline.",
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch narrative", message: error.message });
  }
});

/**
 * POST /api/session/:id/ask — RAG Agent Question-Answering grounded in real uploaded docs
 */
app.post("/api/session/:id/ask", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { question } = req.body;

  if (!question || typeof question !== "string" || !question.trim()) {
    res.status(400).json({ error: "Missing or invalid 'question' in request body" });
    return;
  }

  try {
    const session = await prisma.verificationSession.findUnique({
      where: { id },
      include: {
        documents: true,
        checks: true,
      },
    });

    if (!session) {
      res.status(404).json({ error: `Session '${id}' not found` });
      return;
    }

    if (session.documents.length === 0) {
      res.status(400).json({
        error: "No documents found in this verification session. Please upload documents first.",
      });
      return;
    }

    const ragResult = await answerQueryWithRAG(question.trim(), session, ANTHROPIC_API_KEY);

    res.json({
      success: true,
      question: question.trim(),
      answer: ragResult.answer,
      citations: ragResult.citations,
      confidence: ragResult.confidence,
    });
  } catch (error: any) {
    res.status(500).json({ error: "RAG Agent inquiry failed", message: error.message });
  }
});

/**
 * GET /api/sessions — Retrieve list of recent sessions for audit explorer
 */
app.get("/api/sessions", async (_req: Request, res: Response) => {
  try {
    const sessions = await prisma.verificationSession.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        documents: { select: { id: true, docType: true, extractionConfidence: true } },
        checks: { select: { id: true, checkType: true, result: true } },
      },
    });

    res.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        status: s.status,
        overallResult: s.overallResult,
        documentsCount: s.documents.length,
        checksCount: s.checks.length,
        checksPassed: s.checks.filter((c) => c.result === "pass").length,
        checksFailed: s.checks.filter((c) => c.result === "fail").length,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch sessions", message: error.message });
  }
});

/**
 * GET /api/demo/scenarios — Catalog of preloaded test scenarios
 */
app.get("/api/demo/scenarios", (_req: Request, res: Response) => {
  const list = Object.values(DEMO_SCENARIOS).map((s) => ({
    id: s.id,
    title: s.title,
    badge: s.badge,
    description: s.description,
    expectedResult: s.expectedResult,
    flagReason: s.flagReason,
    documentsCount: s.documents.length,
  }));
  res.json({ scenarios: list });
});

/**
 * POST /api/demo/run — Run a preloaded scenario with live streaming into a session
 */
app.post("/api/demo/run", optionalAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { scenarioId } = req.body;

  if (!scenarioId || !DEMO_SCENARIOS[scenarioId]) {
    res.status(400).json({
      error: `Invalid scenarioId. Available: ${Object.keys(DEMO_SCENARIOS).join(", ")}`,
    });
    return;
  }

  try {
    const validUserId = await resolveValidUserId(req);
    const session = await prisma.verificationSession.create({
      data: {
        status: "PROCESSING",
        userId: validUserId,
      },
    });

    // Run asynchronously so caller can connect to SSE stream immediately
    setTimeout(() => {
      orchestrator.runDemoScenario(session.id, scenarioId, ANTHROPIC_API_KEY).catch((err) => {
        console.error("Demo scenario run error:", err);
      });
    }, 100);

    res.status(200).json({
      sessionId: session.id,
      scenarioId,
      streamUrl: `/api/session/${session.id}/stream`,
      reportUrl: `/api/session/${session.id}/report`,
      message: `Scenario '${scenarioId}' started. Listen at /api/session/${session.id}/stream for live step-by-step progress.`,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to run demo scenario", message: error.message });
  }
});

export async function startServer() {
  await initDb();
  return app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🛡️  Pramana KYB Document Verification Agent active`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    console.log(`   Scenarios: http://localhost:${PORT}/api/demo/scenarios`);
    console.log(`======================================================\n`);
  });
}

// If invoked directly
const isDirectlyExecuted =
  process.argv[1] && (process.argv[1].endsWith("server.js") || process.argv[1].endsWith("server.ts"));

if (isDirectlyExecuted) {
  startServer().catch((err) => {
    console.error("Server startup failed:", err);
    process.exit(1);
  });
}

export default app;
