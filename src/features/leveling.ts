import { type Client, type Message, EmbedBuilder, type TextChannel } from 'discord.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import type { Feature } from '../types/index.js';
import { logger } from '../utils/logger.js';

const DATA_DIR = './data';
const LEVELS_PATH = `${DATA_DIR}/levels.json`;

interface UserLevel {
  xp: number;
  level: number;
  messageCount: number;
  lastMessageAt: number;
}

interface LevelConfig {
  enabled: boolean;
  xpPerMessage: number;
  xpCooldown: number; // Milliseconds between XP gains
  levelUpChannelId?: string;
  levelRoles: { level: number; roleId: string }[];
}

interface LevelData {
  users: Record<string, Record<string, UserLevel>>; // guildId -> userId -> data
  config: Record<string, LevelConfig>;
}

const defaultConfig: LevelConfig = {
  enabled: false,
  xpPerMessage: 15,
  xpCooldown: 60000, // 1 minute
  levelRoles: [],
};

// XP needed for each level: level^2 * 100
function xpForLevel(level: number): number {
  return level * level * 100;
}

// Calculate level from total XP
function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100));
}

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function load(): LevelData {
  ensureDataDir();
  if (!existsSync(LEVELS_PATH)) {
    return { users: {}, config: {} };
  }
  return JSON.parse(readFileSync(LEVELS_PATH, 'utf-8')) as LevelData;
}

function save(data: LevelData): void {
  ensureDataDir();
  writeFileSync(LEVELS_PATH, JSON.stringify(data, null, 2));
}

export function getLevelConfig(guildId: string): LevelConfig {
  const data = load();
  return data.config[guildId] ?? { ...defaultConfig };
}

export function updateLevelConfig(guildId: string, updates: Partial<LevelConfig>): LevelConfig {
  const data = load();
  const current = data.config[guildId] ?? { ...defaultConfig };
  data.config[guildId] = { ...current, ...updates };
  save(data);
  return data.config[guildId];
}

export function getUserLevel(guildId: string, userId: string): UserLevel {
  const data = load();
  return data.users[guildId]?.[userId] ?? { xp: 0, level: 0, messageCount: 0, lastMessageAt: 0 };
}

export function addXp(
  guildId: string,
  userId: string,
  amount: number
): { newLevel: boolean; level: number } {
  const data = load();

  if (!data.users[guildId]) {
    data.users[guildId] = {};
  }

  const user = data.users[guildId][userId] ?? {
    xp: 0,
    level: 0,
    messageCount: 0,
    lastMessageAt: 0,
  };
  const oldLevel = user.level;

  user.xp += amount;
  user.messageCount++;
  user.lastMessageAt = Date.now();
  user.level = levelFromXp(user.xp);

  data.users[guildId][userId] = user;
  save(data);

  return { newLevel: user.level > oldLevel, level: user.level };
}

export function getLeaderboard(
  guildId: string,
  limit = 10
): { userId: string; xp: number; level: number }[] {
  const data = load();
  const guildUsers = data.users[guildId] ?? {};

  return Object.entries(guildUsers)
    .map(([userId, userData]) => ({ userId, xp: userData.xp, level: userData.level }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit);
}

export function addLevelRole(guildId: string, level: number, roleId: string): void {
  const data = load();
  const config = data.config[guildId] ?? { ...defaultConfig };

  config.levelRoles = config.levelRoles.filter((r) => r.level !== level);
  config.levelRoles.push({ level, roleId });
  config.levelRoles.sort((a, b) => a.level - b.level);

  data.config[guildId] = config;
  save(data);
}

export function removeLevelRole(guildId: string, level: number): boolean {
  const data = load();
  const config = data.config[guildId];
  if (!config) return false;

  const initialLength = config.levelRoles.length;
  config.levelRoles = config.levelRoles.filter((r) => r.level !== level);

  if (config.levelRoles.length < initialLength) {
    data.config[guildId] = config;
    save(data);
    return true;
  }
  return false;
}

const feature: Feature = {
  name: 'leveling',

  async init(client: Client) {
    logger.info('[Leveling] Initializing XP/leveling system');

    client.on('messageCreate', async (message: Message) => {
      // Ignore DMs, bots, and commands
      if (!message.guild || message.author.bot || message.content.startsWith('/')) return;

      const guildConfig = getLevelConfig(message.guild.id);
      if (!guildConfig.enabled) return;

      const userId = message.author.id;
      const guildId = message.guild.id;

      // Check cooldown
      const userData = getUserLevel(guildId, userId);
      const now = Date.now();

      if (now - userData.lastMessageAt < guildConfig.xpCooldown) {
        return; // Still on cooldown
      }

      // Add XP with some randomness
      const xpGain = guildConfig.xpPerMessage + Math.floor(Math.random() * 10);
      const result = addXp(guildId, userId, xpGain);

      // Handle level up
      if (result.newLevel) {
        await handleLevelUp(client, message, result.level, guildConfig);
      }
    });

    logger.info('[Leveling] XP/leveling system ready');
  },
};

async function handleLevelUp(
  client: Client,
  message: Message,
  newLevel: number,
  config: LevelConfig
): Promise<void> {
  const member = message.member;
  if (!member) return;

  // Send level up message
  const channelId = config.levelUpChannelId ?? message.channel.id;

  try {
    const channel = (await client.channels.fetch(channelId)) as TextChannel;
    if (channel) {
      const embed = new EmbedBuilder()
        .setColor(0xffd700) // Gold
        .setTitle('Level Up!')
        .setDescription(`Congratulations <@${member.id}>! You reached **Level ${newLevel}**!`)
        .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    }
  } catch (error) {
    logger.error('[Leveling] Failed to send level up message:', error);
  }

  // Check for level roles
  const roleToAdd = config.levelRoles.filter((r) => r.level <= newLevel).pop();

  if (roleToAdd) {
    try {
      // Remove lower level roles
      const lowerRoles = config.levelRoles.filter((r) => r.level < roleToAdd.level);
      for (const lowerRole of lowerRoles) {
        if (member.roles.cache.has(lowerRole.roleId)) {
          await member.roles.remove(lowerRole.roleId);
        }
      }

      // Add new role
      if (!member.roles.cache.has(roleToAdd.roleId)) {
        await member.roles.add(roleToAdd.roleId);
        logger.info(`[Leveling] Added level role to ${member.user.tag} (level ${roleToAdd.level})`);
      }
    } catch (error) {
      logger.error('[Leveling] Failed to manage level roles:', error);
    }
  }
}

export { xpForLevel, levelFromXp };
export default feature;
