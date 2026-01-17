import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import type { FeedbackItem, FeedbackType, FeedbackStatus, FeedbackData } from '../types/index.js';

const DATA_DIR = './data';
const FEEDBACK_PATH = `${DATA_DIR}/feedback.json`;

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function load(): FeedbackData {
  ensureDataDir();
  if (!existsSync(FEEDBACK_PATH)) {
    return { nextId: {}, items: [] };
  }
  return JSON.parse(readFileSync(FEEDBACK_PATH, 'utf-8')) as FeedbackData;
}

function save(data: FeedbackData): void {
  ensureDataDir();
  writeFileSync(FEEDBACK_PATH, JSON.stringify(data, null, 2));
}

/**
 * Create a new feedback item
 */
export function createFeedback(
  guildId: string,
  type: FeedbackType,
  authorId: string,
  authorTag: string,
  title: string,
  description: string,
  messageId: string,
  channelId: string
): FeedbackItem {
  const data = load();

  const id = (data.nextId[guildId] ?? 0) + 1;
  data.nextId[guildId] = id;

  const item: FeedbackItem = {
    id,
    guildId,
    type,
    authorId,
    authorTag,
    title,
    description,
    status: 'new',
    messageId,
    channelId,
    upvotes: 0,
    downvotes: 0,
    timestamp: new Date().toISOString(),
  };

  data.items.push(item);
  save(data);

  return item;
}

/**
 * Get a feedback item by ID
 */
export function getFeedback(guildId: string, id: number): FeedbackItem | undefined {
  const data = load();
  return data.items.find((item) => item.guildId === guildId && item.id === id);
}

/**
 * Update feedback status
 */
export function updateFeedbackStatus(
  guildId: string,
  id: number,
  status: FeedbackStatus
): FeedbackItem | undefined {
  const data = load();
  const item = data.items.find((i) => i.guildId === guildId && i.id === id);

  if (item) {
    item.status = status;
    save(data);
  }

  return item;
}

/**
 * Update vote counts
 */
export function updateVotes(guildId: string, id: number, upvotes: number, downvotes: number): void {
  const data = load();
  const item = data.items.find((i) => i.guildId === guildId && i.id === id);

  if (item) {
    item.upvotes = upvotes;
    item.downvotes = downvotes;
    save(data);
  }
}

/**
 * Get all feedback items for a guild by type
 */
export function getFeedbackByType(guildId: string, type: FeedbackType): FeedbackItem[] {
  const data = load();
  return data.items
    .filter((item) => item.guildId === guildId && item.type === type)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Get status emoji
 */
export function getStatusEmoji(status: FeedbackStatus): string {
  const emojis: Record<FeedbackStatus, string> = {
    new: '🆕',
    reviewing: '👀',
    in_progress: '🚧',
    done: '✅',
    wont_do: '❌',
  };
  return emojis[status];
}

/**
 * Get status display name
 */
export function getStatusName(status: FeedbackStatus): string {
  const names: Record<FeedbackStatus, string> = {
    new: 'New',
    reviewing: 'Reviewing',
    in_progress: 'In Progress',
    done: 'Done',
    wont_do: "Won't Do",
  };
  return names[status];
}

/**
 * Get type emoji
 */
export function getTypeEmoji(type: FeedbackType): string {
  const emojis: Record<FeedbackType, string> = {
    suggestion: '💡',
    bug: '🐛',
    feedback: '💬',
  };
  return emojis[type];
}

/**
 * Get type color
 */
export function getTypeColor(type: FeedbackType): number {
  const colors: Record<FeedbackType, number> = {
    suggestion: 0x5865f2, // Blue
    bug: 0xed4245, // Red
    feedback: 0x57f287, // Green
  };
  return colors[type];
}
