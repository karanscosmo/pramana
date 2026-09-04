import test from "node:test";
import assert from "node:assert/strict";
import { verifyIfscCode, normalizeBankName } from "../src/agents/externalAgent.js";

test("External Verification Agent - Live Razorpay IFSC Registry", async (t) => {
  await t.test("verifies genuine HDFC IFSC code against live public registry", async () => {
    // Live call to https://ifsc.razorpay.com/HDFC0000060
    const res = await verifyIfscCode("HDFC0000060", "HDFC Bank");
    assert.equal(res.checkType, "ifsc_lookup");
    assert.equal(res.result, "pass");
    assert.equal(res.evidence.ifsc, "HDFC0000060");
    assert.match(res.evidence.registryBank, /HDFC/i);
    assert.equal(res.evidence.bankNameMatched, true);
    assert.equal(res.evidence.statusCode, 200);
  });

  await t.test("catches non-existent / fake IFSC code with HTTP 404 hard flag", async () => {
    // Live call to https://ifsc.razorpay.com/FAKB0009999 (Non-existent)
    const res = await verifyIfscCode("FAKB0009999", "Fake Bank");
    assert.equal(res.checkType, "ifsc_lookup");
    assert.equal(res.result, "fail");
    assert.equal(res.evidence.statusCode, 404);
    assert.match(res.detail, /does not exist in the official RBI routing registry/);
  });

  await t.test("detects mismatch between valid routing bank and claimed bank on cheque", async () => {
    // Genuine SBI IFSC, but cheque claims to be HDFC Bank
    const res = await verifyIfscCode("SBIN0000691", "HDFC Bank");
    assert.equal(res.checkType, "ifsc_lookup");
    assert.equal(res.result, "fail");
    assert.equal(res.evidence.bankNameMatched, false);
    assert.match(res.detail, /does NOT match the claimed bank/);
  });

  await t.test("normalizes bank names for comparison", () => {
    assert.equal(normalizeBankName("HDFC Bank Limited"), "hdfc");
    assert.equal(normalizeBankName("STATE BANK OF INDIA"), "state of india");
    assert.equal(normalizeBankName("SBI"), "state bank of india");
  });
});
