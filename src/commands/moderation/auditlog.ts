import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } from 'discord.js';
import type { Command } from '../../types/index.js';
import { getAuditConfig, updateAuditConfig } from '../../features/auditLog.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('auditlog')
    .setDescription('Configure audit logging')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('enable')
        .setDescription('Enable audit logging')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel for audit logs')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((sub) => sub.setName('disable').setDescription('Disable audit logging'))
    .addSubcommand((sub) => sub.setName('status').setDescription('View audit log configuration'))
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Toggle specific event logging')
        .addStringOption((opt) =>
          opt
            .setName('event')
            .setDescription('Event to toggle')
            .setRequired(true)
            .addChoices(
              { name: 'Message Edits', value: 'messageEdit' },
              { name: 'Message Deletes', value: 'messageDelete' },
              { name: 'Member Joins', value: 'memberJoin' },
              { name: 'Member Leaves', value: 'memberLeave' },
              { name: 'Member Bans', value: 'memberBan' },
              { name: 'Member Unbans', value: 'memberUnban' },
              { name: 'Role Creates', value: 'roleCreate' },
              { name: 'Role Deletes', value: 'roleDelete' },
              { name: 'Role Updates', value: 'roleUpdate' },
              { name: 'Member Role Changes', value: 'memberRoleUpdate' },
              { name: 'Nickname Changes', value: 'nicknameChange' },
              { name: 'Voice State Changes', value: 'voiceStateUpdate' }
            )
        )
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const config = getAuditConfig(guildId);

    switch (subcommand) {
      case 'enable': {
        const channel = interaction.options.getChannel('channel', true);

        updateAuditConfig(guildId, {
          enabled: true,
          channelId: channel.id,
        });

        await interaction.reply({
          content: `Audit logging enabled! Logs will be sent to <#${channel.id}>.`,
          ephemeral: true,
        });
        break;
      }

      case 'disable': {
        updateAuditConfig(guildId, { enabled: false });
        await interaction.reply({
          content: 'Audit logging disabled.',
          ephemeral: true,
        });
        break;
      }

      case 'status': {
        const enabledEvents = Object.entries(config.events)
          .filter(([, enabled]) => enabled)
          .map(([event]) => formatEventName(event));

        const disabledEvents = Object.entries(config.events)
          .filter(([, enabled]) => !enabled)
          .map(([event]) => formatEventName(event));

        const embed = new EmbedBuilder()
          .setColor(config.enabled ? 0x57f287 : 0xed4245)
          .setTitle('Audit Log Configuration')
          .setDescription(
            config.enabled ? `**Enabled** - Logging to <#${config.channelId}>` : '**Disabled**'
          )
          .addFields(
            {
              name: 'Enabled Events',
              value: enabledEvents.length > 0 ? enabledEvents.join('\n') : '*None*',
              inline: true,
            },
            {
              name: 'Disabled Events',
              value: disabledEvents.length > 0 ? disabledEvents.join('\n') : '*None*',
              inline: true,
            }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }

      case 'toggle': {
        const event = interaction.options.getString('event', true) as keyof typeof config.events;
        const currentValue = config.events[event];
        const newValue = !currentValue;

        updateAuditConfig(guildId, {
          events: { [event]: newValue },
        });

        await interaction.reply({
          content: `${formatEventName(event)} logging is now **${newValue ? 'enabled' : 'disabled'}**.`,
          ephemeral: true,
        });
        break;
      }
    }
  },
};

function formatEventName(event: string): string {
  const names: Record<string, string> = {
    messageEdit: 'Message Edits',
    messageDelete: 'Message Deletes',
    memberJoin: 'Member Joins',
    memberLeave: 'Member Leaves',
    memberBan: 'Member Bans',
    memberUnban: 'Member Unbans',
    roleCreate: 'Role Creates',
    roleDelete: 'Role Deletes',
    roleUpdate: 'Role Updates',
    memberRoleUpdate: 'Member Role Changes',
    nicknameChange: 'Nickname Changes',
    voiceStateUpdate: 'Voice State Changes',
  };
  return names[event] ?? event;
}

export default command;
