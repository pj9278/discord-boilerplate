import { type Client, type Message, type GuildMember, PermissionFlagsBits } from 'discord.js';
import type { Feature } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { getAutomodConfig } from '../utils/automodConfig.js';
import { createCase } from '../utils/moderation.js';
import { sendModLog } from '../utils/modLog.js';

// In-memory tracking for spam detection
interface MessageTrack {
  timestamps: number[];
  contents: Map<string, number>; // content hash -> count
}

const messageTracking = new Map<string, MessageTrack>(); // `${guildId}-${userId}` -> track

// Cleanup old tracking data every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, track] of messageTracking.entries()) {
    // Remove timestamps older than 30 seconds
    track.timestamps = track.timestamps.filter((t) => now - t < 30000);
    // Clear content tracking if no recent messages
    if (track.timestamps.length === 0) {
      messageTracking.delete(key);
    }
  }
}, 30000);

/**
 * Check if member has an exempt role
 */
function isExempt(member: GuildMember, exemptRoles: string[]): boolean {
  // Always exempt admins
  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }
  // Check exempt roles
  return member.roles.cache.some((role) => exemptRoles.includes(role.id));
}

/**
 * Simple hash for content comparison
 */
function hashContent(content: string): string {
  return content.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check for spam (rate limiting and duplicates)
 */
function checkSpam(
  message: Message,
  config: ReturnType<typeof getAutomodConfig>
): { triggered: boolean; reason?: string } {
  if (!config.antiSpam.enabled) return { triggered: false };

  const key = `${message.guildId}-${message.author.id}`;
  const now = Date.now();

  let track = messageTracking.get(key);
  if (!track) {
    track = { timestamps: [], contents: new Map() };
    messageTracking.set(key, track);
  }

  // Add current message
  track.timestamps.push(now);
  const contentHash = hashContent(message.content);
  track.contents.set(contentHash, (track.contents.get(contentHash) ?? 0) + 1);

  // Filter to only messages within time window
  const recentTimestamps = track.timestamps.filter((t) => now - t < config.antiSpam.timeWindow);
  track.timestamps = recentTimestamps;

  // Check rate limit
  if (recentTimestamps.length > config.antiSpam.maxMessages) {
    return {
      triggered: true,
      reason: `Sending messages too quickly (${recentTimestamps.length} messages in ${config.antiSpam.timeWindow / 1000}s)`,
    };
  }

  // Check duplicates
  const duplicateCount = track.contents.get(contentHash) ?? 0;
  if (duplicateCount >= config.antiSpam.duplicateThreshold) {
    return {
      triggered: true,
      reason: `Sending duplicate messages (${duplicateCount} identical messages)`,
    };
  }

  return { triggered: false };
}

/**
 * Check for blocked links
 */
function checkLinks(
  message: Message,
  config: ReturnType<typeof getAutomodConfig>
): { triggered: boolean; reason?: string } {
  if (!config.linkFilter.enabled) return { triggered: false };

  const content = message.content.toLowerCase();

  // Check Discord invites
  if (config.linkFilter.blockDiscordInvites) {
    const invitePattern = /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/\w+/i;
    if (invitePattern.test(content)) {
      return { triggered: true, reason: 'Discord invite links are not allowed' };
    }
  }

  // Check all links
  if (config.linkFilter.blockAllLinks) {
    const urlPattern = /https?:\/\/[^\s]+/gi;
    const urls = content.match(urlPattern);
    if (urls) {
      // Check if any URL is NOT in allowed domains
      for (const url of urls) {
        try {
          const domain = new URL(url).hostname.toLowerCase();
          const isAllowed = config.linkFilter.allowedDomains.some(
            (allowed) => domain === allowed || domain.endsWith(`.${allowed}`)
          );
          if (!isAllowed) {
            return { triggered: true, reason: 'Links are not allowed in this server' };
          }
        } catch {
          // Invalid URL, still block it
          return { triggered: true, reason: 'Links are not allowed in this server' };
        }
      }
    }
  }

  return { triggered: false };
}

/**
 * Check for filtered words
 */
function checkWords(
  message: Message,
  config: ReturnType<typeof getAutomodConfig>
): { triggered: boolean; reason?: string; word?: string } {
  if (!config.wordFilter.enabled || config.wordFilter.words.length === 0) {
    return { triggered: false };
  }

  const content = message.content.toLowerCase();

  for (const word of config.wordFilter.words) {
    // Use word boundary matching
    const pattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (pattern.test(content)) {
      return { triggered: true, reason: 'Message contains a filtered word', word };
    }
  }

  return { triggered: false };
}

/**
 * Take action on a violation
 */
async function takeAction(
  message: Message,
  reason: string,
  action: 'delete' | 'warn' | 'timeout' | 'kick',
  timeoutDuration?: number
): Promise<void> {
  const member = message.member;
  if (!member) return;

  const client = message.client;

  try {
    // Always try to delete the message
    if (message.deletable) {
      await message.delete();
    }

    // Take additional action
    switch (action) {
      case 'warn': {
        // Create a warning case
        const modCase = createCase(
          message.guildId!,
          member.id,
          member.user.tag,
          client.user!.id,
          'AutoMod',
          'warn',
          `[AutoMod] ${reason}`
        );

        // Log to mod channel
        await sendModLog(client, modCase);

        // Try to DM the user
        try {
          await member.send(
            `⚠️ You received an automated warning in **${message.guild!.name}**\nReason: ${reason}`
          );
        } catch {
          // Can't DM user
        }
        break;
      }

      case 'timeout': {
        const duration = timeoutDuration ?? 300000; // 5 minutes default
        await member.timeout(duration, `[AutoMod] ${reason}`);

        const modCase = createCase(
          message.guildId!,
          member.id,
          member.user.tag,
          client.user!.id,
          'AutoMod',
          'timeout',
          `[AutoMod] ${reason}`,
          duration
        );

        await sendModLog(client, modCase);

        try {
          await member.send(
            `⏰ You were timed out in **${message.guild!.name}** for ${Math.round(duration / 60000)} minutes\nReason: ${reason}`
          );
        } catch {
          // Can't DM user
        }
        break;
      }

      case 'kick': {
        const modCase = createCase(
          message.guildId!,
          member.id,
          member.user.tag,
          client.user!.id,
          'AutoMod',
          'kick',
          `[AutoMod] ${reason}`
        );

        try {
          await member.send(
            `👢 You were kicked from **${message.guild!.name}**\nReason: ${reason}`
          );
        } catch {
          // Can't DM user
        }

        await member.kick(`[AutoMod] ${reason}`);

        await sendModLog(client, modCase);
        break;
      }

      case 'delete':
      default:
        // Message already deleted above
        break;
    }

    logger.info(`[AutoMod] Action: ${action} | User: ${member.user.tag} | Reason: ${reason}`);
  } catch (error) {
    logger.error('[AutoMod] Failed to take action:', error);
  }
}

/**
 * Check account age on member join
 */
async function checkAccountAge(member: GuildMember): Promise<void> {
  const config = getAutomodConfig(member.guild.id);

  if (!config.enabled || !config.accountAge.enabled) return;

  const accountAge = Date.now() - member.user.createdTimestamp;
  const minAge = config.accountAge.minAgeDays * 24 * 60 * 60 * 1000;

  if (accountAge < minAge) {
    const ageInDays = Math.floor(accountAge / (24 * 60 * 60 * 1000));
    const reason = `Account too new (${ageInDays} days old, minimum ${config.accountAge.minAgeDays} days required)`;

    if (config.accountAge.action === 'kick') {
      try {
        await member.send(
          `Your account is too new to join **${member.guild.name}**.\n` +
            `Required account age: ${config.accountAge.minAgeDays} days\n` +
            `Your account age: ${ageInDays} days\n\n` +
            `Please try again later.`
        );
      } catch {
        // Can't DM
      }

      const modCase = createCase(
        member.guild.id,
        member.id,
        member.user.tag,
        member.client.user!.id,
        'AutoMod',
        'kick',
        `[AutoMod] ${reason}`
      );

      await member.kick(`[AutoMod] ${reason}`);

      await sendModLog(member.client, modCase);

      logger.info(`[AutoMod] Kicked new account: ${member.user.tag} (${ageInDays} days old)`);
    } else if (config.accountAge.action === 'quarantine' && config.accountAge.quarantineRoleId) {
      try {
        await member.roles.add(config.accountAge.quarantineRoleId);

        await member.send(
          `Welcome to **${member.guild.name}**!\n\n` +
            `Your account is new (${ageInDays} days old), so you've been placed in quarantine.\n` +
            `A moderator will verify you shortly.`
        );
      } catch {
        // Can't add role or DM
      }

      logger.info(`[AutoMod] Quarantined new account: ${member.user.tag} (${ageInDays} days old)`);
    }
  }
}

const feature: Feature = {
  name: 'automod',

  async init(client: Client) {
    logger.info('[AutoMod] Initializing auto-moderation system');

    // Handle messages
    client.on('messageCreate', async (message) => {
      // Ignore DMs, bots, and system messages
      if (!message.guild || message.author.bot || message.system) return;

      const config = getAutomodConfig(message.guildId!);

      // Check if automod is enabled
      if (!config.enabled) return;

      // Check if member is exempt
      if (message.member && isExempt(message.member, config.exemptRoles)) return;

      // Run checks
      const spamCheck = checkSpam(message, config);
      if (spamCheck.triggered) {
        await takeAction(
          message,
          spamCheck.reason!,
          config.antiSpam.action,
          config.antiSpam.timeoutDuration
        );
        return;
      }

      const linkCheck = checkLinks(message, config);
      if (linkCheck.triggered) {
        await takeAction(
          message,
          linkCheck.reason!,
          config.linkFilter.action === 'delete' ? 'delete' : config.linkFilter.action
        );
        return;
      }

      const wordCheck = checkWords(message, config);
      if (wordCheck.triggered) {
        await takeAction(
          message,
          wordCheck.reason!,
          config.wordFilter.action === 'delete' ? 'delete' : config.wordFilter.action
        );
        return;
      }
    });

    // Handle member joins for account age check
    client.on('guildMemberAdd', async (member) => {
      await checkAccountAge(member);
    });

    logger.info('[AutoMod] Auto-moderation system ready');
  },
};

export default feature;
