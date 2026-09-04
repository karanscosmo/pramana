/**
 * NIRNAY (प्रमाण) — CINEMATIC SCROLLING & PARALLAX ENGINE
 * Sticky-stage interpolation, pointer-reactive drift, and deterministic verification bench
 */

(function () {
  'use strict';

  // State Management
  const state = {
    // Scroll coordinates & smoothing
    scrollTarget: 0,
    scrollCurrent: 0,
    scrollProgress: 0, // 0 to 1 across the sticky stage

    // Pointer coordinates & smoothing
    pointerTargetX: 0,
    pointerTargetY: 0,
    pointerCurrentX: 0,
    pointerCurrentY: 0,

    // Active story beat (0, 1, 2, 3)
    currentBeat: 0,

    // Performance & Accessibility
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    isTicking: false,
  };

  // DOM Elements
  const stageWrapper = document.querySelector('.scroll-stage-wrapper');
  const imageLayers = document.querySelectorAll('.scene-image-layer');
  const narrativeBeats = document.querySelectorAll('.narrative-beat');
  const railDots = document.querySelectorAll('.rail-dot');
  const scanline = document.querySelector('.scanline-overlay');
  const siteHeader = document.querySelector('.site-header');

  /**
   * Linear Interpolation Helper
   */
  function lerp(start, end, factor) {
    return start + (end - start) * factor;
  }

  /**
   * Clamp Helper
   */
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  /**
   * Pointer Coordinates Tracking
   */
  function setupPointerTracking() {
    if (state.reducedMotion) return;

    window.addEventListener('mousemove', (e) => {
      // Map pointer to normalized range -1 to 1 from screen center
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      
      state.pointerTargetX = (e.clientX - centerX) / centerX;
      state.pointerTargetY = (e.clientY - centerY) / centerY;

      requestTick();
    });

    // Reset softly on mouseleave
    document.addEventListener('mouseleave', () => {
      state.pointerTargetX = 0;
      state.pointerTargetY = 0;
      requestTick();
    });
  }

  /**
   * Scroll Measurement
   */
  function setupScrollTracking() {
    window.addEventListener('scroll', () => {
      state.scrollTarget = window.pageYOffset || document.documentElement.scrollTop;
      requestTick();
    }, { passive: true });
  }

  /**
   * Request Animation Frame Loop
   */
  function requestTick() {
    if (!state.isTicking) {
      state.isTicking = true;
      requestAnimationFrame(updateLoop);
    }
  }

  /**
   * Core Update Loop
   */
  function updateLoop() {
    // Smooth scroll position - snappy and responsive (0.20)
    state.scrollCurrent = lerp(state.scrollCurrent, state.scrollTarget, state.reducedMotion ? 1 : 0.20);

    // Smooth pointer parallax
    state.pointerCurrentX = lerp(state.pointerCurrentX, state.pointerTargetX, state.reducedMotion ? 1 : 0.06);
    state.pointerCurrentY = lerp(state.pointerCurrentY, state.pointerTargetY, state.reducedMotion ? 1 : 0.06);

    // Update CSS variables for pointer drift on images
    const maxDriftPx = 18;
    const driftX = `${(state.pointerCurrentX * maxDriftPx).toFixed(2)}px`;
    const driftY = `${(state.pointerCurrentY * maxDriftPx).toFixed(2)}px`;
    document.documentElement.style.setProperty('--pointer-x', driftX);
    document.documentElement.style.setProperty('--pointer-y', driftY);

    // Calculate progress within sticky stage
    if (stageWrapper) {
      const stageTop = stageWrapper.offsetTop;
      const stageHeight = stageWrapper.offsetHeight;
      const viewportHeight = window.innerHeight;
      const scrollableDistance = stageHeight - viewportHeight;

      if (scrollableDistance > 0) {
        const stageProgress = (state.scrollCurrent - stageTop) / scrollableDistance;
        state.scrollProgress = clamp(stageProgress, 0, 1);
        updateStoryBeats(state.scrollProgress);
      }
    }

    // Header theme transition on scroll:
    // Dark frosted glass during the 4 cinematic scenes,
    // switching smoothly to light paper theme when scrolled into the interactive bench
    if (siteHeader && stageWrapper) {
      const stageThreshold = stageWrapper.offsetTop + stageWrapper.offsetHeight - 120;
      if (state.scrollCurrent >= stageThreshold) {
        siteHeader.classList.add('theme-light');
      } else {
        siteHeader.classList.remove('theme-light');
      }
    }

    // Keep ticking if there's still interpolation delta
    const scrollDelta = Math.abs(state.scrollTarget - state.scrollCurrent);
    const pointerDelta = Math.abs(state.pointerTargetX - state.pointerCurrentX) + Math.abs(state.pointerTargetY - state.pointerCurrentY);

    if (scrollDelta > 0.3 || pointerDelta > 0.005) {
      requestAnimationFrame(updateLoop);
    } else {
      state.isTicking = false;
    }
  }

  /**
   * Update Active Scene and Narrative Beat based on scroll progress
   */
  function updateStoryBeats(progress) {
    // 4 beats evenly spaced:
    // Beat 0: 0.00 to 0.25 (Opening Documents Stack)
    // Beat 1: 0.25 to 0.50 (Macro Text Reading & OCR)
    // Beat 2: 0.50 to 0.75 (Verification Brass Stamp & Mod-36)
    // Beat 3: 0.75 to 1.00 (Calm Verified Portfolio)
    
    let targetBeat = 0;
    if (progress < 0.26) {
      targetBeat = 0;
    } else if (progress < 0.52) {
      targetBeat = 1;
    } else if (progress < 0.78) {
      targetBeat = 2;
    } else {
      targetBeat = 3;
    }

    if (state.currentBeat !== targetBeat) {
      state.currentBeat = targetBeat;

      // Update image layers
      imageLayers.forEach((img, idx) => {
        img.classList.toggle('active', idx === targetBeat);
      });

      // Update narrative copy blocks
      narrativeBeats.forEach((beat, idx) => {
        beat.classList.toggle('active', idx === targetBeat);
      });

      // Update progress rail dots
      railDots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === targetBeat);
      });

      // Toggle subtle scanline on Beat 1 (extraction)
      if (scanline) {
        scanline.classList.toggle('visible', targetBeat === 1);
      }
    }
  }

  /**
   * Clickable Progress Rail Dots
   */
  function setupProgressRail() {
    railDots.forEach((dot) => {
      dot.addEventListener('click', () => {
        const beatIndex = parseInt(dot.dataset.beat, 10);
        if (stageWrapper && !isNaN(beatIndex)) {
          const stageTop = stageWrapper.offsetTop;
          const stageHeight = stageWrapper.offsetHeight;
          const viewportHeight = window.innerHeight;
          const scrollableDistance = stageHeight - viewportHeight;

          // Target midpoints: 0.12, 0.38, 0.64, 0.88
          const targetProgress = [0.08, 0.38, 0.64, 0.90][beatIndex] || 0;
          const scrollToPos = stageTop + scrollableDistance * targetProgress;

          window.scrollTo({
            top: scrollToPos,
            behavior: 'smooth',
          });
        }
      });
    });
  }

  /**
   * Deterministic GSTIN Mod-36 Checksum Calculator (Offline Algorithm)
   */
  const BASE36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  function computeGstinCheckDigit(gstin14) {
    const clean = (gstin14 || "").trim().toUpperCase().slice(0, 14);
    if (clean.length < 14) return null;

    let total = 0;
    let factor = 2; // moving from right to left starting with 2 for 14th char (index 13)

    for (let i = clean.length - 1; i >= 0; i--) {
      const codePoint = BASE36.indexOf(clean[i]);
      if (codePoint === -1) return null;

      const product = factor * codePoint;
      total += Math.floor(product / 36) + (product % 36);
      factor = factor === 2 ? 1 : 2;
    }

    const remainder = total % 36;
    const checkCodePoint = (36 - remainder) % 36;
    return {
      expectedChar: BASE36[checkCodePoint],
      totalSum: total,
      remainder,
    };
  }

  function setupGstinTool() {
    const input = document.getElementById('gstin-tool-input');
    const result = document.getElementById('gstin-tool-result');

    if (!input || !result) return;

    function evaluate() {
      const val = input.value.trim().toUpperCase();
      if (val.length < 14) {
        result.innerHTML = `<span style="color: var(--obsidian-muted);">Type 14 or 15 letters and numbers to test the GST formula.</span>`;
        return;
      }

      const res = computeGstinCheckDigit(val);
      if (!res) {
        result.innerHTML = `<span style="color: #ef4444;">Invalid character. Indian GST numbers only use 0-9 and A-Z.</span>`;
        return;
      }

      const actual15th = val.length >= 15 ? val[14] : null;
      const isMatch = actual15th === res.expectedChar;

      result.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="color: #f5f2ea; font-weight: 600;">Official 15th Check Character:</span>
          <span style="font-size: 1.15rem; color: #34d399; font-weight: 700; background: rgba(16,185,129,0.15); padding: 2px 8px; border-radius: 4px;">${res.expectedChar}</span>
        </div>
        <div style="color: var(--obsidian-muted); font-size: 0.78rem;">
          Government Formula: Modulo-36 Checksum | Sum: ${res.totalSum}
        </div>
        ${actual15th ? `
          <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--obsidian-border); display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--obsidian-muted);">Entered 15th character: '${actual15th}'</span>
            <span style="color: ${isMatch ? '#34d399' : '#ef4444'}; font-weight: 700;">
              ${isMatch ? '✓ GENUINE GST NUMBER' : '✗ FAKE / TYPO (MATH FAILED)'}
            </span>
          </div>
        ` : ''}
      `;
    }

    input.addEventListener('input', evaluate);
    evaluate();
  }

  /**
   * Live Razorpay IFSC Registry Lookup Tool
   */
  function setupIfscTool() {
    const input = document.getElementById('ifsc-tool-input');
    const button = document.getElementById('ifsc-tool-btn');
    const result = document.getElementById('ifsc-tool-result');

    if (!input || !button || !result) return;

    async function lookup() {
      const code = input.value.trim().toUpperCase();
      if (!code) return;

      result.innerHTML = `<span style="color: var(--obsidian-muted);">Checking Razorpay bank database for ${code}...</span>`;

      try {
        const res = await fetch(`https://ifsc.razorpay.com/${code}`, {
          headers: { 'Accept': 'application/json' },
        });

        if (res.status === 404) {
          result.innerHTML = `
            <div style="color: #ef4444; font-weight: 700; margin-bottom: 2px;">NOT FOUND IN BANK DIRECTORY</div>
            <div style="color: var(--obsidian-muted); font-size: 0.78rem;">This IFSC code does not exist in India's bank directory. High risk of fake cheque.</div>
          `;
          return;
        }

        if (!res.ok) {
          result.innerHTML = `<span style="color: #f59e0b;">Bank database returned error status ${res.status}. Please check again.</span>`;
          return;
        }

        const data = await res.json();
        result.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
            <span style="color: #ffffff; font-weight: 700;">${data.BANK}</span>
            <span style="color: #34d399; font-size: 0.76rem; background: rgba(16,185,129,0.15); padding: 2px 6px; border-radius: 4px;">VERIFIED BANK BRANCH</span>
          </div>
          <div style="color: var(--obsidian-muted); font-size: 0.78rem;">
            Branch: ${data.BRANCH} (${data.CITY}, ${data.STATE})
          </div>
          <div style="color: #34d399; font-size: 0.75rem; margin-top: 4px;">
            ${data.UPI ? '• UPI' : ''} ${data.NEFT ? '• NEFT' : ''} ${data.RTGS ? '• RTGS' : ''}
            <span style="color: var(--obsidian-muted); margin-left: 6px;">MICR: ${data.MICR || 'N/A'}</span>
          </div>
        `;
      } catch (err) {
        result.innerHTML = `<span style="color: #f59e0b;">Could not connect to bank database: ${err.message}</span>`;
      }
    }

    button.addEventListener('click', lookup);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') lookup();
    });
  }

  /**
   * 6 Pillars In-Depth Explanations Database
   */
  const PILLAR_DETAILS = {
    "1": {
      number: "PILLAR 01 • STRUCTURAL EMBED",
      title: "PAN matches GST Number",
      tag: "Official GST Council Rule • CGST Act Section 22",
      img: "/assets/pillar1-pan-gst.jpg",
      summary: "By statutory Indian law, characters 3 through 12 of every 15-character GSTIN are exactly identical to the legal entity's 10-digit PAN. Nirnay compares them directly with 0ms latency.",
      mechanism: "Characters 1-2 denote the State Code (e.g. 27 for Maharashtra, 07 for Delhi). Characters 3-12 are strictly reserved for the Taxpayer's PAN (e.g. AAPFU0939F). Nirnay extracts the PAN from the physical PAN card and the GSTIN from the GST Registration Certificate (Form GST REG-06), performing instant byte-for-byte slice matching without needing any internet connection.",
      fraud: "Catches stolen, shell-company, or borrowed PAN cards; stops brokers who try to onboard a company using an unrelated director's PAN; catches multi-entity cross-collateralization scams where one business borrows credentials from another.",
      statutory: "Central Goods and Services Tax (CGST) Rules, 2017 (Rule 8) and Central Board of Indirect Taxes & Customs (CBIC) statutory format guidelines for GST identification numbers.",
      impact: "Provides 100% deterministic ground truth. If the PAN inside the GSTIN does not match the uploaded PAN card, the application is flagged immediately before any financial transactions or payouts occur."
    },
    "2": {
      number: "PILLAR 02 • CHECKSUM FORMULA",
      title: "GST Number Math Formula (Modulo-36)",
      tag: "Official 15th-Digit Checksum Rule • ISO/IEC 7064",
      img: "/assets/pillar2-gst-checksum.jpg",
      summary: "The 15th character of every GST number is a mathematical checksum computed across the first 14 alphanumeric characters using the Modulo-36 algorithm.",
      mechanism: "Characters 0-9 have values 0-9; letters A-Z map to values 10-35. The algorithm traverses all 14 characters with alternating weighting factors (1 and 2). If the calculated remainder does not match the 15th character, the GSTIN is mathematically impossible and cannot exist on the government GST portal.",
      fraud: "Instantly catches fake GST numbers invented by fraudsters, forged PDF certificates created with random numbers, keystroke typos made during onboarding, and AI-hallucinated fake certificates.",
      statutory: "GST Council Circular & GST Common Portal (GSTN) Schema Specifications (Rule 8(1) Form GST REG-01).",
      impact: "Zero external dependencies. Nirnay recalculates the 15th character in sub-millisecond time. Invalids are rejected on the spot before wasting API credits or risk underwriter time."
    },
    "3": {
      number: "PILLAR 03 • CLEARING REGISTRY",
      title: "Live Bank IFSC Search",
      tag: "Live Razorpay Bank Database • RBI RTGS/NEFT Rail",
      img: "/assets/pillar3-bank-ifsc.jpg",
      summary: "Nirnay checks the IFSC code on the cancelled cheque against Razorpay's live national bank directory, verifying the bank name, branch address, and transfer rail readiness.",
      mechanism: "The first 4 letters represent the bank code (e.g., HDFC, SBIN). The 5th character is always '0'. The last 6 characters designate the physical branch. Nirnay queries the live directory to fetch branch name, city, state, MICR code, and active transfer capabilities (NEFT, RTGS, IMPS, UPI).",
      fraud: "Identifies dummy cheques printed with fictitious IFSC codes, discontinued cooperative banks, branches closed or merged due to bank consolidations, and accounts with no digital transfer capability.",
      statutory: "Reserve Bank of India (RBI) National Automated Clearing House (NACH) & Unified Payments Interface (UPI) branch clearing directories.",
      impact: "Ensures vendor payouts, loans, or merchant settlements will not bounce due to stale or invalid bank branch data, drastically reducing payment ops overhead."
    },
    "4": {
      number: "PILLAR 04 • FUZZY MATCHING",
      title: "Company & Owner Name Match",
      tag: "Smart Business Name Comparison • Token Reconciliation",
      img: "/assets/pillar4-name-match.jpg",
      summary: "Recognizes legitimate legal variations across documents (like 'Pvt Ltd' vs 'Private Limited') while strictly rejecting completely different names or third-party impersonations.",
      mechanism: "Applies specialized legal abbreviation normalization, prefix stripping (such as 'M/S', 'Shree', 'Messrs'), token sorting, and Jaro-Winkler string similarity across four entity fields: GST Legal Name, GST Trade Name, Bank Account Holder Name, and PAN Card Name.",
      fraud: "Stops fraudsters attempting to onboard a firm using an unrelated individual's bank account or GST certificate; flags identity theft and sole-proprietor spoofing.",
      statutory: "Ministry of Corporate Affairs (MCA) entity naming conventions and RBI KYC Master Direction guidelines for commercial entities.",
      impact: "Achieves an optimal balance: legitimate businesses with minor typing variations get approved seamlessly, while mismatched identities are caught with high-confidence scoring."
    },
    "5": {
      number: "PILLAR 05 • FORENSIC CHECK",
      title: "Tamper Consistency & Typography Inspection",
      tag: "Internal Typography & Pixel Forensics • Zero-Trust Analysis",
      img: "/assets/pillar5-tamper-forensic.jpg",
      summary: "Looks deep inside every document for signs of digital editing — mismatched fonts, compression artifacts, misaligned seals, and unnatural anti-aliasing.",
      mechanism: "Executes a multi-layer visual inspection: 1) Typography consistency (checks for foreign font glyphs, font size mismatch, or synthetic vector text stamped over rasterized paper); 2) JPEG Error Level Analysis (ELA) to detect spliced text blocks; 3) Baseline & margin misalignment; 4) State emblem & watermark authenticity.",
      fraud: "Catches documents forged in Photoshop, Canva, or Acrobat where legitimate PDF certificates have had the GST number, company name, or address altered; spots forged bank cheque stamps and fake signatures.",
      statutory: "Information Technology Act, 2000 (Section 65B regarding admissibility of electronic records) and Indian Penal Code Section 463/468 regarding digital forgery.",
      impact: "Prevents fraudulent documents from slipping through automated OCR parsers that only read text without inspecting whether the text was digitally pasted."
    },
    "6": {
      number: "PILLAR 06 • HUMAN-READABLE",
      title: "Underwriter Narrative & Risk Brief",
      tag: "Plain-Language Underwriter Brief • Audit-Ready Memo",
      img: "/assets/pillar6-underwriter-memo.jpg",
      summary: "Every verification concludes with a plain-language memo written the way an experienced credit & risk underwriter would explain the onboarding file to an audit committee.",
      mechanism: "Synthesizes mathematical proof, bank directory confirmation, forensic image analysis, and cross-document entity reconciliation into a structured, executive narrative with clear recommendations: APPROVE, AUDIT_FLAG, or REJECT.",
      fraud: "Eliminates opaque 'black box' machine decisions where legitimate merchants get rejected without explanation, while providing ironclad documentation for auditors and regulatory reviewers.",
      statutory: "RBI Master Direction on Digital Lending (Risk Governance & Transparent Underwriting Standards) and statutory internal audit compliance.",
      impact: "Enables credit risk officers to make decisions in under 10 seconds with complete contextual understanding, backed by verified documentary evidence."
    }
  };

  /**
   * Setup Marquee & Interactive Detail Modal
   */
  function setupPillarsMarqueeAndModal() {
    const modal = document.getElementById('pillar-detail-modal');
    const closeBtn = document.getElementById('modal-close-btn');
    const doneBtn = document.getElementById('modal-done-btn');

    const modalImg = document.getElementById('modal-pillar-img');
    const modalNumber = document.getElementById('modal-pillar-number');
    const modalTag = document.getElementById('modal-pillar-tag');
    const modalTitle = document.getElementById('modal-pillar-title');
    const modalSummary = document.getElementById('modal-pillar-summary');
    const modalMechanism = document.getElementById('modal-pillar-mechanism');
    const modalFraud = document.getElementById('modal-pillar-fraud');
    const modalStatutory = document.getElementById('modal-pillar-statutory');
    const modalImpact = document.getElementById('modal-pillar-impact');

    // Modal Open Handler
    function openPillarModal(pillarId) {
      const data = PILLAR_DETAILS[pillarId];
      if (!data || !modal) return;

      if (modalImg) {
        modalImg.src = data.img;
        modalImg.alt = data.title;
      }
      if (modalNumber) modalNumber.textContent = data.number;
      if (modalTag) modalTag.textContent = data.tag;
      if (modalTitle) modalTitle.textContent = data.title;
      if (modalSummary) modalSummary.textContent = data.summary;
      if (modalMechanism) modalMechanism.textContent = data.mechanism;
      if (modalFraud) modalFraud.textContent = data.fraud;
      if (modalStatutory) modalStatutory.textContent = data.statutory;
      if (modalImpact) modalImpact.textContent = data.impact;

      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    // Modal Close Handler
    function closePillarModal() {
      if (!modal) return;
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    // Attach click listener to every pillar card
    const cards = document.querySelectorAll('.pillar-card[data-pillar-id]');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const pillarId = card.getAttribute('data-pillar-id');
        if (pillarId) openPillarModal(pillarId);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const pillarId = card.getAttribute('data-pillar-id');
          if (pillarId) openPillarModal(pillarId);
        }
      });
    });

    if (closeBtn) closeBtn.addEventListener('click', closePillarModal);
    if (doneBtn) doneBtn.addEventListener('click', closePillarModal);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closePillarModal();
      });
    }
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && modal.classList.contains('open')) {
        closePillarModal();
      }
    });
  }

  /**
   * 3D Indian Sovereign Dharma Chakra & Full-Area Yantra Engine
   * Renders a full-widescreen 3D isometric scene with:
   * 1) Central 3D Ashoka Dharma Chakra (24 truth spokes, bevel treads, emerald core)
   * 2) Left & Right peripheral 3D satellite yantras & solar seals
   * 3) 3D perspective coordinate ground grid with golden crosshairs
   * 4) Concentric banknote security guilloche orbital lattices
   * 5) 110 floating 3D golden & emerald depth particles across the entire viewport
   */
  function setupIndian3dChakra() {
    const canvas = document.getElementById('indian-3d-chakra-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const section = document.getElementById('closing-cta-section');
    let width = 0;
    let height = 0;
    let isVisible = false;
    let animFrameId = null;

    // 3D Camera & Orientation State
    const basePitch = 1.05; // ~60 degrees isometric elevation
    let targetPitch = basePitch;
    let currentPitch = basePitch;

    let targetRoll = 0;
    let currentRoll = 0;

    let rotationAngle = 0;
    const rotationSpeed = 0.005;

    // 110 Ambient 3D floating particles across the FULL widescreen field
    const PARTICLE_COUNT = 110;
    const particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: (Math.random() - 0.5) * 1600,
        y: (Math.random() - 0.5) * 600,
        z: (Math.random() - 0.5) * 260,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.25,
        vz: (Math.random() - 0.5) * 0.3,
        size: 1.0 + Math.random() * 2.4,
        alpha: 0.2 + Math.random() * 0.6,
        isStar: Math.random() > 0.65,
        colorType: Math.random() > 0.3 ? 'gold' : 'emerald'
      });
    }

    function resize() {
      if (!canvas || !section) return;
      width = section.offsetWidth || window.innerWidth;
      height = section.offsetHeight || 620;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Interactive mouse tilt across the full widescreen area
    function onMouseMove(e) {
      if (!section) return;
      const rect = section.getBoundingClientRect();
      if (rect.bottom < -100 || rect.top > window.innerHeight + 100) return;

      const normX = ((e.clientX - rect.left) / (rect.width || 1)) * 2 - 1;
      const normY = ((e.clientY - rect.top) / (rect.height || 1)) * 2 - 1;

      targetPitch = basePitch + normY * 0.16;
      targetRoll = -normX * 0.20;
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true });

    // 3D Point Projection Helper
    function project(x, y, z, cx, cy, fov, pitch, yaw, roll) {
      // 1. Rotate around Z in model space by yaw
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const x1 = x * cosY - y * sinY;
      const y1 = x * sinY + y * cosY;
      const z1 = z;

      // 2. Rotate around X by pitch
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      const y2 = y1 * cosP - z1 * sinP;
      const z2 = y1 * sinP + z1 * cosP;

      // 3. Rotate around Z by roll
      const cosR = Math.cos(roll);
      const sinR = Math.sin(roll);
      const x3 = x1 * cosR - y2 * sinR;
      const y3 = x1 * sinR + y2 * cosR;

      const cameraDist = fov + 380;
      const depth = cameraDist + z2;
      if (depth <= 10) return null;

      const scale = fov / depth;
      return {
        x: cx + x3 * scale,
        y: cy + y3 * scale,
        scale: scale,
        z: z2
      };
    }

    // Draw projected 3D circle
    function draw3dCircle(radius, z, cx, cy, fov, pitch, yaw, roll, strokeStyle, lineWidth, segments = 64) {
      ctx.beginPath();
      let first = true;
      for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        const p = project(Math.cos(a) * radius, Math.sin(a) * radius, z, cx, cy, fov, pitch, yaw, roll);
        if (!p) continue;
        if (first) {
          ctx.moveTo(p.x, p.y);
          first = false;
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }

    // Draw Satellite Yantra (Left or Right peripheral emblem)
    function drawSatelliteYantra(centerModelX, centerModelY, centerModelZ, radius, spokesCount, rot, cx, cy, fov, pitch, roll, isLeft) {
      // Outer ring
      ctx.beginPath();
      let first = true;
      for (let i = 0; i <= 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        const lx = centerModelX + Math.cos(a + rot) * radius;
        const ly = centerModelY + Math.sin(a + rot) * radius;
        const p = project(lx, ly, centerModelZ, cx, cy, fov, pitch, 0, roll);
        if (!p) continue;
        if (first) { ctx.moveTo(p.x, p.y); first = false; }
        else { ctx.lineTo(p.x, p.y); }
      }
      ctx.strokeStyle = isLeft ? 'rgba(180, 138, 65, 0.22)' : 'rgba(11, 102, 77, 0.22)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Spokes / Petals
      for (let i = 0; i < spokesCount; i++) {
        const a = (i / spokesCount) * Math.PI * 2 + rot;
        const pHub = project(centerModelX, centerModelY, centerModelZ, cx, cy, fov, pitch, 0, roll);
        const pTip = project(centerModelX + Math.cos(a) * radius, centerModelY + Math.sin(a) * radius, centerModelZ, cx, cy, fov, pitch, 0, roll);
        if (pHub && pTip) {
          ctx.beginPath();
          ctx.moveTo(pHub.x, pHub.y);
          ctx.lineTo(pTip.x, pTip.y);
          ctx.strokeStyle = isLeft ? 'rgba(180, 138, 65, 0.18)' : 'rgba(11, 102, 77, 0.18)';
          ctx.lineWidth = 0.9;
          ctx.stroke();

          // Small tip orb
          ctx.beginPath();
          ctx.arc(pTip.x, pTip.y, Math.max(0.8, 1.8 * pTip.scale), 0, Math.PI * 2);
          ctx.fillStyle = isLeft ? 'rgba(197, 155, 63, 0.35)' : 'rgba(11, 102, 77, 0.35)';
          ctx.fill();
        }
      }

      // Center orb
      const pCenter = project(centerModelX, centerModelY, centerModelZ + 4, cx, cy, fov, pitch, 0, roll);
      if (pCenter) {
        ctx.beginPath();
        ctx.arc(pCenter.x, pCenter.y, Math.max(1.2, 3.2 * pCenter.scale), 0, Math.PI * 2);
        ctx.fillStyle = isLeft ? '#c59b3f' : '#0b664d';
        ctx.fill();
      }
    }

    function render() {
      if (!isVisible) return;

      // Smooth camera interpolation
      currentPitch += (targetPitch - currentPitch) * 0.05;
      currentRoll += (targetRoll - currentRoll) * 0.05;
      rotationAngle += rotationSpeed;

      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const fov = 420;

      // Central Chakra radius calibrated to section height
      const R_OUTER = Math.min(width * 0.32, Math.max(160, height * 0.38));
      const R_INNER = R_OUTER * 0.88;
      const R_HUB = R_OUTER * 0.22;
      const R_CORE = R_OUTER * 0.09;
      const THICKNESS = 14;

      // ======================================================================
      // 1. 3D Perspective Ground Grid (Spanning the Full Widescreen Width)
      // ======================================================================
      const GRID_Y = 115; // ground plane depth
      const GRID_HALF_W = Math.max(600, width * 0.55);
      const GRID_STEP = 90;

      ctx.strokeStyle = 'rgba(180, 138, 65, 0.08)';
      ctx.lineWidth = 0.8;

      // Lateral grid lines (running X-wise across screen)
      for (let gz = -360; gz <= 360; gz += GRID_STEP) {
        const p1 = project(-GRID_HALF_W, GRID_Y, gz, cx, cy, fov, currentPitch, 0, currentRoll);
        const p2 = project(GRID_HALF_W, GRID_Y, gz, cx, cy, fov, currentPitch, 0, currentRoll);
        if (p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }

      // Longitudinal lines (running Z-wise depth)
      for (let gx = -GRID_HALF_W; gx <= GRID_HALF_W; gx += GRID_STEP) {
        const p1 = project(gx, GRID_Y, -360, cx, cy, fov, currentPitch, 0, currentRoll);
        const p2 = project(gx, GRID_Y, 360, cx, cy, fov, currentPitch, 0, currentRoll);
        if (p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();

          // Golden crosshair at intersection
          const pCross = project(gx, GRID_Y, 0, cx, cy, fov, currentPitch, 0, currentRoll);
          if (pCross) {
            ctx.fillStyle = 'rgba(197, 155, 63, 0.25)';
            ctx.fillRect(pCross.x - 1, pCross.y - 1, 2, 2);
          }
        }
      }

      // ======================================================================
      // 2. Full-Field 3D Floating Particles & Stars (110 units)
      // ======================================================================
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        if (p.x > width * 0.75) p.x = -width * 0.75;
        if (p.x < -width * 0.75) p.x = width * 0.75;
        if (p.y > 280) p.y = -280;
        if (p.y < -280) p.y = 280;
        if (p.z > 120) p.z = -120;
        if (p.z < -120) p.z = 120;

        const proj = project(p.x, p.y, p.z, cx, cy, fov, currentPitch, rotationAngle * 0.25, currentRoll);
        if (!proj) return;

        const depthAlpha = Math.max(0.08, Math.min(0.85, (proj.z + 120) / 240)) * p.alpha;
        const rad = Math.max(0.6, p.size * proj.scale);

        if (p.isStar) {
          // 4-point golden star
          ctx.beginPath();
          ctx.moveTo(proj.x - rad * 1.6, proj.y);
          ctx.lineTo(proj.x + rad * 1.6, proj.y);
          ctx.moveTo(proj.x, proj.y - rad * 1.6);
          ctx.lineTo(proj.x, proj.y + rad * 1.6);
          ctx.strokeStyle = p.colorType === 'emerald' ? `rgba(11, 102, 77, ${depthAlpha})` : `rgba(197, 155, 63, ${depthAlpha})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, rad, 0, Math.PI * 2);
          if (p.colorType === 'emerald') {
            ctx.fillStyle = `rgba(11, 102, 77, ${depthAlpha * 0.75})`;
          } else {
            ctx.fillStyle = `rgba(197, 155, 63, ${depthAlpha})`;
          }
          ctx.fill();
        }
      });

      // ======================================================================
      // 3. Left & Right Peripheral 3D Satellite Yantras (Filling the Wide Wings)
      // ======================================================================
      const SATELLITE_OFFSET_X = Math.max(340, width * 0.35);
      // Left 8-petal Lotus Yantra
      drawSatelliteYantra(-SATELLITE_OFFSET_X, -25, -20, R_OUTER * 0.55, 8, rotationAngle * 0.8, cx, cy, fov, currentPitch, currentRoll, true);
      // Right 12-point Solar Chakra Seal
      drawSatelliteYantra(SATELLITE_OFFSET_X, 20, -20, R_OUTER * 0.6, 12, -rotationAngle * 0.7, cx, cy, fov, currentPitch, currentRoll, false);

      // Connecting subtle semantic alignment arcs from satellites to center
      const pSatLeft = project(-SATELLITE_OFFSET_X, -25, -20, cx, cy, fov, currentPitch, 0, currentRoll);
      const pSatRight = project(SATELLITE_OFFSET_X, 20, -20, cx, cy, fov, currentPitch, 0, currentRoll);
      const pCenterHub = project(0, 0, 0, cx, cy, fov, currentPitch, 0, currentRoll);

      if (pSatLeft && pCenterHub && pSatRight) {
        ctx.beginPath();
        ctx.moveTo(pSatLeft.x, pSatLeft.y);
        ctx.quadraticCurveTo(cx - width * 0.18, cy + 40, pCenterHub.x, pCenterHub.y);
        ctx.quadraticCurveTo(cx + width * 0.18, cy + 40, pSatRight.x, pSatRight.y);
        ctx.strokeStyle = 'rgba(180, 138, 65, 0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // ======================================================================
      // 4. Large Concentric Orbital Watermark Rings (Sweeping Wide)
      // ======================================================================
      draw3dCircle(R_OUTER * 1.55, -15, cx, cy, fov, currentPitch, rotationAngle * 0.2, currentRoll, 'rgba(180, 138, 65, 0.12)', 1.0, 72);
      draw3dCircle(R_OUTER * 1.85, -25, cx, cy, fov, currentPitch, -rotationAngle * 0.15, currentRoll, 'rgba(11, 102, 77, 0.08)', 0.9, 80);

      // 4 Cardinal Sovereign Markers on outer orbital ring
      for (let k = 0; k < 4; k++) {
        const ca = (k / 4) * Math.PI * 2 + rotationAngle * 0.2;
        const pNode = project(Math.cos(ca) * (R_OUTER * 1.55), Math.sin(ca) * (R_OUTER * 1.55), -15, cx, cy, fov, currentPitch, 0, currentRoll);
        if (pNode) {
          ctx.beginPath();
          ctx.arc(pNode.x, pNode.y, Math.max(1.5, 3.5 * pNode.scale), 0, Math.PI * 2);
          ctx.fillStyle = '#0b664d';
          ctx.fill();
          ctx.strokeStyle = '#c59b3f';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // ======================================================================
      // 5. Outer Indian Security Guilloche Lattice (Banknote Wave Pattern)
      // ======================================================================
      ctx.beginPath();
      const GUILLOCHE_RAD = R_OUTER * 1.15;
      const GUILLOCHE_SEGMENTS = 120;
      let firstG = true;
      for (let i = 0; i <= GUILLOCHE_SEGMENTS; i++) {
        const a = (i / GUILLOCHE_SEGMENTS) * Math.PI * 2;
        const wave = Math.sin(a * 24) * 8;
        const r = GUILLOCHE_RAD + wave;
        const proj = project(Math.cos(a) * r, Math.sin(a) * r, -4, cx, cy, fov, currentPitch, -rotationAngle * 0.35, currentRoll);
        if (!proj) continue;
        if (firstG) {
          ctx.moveTo(proj.x, proj.y);
          firstG = false;
        } else {
          ctx.lineTo(proj.x, proj.y);
        }
      }
      ctx.strokeStyle = 'rgba(180, 138, 65, 0.22)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // ======================================================================
      // 6. Central Ashoka Dharma Chakra (3D Solid Bevel & 24 Spokes)
      // ======================================================================
      // 3D Cylinder Thickness Treads
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const cosA = Math.cos(a);
        const sinA = Math.sin(a);

        const pBack = project(cosA * R_OUTER, sinA * R_OUTER, -THICKNESS, cx, cy, fov, currentPitch, rotationAngle, currentRoll);
        const pFront = project(cosA * R_OUTER, sinA * R_OUTER, THICKNESS, cx, cy, fov, currentPitch, rotationAngle, currentRoll);

        if (pBack && pFront) {
          const depthShade = Math.max(0.12, Math.min(0.48, (pFront.z + 50) / 120));
          ctx.beginPath();
          ctx.moveTo(pBack.x, pBack.y);
          ctx.lineTo(pFront.x, pFront.y);
          ctx.strokeStyle = `rgba(160, 120, 50, ${depthShade})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }

      // Rear & Front Rim Rings
      draw3dCircle(R_OUTER, -THICKNESS, cx, cy, fov, currentPitch, rotationAngle, currentRoll, 'rgba(180, 138, 65, 0.24)', 1.2);
      draw3dCircle(R_OUTER, THICKNESS, cx, cy, fov, currentPitch, rotationAngle, currentRoll, 'rgba(180, 138, 65, 0.48)', 1.8);
      draw3dCircle(R_INNER, THICKNESS, cx, cy, fov, currentPitch, rotationAngle, currentRoll, 'rgba(180, 138, 65, 0.36)', 1.2);

      // 24 Spokes of Truth (Dharma Chakra)
      for (let i = 0; i < 24; i++) {
        const spokeAngle = (i / 24) * Math.PI * 2;
        const cosS = Math.cos(spokeAngle);
        const sinS = Math.sin(spokeAngle);

        const pHub = project(cosS * R_HUB, sinS * R_HUB, THICKNESS * 0.8, cx, cy, fov, currentPitch, rotationAngle, currentRoll);
        const pRim = project(cosS * R_INNER, sinS * R_INNER, THICKNESS, cx, cy, fov, currentPitch, rotationAngle, currentRoll);

        const perpAngle = spokeAngle + Math.PI / 2;
        const spread = R_HUB * 0.16;
        const pBaseL = project(cosS * R_HUB - Math.cos(perpAngle) * spread, sinS * R_HUB - Math.sin(perpAngle) * spread, THICKNESS * 0.5, cx, cy, fov, currentPitch, rotationAngle, currentRoll);
        const pBaseR = project(cosS * R_HUB + Math.cos(perpAngle) * spread, sinS * R_HUB + Math.sin(perpAngle) * spread, THICKNESS * 0.5, cx, cy, fov, currentPitch, rotationAngle, currentRoll);

        if (pHub && pRim && pBaseL && pBaseR) {
          const depthLight = Math.max(0.15, Math.min(0.68, (pRim.z + 60) / 120));

          // Tapered spoke triangular body
          ctx.beginPath();
          ctx.moveTo(pBaseL.x, pBaseL.y);
          ctx.lineTo(pRim.x, pRim.y);
          ctx.lineTo(pBaseR.x, pBaseR.y);
          ctx.closePath();
          ctx.fillStyle = `rgba(180, 138, 65, ${depthLight * 0.24})`;
          ctx.fill();

          // Spoke spine line
          ctx.beginPath();
          ctx.moveTo(pHub.x, pHub.y);
          ctx.lineTo(pRim.x, pRim.y);
          ctx.strokeStyle = `rgba(197, 155, 63, ${depthLight})`;
          ctx.lineWidth = 1.3;
          ctx.stroke();

          // Outer roundel / jewel between spokes
          const roundelAngle = spokeAngle + (Math.PI / 24);
          const pRoundel = project(Math.cos(roundelAngle) * ((R_INNER + R_OUTER) / 2), Math.sin(roundelAngle) * ((R_INNER + R_OUTER) / 2), THICKNESS * 1.05, cx, cy, fov, currentPitch, rotationAngle, currentRoll);
          if (pRoundel) {
            ctx.beginPath();
            ctx.arc(pRoundel.x, pRoundel.y, Math.max(1, 2.5 * pRoundel.scale), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(11, 102, 77, ${depthLight * 0.88})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(197, 155, 63, ${depthLight})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Central Sovereign Hub & Raised Emerald Core
      draw3dCircle(R_HUB, THICKNESS * 0.9, cx, cy, fov, currentPitch, rotationAngle, currentRoll, 'rgba(180, 138, 65, 0.48)', 1.5);
      draw3dCircle(R_CORE, THICKNESS * 1.2, cx, cy, fov, currentPitch, rotationAngle, currentRoll, 'rgba(197, 155, 63, 0.7)', 1.8);

      const pCenter = project(0, 0, THICKNESS * 2.2, cx, cy, fov, currentPitch, rotationAngle, currentRoll);
      if (pCenter) {
        const glowRad = Math.max(12, 28 * pCenter.scale);
        const grad = ctx.createRadialGradient(pCenter.x, pCenter.y, 0, pCenter.x, pCenter.y, glowRad);
        grad.addColorStop(0, 'rgba(11, 102, 77, 0.55)');
        grad.addColorStop(0.45, 'rgba(11, 102, 77, 0.2)');
        grad.addColorStop(1, 'rgba(11, 102, 77, 0)');

        ctx.beginPath();
        ctx.arc(pCenter.x, pCenter.y, glowRad, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pCenter.x, pCenter.y, Math.max(2, 4.5 * pCenter.scale), 0, Math.PI * 2);
        ctx.fillStyle = '#0b664d';
        ctx.fill();
        ctx.strokeStyle = '#c59b3f';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      animFrameId = requestAnimationFrame(render);
    }

    // Observer to run only when in viewport
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          isVisible = true;
          resize();
          cancelAnimationFrame(animFrameId);
          animFrameId = requestAnimationFrame(render);
        } else {
          isVisible = false;
          cancelAnimationFrame(animFrameId);
        }
      });
    }, { threshold: 0.05 });

    if (section) observer.observe(section);

    window.addEventListener('resize', () => {
      if (isVisible) resize();
    }, { passive: true });

    resize();
  }

  /**
   * Initialize Everything on DOM Load
   */
  document.addEventListener('DOMContentLoaded', () => {
    setupPointerTracking();
    setupScrollTracking();
    setupProgressRail();
    setupGstinTool();
    setupIfscTool();
    setupPillarsMarqueeAndModal();
    setupIndian3dChakra();

    // Trigger initial frame
    requestTick();
  });

})();
