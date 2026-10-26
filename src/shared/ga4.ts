/** Better Auth provider ID for the dedicated Google Analytics grant. */
export const GA4_OAUTH_PROVIDER_ID = "google-analytics";

export const GA4_DATA_SCOPE =
  "https://www.googleapis.com/auth/analytics.readonly";

export const GA4_OAUTH_SCOPES = [
  "openid",
  "email",
  "profile",
  GA4_DATA_SCOPE,
] as const;

export const GA4_SELF_HOSTED_SETUP_DOCS_URL =
  "https://github.com/every-app/open-seo/blob/main/docs/SELF_HOSTING_GOOGLE_ANALYTICS.md";

/** GA4's native default channel group for AI assistant referrals. */
export const GA4_AI_ASSISTANT_CHANNEL_GROUP = "AI Assistant";

/**
 * AI assistants identified by their `sessionSource`. Patterns are RE2-safe so
 * the same strings drive the GA4 `PARTIAL_REGEXP` filter and in-app naming.
 */
const AI_ASSISTANT_SOURCES = [
  { name: "ChatGPT", pattern: "chatgpt|openai" },
  { name: "Perplexity", pattern: "perplexity" },
  { name: "Gemini", pattern: "gemini\\.google|bard\\.google" },
  { name: "Copilot", pattern: "copilot|edgeservices\\.bing\\.com" },
  { name: "Claude", pattern: "claude\\.ai|anthropic" },
  { name: "DeepSeek", pattern: "deepseek" },
  { name: "Grok", pattern: "grok|(^|\\.)x\\.ai$" },
  { name: "Meta AI", pattern: "(^|\\.)meta\\.ai$" },
  { name: "You.com", pattern: "(^|\\.)you\\.com$" },
  { name: "Phind", pattern: "phind" },
  { name: "Mistral", pattern: "mistral" },
  { name: "Poe", pattern: "(^|\\.)poe\\.com$" },
].map((assistant) => ({
  name: assistant.name,
  pattern: assistant.pattern,
  regex: new RegExp(assistant.pattern, "i"),
}));

export const GA4_AI_ASSISTANT_SOURCE_REGEX = AI_ASSISTANT_SOURCES.map(
  ({ pattern }) => `(${pattern})`,
).join("|");

/** Assistant name for a GA4 `sessionSource`, or null when it is not one. */
export function aiAssistantForSource(source: string): string | null {
  return (
    AI_ASSISTANT_SOURCES.find(({ regex }) => regex.test(source))?.name ?? null
  );
}
