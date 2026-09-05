/**
 * Centralized Configuration Constants for Pramana
 */

// Active Anthropic model ID for vision and text analysis
export const CLAUDE_MODEL = "claude-sonnet-4-6";

// Detect if running inside Vercel Serverless environment
const IS_VERCEL = Boolean(process.env.VERCEL);

// Timeout thresholds for AI and OCR engines
export const VISION_TIMEOUT_MS = IS_VERCEL ? 6000 : 25000;
export const TEXT_TIMEOUT_MS = IS_VERCEL ? 5000 : 15000;
export const OCR_TIMEOUT_MS = IS_VERCEL ? 10000 : 25000;
