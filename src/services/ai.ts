import { Match } from "../types";

// ── Configuration ───────────────────────────────────────────────────
const REQUEST_TIMEOUT = 30_000;
const MAX_INPUT_LENGTH = 2000;

// ── Groq Configuration ──────────────────────────────────────────────
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

// ── OpenRouter Configuration (Fallback) ─────────────────────────────
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS = [
  "deepseek/deepseek-chat-v3.1:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-235b-a22b:free",
  "openai/gpt-oss-120b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
];

// ── Types ───────────────────────────────────────────────────────────
export type AIProvider = "groq" | "openrouter";

export interface AIProviderConfig {
  groqApiKey?: string;
  openrouterApiKey?: string;
  preferredProvider: AIProvider;
}

// ── Helper Functions ────────────────────────────────────────────────
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/(?<!\*)\*(?!\*)/g, "")
    .replace(/`{1,3}[^`]*`{1,3}/g, (m) => m.replace(/`/g, ""))
    .replace(/^#{1,6}\s/gm, "")
    .replace(/^\s*[-*]\s/gm, "")
    .replace(/^\s*\d+\.\s/gm, "")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/^>\s/gm, "");
}

// ── Groq Provider (Fastest, 30 RPM free) ───────────────────────────
async function askGroq(
  question: string,
  apiKey: string,
  systemPrompt: string
): Promise<string> {
  const truncated = question.slice(0, MAX_INPUT_LENGTH);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: truncated },
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Groq API error (${response.status}): ${text}`);
    }

    const data = (await response.json()) as any;
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty Groq response");

    return content.trim();
  } catch (error: any) {
    clearTimeout(timeout);
    throw error;
  }
}

// ── OpenRouter Provider (Fallback) ──────────────────────────────────
async function askOpenRouter(
  question: string,
  apiKey: string,
  systemPrompt: string
): Promise<string> {
  const truncated = question.slice(0, MAX_INPUT_LENGTH);

  for (const model of OPENROUTER_MODELS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://github.com/camiladebian-stack/worldcup-bot",
          "X-Title": "WorldCup Discord Bot",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: truncated },
          ],
          max_tokens: 1024,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const text = await response.text();
        console.warn(`[AI] OpenRouter model ${model} failed (${response.status}): ${text}`);
        continue;
      }

      const data = (await response.json()) as any;
      const content = data.choices?.[0]?.message?.content;
      if (!content) continue;

      return content.trim();
    } catch (error: any) {
      clearTimeout(timeout);
      console.warn(`[AI] OpenRouter model ${model} error:`, error.message);
    }
  }

  throw new Error("All OpenRouter models failed");
}

// ── Main Functions (Multi-Provider with Fallback Chain) ─────────────
function getProviderOrder(config: AIProviderConfig): AIProvider[] {
  const order: AIProvider[] = [config.preferredProvider];
  const all: AIProvider[] = ["groq", "openrouter"];
  for (const p of all) {
    if (!order.includes(p)) order.push(p);
  }
  return order;
}

function isProviderAvailable(provider: AIProvider, config: AIProviderConfig): boolean {
  switch (provider) {
    case "groq": return !!config.groqApiKey;
    case "openrouter": return !!config.openrouterApiKey;
  }
}

async function askWithProvider(
  provider: AIProvider,
  question: string,
  config: AIProviderConfig,
  systemPrompt: string
): Promise<string> {
  switch (provider) {
    case "groq":
      return askGroq(question, config.groqApiKey!, systemPrompt);
    case "openrouter":
      return askOpenRouter(question, config.openrouterApiKey!, systemPrompt);
  }
}

export async function askAI(
  question: string,
  config: AIProviderConfig
): Promise<string> {
  const truncated = question.slice(0, MAX_INPUT_LENGTH);
  const systemPrompt =
    "You are a highly intelligent, direct, and concise assistant. " +
    "Answer clearly and to the point without unnecessary explanations. " +
    "Be helpful, accurate, and efficient. Do not use markdown formatting.";

  const providers = getProviderOrder(config);
  const errors: string[] = [];

  for (const provider of providers) {
    if (!isProviderAvailable(provider, config)) continue;
    try {
      const result = await askWithProvider(provider, truncated, config, systemPrompt);
      return stripMarkdown(result);
    } catch (error: any) {
      console.warn(`[AI] ${provider} failed:`, error.message);
      errors.push(`${provider}: ${error.message}`);
    }
  }

  throw new Error(`All AI providers failed: ${errors.join("; ")}`);
}

export async function generateMatchAnalysis(
  match: Match,
  config: AIProviderConfig
): Promise<string> {
  const home = match.score.fullTime.home ?? 0;
  const away = match.score.fullTime.away ?? 0;
  const htHome = match.score.halfTime.home ?? 0;
  const htAway = match.score.halfTime.away ?? 0;

  const stage = match.stage?.replace(/_/g, " ") || "Group Stage";
  const group = match.group || "";
  const matchday = match.matchday || "";

  const prompt = `Write a short, fun post-match analysis for this FIFA World Cup match.

Match: ${match.homeTeam.name} ${home} - ${away} ${match.awayTeam.name}
Half-time: ${htHome} - ${htAway}
Stage: ${stage}${group ? ` | Group ${group}` : ""}${matchday ? ` | Matchday ${matchday}` : ""}

Write 3-4 short paragraphs. Be enthusiastic and engaging. Mention key moments implied by the score. If it was a big win, talk about dominance. If it was close, talk about the tension. If there was a big HT difference, mention the comeback or collapse. Keep it under 400 characters. Do not use markdown formatting.`;

  const systemPrompt =
    "You are a fun, enthusiastic football commentator. " +
    "Write engaging post-match analysis. Be concise and exciting. No markdown.";

  const providers = getProviderOrder(config);
  const errors: string[] = [];

  for (const provider of providers) {
    if (!isProviderAvailable(provider, config)) continue;
    try {
      const result = await askWithProvider(provider, prompt, config, systemPrompt);
      return stripMarkdown(result);
    } catch (error: any) {
      console.warn(`[AI] ${provider} analysis failed:`, error.message);
      errors.push(`${provider}: ${error.message}`);
    }
  }

  throw new Error(`All AI providers failed for match analysis: ${errors.join("; ")}`);
}
