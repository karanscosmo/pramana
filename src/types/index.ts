export type DocType = "gst_certificate" | "pan_card" | "cancelled_cheque" | "bank_proof";

export type CheckType =
  | "gstin_pan_match"
  | "gstin_checksum"
  | "pan_format"
  | "ifsc_lookup"
  | "name_cross_match"
  | "tamper_consistency";

export type CheckResult = "pass" | "fail" | "inconclusive";

export type SessionStatus = "PROCESSING" | "COMPLETE";

export type OverallResult = "verified" | "flagged" | "insufficient_documents";

export type TamperRisk = "low" | "medium" | "high";

export interface FlaggedRegion {
  field: string;
  reason: string;
}

export interface TamperOutput {
  tamperRisk: TamperRisk;
  flaggedRegions: FlaggedRegion[];
  summary: string;
}

export interface GstFields {
  gstin: string;
  legalBusinessName: string;
  tradeName?: string;
  address?: string;
  dateOfRegistration?: string;
}

export interface PanFields {
  panNumber: string;
  name: string;
  dateOfBirth?: string;
  businessName?: string;
}

export interface ChequeFields {
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
}

export type ExtractedFields = GstFields | PanFields | ChequeFields | Record<string, any>;

export interface ExtractionOutput {
  docType: DocType;
  fields: ExtractedFields;
  confidence: number;
  rawTextPreview?: string;
  confidenceBreakdown?: {
    fieldCompleteness: number;
    visualQuality: number;
    structuralIntegrity: number;
  };
}

export interface CheckOutput {
  checkType: CheckType;
  result: CheckResult;
  detail: string;
  evidence: Record<string, any>;
}

export interface SSEMessage {
  type:
    | "session_created"
    | "doc_uploaded"
    | "extraction_started"
    | "extraction_update"
    | "check_started"
    | "check_update"
    | "narrative_ready"
    | "session_complete"
    | "error";
  sessionId: string;
  payload?: any;
  checkType?: CheckType;
  result?: CheckResult;
  detail?: string;
  evidence?: Record<string, any>;
  narrative?: string;
}
