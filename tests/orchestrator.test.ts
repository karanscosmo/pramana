import test from "node:test";
import assert from "node:assert/strict";
import { prisma, initDb } from "../src/db.js";
import { orchestrator } from "../src/orchestrator.js";

test("Orchestrator End-to-End Pipeline", async (t) => {
  await initDb();

  await t.test("executes Clean Pass scenario -> overallResult: 'verified'", async () => {
    const session = await prisma.verificationSession.create({
      data: { status: "PROCESSING" },
    });

    const events: any[] = [];
    // Mock response stream to record SSE events
    const mockRes: any = {
      write: (data: string) => {
        if (data.startsWith("data: ")) {
          try {
            events.push(JSON.parse(data.replace("data: ", "").trim()));
          } catch {}
        }
      },
      on: () => {},
    };

    orchestrator.registerSseClient(session.id, mockRes);

    const result = await orchestrator.runDemoScenario(session.id, "clean-pass");
    assert.equal(result.overallResult, "verified");

    // Fetch updated session from database
    const updated = await prisma.verificationSession.findUnique({
      where: { id: session.id },
      include: { checks: true, documents: true },
    });

    assert.equal(updated?.status, "COMPLETE");
    assert.equal(updated?.overallResult, "verified");
    assert.equal(updated?.documents.length, 3);
    assert.ok(updated?.checks.length >= 4);

    // Verify all checks passed
    for (const check of updated.checks) {
      assert.equal(check.result, "pass", `Check ${check.checkType} should pass`);
    }

    // Check that check_update and session_complete events were broadcast
    const checkUpdates = events.filter((e) => e.type === "check_update");
    assert.ok(checkUpdates.length >= 4);
    const completeEvent = events.find((e) => e.type === "session_complete");
    assert.ok(completeEvent);
    assert.equal(completeEvent.payload.overallResult, "verified");
  });

  await t.test("executes Tampered GSTIN scenario -> flags session with gstin_checksum failure", async () => {
    const session = await prisma.verificationSession.create({
      data: { status: "PROCESSING" },
    });

    const result = await orchestrator.runDemoScenario(session.id, "tampered-gstin");
    assert.equal(result.overallResult, "flagged");

    const failedCheck = result.executedChecks.find((c) => c.checkType === "gstin_checksum");
    assert.ok(failedCheck);
    assert.equal(failedCheck.result, "fail");
    assert.equal(failedCheck.evidence.actual15thChar, "9");
    assert.equal(failedCheck.evidence.expected15thChar, "V");
  });

  await t.test("executes Fake IFSC scenario -> flags session with HTTP 404 registry evidence", async () => {
    const session = await prisma.verificationSession.create({
      data: { status: "PROCESSING" },
    });

    const result = await orchestrator.runDemoScenario(session.id, "fake-ifsc");
    assert.equal(result.overallResult, "flagged");

    const ifscCheck = result.executedChecks.find((c) => c.checkType === "ifsc_lookup");
    assert.ok(ifscCheck);
    assert.equal(ifscCheck.result, "fail");
    assert.equal(ifscCheck.evidence.statusCode, 404);
  });

  await t.test("executes Identity Mismatch scenario -> flags session with gstin_pan_match failure", async () => {
    const session = await prisma.verificationSession.create({
      data: { status: "PROCESSING" },
    });

    const result = await orchestrator.runDemoScenario(session.id, "pan-mismatch");
    assert.equal(result.overallResult, "flagged");

    const panMatchCheck = result.executedChecks.find((c) => c.checkType === "gstin_pan_match");
    assert.ok(panMatchCheck);
    assert.equal(panMatchCheck.result, "fail");
    assert.equal(panMatchCheck.evidence.matched, false);
    assert.equal(panMatchCheck.evidence.extractedPanFromGstin, "AAPFU0939F");
    assert.equal(panMatchCheck.evidence.standalonePan, "BBBPK4321Z");
  });
});
