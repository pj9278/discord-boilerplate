import {
  type Client,
  EmbedBuilder,
  type TextChannel,
  type Message,
  type GuildMember,
  type PartialGuildMember,
  type GuildBan,
  AuditLogEvent,
  type Role,
  Events,
} from 'discord.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import type { Feature } from '../types/index.js';
import { logger } from '../utils/logger.js';

const DATA_DIR = './data';
const AUDIT_CONFIG_PATH = `${DATA_DIR}/audit-log.json`;

interface AuditConfig {
  enabled: boolean;
  channelId?: string;
  events: {
    messageEdit: boolean;
    messageDelete: boolean;
    memberJoin: boolean;
    memberLeave: boolean;
    memberBan: boolean;
    memberUnban: boolean;
    roleCreate: boolean;
    roleDelete: boolean;
    roleUpdate: boolean;
    memberRoleUpdate: boolean;
    nicknameChange: boolean;
    voiceStateUpdate: boolean;
  };
}

interface AuditData {
  config: Record<string, AuditConfig>;
}

const defaultConfig: AuditConfig = {
  enabled: false,
  events: {
    messageEdit: true,
    messageDelete: true,
    memberJoin: true,
    memberLeave: true,
    memberBan: true,
    memberUnban: true,
    roleCreate: true,
    roleDelete: true,
    roleUpdate: true,
    memberRoleUpdate: true,
    nicknameChange: true,
    voiceStateUpdate: true,
  },
};

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function load(): AuditData {
  ensureDataDir();
  if (!existsSync(AUDIT_CONFIG_PATH)) {
    return { config: {} };
  }
  return JSON.parse(readFileSync(AUDIT_CONFIG_PATH, 'utf-8')) as AuditData;
}

function save(data: AuditData): void {
  ensureDataDir();
  writeFileSync(AUDIT_CONFIG_PATH, JSON.stringify(data, null, 2));
}

export function getAuditConfig(guildId: string): AuditConfig {
  const data = load();
  return data.config[guildId] ?? { ...defaultConfig, events: { ...defaultConfig.events } };
}

export function updateAuditConfig(
  guildId: string,
  updates: Partial<Omit<AuditConfig, 'events'>> & { events?: Partial<AuditConfig['events']> }
): AuditConfig {
  const data = load();
  const current = data.config[guildId] ?? { ...defaultConfig, events: { ...defaultConfig.events } };
  data.config[guildId] = {
    ...current,
    ...updates,
    events: { ...current.events, ...(updates.events ?? {}) },
  };
  save(data);
  return data.config[guildId];
}

async function sendAuditLog(client: Client, guildId: string, embed: EmbedBuilder): Promise<void> {
  const config = getAuditConfig(guildId);
  if (!config.enabled || !config.channelId) return;

  try {
    const channel = (await client.channels.fetch(config.channelId)) as TextChannel;
    if (channel) {
      await channel.send({ embeds: [embed] });
    }
  } catch (error) {
    logger.error('[Audit Log] Failed to send audit log:', error);
  }
}

const feature: Feature = {
  name: 'auditLog',

  async init(client: Client) {
    logger.info('[Audit Log] Initializing audit logging system');

    // Message Edit
    client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
      if (!oldMessage.guild || oldMessage.author?.bot) return;
      if (oldMessage.content === newMessage.content) return;

      const config = getAuditConfig(oldMessage.guild.id);
      if (!config.enabled || !config.events.messageEdit) return;

      const embed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle('Message Edited')
        .setAuthor({
          name: oldMessage.author?.tag ?? 'Unknown',
          iconURL: oldMessage.author?.displayAvatarURL(),
        })
        .addFields(
          {
            name: 'Before',
            value: truncate(oldMessage.content ?? '*No content*', 1024),
          },
          {
            name: 'After',
            value: truncate((newMessage as Message).content ?? '*No content*', 1024),
          },
          {
            name: 'Channel',
            value: `<#${oldMessage.channel.id}>`,
            inline: true,
          },
          {
            name: 'Message Link',
            value: `[Jump to Message](${newMessage.url})`,
            inline: true,
          }
        )
        .setFooter({ text: `User ID: ${oldMessage.author?.id}` })
        .setTimestamp();

      await sendAuditLog(client, oldMessage.guild.id, embed);
    });

    // Message Delete
    client.on(Events.MessageDelete, async (message) => {
      if (!message.guild || message.author?.bot) return;

      const config = getAuditConfig(message.guild.id);
      if (!config.enabled || !config.events.messageDelete) return;

      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('Message Deleted')
        .setAuthor({
          name: message.author?.tag ?? 'Unknown',
          iconURL: message.author?.displayAvatarURL(),
        })
        .addFields(
          {
            name: 'Content',
            value: truncate(message.content ?? '*No content or embed*', 1024),
          },
          {
            name: 'Channel',
            value: `<#${message.channel.id}>`,
            inline: true,
          }
        )
        .setFooter({ text: `User ID: ${message.author?.id}` })
        .setTimestamp();

      if (message.attachments.size > 0) {
        embed.addFields({
          name: 'Attachments',
          value: message.attachments.map((a) => a.url).join('\n'),
        });
      }

      await sendAuditLog(client, message.guild.id, embed);
    });

    // Member Join
    client.on(Events.GuildMemberAdd, async (member) => {
      const config = getAuditConfig(member.guild.id);
      if (!config.enabled || !config.events.memberJoin) return;

      const accountAge = Math.floor(
        (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24)
      );

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('Member Joined')
        .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
        .addFields(
          { name: 'User', value: `${member.user.tag}`, inline: true },
          { name: 'Account Age', value: `${accountAge} days`, inline: true },
          { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true }
        )
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp();

      await sendAuditLog(client, member.guild.id, embed);
    });

    // Member Leave
    client.on(Events.GuildMemberRemove, async (member) => {
      const config = getAuditConfig(member.guild.id);
      if (!config.enabled || !config.events.memberLeave) return;

      const roles =
        member.roles?.cache
          .filter((r) => r.id !== member.guild.id)
          .map((r) => r.name)
          .join(', ') || 'None';

      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('Member Left')
        .setThumbnail(member.user?.displayAvatarURL({ size: 128 }) ?? null)
        .addFields(
          { name: 'User', value: member.user?.tag ?? 'Unknown', inline: true },
          { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true },
          { name: 'Roles', value: truncate(roles, 1024) }
        )
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp();

      await sendAuditLog(client, member.guild.id, embed);
    });

    // Member Ban
    client.on(Events.GuildBanAdd, async (ban: GuildBan) => {
      const config = getAuditConfig(ban.guild.id);
      if (!config.enabled || !config.events.memberBan) return;

      const embed = new EmbedBuilder()
        .setColor(0x992d22)
        .setTitle('Member Banned')
        .setThumbnail(ban.user.displayAvatarURL({ size: 128 }))
        .addFields(
          { name: 'User', value: ban.user.tag, inline: true },
          { name: 'Reason', value: ban.reason ?? 'No reason provided', inline: true }
        )
        .setFooter({ text: `User ID: ${ban.user.id}` })
        .setTimestamp();

      await sendAuditLog(client, ban.guild.id, embed);
    });

    // Member Unban
    client.on(Events.GuildBanRemove, async (ban: GuildBan) => {
      const config = getAuditConfig(ban.guild.id);
      if (!config.enabled || !config.events.memberUnban) return;

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('Member Unbanned')
        .setThumbnail(ban.user.displayAvatarURL({ size: 128 }))
        .addFields({ name: 'User', value: ban.user.tag, inline: true })
        .setFooter({ text: `User ID: ${ban.user.id}` })
        .setTimestamp();

      await sendAuditLog(client, ban.guild.id, embed);
    });

    // Role Create
    client.on(Events.GuildRoleCreate, async (role: Role) => {
      const config = getAuditConfig(role.guild.id);
      if (!config.enabled || !config.events.roleCreate) return;

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('Role Created')
        .addFields(
          { name: 'Name', value: role.name, inline: true },
          { name: 'Color', value: role.hexColor, inline: true },
          { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true }
        )
        .setFooter({ text: `Role ID: ${role.id}` })
        .setTimestamp();

      await sendAuditLog(client, role.guild.id, embed);
    });

    // Role Delete
    client.on(Events.GuildRoleDelete, async (role: Role) => {
      const config = getAuditConfig(role.guild.id);
      if (!config.enabled || !config.events.roleDelete) return;

      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('Role Deleted')
        .addFields(
          { name: 'Name', value: role.name, inline: true },
          { name: 'Color', value: role.hexColor, inline: true }
        )
        .setFooter({ text: `Role ID: ${role.id}` })
        .setTimestamp();

      await sendAuditLog(client, role.guild.id, embed);
    });

    // Role Update
    client.on(Events.GuildRoleUpdate, async (oldRole: Role, newRole: Role) => {
      const config = getAuditConfig(newRole.guild.id);
      if (!config.enabled || !config.events.roleUpdate) return;

      const changes: string[] = [];
      if (oldRole.name !== newRole.name) {
        changes.push(`Name: ${oldRole.name} → ${newRole.name}`);
      }
      if (oldRole.hexColor !== newRole.hexColor) {
        changes.push(`Color: ${oldRole.hexColor} → ${newRole.hexColor}`);
      }
      if (oldRole.hoist !== newRole.hoist) {
        changes.push(`Hoisted: ${oldRole.hoist ? 'Yes' : 'No'} → ${newRole.hoist ? 'Yes' : 'No'}`);
      }
      if (oldRole.mentionable !== newRole.mentionable) {
        changes.push(
          `Mentionable: ${oldRole.mentionable ? 'Yes' : 'No'} → ${newRole.mentionable ? 'Yes' : 'No'}`
        );
      }

      if (changes.length === 0) return;

      const embed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle('Role Updated')
        .addFields(
          { name: 'Role', value: newRole.name, inline: true },
          { name: 'Changes', value: changes.join('\n') }
        )
        .setFooter({ text: `Role ID: ${newRole.id}` })
        .setTimestamp();

      await sendAuditLog(client, newRole.guild.id, embed);
    });

    // Member Role/Nickname Update
    client.on(
      Events.GuildMemberUpdate,
      async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
        const config = getAuditConfig(newMember.guild.id);
        if (!config.enabled) return;

        // Nickname change
        if (config.events.nicknameChange && oldMember.nickname !== newMember.nickname) {
          const embed = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle('Nickname Changed')
            .setAuthor({
              name: newMember.user.tag,
              iconURL: newMember.user.displayAvatarURL(),
            })
            .addFields(
              {
                name: 'Before',
                value: oldMember.nickname ?? '*No nickname*',
                inline: true,
              },
              {
                name: 'After',
                value: newMember.nickname ?? '*No nickname*',
                inline: true,
              }
            )
            .setFooter({ text: `User ID: ${newMember.id}` })
            .setTimestamp();

          await sendAuditLog(client, newMember.guild.id, embed);
        }

        // Role changes
        if (config.events.memberRoleUpdate) {
          const oldRoles = oldMember.roles?.cache ?? new Map();
          const newRoles = newMember.roles.cache;

          const addedRoles = newRoles.filter((r) => !oldRoles.has(r.id));
          const removedRoles = oldRoles.filter((r) => !newRoles.has(r.id));

          if (addedRoles.size > 0 || removedRoles.size > 0) {
            const embed = new EmbedBuilder()
              .setColor(0x3498db)
              .setTitle('Member Roles Updated')
              .setAuthor({
                name: newMember.user.tag,
                iconURL: newMember.user.displayAvatarURL(),
              })
              .setFooter({ text: `User ID: ${newMember.id}` })
              .setTimestamp();

            if (addedRoles.size > 0) {
              embed.addFields({
                name: 'Added',
                value: addedRoles.map((r) => r.name).join(', '),
                inline: true,
              });
            }

            if (removedRoles.size > 0) {
              embed.addFields({
                name: 'Removed',
                value: removedRoles.map((r) => r.name).join(', '),
                inline: true,
              });
            }

            await sendAuditLog(client, newMember.guild.id, embed);
          }
        }
      }
    );

    // Voice State Update
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
      const guildId = newState.guild?.id ?? oldState.guild?.id;
      if (!guildId) return;

      const config = getAuditConfig(guildId);
      if (!config.enabled || !config.events.voiceStateUpdate) return;

      const member = newState.member ?? oldState.member;
      if (!member || member.user.bot) return;

      let title: string | null = null;
      let description = '';
      let color = 0x3498db;

      if (!oldState.channel && newState.channel) {
        // Joined voice channel
        title = 'Voice Channel Joined';
        description = `Joined <#${newState.channel.id}>`;
        color = 0x2ecc71;
      } else if (oldState.channel && !newState.channel) {
        // Left voice channel
        title = 'Voice Channel Left';
        description = `Left <#${oldState.channel.id}>`;
        color = 0xe74c3c;
      } else if (
        oldState.channel &&
        newState.channel &&
        oldState.channel.id !== newState.channel.id
      ) {
        // Moved channels
        title = 'Voice Channel Moved';
        description = `<#${oldState.channel.id}> → <#${newState.channel.id}>`;
        color = 0xf39c12;
      }

      if (!title) return;

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setAuthor({
          name: member.user.tag,
          iconURL: member.user.displayAvatarURL(),
        })
        .setDescription(description)
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp();

      await sendAuditLog(client, guildId, embed);
    });

    logger.info('[Audit Log] Audit logging system ready');
  },
};

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

// Export for use with AuditLogEvent if needed for fetching perpetrators
export { AuditLogEvent };
export default feature;
