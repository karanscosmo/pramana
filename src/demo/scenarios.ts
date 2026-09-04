import { DocType } from "../types/index.js";

export interface DemoDocumentPayload {
  docType: DocType;
  fileName: string;
  extractedFields: Record<string, any>;
  confidence: number;
  confidenceBreakdown?: {
    fieldCompleteness: number;
    visualQuality: number;
    structuralIntegrity: number;
  };
  rawTextPreview: string;
}

export interface DemoScenario {
  id: string;
  title: string;
  badge: "pass" | "tampered_gstin" | "pan_mismatch" | "fake_ifsc" | "name_divergence" | "low_confidence";
  description: string;
  expectedResult: "verified" | "flagged" | "insufficient_documents";
  flagReason?: string;
  documents: DemoDocumentPayload[];
}

export const DEMO_SCENARIOS: Record<string, DemoScenario> = {
  "clean-pass": {
    id: "clean-pass",
    title: "1. Clean Pass — Verified Enterprise",
    badge: "pass",
    description: "Flawless document bundle. Valid Mod-36 GSTIN checksum, embedded PAN strictly matches PAN card, real live HDFC IFSC verified via Razorpay API, semantic name match passes.",
    expectedResult: "verified",
    documents: [
      {
        docType: "gst_certificate",
        fileName: "gst_certificate_acme.pdf",
        extractedFields: {
          gstin: "27AAPFU0939F1ZV",
          legalBusinessName: "Acme Infotech Private Limited",
          tradeName: "Acme Tech Solutions",
          address: "Unit 401, Tech Park, MIDC Andheri East, Mumbai 400069",
          dateOfRegistration: "15/07/2018",
        },
        confidence: 0.98,
        confidenceBreakdown: { fieldCompleteness: 1.0, visualQuality: 0.96, structuralIntegrity: 0.99 },
        rawTextPreview: "FORM GST REG-06 - REGISTRATION CERTIFICATE - GSTIN: 27AAPFU0939F1ZV - ACME INFOTECH PRIVATE LIMITED",
      },
      {
        docType: "pan_card",
        fileName: "pan_card_acme.jpg",
        extractedFields: {
          panNumber: "AAPFU0939F",
          name: "Acme Infotech Private Limited",
          dateOfBirth: "12/03/2016",
        },
        confidence: 0.97,
        confidenceBreakdown: { fieldCompleteness: 1.0, visualQuality: 0.95, structuralIntegrity: 0.98 },
        rawTextPreview: "INCOME TAX DEPARTMENT - GOVT OF INDIA - PERMANENT ACCOUNT NUMBER: AAPFU0939F",
      },
      {
        docType: "cancelled_cheque",
        fileName: "cancelled_cheque_hdfc.png",
        extractedFields: {
          accountHolderName: "Acme Infotech Pvt Ltd",
          accountNumber: "50200012345678",
          ifsc: "HDFC0000060",
          bankName: "HDFC Bank",
        },
        confidence: 0.96,
        confidenceBreakdown: { fieldCompleteness: 0.98, visualQuality: 0.94, structuralIntegrity: 0.96 },
        rawTextPreview: "HDFC BANK - FORT BRANCH - IFSC: HDFC0000060 - A/C NO: 50200012345678 - ACME INFOTECH PVT LTD",
      },
    ],
  },

  "tampered-gstin": {
    id: "tampered-gstin",
    title: "2. Tampered GSTIN — Mod-36 Checksum Failure",
    badge: "tampered_gstin",
    description: "The 15th digit of the GSTIN has been modified from 'V' to '9'. Caught offline by the mathematical Mod-36 checksum algorithm without needing external APIs.",
    expectedResult: "flagged",
    flagReason: "GSTIN checksum mismatch: 15th digit is '9', but Mod-36 calculates 'V'.",
    documents: [
      {
        docType: "gst_certificate",
        fileName: "gst_forged_checksum.pdf",
        extractedFields: {
          gstin: "27AAPFU0939F1Z9", // Tampered 15th digit ('9' instead of 'V')
          legalBusinessName: "Apex Logistics Private Limited",
          tradeName: "Apex Express",
          address: "Sector 18, Gurugram, Haryana 122008",
          dateOfRegistration: "04/11/2020",
        },
        confidence: 0.94,
        confidenceBreakdown: { fieldCompleteness: 0.95, visualQuality: 0.92, structuralIntegrity: 0.95 },
        rawTextPreview: "REGISTRATION CERTIFICATE - GSTIN: 27AAPFU0939F1Z9 (ALTERED DIGIT)",
      },
      {
        docType: "pan_card",
        fileName: "pan_card_apex.jpg",
        extractedFields: {
          panNumber: "AAPFU0939F",
          name: "Apex Logistics Private Limited",
          dateOfBirth: "20/08/2019",
        },
        confidence: 0.97,
        confidenceBreakdown: { fieldCompleteness: 1.0, visualQuality: 0.96, structuralIntegrity: 0.97 },
        rawTextPreview: "INCOME TAX DEPARTMENT - PAN CARD: AAPFU0939F - APEX LOGISTICS PRIVATE LIMITED",
      },
      {
        docType: "cancelled_cheque",
        fileName: "cheque_icici.png",
        extractedFields: {
          accountHolderName: "Apex Logistics Pvt Ltd",
          accountNumber: "000405001234",
          ifsc: "ICIC0000004",
          bankName: "ICICI Bank",
        },
        confidence: 0.95,
        confidenceBreakdown: { fieldCompleteness: 0.95, visualQuality: 0.93, structuralIntegrity: 0.96 },
        rawTextPreview: "ICICI BANK - NARIMAN POINT - IFSC: ICIC0000004 - APEX LOGISTICS PVT LTD",
      },
    ],
  },

  "pan-mismatch": {
    id: "pan-mismatch",
    title: "3. Identity Mismatch — Standalone PAN ≠ GSTIN PAN",
    badge: "pan_mismatch",
    description: "Applicant uploaded a GST certificate belonging to one business and a PAN card belonging to a completely different company. Caught deterministically by extracting chars 3–12 of the GSTIN.",
    expectedResult: "flagged",
    flagReason: "GSTIN embedded PAN 'AAPFU0939F' does not match uploaded PAN 'BBBPK4321Z'.",
    documents: [
      {
        docType: "gst_certificate",
        fileName: "gst_certificate_entity_a.pdf",
        extractedFields: {
          gstin: "27AAPFU0939F1ZV", // Embedded PAN is AAPFU0939F
          legalBusinessName: "Acme Infotech Private Limited",
          tradeName: "Acme Tech",
          address: "Mumbai, Maharashtra",
          dateOfRegistration: "10/01/2017",
        },
        confidence: 0.98,
        confidenceBreakdown: { fieldCompleteness: 1.0, visualQuality: 0.98, structuralIntegrity: 0.99 },
        rawTextPreview: "FORM GST REG-06 - GSTIN: 27AAPFU0939F1ZV",
      },
      {
        docType: "pan_card",
        fileName: "pan_card_entity_b.jpg",
        extractedFields: {
          panNumber: "BBBPK4321Z", // Completely different PAN!
          name: "Vanguard Global Trading Private Limited",
          dateOfBirth: "05/09/2021",
        },
        confidence: 0.97,
        confidenceBreakdown: { fieldCompleteness: 1.0, visualQuality: 0.96, structuralIntegrity: 0.98 },
        rawTextPreview: "INCOME TAX DEPARTMENT - PAN CARD: BBBPK4321Z - VANGUARD GLOBAL TRADING PVT LTD",
      },
      {
        docType: "cancelled_cheque",
        fileName: "cheque_sbi.png",
        extractedFields: {
          accountHolderName: "Acme Infotech Pvt Ltd",
          accountNumber: "20100456789",
          ifsc: "SBIN0000691",
          bankName: "State Bank of India",
        },
        confidence: 0.95,
        confidenceBreakdown: { fieldCompleteness: 0.96, visualQuality: 0.94, structuralIntegrity: 0.95 },
        rawTextPreview: "STATE BANK OF INDIA - MUMBAI MAIN - IFSC: SBIN0000691",
      },
    ],
  },

  "fake-ifsc": {
    id: "fake-ifsc",
    title: "4. Fraudulent Routing — Non-Existent IFSC in Live Registry",
    badge: "fake_ifsc",
    description: "Applicant provided a forged cancelled cheque with an invented routing code 'FAKB0009999'. Real-time query to https://ifsc.razorpay.com/FAKB0009999 returns HTTP 404, triggering a hard flag.",
    expectedResult: "flagged",
    flagReason: "IFSC 'FAKB0009999' not found in RBI clearing directory (HTTP 404 from live registry).",
    documents: [
      {
        docType: "gst_certificate",
        fileName: "gst_certificate_genuine.pdf",
        extractedFields: {
          gstin: "27AAPFU0939F1ZV",
          legalBusinessName: "Acme Infotech Private Limited",
          tradeName: "Acme Tech",
          address: "Andheri East, Mumbai",
          dateOfRegistration: "15/07/2018",
        },
        confidence: 0.98,
        confidenceBreakdown: { fieldCompleteness: 1.0, visualQuality: 0.97, structuralIntegrity: 0.99 },
        rawTextPreview: "FORM GST REG-06 - GSTIN: 27AAPFU0939F1ZV",
      },
      {
        docType: "pan_card",
        fileName: "pan_card_genuine.jpg",
        extractedFields: {
          panNumber: "AAPFU0939F",
          name: "Acme Infotech Private Limited",
          dateOfBirth: "12/03/2016",
        },
        confidence: 0.97,
        confidenceBreakdown: { fieldCompleteness: 1.0, visualQuality: 0.96, structuralIntegrity: 0.97 },
        rawTextPreview: "PERMANENT ACCOUNT NUMBER: AAPFU0939F",
      },
      {
        docType: "cancelled_cheque",
        fileName: "forged_cheque_fake_ifsc.png",
        extractedFields: {
          accountHolderName: "Acme Infotech Private Limited",
          accountNumber: "998877665544",
          ifsc: "FAKB0009999", // Non-existent IFSC code
          bankName: "First National Trust Bank",
        },
        confidence: 0.92,
        confidenceBreakdown: { fieldCompleteness: 0.95, visualQuality: 0.88, structuralIntegrity: 0.93 },
        rawTextPreview: "FORGED CHEQUE - INVENTED IFSC: FAKB0009999",
      },
    ],
  },

  "name-divergence": {
    id: "name-divergence",
    title: "5. Entity Name Divergence — Cross-Document Semantic Mismatch",
    badge: "name_divergence",
    description: "PAN and GST belong to 'Matrix Cloud Technologies Pvt Ltd', but the bank cheque belongs to 'Ramesh Kumar Personal Services'. Caught by the semantic name cross-match agent.",
    expectedResult: "flagged",
    flagReason: "Legal name on bank account differs fundamentally from registered corporate entity on GST and PAN.",
    documents: [
      {
        docType: "gst_certificate",
        fileName: "gst_matrix.pdf",
        extractedFields: {
          gstin: "27AAPFU0939F1ZV",
          legalBusinessName: "Matrix Cloud Technologies Private Limited",
          tradeName: "Matrix Cloud",
          address: "Bandra Kurla Complex, Mumbai",
          dateOfRegistration: "01/04/2019",
        },
        confidence: 0.98,
        confidenceBreakdown: { fieldCompleteness: 1.0, visualQuality: 0.97, structuralIntegrity: 0.99 },
        rawTextPreview: "FORM GST REG-06 - MATRIX CLOUD TECHNOLOGIES PRIVATE LIMITED",
      },
      {
        docType: "pan_card",
        fileName: "pan_matrix.jpg",
        extractedFields: {
          panNumber: "AAPFU0939F",
          name: "Matrix Cloud Technologies Private Limited",
          dateOfBirth: "14/02/2018",
        },
        confidence: 0.97,
        confidenceBreakdown: { fieldCompleteness: 1.0, visualQuality: 0.96, structuralIntegrity: 0.98 },
        rawTextPreview: "INCOME TAX DEPARTMENT - MATRIX CLOUD TECHNOLOGIES PRIVATE LIMITED",
      },
      {
        docType: "cancelled_cheque",
        fileName: "cheque_unrelated.png",
        extractedFields: {
          accountHolderName: "Ramesh Kumar Personal Services",
          accountNumber: "102030405060",
          ifsc: "HDFC0000060",
          bankName: "HDFC Bank",
        },
        confidence: 0.96,
        confidenceBreakdown: { fieldCompleteness: 0.98, visualQuality: 0.94, structuralIntegrity: 0.96 },
        rawTextPreview: "HDFC BANK - A/C: 102030405060 - RAMESH KUMAR PERSONAL SERVICES",
      },
    ],
  },

  "low-confidence": {
    id: "low-confidence",
    title: "6. Honest OCR Degradation — Low Confidence Alert",
    badge: "low_confidence",
    description: "Bad scan with smudged ink and glare. Rather than asserting a confident wrong answer, Nirnay surfaces extractionConfidence (0.48) and flags document as insufficient.",
    expectedResult: "insufficient_documents",
    flagReason: "Document visual quality below 0.70 threshold. Manual re-upload requested.",
    documents: [
      {
        docType: "cancelled_cheque",
        fileName: "blurry_waterdamaged_cheque.jpg",
        extractedFields: {
          accountHolderName: "Acme In???ech ??? Ltd",
          accountNumber: "5020001???????",
          ifsc: "HDFC0000060",
          bankName: "HDFC Bank",
        },
        confidence: 0.48,
        confidenceBreakdown: { fieldCompleteness: 0.52, visualQuality: 0.38, structuralIntegrity: 0.54 },
        rawTextPreview: "HDFC B??? - [SMUDGED INK] - [WATER DAMAGE OBSCURED]",
      },
    ],
  },
};
