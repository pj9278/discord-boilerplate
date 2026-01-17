import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const DATA_DIR = './data';
const CONFIG_PATH = `${DATA_DIR}/automod.json`;

export interface AutomodConfig {
  enabled: boolean;
  // Anti-spam settings
  antiSpam: {
    enabled: boolean;
    maxMessages: number; // Max messages in timeWindow
    timeWindow: number; // Milliseconds
    duplicateThreshold: number; // Number of identical messages to trigger
    action: 'warn' | 'timeout' | 'kick';
    timeoutDuration: number; // Milliseconds for timeout action
  };
  // Link filtering
  linkFilter: {
    enabled: boolean;
    blockDiscordInvites: boolean;
    blockAllLinks: boolean;
    allowedDomains: string[];
    action: 'delete' | 'warn' | 'timeout';
  };
  // Word filter
  wordFilter: {
    enabled: boolean;
    words: string[];
    action: 'delete' | 'warn' | 'timeout';
  };
  // Account age verification
  accountAge: {
    enabled: boolean;
    minAgeDays: number;
    action: 'kick' | 'quarantine';
    quarantineRoleId?: string;
  };
  // Exempt roles (won't be affected by automod)
  exemptRoles: string[];
}

export type GuildAutomodData = Record<string, AutomodConfig>;

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function load(): GuildAutomodData {
  ensureDataDir();
  if (!existsSync(CONFIG_PATH)) {
    return {};
  }
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as GuildAutomodData;
}

function save(data: GuildAutomodData): void {
  ensureDataDir();
  writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

const defaultConfig: AutomodConfig = {
  enabled: false,
  antiSpam: {
    enabled: true,
    maxMessages: 5,
    timeWindow: 5000, // 5 seconds
    duplicateThreshold: 3,
    action: 'timeout',
    timeoutDuration: 300000, // 5 minutes
  },
  linkFilter: {
    enabled: false,
    blockDiscordInvites: true,
    blockAllLinks: false,
    allowedDomains: [],
    action: 'delete',
  },
  wordFilter: {
    enabled: false,
    words: [],
    action: 'delete',
  },
  accountAge: {
    enabled: false,
    minAgeDays: 7,
    action: 'kick',
  },
  exemptRoles: [],
};

/**
 * Get automod config for a guild
 */
export function getAutomodConfig(guildId: string): AutomodConfig {
  const data = load();
  return data[guildId] ?? { ...defaultConfig };
}

/**
 * Update automod config for a guild
 */
export function updateAutomodConfig(
  guildId: string,
  config: Partial<AutomodConfig>
): AutomodConfig {
  const data = load();
  const current = data[guildId] ?? { ...defaultConfig };
  data[guildId] = { ...current, ...config };
  save(data);
  return data[guildId];
}

/**
 * Update a specific section of automod config
 */
export function updateAutomodSection<K extends keyof AutomodConfig>(
  guildId: string,
  section: K,
  value: AutomodConfig[K]
): AutomodConfig {
  const data = load();
  const current = data[guildId] ?? { ...defaultConfig };
  data[guildId] = { ...current, [section]: value };
  save(data);
  return data[guildId];
}

/**
 * Add a word to the filter
 */
export function addFilteredWord(guildId: string, word: string): void {
  const data = load();
  const current = data[guildId] ?? { ...defaultConfig };
  if (!current.wordFilter.words.includes(word.toLowerCase())) {
    current.wordFilter.words.push(word.toLowerCase());
    data[guildId] = current;
    save(data);
  }
}

/**
 * Remove a word from the filter
 */
export function removeFilteredWord(guildId: string, word: string): void {
  const data = load();
  const current = data[guildId] ?? { ...defaultConfig };
  current.wordFilter.words = current.wordFilter.words.filter((w) => w !== word.toLowerCase());
  data[guildId] = current;
  save(data);
}

/**
 * Add an exempt role
 */
export function addExemptRole(guildId: string, roleId: string): void {
  const data = load();
  const current = data[guildId] ?? { ...defaultConfig };
  if (!current.exemptRoles.includes(roleId)) {
    current.exemptRoles.push(roleId);
    data[guildId] = current;
    save(data);
  }
}

/**
 * Remove an exempt role
 */
export function removeExemptRole(guildId: string, roleId: string): void {
  const data = load();
  const current = data[guildId] ?? { ...defaultConfig };
  current.exemptRoles = current.exemptRoles.filter((r) => r !== roleId);
  data[guildId] = current;
  save(data);
}

/**
 * Add an allowed domain
 */
export function addAllowedDomain(guildId: string, domain: string): void {
  const data = load();
  const current = data[guildId] ?? { ...defaultConfig };
  if (!current.linkFilter.allowedDomains.includes(domain.toLowerCase())) {
    current.linkFilter.allowedDomains.push(domain.toLowerCase());
    data[guildId] = current;
    save(data);
  }
}

/**
 * Remove an allowed domain
 */
export function removeAllowedDomain(guildId: string, domain: string): void {
  const data = load();
  const current = data[guildId] ?? { ...defaultConfig };
  current.linkFilter.allowedDomains = current.linkFilter.allowedDomains.filter(
    (d) => d !== domain.toLowerCase()
  );
  data[guildId] = current;
  save(data);
}
