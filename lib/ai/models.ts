import "server-only";
import { createGoogle } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import type { ReviewModel } from "./supplier-review-agent";

// Free-tier providers in fallback order. Groq goes first because it does
// not train on what it is sent (turn on Zero Data Retention in its console).
// Gemini's and Mistral's free tiers may use prompts for training, which is
// acceptable only because the review sends product data and nothing personal.
// A provider without a key is skipped; with none, the AI proof runs the
// basic checks only.

export const DEFAULT_MODEL_IDS = {
  groq: "openai/gpt-oss-120b",
  gemini: "gemini-3.5-flash-lite",
  mistral: "mistral-small-latest",
} as const;

type Env = Record<string, string | undefined>;

function key(env: Env, name: string): string | null {
  const value = env[name]?.trim();
  return value ? value : null;
}

export function getReviewModels(env: Env = process.env): ReviewModel[] {
  const models: ReviewModel[] = [];

  const groqKey = key(env, "GROQ_API_KEY");
  if (groqKey) {
    const modelId = key(env, "GROQ_MODEL") ?? DEFAULT_MODEL_IDS.groq;
    models.push({ provider: "groq", modelId, model: createGroq({ apiKey: groqKey })(modelId) });
  }

  const geminiKey = key(env, "GOOGLE_GENERATIVE_AI_API_KEY");
  if (geminiKey) {
    const modelId = key(env, "GEMINI_MODEL") ?? DEFAULT_MODEL_IDS.gemini;
    models.push({ provider: "gemini", modelId, model: createGoogle({ apiKey: geminiKey })(modelId) });
  }

  const mistralKey = key(env, "MISTRAL_API_KEY");
  if (mistralKey) {
    const modelId = key(env, "MISTRAL_MODEL") ?? DEFAULT_MODEL_IDS.mistral;
    models.push({ provider: "mistral", modelId, model: createMistral({ apiKey: mistralKey })(modelId) });
  }

  return models;
}
