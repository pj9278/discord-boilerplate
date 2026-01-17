import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import type { Command } from '../../types/index.js';
import {
  getRaidConfig,
  updateRaidConfig,
  isRaidActive,
  deactivateRaid,
} from '../../features/raidProtection.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('raid')
    .setDescription('Configure raid protection')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) => sub.setName('enable').setDescription('Enable raid protection'))
    .addSubcommand((sub) => sub.setName('disable').setDescription('Disable raid protection'))
    .addSubcommand((sub) => sub.setName('status').setDescription('View raid protection status'))
    .addSubcommand((sub) => sub.setName('end').setDescription('End active raid mode'))
    .addSubcommand((sub) =>
      sub
        .setName('config')
        .setDescription('Configure raid protection settings')
        .addIntegerOption((opt) =>
          opt
            .setName('threshold')
            .setDescription('Number of joins to trigger raid mode (default: 10)')
            .setMinValue(3)
            .setMaxValue(50)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('window')
            .setDescription('Time window in seconds (default: 10)')
            .setMinValue(5)
            .setMaxValue(60)
        )
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('Action to take on raid members')
            .addChoices(
              { name: 'Kick', value: 'kick' },
              { name: 'Ban', value: 'ban' },
              { name: 'Quarantine', value: 'quarantine' }
            )
        )
        .addIntegerOption((opt) =>
          opt
            .setName('min_account_age')
            .setDescription('Minimum account age in days during raid (0 = disabled)')
            .setMinValue(0)
            .setMaxValue(365)
        )
        .addRoleOption((opt) =>
          opt.setName('quarantine_role').setDescription('Role for quarantine action')
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
    const raidConfig = getRaidConfig(guildId);

    switch (subcommand) {
      case 'enable': {
        updateRaidConfig(guildId, { enabled: true });
        await interaction.reply({
          content: '✅ Raid protection enabled!',
          ephemeral: true,
        });
        break;
      }

      case 'disable': {
        updateRaidConfig(guildId, { enabled: false });
        await interaction.reply({
          content: '❌ Raid protection disabled.',
          ephemeral: true,
        });
        break;
      }

      case 'status': {
        const active = isRaidActive(guildId);

        const embed = new EmbedBuilder()
          .setColor(raidConfig.enabled ? (active ? 0xed4245 : 0x57f287) : 0x95a5a6)
          .setTitle('Raid Protection Status')
          .setDescription(
            raidConfig.enabled
              ? active
                ? '🚨 **RAID MODE ACTIVE** - Use `/raid end` to deactivate'
                : '✅ **Protection is ENABLED**'
              : '❌ **Protection is DISABLED**'
          )
          .addFields(
            {
              name: 'Threshold',
              value: `${raidConfig.joinThreshold} joins in ${raidConfig.timeWindow / 1000}s`,
              inline: true,
            },
            {
              name: 'Action',
              value: raidConfig.action.charAt(0).toUpperCase() + raidConfig.action.slice(1),
              inline: true,
            },
            {
              name: 'Min Account Age',
              value: raidConfig.minAccountAge > 0 ? `${raidConfig.minAccountAge} days` : 'Disabled',
              inline: true,
            }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }

      case 'end': {
        const result = deactivateRaid(guildId);

        if (!result) {
          await interaction.reply({
            content: '❌ No raid is currently active.',
            ephemeral: true,
          });
          return;
        }

        const duration = Math.round(result.duration / 60000);

        await interaction.reply({
          content:
            `✅ Raid mode deactivated!\n\n` +
            `Duration: ${duration} minute${duration !== 1 ? 's' : ''}\n` +
            `Members handled: ${result.kickedCount}`,
          ephemeral: true,
        });
        break;
      }

      case 'config': {
        const threshold = interaction.options.getInteger('threshold');
        const window = interaction.options.getInteger('window');
        const action = interaction.options.getString('action') as
          | 'kick'
          | 'ban'
          | 'quarantine'
          | null;
        const minAccountAge = interaction.options.getInteger('min_account_age');
        const quarantineRole = interaction.options.getRole('quarantine_role');

        const updates: Record<string, unknown> = {};

        if (threshold !== null) updates.joinThreshold = threshold;
        if (window !== null) updates.timeWindow = window * 1000;
        if (action !== null) updates.action = action;
        if (minAccountAge !== null) updates.minAccountAge = minAccountAge;
        if (quarantineRole) updates.quarantineRoleId = quarantineRole.id;

        if (Object.keys(updates).length === 0) {
          await interaction.reply({
            content: 'No settings specified. Use the options to configure raid protection.',
            ephemeral: true,
          });
          return;
        }

        updateRaidConfig(guildId, updates);

        await interaction.reply({
          content: '✅ Raid protection settings updated.',
          ephemeral: true,
        });
        break;
      }
    }
  },
};

export default command;
