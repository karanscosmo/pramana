import Anthropic from "@anthropic-ai/sdk";
import { CheckOutput } from "../types/index.js";

export interface DocumentNameEntry {
  docType: string;
  sourceField: string;
  name: string;
}

export interface PairwiseComparison {
  docA: string;
  nameA: string;
  docB: string;
  nameB: string;
  judgment: "match" | "partial_match" | "mismatch";
  similarityScore: number;
  reasoning: string;
}

/**
 * Normalizes company and legal entity names for rule-based comparison.
 */
export function normalizeEntityName(raw: string): string {
  if (!raw) return "";
  let s = raw.toUpperCase().trim();
  s = s.replace(/[\.,\-_/\\()&]/g, " ");
  s = s.replace(/\b(PVT|PRIVATE)\b/g, "PVT");
  s = s.replace(/\b(LTD|LIMITED)\b/g, "LTD");
  s = s.replace(/\b(CORP|CORPORATION)\b/g, "CORP");
  s = s.replace(/\b(INC|INCORPORATED)\b/g, "INC");
  s = s.replace(/\b(CO|COMPANY)\b/g, "CO");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/**
 * Computes heuristic Jaccard token similarity with suffix tolerance.
 */
export function computeNameSimilarity(nameA: string, nameB: string): {
  score: number;
  judgment: "match" | "partial_match" | "mismatch";
  reasoning: string;
} {
  const normA = normalizeEntityName(nameA);
  const normB = normalizeEntityName(nameB);

  if (normA === normB) {
    return {
      score: 1.0,
      judgment: "match",
      reasoning: "Exact character match after standardizing corporate abbreviations and whitespace.",
    };
  }

  const tokensA = normA.split(" ").filter(Boolean);
  const tokensB = normB.split(" ").filter(Boolean);

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  const intersection = tokensA.filter((t) => setB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  const jaccard = union > 0 ? intersection / union : 0;

  // Check if one is a clean prefix or trade alias of the other
  // e.g. "Sharma Enterprises" vs "Sharma Enterprises Pvt Ltd"
  const nonSuffixA = tokensA.filter((t) => !["PVT", "LTD", "LLP", "CO"].includes(t)).join(" ");
  const nonSuffixB = tokensB.filter((t) => !["PVT", "LTD", "LLP", "CO"].includes(t)).join(" ");

  if (nonSuffixA && nonSuffixA === nonSuffixB) {
    return {
      score: 0.92,
      judgment: "match",
      reasoning: `Same root entity ('${nonSuffixA}'). Discrepancy is purely formal suffix syntax ('Pvt Ltd' vs 'Private Limited').`,
    };
  }

  if (nonSuffixA.includes(nonSuffixB) || nonSuffixB.includes(nonSuffixA)) {
    return {
      score: 0.78,
      judgment: "partial_match",
      reasoning: "High stem overlap; appears to be trade name or subsidiary designation, but missing secondary qualifiers.",
    };
  }

  if (jaccard >= 0.7) {
    return {
      score: jaccard,
      judgment: "match",
      reasoning: `Strong token concordance (${Math.round(jaccard * 100)}% token overlap). Minor ordering or formatting divergence.`,
    };
  }

  if (jaccard >= 0.4) {
    return {
      score: jaccard,
      judgment: "partial_match",
      reasoning: `Moderate overlap (${Math.round(jaccard * 100)}%). Key words match, but secondary words or entity structure diverge.`,
    };
  }

  return {
    score: jaccard,
    judgment: "mismatch",
    reasoning: `Distinct legal names entirely (${Math.round(jaccard * 100)}% overlap). High likelihood of unrelated business or fraudulent document mix.`,
  };
}

/**
 * Uses Claude (or deterministic semantic fallback) to evaluate pairwise entity name congruence.
 * The LLM earns its place here specifically for nuanced semantic variations
 * (e.g. proprietary trading styles, initials, transliterations).
 */
export async function matchNamesAcrossDocuments(
  names: DocumentNameEntry[],
  apiKey?: string
): Promise<CheckOutput> {
  const validNames = names.filter((n) => n.name && n.name.trim().length > 0);

  if (validNames.length < 2) {
    return {
      checkType: "name_cross_match",
      result: "pass",
      detail: "Insufficient documents to cross-compare names (at least 2 documents with extracted names are required).",
      evidence: {
        namesProvided: validNames,
        comparisonsCount: 0,
        skipped: true,
      },
    };
  }

  const pairwiseResults: PairwiseComparison[] = [];

  // If Claude API key is configured, prompt Claude 3.5 Sonnet for semantic judgment
  if (apiKey) {
    try {
      const anthropic = new Anthropic({ apiKey });
      const prompt = `You are a compliance officer validating KYB (Know Your Business) onboarding documents in India.
Compare the following business/entity names extracted from different uploaded documents:

${JSON.stringify(validNames, null, 2)}

For each distinct pair of documents, evaluate whether they refer to the SAME legal entity, taking into account:
1. Legal corporate suffixes (e.g., "Pvt Ltd" vs "Private Limited", "LLP", "Inc")
2. Spacing, capitalization, and punctuation OCR variations
3. Common trade style abbreviations or director names vs proprietary firm names
4. Serious discrepancies (e.g., completely different company names or unrelated individuals)

Return STRICT JSON adhering to this structure:
{
  "overallVerdict": "pass" | "fail" | "inconclusive",
  "summary": "Clear, audit-ready 1-2 sentence explanation citing the actual names compared",
  "comparisons": [
    {
      "docA": "...",
      "nameA": "...",
      "docB": "...",
      "nameB": "...",
      "judgment": "match" | "partial_match" | "mismatch",
      "similarityScore": 0.0 to 1.0,
      "reasoning": "..."
    }
  ]
}`;

      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const content = response.content[0];
      if (content.type === "text") {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            checkType: "name_cross_match",
            result: parsed.overallVerdict || "pass",
            detail: parsed.summary,
            evidence: {
              evaluationMethod: "claude-3-5-sonnet (Semantic Analysis)",
              comparisons: parsed.comparisons,
              namesExtracted: validNames,
            },
          };
        }
      }
    } catch (err: any) {
      console.warn("Claude name matching call failed or timed out, falling back to deterministic semantic matcher:", err.message);
    }
  }

  // Deterministic fallback comparison
  let hasMismatch = false;
  let hasPartialMatch = false;

  for (let i = 0; i < validNames.length; i++) {
    for (let j = i + 1; j < validNames.length; j++) {
      const docA = validNames[i];
      const docB = validNames[j];
      const comp = computeNameSimilarity(docA.name, docB.name);

      pairwiseResults.push({
        docA: `${docA.docType} (${docA.sourceField})`,
        nameA: docA.name,
        docB: `${docB.docType} (${docB.sourceField})`,
        nameB: docB.name,
        judgment: comp.judgment,
        similarityScore: Math.round(comp.score * 100) / 100,
        reasoning: comp.reasoning,
      });

      if (comp.judgment === "mismatch") hasMismatch = true;
      if (comp.judgment === "partial_match") hasPartialMatch = true;
    }
  }

  const result = hasMismatch ? "fail" : "pass";
  const detail = hasMismatch
    ? `Legal entity name mismatch detected across uploaded documents. One or more documents refer to distinct businesses.`
    : hasPartialMatch
    ? `Legal entity names across documents are consistent with minor formatting or trade style variations.`
    : `Legal entity names match across all ${validNames.length} uploaded documents.`;

  return {
    checkType: "name_cross_match",
    result,
    detail,
    evidence: {
      evaluationMethod: "Deterministic Semantic Normalization & Token Overlap",
      comparisons: pairwiseResults,
      namesExtracted: validNames,
      note: "LLM semantic evaluation active when ANTHROPIC_API_KEY is configured.",
    },
  };
}
