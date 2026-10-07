import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { DEFAULT_MODEL_IDS, getReviewModels } from "./models";

describe("getReviewModels", () => {
  it("returns no models when no keys are set", () => {
    expect(getReviewModels({})).toEqual([]);
  });

  it("orders providers Groq, Gemini, Mistral and skips blank keys", () => {
    const models = getReviewModels({
      MISTRAL_API_KEY: "m-key",
      GOOGLE_GENERATIVE_AI_API_KEY: "  ",
      GROQ_API_KEY: "g-key",
    });
    expect(models.map((m) => m.provider)).toEqual(["groq", "mistral"]);
    expect(models[0].modelId).toBe(DEFAULT_MODEL_IDS.groq);
  });

  it("lets the model id be changed without a code change", () => {
    const models = getReviewModels({ GOOGLE_GENERATIVE_AI_API_KEY: "k", GEMINI_MODEL: "gemini-3.8-flash" });
    expect(models[0]).toMatchObject({ provider: "gemini", modelId: "gemini-3.8-flash" });
  });
});
