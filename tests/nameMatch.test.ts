import test from "node:test";
import assert from "node:assert/strict";
import {
  computeNameSimilarity,
  matchNamesAcrossDocuments,
  normalizeEntityName,
} from "../src/agents/nameMatchAgent.js";

test("Cross-Document Name Match Agent", async (t) => {
  await t.test("matches identical entity names with different legal suffixes", () => {
    const res = computeNameSimilarity(
      "Acme Infotech Private Limited",
      "Acme Infotech Pvt Ltd"
    );
    assert.equal(res.judgment, "match");
    assert.ok(res.score >= 0.9);
  });

  await t.test("catches completely different legal entities", () => {
    const res = computeNameSimilarity(
      "Acme Infotech Private Limited",
      "Ramesh Kumar Personal Services"
    );
    assert.equal(res.judgment, "mismatch");
    assert.ok(res.score < 0.3);
  });

  await t.test("normalizes entity suffixes", () => {
    assert.equal(
      normalizeEntityName("Tata Consultancy Services Private Limited"),
      "TATA CONSULTANCY SERVICES PVT LTD"
    );
  });

  await t.test("evaluates cross-document list of 3 documents with matching names", async () => {
    const names = [
      { docType: "GST Certificate", sourceField: "legalBusinessName", name: "Acme Infotech Private Limited" },
      { docType: "PAN Card", sourceField: "name", name: "Acme Infotech Private Limited" },
      { docType: "Cancelled Cheque", sourceField: "accountHolderName", name: "Acme Infotech Pvt Ltd" },
    ];

    const res = await matchNamesAcrossDocuments(names);
    assert.equal(res.checkType, "name_cross_match");
    assert.equal(res.result, "pass");
    assert.equal(res.evidence.comparisons.length, 3);
  });

  await t.test("flags cross-document list when cheque belongs to another entity", async () => {
    const names = [
      { docType: "GST Certificate", sourceField: "legalBusinessName", name: "Acme Infotech Private Limited" },
      { docType: "PAN Card", sourceField: "name", name: "Acme Infotech Private Limited" },
      { docType: "Cancelled Cheque", sourceField: "accountHolderName", name: "Apex Global Traders" },
    ];

    const res = await matchNamesAcrossDocuments(names);
    assert.equal(res.checkType, "name_cross_match");
    assert.equal(res.result, "fail");
  });
});
