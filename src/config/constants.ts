/**
 * Centralized Configuration Constants for Pramana
 */

// Active Anthropic model ID for vision and text analysis
export const CLAUDE_MODEL = "claude-3-5-sonnet-20241022";

// Timeout thresholds for external AI calls
export const VISION_TIMEOUT_MS = 25000; // 25s for multi-modal vision (extraction, forensic tamper)
export const TEXT_TIMEOUT_MS = 15000;   // 15s for text reasoning (narrative, semantic name match, RAG)
export const OCR_TIMEOUT_MS = 20000;    // 20s for local Tesseract.js processing on high-res scans
