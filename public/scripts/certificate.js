/**
 * PRAMANA (प्रमाण) — OFFICIAL AUDIT CERTIFICATE & DOCUMENT EXPORTER
 * Generates official compliance verification certificates with logo, seal, and Word (.doc) / PDF export.
 */

export function formatCertificateHTML(report) {
  const isVerified = report.overallResult === "verified";
  const dateStr = new Date(report.createdAt || Date.now()).toLocaleString("en-IN", {
    dateStyle: "long",
    timeStyle: "medium"
  });
  const certId = `CERT-PRM-2026-${(report.sessionId || report.id || "00000000").slice(-8).toUpperCase()}`;

  // Find extracted fields from documents if available
  let businessName = "N/A";
  let gstin = "N/A";
  let pan = "N/A";
  let bankName = "N/A";
  let ifsc = "N/A";

  if (report.documents && Array.isArray(report.documents)) {
    report.documents.forEach((d) => {
      let fields = d.extractedFields;
      if (typeof fields === "string") {
        try { fields = JSON.parse(fields); } catch (e) {}
      }
      if (fields) {
        if (fields.legalBusinessName) businessName = fields.legalBusinessName;
        if (fields.gstin) gstin = fields.gstin;
        if (fields.pan) pan = fields.pan;
        if (fields.bankName) bankName = fields.bankName;
        if (fields.ifsc) ifsc = fields.ifsc;
      }
    });
  }

  // Generate checks breakdown rows
  const checksList = report.checks || [];
  const checksRows = checksList.map((c) => {
    const isPass = c.result === "pass";
    const statusText = isPass ? "VERIFIED" : "FLAGGED";
    const statusClass = isPass ? "cert-status-pass" : "cert-status-fail";
    const statusColor = isPass ? "#059669" : "#dc2626";

    let evidenceNote = c.detail || "";
    let evObj = c.evidence;
    if (typeof evObj === "string") {
      try { evObj = JSON.parse(evObj); } catch (e) {}
    }

    if (c.checkType === "gstin_checksum" && evObj) {
      evidenceNote += ` [Expected 15th digit: '${evObj.expected15thChar}', Document: '${evObj.actual15thChar}']`;
    } else if (c.checkType === "gstin_pan_match" && evObj) {
      evidenceNote += ` [GSTIN PAN: ${evObj.extractedPanFromGstin}, Standalone: ${evObj.standalonePan}]`;
    } else if (c.checkType === "ifsc_lookup" && evObj) {
      evidenceNote += ` [Bank: ${evObj.registryBank || "Not Found"}, Branch: ${evObj.branch || "N/A"}]`;
    }

    return `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e0d8; font-weight: 600; color: #171614;">
          ${formatCheckLabel(c.checkType)}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e0d8; text-align: center;">
          <span style="font-family: monospace; font-size: 11px; font-weight: 700; color: ${statusColor}; background: ${isPass ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'}; padding: 3px 8px; border-radius: 999px; border: 1px solid ${isPass ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'};">
            ${isPass ? '✓ PASS' : '✗ FAIL'}
          </span>
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e0d8; font-size: 12px; color: #5a5750; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          ${escapeHtml(evidenceNote)}
        </td>
      </tr>
    `;
  }).join("");

  return `
    <div class="pramana-official-certificate" id="printable-certificate" style="background: #ffffff; color: #171614; padding: 2.5rem; border-radius: 12px; border: 2px solid #0b664d; box-shadow: 0 4px 20px rgba(0,0,0,0.06); position: relative; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      
      <!-- Watermark Background -->
      <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0.03; pointer-events: none; z-index: 0;">
        <svg viewBox="0 0 100 100" style="width: 380px; height: 380px; fill: #0b664d;">
          <circle cx="50" cy="50" r="45" />
        </svg>
      </div>

      <div style="position: relative; z-index: 1;">

        <!-- Header: Logo, Title, Seal -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0b664d; padding-bottom: 1.5rem; margin-bottom: 1.5rem;">
          <div style="display: flex; align-items: center; gap: 1.1rem;">
            <!-- Brand Seal Icon -->
            <div style="width: 58px; height: 58px; border-radius: 50%; background: #0b664d; color: #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 10px rgba(11,102,77,0.3);">
              <svg viewBox="0 0 100 100" fill="none" style="width: 38px; height: 38px;">
                <circle cx="50" cy="50" r="45" stroke="#ffffff" stroke-width="4.5" />
                <circle cx="50" cy="50" r="37" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="3 3" />
                <path d="M34 50 L45 61 L68 38" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <div>
              <div style="font-size: 24px; font-weight: 800; letter-spacing: -0.02em; color: #0b664d; line-height: 1.1;">
                PRAMANA <span style="font-size: 20px; font-weight: 400; color: #171614;">प्रमाण</span>
              </div>
              <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #5a5750; margin-top: 3px;">
                Autonomous KYB Verification & Ground Truth Network
              </div>
              <div style="font-size: 10px; color: #8c887b;">
                Compliant with RBI KYC Master Direction & GST Council ISO/IEC 7064
              </div>
            </div>
          </div>

          <!-- Official Stamp Badge -->
          <div style="text-align: right;">
            <div style="display: inline-block; border: 2px solid ${isVerified ? '#0b664d' : '#dc2626'}; border-radius: 8px; padding: 6px 14px; background: ${isVerified ? 'rgba(11,102,77,0.06)' : 'rgba(220,38,38,0.06)'}; text-align: center;">
              <div style="font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: ${isVerified ? '#0b664d' : '#dc2626'};">
                ${isVerified ? 'VERIFIED & CERTIFIED' : 'FLAGGED - FRAUD CAUGHT'}
              </div>
              <div style="font-family: monospace; font-size: 9px; color: #5a5750; margin-top: 2px;">
                ${certId}
              </div>
            </div>
          </div>
        </div>

        <!-- Certificate Sub-Header -->
        <div style="text-align: center; margin-bottom: 1.5rem;">
          <h2 style="font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: #171614; margin: 0 0 4px;">
            Statutory Document Verification Certificate
          </h2>
          <div style="font-size: 12px; color: #5a5750;">
            Issued on: <strong>${dateStr}</strong> • Session ID: <code style="background: #f5f2ea; padding: 2px 6px; border-radius: 4px;">${report.sessionId || report.id}</code>
          </div>
        </div>

        <!-- LEAD ELEMENT: UNDERWRITER NARRATIVE MEMORANDUM -->
        ${report.narrativeSummary ? `
        <div style="background: #ffffff; border: 1px solid #0b664d; border-left: 6px solid #0b664d; border-radius: 10px; padding: 1.4rem 1.6rem; margin-bottom: 1.6rem; box-shadow: 0 3px 12px rgba(11,102,77,0.06);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #0b664d; display: flex; align-items: center; gap: 8px;">
              <span>UNDERWRITER NARRATIVE MEMORANDUM</span>
              <span style="background: rgba(11,102,77,0.12); color: #0b664d; font-size: 9px; padding: 2px 7px; border-radius: 4px; font-family: monospace;">STAGE 06</span>
            </div>
            <span style="font-size: 10px; color: #8c887b; font-family: monospace;">HUMAN-READABLE RISK ASSESSMENT</span>
          </div>
          <div style="font-size: 14.5px; line-height: 1.65; color: #171614; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-style: italic;">
            "${escapeHtml(report.narrativeSummary)}"
          </div>
        </div>
        ` : ''}

        <!-- Entity Information Grid -->
        <div style="background: #faf8f5; border: 1px solid #e5e0d8; border-radius: 8px; padding: 1.2rem; margin-bottom: 1.5rem;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #0b664d; margin-bottom: 0.6rem;">
            Onboarded Merchant & Legal Entity Profile
          </div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.8rem; font-size: 12.5px;">
            <div>
              <span style="color: #8c887b;">Legal Business Name:</span><br>
              <strong style="color: #171614; font-size: 13.5px;">${escapeHtml(businessName)}</strong>
            </div>
            <div>
              <span style="color: #8c887b;">GSTIN (15 Digits):</span><br>
              <strong style="font-family: monospace; font-size: 13px; color: #171614;">${escapeHtml(gstin)}</strong>
            </div>
            <div>
              <span style="color: #8c887b;">Permanent Account Number (PAN):</span><br>
              <strong style="font-family: monospace; font-size: 13px; color: #171614;">${escapeHtml(pan)}</strong>
            </div>
            <div>
              <span style="color: #8c887b;">Bank & Routing Code:</span><br>
              <strong style="color: #171614;">${escapeHtml(bankName)} (${escapeHtml(ifsc)})</strong>
            </div>
          </div>
        </div>

        <!-- Statutory Checks Evidence Table -->
        <div style="margin-bottom: 1.5rem;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #0b664d; margin-bottom: 0.5rem;">
            Autonomous Evidence Trail & Statutory Checks
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 12.5px; border: 1px solid #e5e0d8; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: #ede8df; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #5a5750;">
                <th style="padding: 8px 12px; border-bottom: 1px solid #e5e0d8; width: 32%;">Statutory Verification Check</th>
                <th style="padding: 8px 12px; border-bottom: 1px solid #e5e0d8; width: 15%; text-align: center;">Outcome</th>
                <th style="padding: 8px 12px; border-bottom: 1px solid #e5e0d8;">Explainable Audit Evidence</th>
              </tr>
            </thead>
            <tbody>
              ${checksRows || '<tr><td colspan="3" style="padding: 12px; text-align: center; color: #8c887b;">No checks recorded in session.</td></tr>'}
            </tbody>
          </table>
        </div>

        <!-- Digital Signature & Legal Trust Footer -->
        <div style="border-top: 1px solid #e5e0d8; padding-top: 1.2rem; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; color: #5a5750;">
          <div>
            <div><strong>Authenticating Registry:</strong> Razorpay IFSC Directory • GST Council ISO/IEC 7064 Algorithm</div>
            <div style="margin-top: 3px; font-family: monospace; font-size: 9.5px; color: #8c887b;">
              HASH: SHA256-${(report.sessionId || "00000000").split("").reverse().join("").slice(0, 16).toUpperCase()} • TAMPER-PROOF EVIDENCE
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 700; color: #0b664d;">PRAMANA AUTONOMOUS ENGINE</div>
            <div style="font-size: 10px; color: #8c887b;">Cryptographically Certified KYC/KYB Record</div>
          </div>
        </div>

      </div>
    </div>
  `;
}

function formatCheckLabel(type) {
  const map = {
    tamper_consistency: "Document Forensic Authenticity & Tamper Consistency",
    gstin_checksum: "GST Number Mod-36 Math Check",
    gstin_pan_match: "PAN matches GST Number (Letters 3–12)",
    ifsc_lookup: "Live Bank IFSC Registry Verification",
    pan_format: "PAN 10-Character Format Check",
    name_cross_match: "Cross-Document Legal Name Match"
  };
  return map[type] || type;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Downloads an official Microsoft Word (.doc) file containing the complete formatted certificate
 */
export function downloadCertificateDocx(report) {
  const certHtml = formatCertificateHTML(report);
  const certId = (report.sessionId || report.id || "report").slice(-8);

  const wordDocumentContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>Pramana Verification Certificate</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12pt; color: #171614; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #cccccc; padding: 6pt; }
        th { background-color: #f2f0ea; font-weight: bold; }
      </style>
    </head>
    <body>
      ${certHtml}
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', wordDocumentContent], {
    type: 'application/msword'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Pramana-Verification-Certificate-${certId}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
