const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-235b-a22b:free",
  "deepseek/deepseek-chat-v3.1:free",
  "google/gemma-3-27b-it:free",
];

export async function askAI(
  question: string,
  apiKey: string
): Promise<string> {
  let lastError: Error | null = null;

  for (const model of MODELS) {
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
                "You are a highly intelligent, direct, and concise assistant. Answer clearly and to the point without unnecessary explanations. Be helpful, accurate, and efficient.",
            },
            { role: "user", content: question },
          ],
          max_tokens: 1024,
          temperature: 0.7,
        }),
      });

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "10", 10);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`AI API error ${response.status}: ${text}`);
      }

      const data = (await response.json()) as any;
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("Empty response from AI");
      }

      return content.trim();
    } catch (error: any) {
      lastError = error;
      if (error.message.includes("429")) {
        continue;
      }
    }
  }

  throw lastError || new Error("All AI models failed");
}
