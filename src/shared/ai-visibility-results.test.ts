import { describe, expect, it } from "vitest";
import type { AiObservationRow } from "./ai-visibility";
import { summarizeAiBrands } from "./ai-visibility-results";

const answer = (sample: number, mentioned: boolean): AiObservationRow => ({
  id: `answer-${sample}`,
  runId: "run",
  promptId: "prompt",
  prompt: "Which SEO tools?",
  topic: "General",
  branded: false,
  engine: "chatgpt",
  sample,
  status: "completed",
  answerStatus: "answered",
  brands: [
    {
      name: "OpenSEO",
      domain: "openseo.so",
      own: true,
      mentioned,
      cited: false,
      firstMention: mentioned ? 0 : null,
    },
  ],
  citationCount: 0,
  collectedAt: null,
  error: null,
});

describe("summarizeAiBrands", () => {
  it("rates a prompt over every answer collected for it", () => {
    const [own] = summarizeAiBrands([
      answer(1, true),
      answer(2, false),
      answer(3, false),
    ]);

    expect(own).toMatchObject({ answers: 3, mentions: 1 });
  });
});
