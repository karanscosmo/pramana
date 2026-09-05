import axios from "axios";
import { CheckOutput } from "../types/index.js";

export interface RazorpayIfscResponse {
  BANK: string;
  IFSC: string;
  BRANCH: string;
  CENTRE: string;
  DISTRICT: string;
  STATE: string;
  ADDRESS: string;
  CONTACT?: string;
  CITY: string;
  RTGS?: boolean;
  NEFT?: boolean;
  UPI?: boolean;
  MICR?: string;
}

/**
 * Normalizes bank names for resilient matching.
 * e.g., "HDFC BANK LIMITED" -> "hdfc", "ICICI BANK LTD" -> "icici", "STATE BANK OF INDIA" -> "sbi".
 */
export function normalizeBankName(name: string): string {
  if (!name) return "";
  let s = name.toLowerCase().trim();
  s = s.replace(/[\.,\-_]/g, " ");
  s = s.replace(/\b(bank|limited|ltd|pvt|co-operative|coop|the)\b/g, "");
  s = s.replace(/\s+/g, " ").trim();

  // Common Indian bank aliases
  const aliases: Record<string, string> = {
    sbi: "state bank of india",
    pnb: "punjab national bank",
    bob: "bank of baroda",
    boi: "bank of india",
    cbi: "central bank of india",
    kotak: "kotak mahindra",
    scb: "standard chartered",
  };

  for (const [abbr, full] of Object.entries(aliases)) {
    if (s === abbr) return full;
  }

  return s;
}

/**
 * Calculates a simple fuzzy similarity ratio between 0 and 1
 */
export function calculateStringSimilarity(a: string, b: string): number {
  const normA = normalizeBankName(a);
  const normB = normalizeBankName(b);

  if (normA === normB) return 1.0;
  if (!normA || !normB) return 0;

  if (normA.includes(normB) || normB.includes(normA)) {
    return 0.85;
  }

  // Token overlap
  const tokensA = new Set(normA.split(" ").filter(Boolean));
  const tokensB = new Set(normB.split(" ").filter(Boolean));
  let intersection = 0;

  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Validates an IFSC code against the live public Razorpay IFSC registry (https://ifsc.razorpay.com/:ifsc)
 * and cross-checks the registered bank against the claimed bank name on the cheque.
 */
export async function verifyIfscCode(ifsc: string, claimedBankName?: string): Promise<CheckOutput> {
  const cleanIfsc = (ifsc || "").trim().toUpperCase();

  if (!cleanIfsc || cleanIfsc.length !== 11) {
    return {
      checkType: "ifsc_lookup",
      result: "fail",
      detail: `IFSC format invalid: '${cleanIfsc}'. Expected 11 alphanumeric characters (e.g., HDFC0001234).`,
      evidence: {
        providedIfsc: cleanIfsc,
        claimedBankName: claimedBankName || "Not provided",
        length: cleanIfsc.length,
        expectedLength: 11,
      },
    };
  }

  const registryUrl = `https://ifsc.razorpay.com/${cleanIfsc}`;

  try {
    const response = await axios.get<RazorpayIfscResponse>(registryUrl, {
      timeout: 6000,
      headers: {
        Accept: "application/json",
        "User-Agent": "Pramana-KYB-Verification/1.0",
      },
    });

    if (response.status === 200 && response.data) {
      const data = response.data;
      const registryBank = data.BANK;
      const branch = data.BRANCH;
      const city = data.CITY;

      let bankNameMatched = true;
      let matchScore = 1.0;
      let bankMatchNote = "";

      if (claimedBankName) {
        matchScore = calculateStringSimilarity(claimedBankName, registryBank);
        bankNameMatched = matchScore >= 0.5;

        if (bankNameMatched) {
          bankMatchNote = ` Bank name on cheque ('${claimedBankName}') matches registry ('${registryBank}').`;
        } else {
          bankMatchNote = ` WARNING: Bank name on cheque ('${claimedBankName}') diverges from registry ('${registryBank}').`;
        }
      }

      const result = bankNameMatched ? "pass" : "fail";
      const detail =
        result === "pass"
          ? `IFSC '${cleanIfsc}' verified against live RBI registry. Bank: ${registryBank}, Branch: ${branch}, City: ${city}.${bankMatchNote}`
          : `IFSC '${cleanIfsc}' is a valid routing code for '${registryBank}' (${branch}), but does NOT match the claimed bank '${claimedBankName}' on the cheque proof.`;

      return {
        checkType: "ifsc_lookup",
        result,
        detail,
        evidence: {
          ifsc: cleanIfsc,
          registryBank,
          branch,
          city,
          district: data.DISTRICT,
          state: data.STATE,
          micr: data.MICR || null,
          upiSupported: !!data.UPI,
          rtgsSupported: !!data.RTGS,
          neftSupported: !!data.NEFT,
          claimedBankName: claimedBankName || null,
          bankNameMatched,
          matchScore: Math.round(matchScore * 100) / 100,
          apiEndpoint: registryUrl,
          statusCode: 200,
        },
      };
    }

    return {
      checkType: "ifsc_lookup",
      result: "inconclusive",
      detail: `Unexpected response status ${response.status} from Razorpay IFSC registry for code '${cleanIfsc}'.`,
      evidence: {
        ifsc: cleanIfsc,
        statusCode: response.status,
      },
    };
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      // 404 is a definitive HARD flag - the IFSC simply does not exist
      return {
        checkType: "ifsc_lookup",
        result: "fail",
        detail: `IFSC '${cleanIfsc}' does not exist in the official RBI routing registry (HTTP 404 from Razorpay API). This is a fraudulent or non-existent routing code.`,
        evidence: {
          ifsc: cleanIfsc,
          claimedBankName: claimedBankName || null,
          statusCode: 404,
          apiEndpoint: registryUrl,
          reason: "Not found in RBI database",
        },
      };
    }

    // Network timeouts or service unreachability - must be inconclusive, never faked
    const errorMessage = error.code === "ECONNABORTED" ? "Request timed out after 6000ms" : error.message;

    return {
      checkType: "ifsc_lookup",
      result: "inconclusive",
      detail: `Live IFSC registry check could not be completed: ${errorMessage}. The check is marked inconclusive for manual human review.`,
      evidence: {
        ifsc: cleanIfsc,
        claimedBankName: claimedBankName || null,
        apiEndpoint: registryUrl,
        error: errorMessage,
      },
    };
  }
}
