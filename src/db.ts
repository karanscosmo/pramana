import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

// Auto-configure for Vercel serverless environment:
// In Vercel, the application root is read-only at runtime.
// Point SQLite to /tmp/dev.db if running on Vercel and using file-based storage.
if (process.env.VERCEL) {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith("file:./")) {
    process.env.DATABASE_URL = "file:/tmp/dev.db";
  }
}

export const prisma = new PrismaClient();

let isInitialized = false;

export async function initDb() {
  if (isInitialized) return;

  try {
    await prisma.$connect();

    // Ensure core tables exist in SQLite environment (e.g. ephemeral serverless container in /tmp)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "email" TEXT NOT NULL,
        "passwordHash" TEXT NOT NULL,
        "fullName" TEXT NOT NULL,
        "businessName" TEXT NOT NULL,
        "businessType" TEXT NOT NULL,
        "phone" TEXT NOT NULL,
        "city" TEXT NOT NULL,
        "state" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "VerificationSession" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "status" TEXT NOT NULL DEFAULT 'PROCESSING',
        "overallResult" TEXT,
        "narrativeSummary" TEXT,
        CONSTRAINT "VerificationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Document" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "sessionId" TEXT NOT NULL,
        "docType" TEXT NOT NULL,
        "rawFileUrl" TEXT NOT NULL,
        "extractedFields" TEXT NOT NULL,
        "extractionConfidence" REAL NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "tamperFlags" TEXT,
        "tamperRisk" TEXT,
        "tamperSummary" TEXT,
        CONSTRAINT "Document_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VerificationSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "VerificationCheck" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "sessionId" TEXT NOT NULL,
        "checkType" TEXT NOT NULL,
        "result" TEXT NOT NULL,
        "detail" TEXT NOT NULL,
        "evidence" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "VerificationCheck_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VerificationSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);

    isInitialized = true;
  } catch (err) {
    // Non-fatal if tables already created or external DB used
    console.log("[Pramana DB] Note on schema initialization:", err);
    isInitialized = true;
  }
}
