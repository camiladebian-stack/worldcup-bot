const SILICONFLOW_URL = "https://api.siliconflow.cn/v1/chat/completions";
const MODEL = "Qwen/Qwen3-8B";

export async function askAI(
  question: string,
  apiKey: string
): Promise<string> {
  const response = await fetch(SILICONFLOW_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
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
