import Groq from 'groq-sdk';

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

export function isAIAvailable(): boolean {
  return groq !== null;
}

export async function chat(message: string): Promise<string> {
  if (!groq) throw new Error('AI not configured - set GROQ_API_KEY');

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: message },
    ],
    max_tokens: 1024,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content ?? 'No response';
}

export async function summarize(text: string): Promise<string> {
  if (!groq) throw new Error('AI not configured - set GROQ_API_KEY');

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: 'Summarize concisely in bullet points.' },
      { role: 'user', content: text },
    ],
    max_tokens: 512,
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content ?? 'Could not summarize';
}
