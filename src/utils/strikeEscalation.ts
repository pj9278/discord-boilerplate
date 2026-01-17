import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { countUserCases } from './moderation.js';

const DATA_DIR = './data';
const ESCALATION_PATH = `${DATA_DIR}/escalation.json`;

export interface EscalationRule {
  warnCount: number;
  action: 'timeout' | 'kick' | 'ban';
  duration?: number; // For timeout, in milliseconds
}

export interface EscalationConfig {
  enabled: boolean;
  rules: EscalationRule[];
}

export interface EscalationData {
  config: Record<string, EscalationConfig>; // Per-guild config
}

const defaultRules: EscalationRule[] = [
  { warnCount: 3, action: 'timeout', duration: 3600000 }, // 1 hour timeout at 3 warns
  { warnCount: 5, action: 'timeout', duration: 86400000 }, // 24 hour timeout at 5 warns
  { warnCount: 7, action: 'kick' }, // Kick at 7 warns
  { warnCount: 10, action: 'ban' }, // Ban at 10 warns
];

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function load(): EscalationData {
  ensureDataDir();
  if (!existsSync(ESCALATION_PATH)) {
    return { config: {} };
  }
  return JSON.parse(readFileSync(ESCALATION_PATH, 'utf-8')) as EscalationData;
}

function save(data: EscalationData): void {
  ensureDataDir();
  writeFileSync(ESCALATION_PATH, JSON.stringify(data, null, 2));
}

/**
 * Get escalation config for a guild
 */
export function getEscalationConfig(guildId: string): EscalationConfig {
  const data = load();
  return data.config[guildId] ?? { enabled: false, rules: [...defaultRules] };
}

/**
 * Update escalation config for a guild
 */
export function updateEscalationConfig(
  guildId: string,
  config: Partial<EscalationConfig>
): EscalationConfig {
  const data = load();
  const current = data.config[guildId] ?? { enabled: false, rules: [...defaultRules] };
  data.config[guildId] = { ...current, ...config };
  save(data);
  return data.config[guildId];
}

/**
 * Set custom rules for a guild
 */
export function setEscalationRules(guildId: string, rules: EscalationRule[]): void {
  const data = load();
  const current = data.config[guildId] ?? { enabled: false, rules: [...defaultRules] };
  current.rules = rules.sort((a, b) => a.warnCount - b.warnCount);
  data.config[guildId] = current;
  save(data);
}

/**
 * Check if a user should be escalated based on their warn count
 * Returns the action to take, or null if no escalation needed
 */
export function checkEscalation(guildId: string, userId: string): EscalationRule | null {
  const config = getEscalationConfig(guildId);

  if (!config.enabled) return null;

  const counts = countUserCases(guildId, userId);
  const warnCount = counts.warn;

  // Find the highest matching rule
  let matchingRule: EscalationRule | null = null;

  for (const rule of config.rules) {
    if (warnCount >= rule.warnCount) {
      matchingRule = rule;
    }
  }

  return matchingRule;
}

/**
 * Check if exact warn count matches a rule (for triggering on new warn)
 */
export function checkExactEscalation(guildId: string, warnCount: number): EscalationRule | null {
  const config = getEscalationConfig(guildId);

  if (!config.enabled) return null;

  return config.rules.find((r) => r.warnCount === warnCount) ?? null;
}

/**
 * Format duration for display
 */
export function formatEscalationDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  return `${hours} hour${hours > 1 ? 's' : ''}`;
}
