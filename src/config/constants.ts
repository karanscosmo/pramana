/**
 * Centralized Configuration Constants for Pramana
 */

// Active Anthropic model ID for vision and text analysis
export const CLAUDE_MODEL = "claude-3-5-sonnet-20241022";

// Detect if running inside Vercel Serverless environment
const IS_VERCEL = Boolean(process.env.VERCEL);

// Timeout thresholds for external AI calls
// On Vercel Serverless (10s default gateway limit), use aggressive timeouts so fallbacks resolve well before container abort
export const VISION_TIMEOUT_MS = IS_VERCEL ? 3000 : 25000;
export const TEXT_TIMEOUT_MS = IS_VERCEL ? 3000 : 15000;
export const OCR_TIMEOUT_MS = IS_VERCEL ? 2500 : 15000;
