import { GoogleGenAI } from "@google/genai";
import { Match } from "../types";

// ── Configuration ───────────────────────────────────────────────────
const REQUEST_TIMEOUT = 30_000;
const MAX_INPUT_LENGTH = 2000;
const GEMINI_MODEL = "gemini-2.0-flash";

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
export interface AIProviderConfig {
  geminiApiKey?: string;
  openrouterApiKey?: string;
  preferredProvider: "gemini" | "openrouter";
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

// ── Google Gemini Provider ──────────────────────────────────────────
async function askGemini(
  question: string,
  apiKey: string,
  systemPrompt: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: question,
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: 1024,
      temperature: 0.7,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Empty Gemini response");
  return text;
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

// ── Main Functions (Dual Provider with Fallback) ────────────────────
export async function askAI(
  question: string,
  config: AIProviderConfig
): Promise<string> {
  const truncated = question.slice(0, MAX_INPUT_LENGTH);
  const systemPrompt =
    "You are a highly intelligent, direct, and concise assistant. " +
    "Answer clearly and to the point without unnecessary explanations. " +
    "Be helpful, accurate, and efficient. Do not use markdown formatting.";

  // Try Gemini first if configured
  if (config.preferredProvider === "gemini" && config.geminiApiKey) {
    try {
      const result = await askGemini(truncated, config.geminiApiKey, systemPrompt);
      return stripMarkdown(result);
    } catch (error: any) {
      console.warn("[AI] Gemini failed, falling back to OpenRouter:", error.message);
    }
  }

  // Fallback to OpenRouter
  if (config.openrouterApiKey) {
    try {
      const result = await askOpenRouter(truncated, config.openrouterApiKey, systemPrompt);
      return stripMarkdown(result);
    } catch (error: any) {
      console.warn("[AI] OpenRouter failed:", error.message);
    }
  }

  throw new Error("All AI providers failed. Check your API keys.");
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

  // Try Gemini first if configured
  if (config.preferredProvider === "gemini" && config.geminiApiKey) {
    try {
      const result = await askGemini(prompt, config.geminiApiKey, systemPrompt);
      return stripMarkdown(result);
    } catch (error: any) {
      console.warn("[AI] Gemini analysis failed, falling back to OpenRouter:", error.message);
    }
  }

  // Fallback to OpenRouter
  if (config.openrouterApiKey) {
    try {
      const result = await askOpenRouter(prompt, config.openrouterApiKey, systemPrompt);
      return stripMarkdown(result);
    } catch (error: any) {
      console.warn("[AI] OpenRouter analysis failed:", error.message);
    }
  }

  throw new Error("All AI providers failed for match analysis.");
}
