import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import type { ModCase } from '../types/index.js';
import { config } from './config.js';
import { formatDuration } from './moderation.js';
import { logger } from './logger.js';

const ACTION_COLORS: Record<string, number> = {
  ban: 0xdc3545, // Red
  kick: 0xfd7e14, // Orange
  timeout: 0xffc107, // Yellow
  warn: 0xffc107, // Yellow
  unban: 0x28a745, // Green
  untimeout: 0x28a745, // Green
};

const ACTION_EMOJI: Record<string, string> = {
  ban: '🔨',
  kick: '👢',
  timeout: '🔇',
  warn: '⚠️',
  unban: '🔓',
  untimeout: '🔊',
};

/**
 * Send a moderation action to the mod log channel
 */
export async function sendModLog(client: Client, modCase: ModCase): Promise<void> {
  const channelId = config.channels.modLog;
  if (!channelId) {
    logger.warn('No mod log channel configured (MOD_LOG_CHANNEL_ID)');
    return;
  }

  try {
    const channel = (await client.channels.fetch(channelId)) as TextChannel;
    if (!channel || !channel.isTextBased()) {
      logger.warn('Mod log channel not found or not a text channel');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(ACTION_COLORS[modCase.action] ?? 0x5865f2)
      .setTitle(
        `${ACTION_EMOJI[modCase.action] ?? '📋'} ${modCase.action.toUpperCase()} | Case #${modCase.id}`
      )
      .addFields(
        { name: 'User', value: `<@${modCase.targetId}> (${modCase.targetTag})`, inline: true },
        { name: 'Moderator', value: `<@${modCase.moderatorId}>`, inline: true },
        { name: 'Reason', value: modCase.reason || 'No reason provided' }
      )
      .setTimestamp(new Date(modCase.timestamp))
      .setFooter({ text: `User ID: ${modCase.targetId}` });

    if (modCase.duration) {
      embed.addFields({ name: 'Duration', value: formatDuration(modCase.duration), inline: true });
    }

    await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.error('Failed to send mod log:', error);
  }
}

/**
 * Send a simple mod action notification (for actions without full case tracking)
 */
export async function sendSimpleModLog(
  client: Client,
  _guildId: string,
  action: string,
  description: string,
  color = 0x5865f2
): Promise<void> {
  const channelId = config.channels.modLog;
  if (!channelId) return;

  try {
    const channel = (await client.channels.fetch(channelId)) as TextChannel;
    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(action)
      .setDescription(description)
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.error('Failed to send simple mod log:', error);
  }
}
