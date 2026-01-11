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

interface Message {
  role: 'user' | 'assistant';
  content: string;
}
const conversations = new Map<string, Message[]>();

export function clearHistory(userId: string): void {
  conversations.delete(userId);
}

export async function chatWithHistory(userId: string, message: string): Promise<string> {
  if (!groq) throw new Error('AI not configured - set GROQ_API_KEY');

  const history = conversations.get(userId) ?? [];
  history.push({ role: 'user', content: message });

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'system', content: 'You are a helpful assistant.' }, ...history.slice(-10)],
    max_tokens: 1024,
    temperature: 0.7,
  });

  const reply = response.choices[0]?.message?.content ?? 'No response';
  history.push({ role: 'assistant', content: reply });
  conversations.set(userId, history);

  return reply;
}
