import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import type { ModCase, ModActionType, ModerationData } from '../types/index.js';

const DATA_DIR = './data';
const MOD_DATA_PATH = `${DATA_DIR}/moderation.json`;

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function load(): ModerationData {
  ensureDataDir();
  if (!existsSync(MOD_DATA_PATH)) {
    return { nextCaseId: {}, cases: [] };
  }
  return JSON.parse(readFileSync(MOD_DATA_PATH, 'utf-8')) as ModerationData;
}

function save(data: ModerationData): void {
  ensureDataDir();
  writeFileSync(MOD_DATA_PATH, JSON.stringify(data, null, 2));
}

/**
 * Create a new moderation case
 */
export function createCase(
  guildId: string,
  targetId: string,
  targetTag: string,
  moderatorId: string,
  moderatorTag: string,
  action: ModActionType,
  reason: string,
  duration?: number
): ModCase {
  const data = load();

  // Get next case ID for this guild
  const caseId = (data.nextCaseId[guildId] ?? 0) + 1;
  data.nextCaseId[guildId] = caseId;

  const modCase: ModCase = {
    id: caseId,
    guildId,
    targetId,
    targetTag,
    moderatorId,
    moderatorTag,
    action,
    reason,
    duration,
    timestamp: new Date().toISOString(),
  };

  data.cases.push(modCase);
  save(data);

  return modCase;
}

/**
 * Get all cases for a user in a guild
 */
export function getUserCases(guildId: string, userId: string): ModCase[] {
  const data = load();
  return data.cases.filter((c) => c.guildId === guildId && c.targetId === userId);
}

/**
 * Get a specific case by ID
 */
export function getCase(guildId: string, caseId: number): ModCase | undefined {
  const data = load();
  return data.cases.find((c) => c.guildId === guildId && c.id === caseId);
}

/**
 * Get recent cases for a guild
 */
export function getRecentCases(guildId: string, limit = 10): ModCase[] {
  const data = load();
  return data.cases
    .filter((c) => c.guildId === guildId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

/**
 * Count cases by type for a user
 */
export function countUserCases(guildId: string, userId: string): Record<ModActionType, number> {
  const cases = getUserCases(guildId, userId);
  const counts: Record<ModActionType, number> = {
    ban: 0,
    kick: 0,
    timeout: 0,
    warn: 0,
    unban: 0,
    untimeout: 0,
  };

  for (const c of cases) {
    counts[c.action]++;
  }

  return counts;
}

/**
 * Format duration in seconds to human readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

/**
 * Parse duration string to seconds (e.g., "1h", "30m", "1d")
 */
export function parseDuration(duration: string): number | null {
  const match = duration.match(/^(\d+)(s|m|h|d)$/i);
  if (!match || !match[1] || !match[2]) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      return null;
  }
}
