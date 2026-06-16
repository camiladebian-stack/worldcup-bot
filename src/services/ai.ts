const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "meta-llama/llama-3.3-70b-instruct:free";

export async function askAI(
  question: string,
  apiKey: string
): Promise<string> {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://github.com/camiladebian-stack/worldcup-bot",
      "X-Title": "WorldCup Discord Bot",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant. Answer concisely and clearly. If the question is about football or the World Cup, provide accurate information.",
        },
        { role: "user", content: question },
      ],
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

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
}
