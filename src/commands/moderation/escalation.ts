import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import type { Command } from '../../types/index.js';
import {
  getEscalationConfig,
  updateEscalationConfig,
  setEscalationRules,
  formatEscalationDuration,
  type EscalationRule,
} from '../../utils/strikeEscalation.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('escalation')
    .setDescription('Configure strike escalation system')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) => sub.setName('enable').setDescription('Enable strike escalation'))
    .addSubcommand((sub) => sub.setName('disable').setDescription('Disable strike escalation'))
    .addSubcommand((sub) => sub.setName('status').setDescription('View current escalation rules'))
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Set an escalation rule')
        .addIntegerOption((opt) =>
          opt
            .setName('warns')
            .setDescription('Number of warnings to trigger escalation')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(50)
        )
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('Action to take')
            .setRequired(true)
            .addChoices(
              { name: 'Timeout', value: 'timeout' },
              { name: 'Kick', value: 'kick' },
              { name: 'Ban', value: 'ban' }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName('duration')
            .setDescription('Timeout duration (e.g., 1h, 24h, 7d) - only for timeout action')
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove an escalation rule')
        .addIntegerOption((opt) =>
          opt.setName('warns').setDescription('Warning count to remove rule for').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('reset').setDescription('Reset to default escalation rules')
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
    const config = getEscalationConfig(guildId);

    switch (subcommand) {
      case 'enable': {
        updateEscalationConfig(guildId, { enabled: true });
        await interaction.reply({
          content: '✅ Strike escalation enabled!',
          ephemeral: true,
        });
        break;
      }

      case 'disable': {
        updateEscalationConfig(guildId, { enabled: false });
        await interaction.reply({
          content: '❌ Strike escalation disabled.',
          ephemeral: true,
        });
        break;
      }

      case 'status': {
        const rules = config.rules.sort((a, b) => a.warnCount - b.warnCount);

        const embed = new EmbedBuilder()
          .setColor(config.enabled ? 0x57f287 : 0xed4245)
          .setTitle('Strike Escalation')
          .setDescription(
            config.enabled ? '✅ **Escalation is ENABLED**' : '❌ **Escalation is DISABLED**'
          )
          .addFields({
            name: 'Rules',
            value:
              rules.length > 0
                ? rules
                    .map((r) => {
                      let action = r.action.charAt(0).toUpperCase() + r.action.slice(1);
                      if (r.action === 'timeout' && r.duration) {
                        action += ` (${formatEscalationDuration(r.duration)})`;
                      }
                      return `**${r.warnCount} warnings** → ${action}`;
                    })
                    .join('\n')
                : 'No rules configured',
          })
          .setFooter({
            text: 'Use /escalation set to add rules, /escalation remove to delete',
          });

        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }

      case 'set': {
        const warns = interaction.options.getInteger('warns', true);
        const action = interaction.options.getString('action', true) as 'timeout' | 'kick' | 'ban';
        const durationStr = interaction.options.getString('duration');

        let duration: number | undefined;
        if (action === 'timeout') {
          if (durationStr) {
            const match = durationStr.match(/^(\d+)(h|d)$/i);
            if (match?.[1] && match?.[2]) {
              const value = parseInt(match[1], 10);
              const unit = match[2].toLowerCase();
              duration = unit === 'h' ? value * 3600000 : value * 86400000;
            } else {
              await interaction.reply({
                content: '❌ Invalid duration format. Use format like 1h, 24h, 7d',
                ephemeral: true,
              });
              return;
            }
          } else {
            duration = 3600000; // Default 1 hour
          }
        }

        const newRule: EscalationRule = { warnCount: warns, action, duration };

        // Update rules
        const updatedRules = config.rules.filter((r) => r.warnCount !== warns);
        updatedRules.push(newRule);
        setEscalationRules(guildId, updatedRules);

        let actionStr = action;
        if (action === 'timeout' && duration) {
          actionStr += ` (${formatEscalationDuration(duration)})`;
        }

        await interaction.reply({
          content: `✅ Set escalation rule: **${warns} warnings** → ${actionStr}`,
          ephemeral: true,
        });
        break;
      }

      case 'remove': {
        const warns = interaction.options.getInteger('warns', true);

        const exists = config.rules.some((r) => r.warnCount === warns);
        if (!exists) {
          await interaction.reply({
            content: `❌ No rule found for ${warns} warnings.`,
            ephemeral: true,
          });
          return;
        }

        const updatedRules = config.rules.filter((r) => r.warnCount !== warns);
        setEscalationRules(guildId, updatedRules);

        await interaction.reply({
          content: `✅ Removed escalation rule for ${warns} warnings.`,
          ephemeral: true,
        });
        break;
      }

      case 'reset': {
        const defaultRules: EscalationRule[] = [
          { warnCount: 3, action: 'timeout', duration: 3600000 },
          { warnCount: 5, action: 'timeout', duration: 86400000 },
          { warnCount: 7, action: 'kick' },
          { warnCount: 10, action: 'ban' },
        ];

        setEscalationRules(guildId, defaultRules);

        await interaction.reply({
          content:
            '✅ Reset to default escalation rules:\n' +
            '• 3 warnings → Timeout (1 hour)\n' +
            '• 5 warnings → Timeout (24 hours)\n' +
            '• 7 warnings → Kick\n' +
            '• 10 warnings → Ban',
          ephemeral: true,
        });
        break;
      }
    }
  },
};

export default command;
