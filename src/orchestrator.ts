import { Response } from "express";
import { prisma } from "./db.js";
import { extractDocumentFields } from "./agents/extractionAgent.js";
import { validateGstinChecksum, validateGstinPanMatch, validatePanFormat } from "./agents/structuralAgent.js";
import { verifyIfscCode } from "./agents/externalAgent.js";
import { DocumentNameEntry, matchNamesAcrossDocuments } from "./agents/nameMatchAgent.js";
import { CheckOutput, DocType, OverallResult, SSEMessage } from "./types/index.js";
import { DEMO_SCENARIOS } from "./demo/scenarios.js";
import { analyzeDocumentTampering } from "./agents/tamperAgent.js";
import { generateUnderwriterNarrative } from "./agents/narrativeAgent.js";

class VerificationOrchestrator {
  private sseClients: Map<string, Set<Response>> = new Map();

  /**
   * Registers an active Express response stream as an SSE listener for a session
   */
  public registerSseClient(sessionId: string, res: Response) {
    if (!this.sseClients.has(sessionId)) {
      this.sseClients.set(sessionId, new Set());
    }
    this.sseClients.get(sessionId)!.add(res);

    res.on("close", () => {
      const clients = this.sseClients.get(sessionId);
      if (clients) {
        clients.delete(res);
        if (clients.size === 0) {
          this.sseClients.delete(sessionId);
        }
      }
    });

    // Send immediate initial handshake
    this.sendToResponse(res, {
      type: "session_created",
      sessionId,
      payload: { message: "SSE stream established with Nirnay verification pipeline." },
    });
  }

  /**
   * Broadcasts an SSE event to all connected listeners for a session
   */
  public broadcast(sessionId: string, message: SSEMessage) {
    const clients = this.sseClients.get(sessionId);
    if (!clients || clients.size === 0) return;

    for (const client of clients) {
      this.sendToResponse(client, message);
    }
  }

  private sendToResponse(res: Response, message: SSEMessage) {
    res.write(`event: message\n`);
    res.write(`data: ${JSON.stringify(message)}\n\n`);
    if (typeof (res as any).flush === "function") {
      (res as any).flush();
    }
  }

  /**
   * Processes an uploaded document, extracts fields, stores in DB, and re-evaluates all cross-document checks
   */
  public async processDocument(
    sessionId: string,
    docType: DocType,
    filePath: string,
    mimeType: string,
    apiKey?: string,
    originalName?: string
  ) {
    this.broadcast(sessionId, {
      type: "extraction_started",
      sessionId,
      payload: { docType, status: "Extracting structured fields via Vision agent..." },
    });

    // Step 1: Extraction Agent
    const extraction = await extractDocumentFields(filePath, docType, mimeType, apiKey, originalName);

    // Persist document record
    const documentRecord = await prisma.document.create({
      data: {
        sessionId,
        docType,
        rawFileUrl: filePath,
        extractedFields: JSON.stringify(extraction.fields),
        extractionConfidence: extraction.confidence,
      },
    });

    this.broadcast(sessionId, {
      type: "extraction_update",
      sessionId,
      payload: {
        documentId: documentRecord.id,
        docType,
        fields: extraction.fields,
        confidence: extraction.confidence,
        confidenceBreakdown: extraction.confidenceBreakdown,
        rawTextPreview: extraction.rawTextPreview,
      },
    });

    // Step 1.5: Stage 5 - Tamper-Consistency Agent (Evaluates internal visual consistency)
    this.broadcast(sessionId, {
      type: "check_started",
      sessionId,
      checkType: "tamper_consistency",
      payload: { docType, status: `Evaluating internal typography & tamper consistency for ${docType}...` },
    });

    const tamperResult = await analyzeDocumentTampering(filePath, docType, mimeType, apiKey, originalName);

    // Update document record with tamper data
    await prisma.document.update({
      where: { id: documentRecord.id },
      data: {
        tamperRisk: tamperResult.tamperRisk,
        tamperFlags: JSON.stringify(tamperResult.flaggedRegions),
        tamperSummary: tamperResult.summary,
      },
    });

    const isTamperFail = tamperResult.tamperRisk === "high" || tamperResult.tamperRisk === "medium";
    const tamperCheckRecord = await prisma.verificationCheck.create({
      data: {
        sessionId,
        checkType: "tamper_consistency",
        result: isTamperFail ? "fail" : "pass",
        detail: tamperResult.summary,
        evidence: JSON.stringify({
          docType,
          tamperRisk: tamperResult.tamperRisk,
          flaggedRegions: tamperResult.flaggedRegions,
          summary: tamperResult.summary,
        }),
      },
    });

    this.broadcast(sessionId, {
      type: "check_update",
      sessionId,
      checkType: "tamper_consistency",
      result: isTamperFail ? "fail" : "pass",
      detail: tamperResult.summary,
      evidence: {
        docType,
        tamperRisk: tamperResult.tamperRisk,
        flaggedRegions: tamperResult.flaggedRegions,
      },
      payload: {
        documentId: documentRecord.id,
        docType,
        tamperRisk: tamperResult.tamperRisk,
        flaggedRegions: tamperResult.flaggedRegions,
        tamperSummary: tamperResult.summary,
        checkId: tamperCheckRecord.id,
      },
    });

    // Step 2: Trigger Verification Checks based on all available documents in this session
    await this.evaluateSessionChecks(sessionId, apiKey);

    return documentRecord;
  }

  /**
   * Evaluates all structural, external registry, and semantic checks across all documents in the session
   */
  public async evaluateSessionChecks(sessionId: string, apiKey?: string) {
    const docs = await prisma.document.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    });

    const parsedDocs = docs.map((d) => ({
      ...d,
      parsedFields: JSON.parse(d.extractedFields),
    }));

    let gstDoc = parsedDocs.find((d) => d.docType === "gst_certificate");
    let panDoc = parsedDocs.find((d) => d.docType === "pan_card");
    let chequeDoc = parsedDocs.find((d) => d.docType === "cancelled_cheque" || d.docType === "bank_proof");

    const checksToRun: Array<() => Promise<CheckOutput | null>> = [];

    // Check 1: PAN format check (runs if PAN card is present)
    if (panDoc && panDoc.parsedFields.panNumber) {
      checksToRun.push(async () => {
        return validatePanFormat(panDoc!.parsedFields.panNumber);
      });
    }

    // Check 2: GSTIN checksum validation (runs if GST certificate is present)
    if (gstDoc && gstDoc.parsedFields.gstin) {
      checksToRun.push(async () => {
        return validateGstinChecksum(gstDoc!.parsedFields.gstin);
      });
    }

    // Check 3: GSTIN ⇄ PAN structural match (runs if both GST & PAN are present)
    if (gstDoc && panDoc && gstDoc.parsedFields.gstin && panDoc.parsedFields.panNumber) {
      checksToRun.push(async () => {
        return validateGstinPanMatch(gstDoc!.parsedFields.gstin, panDoc!.parsedFields.panNumber);
      });
    }

    // Check 4: External live IFSC verification via Razorpay public registry (runs if cheque is present)
    if (chequeDoc && chequeDoc.parsedFields.ifsc) {
      checksToRun.push(async () => {
        return verifyIfscCode(chequeDoc!.parsedFields.ifsc, chequeDoc!.parsedFields.bankName);
      });
    }

    // Check 5: Cross-document semantic name matching (runs if at least 2 documents with entity names exist)
    const nameEntries: DocumentNameEntry[] = [];
    if (gstDoc && gstDoc.parsedFields.legalBusinessName) {
      nameEntries.push({
        docType: "GST Certificate",
        sourceField: "legalBusinessName",
        name: gstDoc.parsedFields.legalBusinessName,
      });
    }
    if (panDoc && (panDoc.parsedFields.name || panDoc.parsedFields.businessName)) {
      nameEntries.push({
        docType: "PAN Card",
        sourceField: "name",
        name: panDoc.parsedFields.name || panDoc.parsedFields.businessName,
      });
    }
    if (chequeDoc && chequeDoc.parsedFields.accountHolderName) {
      nameEntries.push({
        docType: "Cancelled Cheque",
        sourceField: "accountHolderName",
        name: chequeDoc.parsedFields.accountHolderName,
      });
    }

    if (nameEntries.length >= 2) {
      checksToRun.push(async () => {
        return matchNamesAcrossDocuments(nameEntries, apiKey);
      });
    }

    // Execute each check, record in DB, and stream live update
    const executedChecks: CheckOutput[] = [];

    for (const runCheck of checksToRun) {
      const checkResult = await runCheck();
      if (!checkResult) continue;

      executedChecks.push(checkResult);

      // Upsert or record check
      const checkRecord = await prisma.verificationCheck.create({
        data: {
          sessionId,
          checkType: checkResult.checkType,
          result: checkResult.result,
          detail: checkResult.detail,
          evidence: JSON.stringify(checkResult.evidence),
        },
      });

      // Stream live check update
      this.broadcast(sessionId, {
        type: "check_update",
        sessionId,
        checkType: checkResult.checkType,
        result: checkResult.result,
        detail: checkResult.detail,
        evidence: checkResult.evidence,
        payload: { checkId: checkRecord.id },
      });
    }

    // Fetch all current checks recorded in DB for this session (including tamper checks)
    const allDbChecks = await prisma.verificationCheck.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    });

    // Determine overall session result
    const hasFail = allDbChecks.some((c) => c.result === "fail");
    const hasLowConfidenceDoc = parsedDocs.some((d) => d.extractionConfidence < 0.7);

    // Minimum required documents for full verification: GST, PAN, and Bank proof
    const hasAllDocs = Boolean(gstDoc && panDoc && chequeDoc);

    let overallResult: OverallResult = "insufficient_documents";

    if (hasFail) {
      overallResult = "flagged";
    } else if (hasLowConfidenceDoc) {
      overallResult = "insufficient_documents";
    } else if (hasAllDocs && allDbChecks.length >= 4 && allDbChecks.every((c) => c.result === "pass")) {
      overallResult = "verified";
    } else {
      overallResult = "insufficient_documents";
    }

    // Stage 6: Underwriter Narrative Agent (Synthesizes plain-language memorandum)
    this.broadcast(sessionId, {
      type: "check_started",
      sessionId,
      payload: { status: "Generating Underwriter Narrative Memo from all forensic and statutory proof..." },
    });

    const narrative = await generateUnderwriterNarrative(
      {
        sessionId,
        overallResult,
        documents: docs,
        checks: allDbChecks,
      },
      apiKey
    );

    await prisma.verificationSession.update({
      where: { id: sessionId },
      data: {
        status: "COMPLETE",
        overallResult,
        narrativeSummary: narrative,
      },
    });

    // Broadcast Stage 6 narrative_ready event
    this.broadcast(sessionId, {
      type: "narrative_ready",
      sessionId,
      narrative,
      payload: { narrative },
    });

    this.broadcast(sessionId, {
      type: "session_complete",
      sessionId,
      payload: {
        overallResult,
        narrative,
        checksTotal: allDbChecks.length,
        documentsTotal: parsedDocs.length,
      },
    });

    return { overallResult, executedChecks, narrative };
  }

  /**
   * Executes a pre-configured demo scenario step-by-step with realistic human/agent pace
   */
  public async runDemoScenario(sessionId: string, scenarioId: string, apiKey?: string) {
    const scenario = DEMO_SCENARIOS[scenarioId];
    if (!scenario) {
      throw new Error(`Scenario '${scenarioId}' not found.`);
    }

    // Process each document in the scenario
    for (const doc of scenario.documents) {
      this.broadcast(sessionId, {
        type: "doc_uploaded",
        sessionId,
        payload: {
          fileName: doc.fileName,
          docType: doc.docType,
          previewUrl: `demo://${doc.fileName}`,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 350));

      this.broadcast(sessionId, {
        type: "extraction_started",
        sessionId,
        payload: { docType: doc.docType, status: `Reading ${doc.fileName}...` },
      });

      await new Promise((resolve) => setTimeout(resolve, 350));

      // Save document in DB with tamper evaluation
      const tamperResult = await analyzeDocumentTampering(
        `demo://${doc.fileName}`,
        doc.docType as any,
        "image/jpeg",
        apiKey
      );

      const docRecord = await prisma.document.create({
        data: {
          sessionId,
          docType: doc.docType,
          rawFileUrl: `demo://${doc.fileName}`,
          extractedFields: JSON.stringify(doc.extractedFields),
          extractionConfidence: doc.confidence,
          tamperRisk: tamperResult.tamperRisk,
          tamperFlags: JSON.stringify(tamperResult.flaggedRegions),
          tamperSummary: tamperResult.summary,
        },
      });

      const isTamperFail = tamperResult.tamperRisk === "high" || tamperResult.tamperRisk === "medium";
      await prisma.verificationCheck.create({
        data: {
          sessionId,
          checkType: "tamper_consistency",
          result: isTamperFail ? "fail" : "pass",
          detail: tamperResult.summary,
          evidence: JSON.stringify({
            docType: doc.docType,
            tamperRisk: tamperResult.tamperRisk,
            flaggedRegions: tamperResult.flaggedRegions,
            summary: tamperResult.summary,
          }),
        },
      });

      this.broadcast(sessionId, {
        type: "check_update",
        sessionId,
        checkType: "tamper_consistency",
        result: isTamperFail ? "fail" : "pass",
        detail: tamperResult.summary,
        evidence: {
          docType: doc.docType,
          tamperRisk: tamperResult.tamperRisk,
          flaggedRegions: tamperResult.flaggedRegions,
        },
        payload: {
          documentId: docRecord.id,
          docType: doc.docType,
          tamperRisk: tamperResult.tamperRisk,
          flaggedRegions: tamperResult.flaggedRegions,
          tamperSummary: tamperResult.summary,
        },
      });

      this.broadcast(sessionId, {
        type: "extraction_update",
        sessionId,
        payload: {
          docType: doc.docType,
          fields: doc.extractedFields,
          confidence: doc.confidence,
          confidenceBreakdown: doc.confidenceBreakdown,
          rawTextPreview: doc.rawTextPreview,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    // Now run all verification checks
    await new Promise((resolve) => setTimeout(resolve, 400));
    return await this.evaluateSessionChecks(sessionId, apiKey);
  }
}

export const orchestrator = new VerificationOrchestrator();
