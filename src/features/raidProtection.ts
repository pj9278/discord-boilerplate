import { type Client, type GuildMember, EmbedBuilder, type TextChannel, Events } from 'discord.js';
import type { Feature } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const DATA_DIR = './data';
const RAID_CONFIG_PATH = `${DATA_DIR}/raid-protection.json`;

interface RaidConfig {
  enabled: boolean;
  joinThreshold: number; // Number of joins to trigger raid mode
  timeWindow: number; // Milliseconds to count joins
  action: 'kick' | 'ban' | 'quarantine';
  quarantineRoleId?: string;
  lockdownOnRaid: boolean;
  minAccountAge: number; // Minimum account age in days during raid (0 = disabled)
}

interface RaidData {
  config: Record<string, RaidConfig>;
  activeRaids: Record<string, { startedAt: number; kickedCount: number }>;
}

// In-memory join tracking
const joinTracking = new Map<string, number[]>(); // guildId -> timestamps

const defaultConfig: RaidConfig = {
  enabled: false,
  joinThreshold: 10,
  timeWindow: 10000, // 10 seconds
  action: 'kick',
  lockdownOnRaid: false,
  minAccountAge: 7,
};

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function load(): RaidData {
  ensureDataDir();
  if (!existsSync(RAID_CONFIG_PATH)) {
    return { config: {}, activeRaids: {} };
  }
  return JSON.parse(readFileSync(RAID_CONFIG_PATH, 'utf-8')) as RaidData;
}

function save(data: RaidData): void {
  ensureDataDir();
  writeFileSync(RAID_CONFIG_PATH, JSON.stringify(data, null, 2));
}

export function getRaidConfig(guildId: string): RaidConfig {
  const data = load();
  return data.config[guildId] ?? { ...defaultConfig };
}

export function updateRaidConfig(guildId: string, updates: Partial<RaidConfig>): RaidConfig {
  const data = load();
  const current = data.config[guildId] ?? { ...defaultConfig };
  data.config[guildId] = { ...current, ...updates };
  save(data);
  return data.config[guildId];
}

export function isRaidActive(guildId: string): boolean {
  const data = load();
  return !!data.activeRaids[guildId];
}

export function activateRaid(guildId: string): void {
  const data = load();
  data.activeRaids[guildId] = { startedAt: Date.now(), kickedCount: 0 };
  save(data);
}

export function deactivateRaid(guildId: string): { duration: number; kickedCount: number } | null {
  const data = load();
  const raid = data.activeRaids[guildId];
  if (!raid) return null;

  delete data.activeRaids[guildId];
  save(data);

  return {
    duration: Date.now() - raid.startedAt,
    kickedCount: raid.kickedCount,
  };
}

export function incrementRaidKicks(guildId: string): void {
  const data = load();
  if (data.activeRaids[guildId]) {
    data.activeRaids[guildId].kickedCount++;
    save(data);
  }
}

const feature: Feature = {
  name: 'raidProtection',

  async init(client: Client) {
    logger.info('[Raid Protection] Initializing raid protection system');

    // Clean up old tracking data every minute
    setInterval(() => {
      const now = Date.now();
      for (const [guildId, timestamps] of joinTracking.entries()) {
        const config = getRaidConfig(guildId);
        const filtered = timestamps.filter((t) => now - t < config.timeWindow * 2);
        if (filtered.length === 0) {
          joinTracking.delete(guildId);
        } else {
          joinTracking.set(guildId, filtered);
        }
      }
    }, 60000);

    client.on(Events.GuildMemberAdd, async (member) => {
      const raidConfig = getRaidConfig(member.guild.id);

      if (!raidConfig.enabled) return;

      const now = Date.now();
      const guildId = member.guild.id;

      // Track this join
      let timestamps = joinTracking.get(guildId) ?? [];
      timestamps.push(now);

      // Filter to only recent joins within window
      timestamps = timestamps.filter((t) => now - t < raidConfig.timeWindow);
      joinTracking.set(guildId, timestamps);

      // Check if raid threshold reached
      const raidDetected = timestamps.length >= raidConfig.joinThreshold;

      // If raid is active or just detected
      if (raidDetected || isRaidActive(guildId)) {
        if (!isRaidActive(guildId)) {
          // First detection - activate raid mode
          activateRaid(guildId);

          // Send alert
          await sendRaidAlert(client, member.guild.id, timestamps.length);
        }

        // Handle the new member according to config
        await handleRaidMember(member, raidConfig);
      }
    });

    logger.info('[Raid Protection] Raid protection system ready');
  },
};

async function sendRaidAlert(client: Client, guildId: string, joinCount: number): Promise<void> {
  const modLogChannelId = config.channels.modLog;
  if (!modLogChannelId) return;

  try {
    const channel = (await client.channels.fetch(modLogChannelId)) as TextChannel;
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('🚨 RAID DETECTED')
      .setDescription(
        `**${joinCount} members** joined in rapid succession.\n\n` +
          'Raid protection mode has been activated. New members will be handled automatically.\n\n' +
          'Use `/raid end` to deactivate raid mode when the raid is over.'
      )
      .setTimestamp();

    await channel.send({
      content: '@here Raid detected!',
      embeds: [embed],
    });

    logger.warn(`[Raid Protection] Raid detected in guild ${guildId} - ${joinCount} rapid joins`);
  } catch (error) {
    logger.error('[Raid Protection] Failed to send raid alert:', error);
  }
}

async function handleRaidMember(member: GuildMember, raidConfig: RaidConfig): Promise<void> {
  const guildId = member.guild.id;

  // Check account age during raid
  if (raidConfig.minAccountAge > 0) {
    const accountAge = Date.now() - member.user.createdTimestamp;
    const minAgeMs = raidConfig.minAccountAge * 24 * 60 * 60 * 1000;

    if (accountAge < minAgeMs) {
      // Account is too new during raid - definitely suspicious
      try {
        switch (raidConfig.action) {
          case 'kick':
            await member
              .send(
                'You have been automatically removed during a raid protection event. ' +
                  'Please try joining again later.'
              )
              .catch(() => null);
            await member.kick('Raid protection: New account during raid');
            break;

          case 'ban':
            await member
              .send(
                'You have been automatically banned during a raid protection event. ' +
                  'If this was a mistake, please contact the server staff.'
              )
              .catch(() => null);
            await member.ban({ reason: 'Raid protection: New account during raid' });
            break;

          case 'quarantine':
            if (raidConfig.quarantineRoleId) {
              await member.roles.add(raidConfig.quarantineRoleId);
              await member
                .send(
                  'You have been placed in quarantine due to a raid protection event. ' +
                    'A moderator will verify you shortly.'
                )
                .catch(() => null);
            }
            break;
        }

        incrementRaidKicks(guildId);
        logger.info(
          `[Raid Protection] Handled raid member: ${member.user.tag} (action: ${raidConfig.action})`
        );
      } catch (error) {
        logger.error('[Raid Protection] Failed to handle raid member:', error);
      }
    }
  }
}

export default feature;
