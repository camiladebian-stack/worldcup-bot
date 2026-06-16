const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT = 30_000;
const MAX_INPUT_LENGTH = 2000;

const MODELS = [
  "deepseek/deepseek-chat-v3.1:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-235b-a22b:free",
  "openai/gpt-oss-120b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
];

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

export async function askAI(
  question: string,
  apiKey: string
): Promise<string> {
  const truncated = question.slice(0, MAX_INPUT_LENGTH);
  let lastError: Error | null = null;

  for (const model of MODELS) {
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
            {
              role: "system",
              content:
                "You are a highly intelligent, direct, and concise assistant. Answer clearly and to the point without unnecessary explanations. Be helpful, accurate, and efficient. Do not use markdown formatting.",
            },
            { role: "user", content: truncated },
          ],
          max_tokens: 1024,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        console.warn(`[AI] Model ${model} failed (${response.status}): ${text}`);
        lastError = new Error(`AI API error ${response.status}`);
        continue;
      }

      const data = (await response.json()) as any;
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        lastError = new Error("Empty response from AI");
        continue;
      }

      return stripMarkdown(content.trim());
    } catch (error: any) {
      console.warn(`[AI] Model ${model} error:`, error.message);
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("All AI models failed");
}
