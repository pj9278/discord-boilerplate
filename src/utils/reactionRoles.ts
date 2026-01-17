import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const DATA_DIR = './data';
const REACTION_ROLES_PATH = `${DATA_DIR}/reaction-roles.json`;

export interface ReactionRoleMapping {
  messageId: string;
  channelId: string;
  guildId: string;
  emoji: string; // Unicode emoji or custom emoji ID
  roleId: string;
  description?: string;
}

export interface ReactionRolesData {
  mappings: ReactionRoleMapping[];
}

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function load(): ReactionRolesData {
  ensureDataDir();
  if (!existsSync(REACTION_ROLES_PATH)) {
    return { mappings: [] };
  }
  return JSON.parse(readFileSync(REACTION_ROLES_PATH, 'utf-8')) as ReactionRolesData;
}

function save(data: ReactionRolesData): void {
  ensureDataDir();
  writeFileSync(REACTION_ROLES_PATH, JSON.stringify(data, null, 2));
}

/**
 * Add a reaction role mapping
 */
export function addReactionRole(mapping: ReactionRoleMapping): void {
  const data = load();

  // Remove existing mapping for same message + emoji
  data.mappings = data.mappings.filter(
    (m) => !(m.messageId === mapping.messageId && m.emoji === mapping.emoji)
  );

  data.mappings.push(mapping);
  save(data);
}

/**
 * Remove a reaction role mapping
 */
export function removeReactionRole(messageId: string, emoji: string): boolean {
  const data = load();
  const initialLength = data.mappings.length;

  data.mappings = data.mappings.filter((m) => !(m.messageId === messageId && m.emoji === emoji));

  if (data.mappings.length < initialLength) {
    save(data);
    return true;
  }
  return false;
}

/**
 * Get role ID for a message + emoji combination
 */
export function getRoleForReaction(messageId: string, emoji: string): string | undefined {
  const data = load();
  const mapping = data.mappings.find((m) => m.messageId === messageId && m.emoji === emoji);
  return mapping?.roleId;
}

/**
 * Get all mappings for a message
 */
export function getMappingsForMessage(messageId: string): ReactionRoleMapping[] {
  const data = load();
  return data.mappings.filter((m) => m.messageId === messageId);
}

/**
 * Get all mappings for a guild
 */
export function getMappingsForGuild(guildId: string): ReactionRoleMapping[] {
  const data = load();
  return data.mappings.filter((m) => m.guildId === guildId);
}

/**
 * Remove all mappings for a message
 */
export function removeAllMappingsForMessage(messageId: string): number {
  const data = load();
  const initialLength = data.mappings.length;
  data.mappings = data.mappings.filter((m) => m.messageId !== messageId);
  save(data);
  return initialLength - data.mappings.length;
}
