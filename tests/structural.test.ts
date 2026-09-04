import test from "node:test";
import assert from "node:assert/strict";
import {
  computeGstinCheckDigit,
  validateGstinChecksum,
  validateGstinPanMatch,
  validatePanFormat,
} from "../src/agents/structuralAgent.js";

test("Structural Agent - GSTIN Mod-36 Checksum", async (t) => {
  await t.test("computes correct check digit for valid GSTIN 27AAACT2727Q1ZW (Tata Motors)", () => {
    const { expectedCheckChar } = computeGstinCheckDigit("27AAACT2727Q1Z");
    assert.equal(expectedCheckChar, "W");
  });

  await t.test("computes correct check digit for valid GSTIN 27AAPFU0939F1ZV", () => {
    const { expectedCheckChar } = computeGstinCheckDigit("27AAPFU0939F1Z");
    assert.equal(expectedCheckChar, "V");
  });

  await t.test("validates genuine GSTIN 27AAACT2727Q1ZW with pass verdict", () => {
    const res = validateGstinChecksum("27AAACT2727Q1ZW");
    assert.equal(res.result, "pass");
    assert.equal(res.checkType, "gstin_checksum");
    assert.equal(res.evidence.actual15thChar, "W");
    assert.equal(res.evidence.expected15thChar, "W");
  });

  await t.test("catches tampered 15th digit with fail verdict", () => {
    // Tampered from 'W' to '9'
    const res = validateGstinChecksum("27AAACT2727Q1Z9");
    assert.equal(res.result, "fail");
    assert.equal(res.checkType, "gstin_checksum");
    assert.equal(res.evidence.actual15thChar, "9");
    assert.equal(res.evidence.expected15thChar, "W");
    assert.match(res.detail, /Potential forgery or typo/);
  });

  await t.test("rejects malformed GSTIN length", () => {
    const res = validateGstinChecksum("27AAACL9472L1");
    assert.equal(res.result, "fail");
    assert.equal(res.evidence.length, 13);
  });
});

test("Structural Agent - GSTIN ⇄ PAN Match", async (t) => {
  await t.test("passes when GSTIN chars 3-12 match standalone PAN", () => {
    const res = validateGstinPanMatch("27AAACL9472L1Z5", "AAACL9472L");
    assert.equal(res.result, "pass");
    assert.equal(res.evidence.matched, true);
    assert.equal(res.evidence.extractedPanFromGstin, "AAACL9472L");
    assert.equal(res.evidence.standalonePan, "AAACL9472L");
  });

  await t.test("fails when GSTIN embedded PAN diverges from standalone PAN", () => {
    const res = validateGstinPanMatch("27AAACL9472L1Z5", "BBBPK1234F");
    assert.equal(res.result, "fail");
    assert.equal(res.evidence.matched, false);
    assert.equal(res.evidence.extractedPanFromGstin, "AAACL9472L");
    assert.equal(res.evidence.standalonePan, "BBBPK1234F");
    assert.match(res.detail, /Registration documents belong to different entities/);
  });
});

test("Structural Agent - PAN Format & Entity Parsing", async (t) => {
  await t.test("validates genuine company PAN and identifies entity type", () => {
    const res = validatePanFormat("AAACL9472L");
    assert.equal(res.result, "pass");
    assert.equal(res.evidence.isValid, true);
    assert.equal(res.evidence.entityCode, "C");
    assert.match(res.evidence.entityDescription, /Company/);
  });

  await t.test("validates individual PAN", () => {
    const res = validatePanFormat("ABCDE1234F");
    assert.equal(res.result, "pass");
    assert.equal(res.evidence.entityCode, "D"); // Individual or specific
  });

  await t.test("fails invalid PAN syntax", () => {
    const res = validatePanFormat("INVALID_PAN");
    assert.equal(res.result, "fail");
    assert.equal(res.evidence.isValid, false);
  });
});
