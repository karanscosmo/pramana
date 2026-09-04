import Anthropic from "@anthropic-ai/sdk";

export interface SessionEvidenceContext {
  sessionId: string;
  overallResult: string | null;
  documents: Array<{
    id: string;
    docType: string;
    rawFileUrl: string;
    extractedFields: any;
    extractionConfidence: number;
    tamperRisk?: string | null;
    tamperFlags?: any;
    tamperSummary?: string | null;
  }>;
  checks: Array<{
    id: string;
    checkType: string;
    result: string;
    detail: string;
    evidence: any;
  }>;
}

/**
 * Stage 6: Underwriter Narrative Agent
 * Synthesizes all prior stages (extraction, tamper checks, structural, registry lookup, name match)
 * into a single cohesive, plain-language memo written from the perspective of a seasoned risk underwriter.
 */
export async function generateUnderwriterNarrative(
  context: SessionEvidenceContext,
  apiKey?: string
): Promise<string> {
  // If Anthropic API key is present, generate with Claude 3.5 Sonnet
  if (apiKey) {
    try {
      return await generateNarrativeWithClaude(context, apiKey);
    } catch (err: any) {
      console.warn("Claude Underwriter Narrative synthesis fallback:", err.message);
    }
  }

  // Deterministic Expert Underwriter Narrative Engine (Grounded, direct, 0% hallucination)
  return synthesizeDeterministicNarrative(context);
}

/**
 * Invokes Claude 3.5 Sonnet to craft the underwriter memorandum.
 */
async function generateNarrativeWithClaude(
  context: SessionEvidenceContext,
  apiKey: string
): Promise<string> {
  const anthropic = new Anthropic({ apiKey });

  const summaryData = {
    sessionId: context.sessionId,
    overallResult: context.overallResult,
    documents: context.documents.map((d) => ({
      docType: d.docType,
      extractionConfidence: `${Math.round(d.extractionConfidence * 100)}%`,
      tamperRisk: d.tamperRisk || "low",
      tamperSummary: d.tamperSummary,
      tamperFlags: d.tamperFlags,
      fields: typeof d.extractedFields === "string" ? tryParseJson(d.extractedFields) : d.extractedFields,
    })),
    checks: context.checks.map((c) => ({
      checkType: c.checkType,
      result: c.result,
      detail: c.detail,
      evidence: typeof c.evidence === "string" ? tryParseJson(c.evidence) : c.evidence,
    })),
  };

  const prompt = `You are a Senior Fintech KYB Credit & Risk Underwriter reviewing a merchant onboarding application.
Write a concise, 3 to 5 sentence plain-language memorandum summarizing this applicant file for a human risk officer.

CRITICAL RULES:
1. Write like an experienced underwriter explaining a file to a colleague, NOT like a software system emitting status codes.
2. IF ANY DOCUMENT HAS A TAMPER FLAG (medium or high risk), YOU MUST LEAD WITH THAT IN THE FIRST SENTENCE — digital editing is the most consequential finding.
3. Be direct and specific: cite actual numbers, compared strings, bank branch names, or mismatched characters (e.g. mention the exact PAN, GSTIN, or IFSC).
4. Clearly distinguish between hard fraud (forged checksum, altered typography, wrong PAN owner) and benign discrepancies (spelling variations, branch naming prefixes).
5. Conclude with an unambiguous risk recommendation (Approve, Reject, or Conditional Approval with specific manual step).

AUDIT EVIDENCE RECORD:
${JSON.stringify(summaryData, null, 2)}`;

  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (textBlock && textBlock.text) {
    return textBlock.text.trim();
  }

  throw new Error("Empty response from Claude narrative agent");
}

/**
 * Deterministic Underwriter Narrative Synthesizer
 */
function synthesizeDeterministicNarrative(context: SessionEvidenceContext): string {
  const sentences: string[] = [];

  // 1. Check for Tamper-Consistency Flags across all documents
  const tamperedDocs = context.documents.filter(
    (d) => d.tamperRisk === "high" || d.tamperRisk === "medium"
  );

  if (tamperedDocs.length > 0) {
    const docNames = tamperedDocs.map((d) => formatDocTitle(d.docType)).join(" and ");
    const primaryReason = tamperedDocs[0].tamperSummary || "digital editing artifacts detected";
    sentences.push(
      `CRITICAL TAMPER WARNING: Forensic analysis flagged suspicious digital modification on ${docNames} (${primaryReason}).`
    );
  }

  // 2. Identify key checks and results
  const checks = context.checks || [];
  const gstinPanCheck = checks.find((c) => c.checkType === "gstin_pan_match");
  const gstinChecksumCheck = checks.find((c) => c.checkType === "gstin_checksum");
  const ifscCheck = checks.find((c) => c.checkType === "ifsc_lookup");
  const nameCheck = checks.find((c) => c.checkType === "name_cross_match");
  const panFormatCheck = checks.find((c) => c.checkType === "pan_format");

  const passedChecks = checks.filter((c) => c.result === "pass");
  const failedChecks = checks.filter((c) => c.result === "fail");

  // Document Overview
  const docCount = context.documents.length;
  if (tamperedDocs.length === 0) {
    sentences.push(
      `This onboarding file contains ${docCount} uploaded business document${docCount > 1 ? "s" : ""} evaluated across statutory registers and bank clearing networks.`
    );
  }

  // 3. Structural & Statutory findings
  if (gstinChecksumCheck && gstinChecksumCheck.result === "fail") {
    const ev = typeof gstinChecksumCheck.evidence === "string" ? tryParseJson(gstinChecksumCheck.evidence) : gstinChecksumCheck.evidence;
    sentences.push(
      `The GST Certificate failed the official ISO/IEC 7064 Modulo-36 checksum with character '${ev?.actual15thChar}' instead of mathematical check digit '${ev?.expected15thChar}', indicating a fabricated or modified GSTIN.`
    );
  } else if (gstinChecksumCheck && gstinChecksumCheck.result === "pass") {
    sentences.push(`Statutory GSTIN checksum integrity verified cleanly against Modulo-36 rules.`);
  }

  if (gstinPanCheck && gstinPanCheck.result === "fail") {
    const ev = typeof gstinPanCheck.evidence === "string" ? tryParseJson(gstinPanCheck.evidence) : gstinPanCheck.evidence;
    sentences.push(
      `Major identity discrepancy caught: PAN extracted from GST registration (${ev?.extractedPanFromGstin || "N/A"}) does not match the submitted PAN card (${ev?.standalonePan || "N/A"}), pointing to an unrelated third-party entity.`
    );
  }

  // 4. Banking Clearing Check
  if (ifscCheck) {
    const ev = typeof ifscCheck.evidence === "string" ? tryParseJson(ifscCheck.evidence) : ifscCheck.evidence;
    if (ifscCheck.result === "pass") {
      sentences.push(
        `Banking credentials confirmed live against the Razorpay registry for ${ev?.registryBank || "the institution"} (${ev?.branch || "branch"} / ${ev?.city || "clearing node"}), supporting immediate UPI and RTGS fund settlement.`
      );
    } else if (ifscCheck.result === "fail") {
      sentences.push(
        `Bank clearing verification failed: the submitted IFSC code was rejected with HTTP 404 by the live routing directory, indicating a non-existent or decommissioned bank branch.`
      );
    }
  }

  // 5. Name alignment
  if (nameCheck && nameCheck.result === "fail") {
    sentences.push(
      `Cross-document name alignment flagged noticeable spelling variation between registered legal entity styles, warranting human confirmation of trade style authorization.`
    );
  }

  // 6. Concluding Underwriter Verdict
  if (tamperedDocs.length > 0 || failedChecks.length > 0) {
    const issuesTotal = tamperedDocs.length + failedChecks.length;
    sentences.push(
      `Underwriting Recommendation: REJECT OR ESCALATE. File exhibits ${issuesTotal} substantive compliance defect${issuesTotal > 1 ? "s" : ""}; automated straight-through onboarding halted pending forensic clarification.`
    );
  } else {
    sentences.push(
      `Underwriting Recommendation: APPROVE FOR SETTLEMENT. All entity identifiers, statutory checksums, and banking credentials cross-verify with zero discrepancies across ${passedChecks.length} verification checks.`
    );
  }

  return sentences.join(" ");
}

function formatDocTitle(docType: string): string {
  const map: Record<string, string> = {
    gst_certificate: "GST Certificate",
    pan_card: "PAN Card",
    cancelled_cheque: "Cancelled Cheque",
    bank_proof: "Bank Proof",
  };
  return map[docType] || docType.replace("_", " ").toUpperCase();
}

function tryParseJson(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}
