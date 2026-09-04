import { CheckOutput } from "../types/index.js";

const BASE36_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Computes the 15th check character of an Indian GSTIN
 * using the standard Modulo-36 check-digit algorithm.
 */
export function computeGstinCheckDigit(gstin14: string): {
  expectedCheckChar: string;
  sum: number;
  steps: Array<{ char: string; codePoint: number; factor: number; product: number; quotient: number; remainder: number }>;
} {
  const clean14 = gstin14.trim().toUpperCase().slice(0, 14);
  if (clean14.length !== 14) {
    throw new Error(`GSTIN input must have at least 14 characters to compute check digit, got: ${clean14.length}`);
  }

  let sum = 0;
  let factor = 2; // Moving right-to-left starting with factor 2 on the 14th character
  const steps = [];

  for (let i = clean14.length - 1; i >= 0; i--) {
    const char = clean14[i];
    const codePoint = BASE36_ALPHABET.indexOf(char);
    if (codePoint === -1) {
      throw new Error(`Invalid character '${char}' at index ${i} in GSTIN`);
    }

    const product = codePoint * factor;
    const quotient = Math.floor(product / 36);
    const remainder = product % 36;
    sum += quotient + remainder;

    steps.unshift({
      char,
      codePoint,
      factor,
      product,
      quotient,
      remainder,
    });

    factor = factor === 2 ? 1 : 2;
  }

  const remainder = sum % 36;
  const checkCodePoint = (36 - remainder) % 36;
  const expectedCheckChar = BASE36_ALPHABET[checkCodePoint];

  return { expectedCheckChar, sum, steps };
}

/**
 * Validates the 15th checksum character of a 15-character GSTIN.
 */
export function validateGstinChecksum(gstin: string): CheckOutput {
  const cleanGstin = gstin.trim().toUpperCase();

  if (cleanGstin.length !== 15) {
    return {
      checkType: "gstin_checksum",
      result: "fail",
      detail: `GSTIN length invalid: expected 15 characters, got ${cleanGstin.length} ('${cleanGstin}')`,
      evidence: {
        providedGstin: cleanGstin,
        length: cleanGstin.length,
        expectedLength: 15,
      },
    };
  }

  try {
    const { expectedCheckChar, sum } = computeGstinCheckDigit(cleanGstin.slice(0, 14));
    const actualCheckChar = cleanGstin[14];

    const isMatch = actualCheckChar === expectedCheckChar;

    return {
      checkType: "gstin_checksum",
      result: isMatch ? "pass" : "fail",
      detail: isMatch
        ? `GSTIN checksum verified: 15th digit '${actualCheckChar}' mathematically matches Mod-36 checksum of first 14 chars.`
        : `GSTIN checksum failure: 15th digit is '${actualCheckChar}', but mathematical Mod-36 checksum computes '${expectedCheckChar}'. Potential forgery or typo.`,
      evidence: {
        gstin: cleanGstin,
        first14Chars: cleanGstin.slice(0, 14),
        actual15thChar: actualCheckChar,
        expected15thChar: expectedCheckChar,
        modulo36Sum: sum,
        algorithm: "ISO/IEC 7064 Mod 37,36 / GST Council Modulo-36",
      },
    };
  } catch (err: any) {
    return {
      checkType: "gstin_checksum",
      result: "fail",
      detail: `GSTIN checksum calculation error: ${err.message}`,
      evidence: {
        providedGstin: cleanGstin,
        error: err.message,
      },
    };
  }
}

/**
 * Cross-checks standalone PAN against the embedded PAN (chars 3–12) of GSTIN.
 */
export function validateGstinPanMatch(gstin: string, panNumber: string): CheckOutput {
  const cleanGstin = gstin.trim().toUpperCase();
  const cleanPan = panNumber.trim().toUpperCase();

  if (cleanGstin.length < 12) {
    return {
      checkType: "gstin_pan_match",
      result: "fail",
      detail: `GSTIN '${cleanGstin}' is too short to extract embedded 10-digit PAN (requires at least 12 characters).`,
      evidence: {
        gstin: cleanGstin,
        panNumber: cleanPan,
      },
    };
  }

  // Chars 3 to 12 (0-indexed: index 2 to 12)
  const embeddedPan = cleanGstin.substring(2, 12);
  const isMatch = embeddedPan === cleanPan;

  return {
    checkType: "gstin_pan_match",
    result: isMatch ? "pass" : "fail",
    detail: isMatch
      ? `GSTIN embedded PAN '${embeddedPan}' (chars 3–12) strictly matches standalone PAN '${cleanPan}'.`
      : `GSTIN embedded PAN '${embeddedPan}' (chars 3–12) does NOT match standalone PAN '${cleanPan}'. Registration documents belong to different entities or have been tampered with.`,
    evidence: {
      gstin: cleanGstin,
      extractedPanFromGstin: embeddedPan,
      standalonePan: cleanPan,
      charIndicesCompared: "3 to 12 (substring 2..12)",
      matched: isMatch,
    },
  };
}

const PAN_ENTITY_TYPES: Record<string, string> = {
  C: "Company (Private / Public Limited)",
  P: "Individual / Proprietorship",
  H: "Hindu Undivided Family (HUF)",
  F: "Firm / Limited Liability Partnership (LLP)",
  A: "Association of Persons (AOP)",
  T: "Trust",
  B: "Body of Individuals (BOI)",
  L: "Local Authority",
  J: "Artificial Juridical Person",
  G: "Government Agency",
};

/**
 * Validates 10-character PAN syntax and parses entity type from 4th character.
 */
export function validatePanFormat(panNumber: string): CheckOutput {
  const cleanPan = panNumber.trim().toUpperCase();
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

  const isValid = panRegex.test(cleanPan);
  const entityCode = isValid ? cleanPan[3] : undefined;
  const entityDescription = entityCode ? PAN_ENTITY_TYPES[entityCode] || "Unknown Entity Type" : undefined;

  return {
    checkType: "pan_format",
    result: isValid ? "pass" : "fail",
    detail: isValid
      ? `PAN format valid ([A-Z]{5}[0-9]{4}[A-Z]{1}). 4th character '${entityCode}' designates entity as ${entityDescription}.`
      : `Invalid PAN structure: '${cleanPan}'. Expected 5 uppercase letters, 4 digits, 1 uppercase letter.`,
    evidence: {
      panNumber: cleanPan,
      pattern: "^[A-Z]{5}[0-9]{4}[A-Z]{1}$",
      entityCode,
      entityDescription,
      isValid,
    },
  };
}
