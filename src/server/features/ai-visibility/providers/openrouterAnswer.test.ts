import { afterEach, expect, it, vi, type Mock } from "vitest";
import { z } from "zod";
import { fetchOpenRouterAnswer } from "./openrouterAnswer";

vi.mock("@/server/lib/runtime-env", () => ({
  getRequiredEnvValue: async () => "key",
}));

afterEach(() => vi.unstubAllGlobals());

function reply(status: number, body: unknown) {
  const fetchMock = vi.fn<typeof fetch>(async () =>
    Response.json(body, { status }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentPlugins(fetchMock: Mock<typeof fetch>) {
  return z
    .object({ plugins: z.unknown().optional() })
    .parse(JSON.parse(z.string().parse(fetchMock.mock.calls[0]?.[1]?.body)))
    .plugins;
}

it("keeps cited pages and names Gemini's redirect citations by their domain", async () => {
  const fetchMock = reply(200, {
    choices: [
      {
        message: {
          content: "Try **Arcano & Co**.",
          annotations: [
            {
              type: "url_citation",
              url_citation: {
                url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc",
                title: "arcanoandco.com",
              },
            },
            {
              type: "url_citation",
              url_citation: {
                url: "https://clutch.co/cy/web-designers?utm_source=openai",
                title: "Clutch",
              },
            },
          ],
        },
      },
    ],
  });

  const answer = await fetchOpenRouterAnswer("gemini", "Best agency?");

  expect(answer.answerText).toBe("Try Arcano & Co.");
  expect(answer.citations).toMatchObject([
    { url: "https://arcanoandco.com/", domain: "arcanoandco.com" },
    { url: "https://clutch.co/cy/web-designers", domain: "clutch.co" },
  ]);
  expect(sentPlugins(fetchMock)).toEqual([{ id: "web", engine: "native" }]);
});

it("does not send the native search plugin to Perplexity, which rejects it", async () => {
  const fetchMock = reply(200, { choices: [{ message: { content: "Hi" } }] });

  await fetchOpenRouterAnswer("perplexity", "Best agency?");

  expect(sentPlugins(fetchMock)).toBeUndefined();
});

it("marks rate limits as retryable and bad requests as final", async () => {
  reply(429, { error: "slow down" });
  await expect(fetchOpenRouterAnswer("claude", "Q")).rejects.toMatchObject({
    code: "UPSTREAM_UNAVAILABLE",
  });
  reply(400, { error: "bad" });
  await expect(fetchOpenRouterAnswer("claude", "Q")).rejects.toMatchObject({
    code: "INTERNAL_ERROR",
  });
  reply(402, { error: "This request would exceed your available credits" });
  await expect(fetchOpenRouterAnswer("claude", "Q")).rejects.toMatchObject({
    code: "INSUFFICIENT_CREDITS",
  });
});
