import { describe, expect, it, vi } from "vitest";
import { aiCostForAnswers } from "./aiVisibilityCost";
vi.mock("cloudflare:workers", () => ({ env: {} }));
vi.mock("../repositories/AiVisibilityRepository", () => ({
  AiVisibilityRepository: {},
}));
vi.mock("./aiVisibilityMutation", () => ({}));
const overview = (count: number) =>
  Array<"google_ai_overview">(count).fill("google_ai_overview");
// Real pricing functions and constants: only unused IO dependencies are mocked.
describe("AI collection estimates", () => {
  it("quotes hosted markup and credit rounding per provider call", () => {
    expect(aiCostForAnswers(overview(12), true, "queued")).toEqual({
      providerCostUsd: 0.0144,
      costCredits: 24,
      costUsd: 0.024,
    });
    expect(aiCostForAnswers([], true, "queued")).toEqual({
      providerCostUsd: 0,
      costCredits: 0,
      costUsd: 0,
    });
  });
  it("quotes live AI Overviews for manual runs at the live price", () => {
    expect(aiCostForAnswers(overview(3), false, "live").providerCostUsd).toBe(
      0.012,
    );
  });
  it("quotes self-hosted provider cost without markup or credits", () => {
    expect(aiCostForAnswers(overview(3), false, "queued")).toEqual({
      providerCostUsd: 0.0036,
      costCredits: 0,
      costUsd: 0.0036,
    });
  });
  it("prices model API engines at OpenRouter rates on every run", () => {
    for (const mode of ["queued", "live"] as const)
      expect(
        aiCostForAnswers(["chatgpt", "perplexity"], false, mode)
          .providerCostUsd,
      ).toBe(0.031);
  });
});
