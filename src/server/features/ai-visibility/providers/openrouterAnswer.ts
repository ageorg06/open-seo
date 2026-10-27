import { z } from "zod";
import { AppError } from "@/server/lib/errors";
import { getRequiredEnvValue } from "@/server/lib/runtime-env";
import type { AiModelApiEngine } from "@/shared/ai-visibility";
import {
  citationsFrom,
  markdownToText,
  type ParsedAiAnswer,
} from "./dataforseoEvidence";

// ponytail: pinned slugs; bump when an engine's consumer app moves to a new default model.
const ENGINE_MODELS: Record<AiModelApiEngine, string> = {
  chatgpt: "openai/gpt-5.6-luna",
  gemini: "google/gemini-3.8-flash",
  claude: "anthropic/claude-sonnet-5.5",
  perplexity: "perplexity/sonar",
};

/** OpenRouter USD per answer with web search, measured 2026-10-26. */
export const OPENROUTER_ANSWER_USD: Record<AiModelApiEngine, number> = {
  chatgpt: 0.025,
  gemini: 0.035,
  claude: 0.045,
  perplexity: 0.006,
};

const GOOGLE_REDIRECT = "https://vertexaisearch.cloud.google.com/";

const responseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullish(),
          annotations: z
            .array(
              z.object({
                url_citation: z
                  .object({ url: z.string(), title: z.string().nullish() })
                  .nullish(),
              }),
            )
            .nullish(),
        }),
      }),
    )
    .min(1),
});

/**
 * One answer from the engine's official model API through OpenRouter, with the
 * provider's own web search. Citations come from the url_citation annotations.
 */
export async function fetchOpenRouterAnswer(
  engine: AiModelApiEngine,
  prompt: string,
): Promise<ParsedAiAnswer> {
  const apiKey = await getRequiredEnvValue("OPENROUTER_API_KEY");
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ENGINE_MODELS[engine],
        messages: [{ role: "user", content: prompt }],
        // Sonar always searches, and OpenRouter rejects the native plugin for it.
        ...(engine === "perplexity"
          ? {}
          : { plugins: [{ id: "web", engine: "native" }] }),
        // Reasoning counts against this, so a smaller cap can empty the answer.
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(120_000),
    },
  );
  if (!response.ok) {
    const transient = response.status === 429 || response.status >= 500;
    throw new AppError(
      response.status === 402
        ? "INSUFFICIENT_CREDITS"
        : transient
          ? "UPSTREAM_UNAVAILABLE"
          : "INTERNAL_ERROR",
      `OpenRouter ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
  }
  const parsed = responseSchema.safeParse(await response.json());
  if (!parsed.success)
    throw new AppError(
      "INTERNAL_ERROR",
      "OpenRouter returned an invalid response shape",
    );
  const { message } = parsed.data.choices[0];
  const markdown = message.content ?? "";
  const answerText = markdownToText(markdown);
  return {
    answerMarkdown: answerText.trim() ? markdown : null,
    answerText: answerText.trim() ? answerText : "",
    citations: citationsFrom(
      (message.annotations ?? []).flatMap(({ url_citation: cited }) => {
        if (!cited) return [];
        // Gemini cites opaque Google redirects and names the domain in the title.
        if (cited.url.startsWith(GOOGLE_REDIRECT) && cited.title)
          return [{ url: `https://${cited.title}/`, title: cited.title }];
        return [cited];
      }),
    ),
    collectedAt: null,
  };
}
