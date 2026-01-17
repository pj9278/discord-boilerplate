import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import type { Command } from '../../types/index.js';
import {
  getAutomodConfig,
  updateAutomodConfig,
  updateAutomodSection,
  addFilteredWord,
  removeFilteredWord,
  addExemptRole,
  removeExemptRole,
  addAllowedDomain,
  removeAllowedDomain,
} from '../../utils/automodConfig.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configure auto-moderation settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) => sub.setName('enable').setDescription('Enable auto-moderation'))
    .addSubcommand((sub) => sub.setName('disable').setDescription('Disable auto-moderation'))
    .addSubcommand((sub) => sub.setName('status').setDescription('View current automod settings'))
    .addSubcommand((sub) =>
      sub
        .setName('antispam')
        .setDescription('Configure anti-spam settings')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Enable/disable anti-spam').setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('max_messages')
            .setDescription('Max messages in time window (default: 5)')
            .setMinValue(2)
            .setMaxValue(20)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('time_window')
            .setDescription('Time window in seconds (default: 5)')
            .setMinValue(1)
            .setMaxValue(60)
        )
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('Action to take')
            .addChoices(
              { name: 'Warn', value: 'warn' },
              { name: 'Timeout', value: 'timeout' },
              { name: 'Kick', value: 'kick' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('linkfilter')
        .setDescription('Configure link filtering')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Enable/disable link filter').setRequired(true)
        )
        .addBooleanOption((opt) =>
          opt.setName('block_invites').setDescription('Block Discord invites')
        )
        .addBooleanOption((opt) =>
          opt.setName('block_all_links').setDescription('Block all links (except allowed domains)')
        )
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('Action to take')
            .addChoices(
              { name: 'Delete only', value: 'delete' },
              { name: 'Delete + Warn', value: 'warn' },
              { name: 'Delete + Timeout', value: 'timeout' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('wordfilter')
        .setDescription('Configure word filter')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Enable/disable word filter').setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('Action to take')
            .addChoices(
              { name: 'Delete only', value: 'delete' },
              { name: 'Delete + Warn', value: 'warn' },
              { name: 'Delete + Timeout', value: 'timeout' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('addword')
        .setDescription('Add a word to the filter')
        .addStringOption((opt) =>
          opt.setName('word').setDescription('Word to filter').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('removeword')
        .setDescription('Remove a word from the filter')
        .addStringOption((opt) =>
          opt.setName('word').setDescription('Word to remove').setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName('listwords').setDescription('List all filtered words'))
    .addSubcommand((sub) =>
      sub
        .setName('accountage')
        .setDescription('Configure account age verification')
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Enable/disable account age check')
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('min_days')
            .setDescription('Minimum account age in days (default: 7)')
            .setMinValue(1)
            .setMaxValue(365)
        )
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('Action to take')
            .addChoices(
              { name: 'Kick', value: 'kick' },
              { name: 'Quarantine (assign role)', value: 'quarantine' }
            )
        )
        .addRoleOption((opt) =>
          opt.setName('quarantine_role').setDescription('Role to assign for quarantine action')
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('exempt')
        .setDescription('Add or remove exempt roles')
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('Add or remove')
            .setRequired(true)
            .addChoices(
              { name: 'Add', value: 'add' },
              { name: 'Remove', value: 'remove' },
              { name: 'List', value: 'list' }
            )
        )
        .addRoleOption((opt) => opt.setName('role').setDescription('Role to exempt'))
    )
    .addSubcommand((sub) =>
      sub
        .setName('allowdomain')
        .setDescription('Add or remove allowed domains for link filter')
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('Add or remove')
            .setRequired(true)
            .addChoices(
              { name: 'Add', value: 'add' },
              { name: 'Remove', value: 'remove' },
              { name: 'List', value: 'list' }
            )
        )
        .addStringOption((opt) =>
          opt.setName('domain').setDescription('Domain (e.g., youtube.com)')
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
    const config = getAutomodConfig(guildId);

    switch (subcommand) {
      case 'enable': {
        updateAutomodConfig(guildId, { enabled: true });
        await interaction.reply({ content: '✅ Auto-moderation enabled!', ephemeral: true });
        break;
      }

      case 'disable': {
        updateAutomodConfig(guildId, { enabled: false });
        await interaction.reply({ content: '❌ Auto-moderation disabled.', ephemeral: true });
        break;
      }

      case 'status': {
        const embed = new EmbedBuilder()
          .setColor(config.enabled ? 0x57f287 : 0xed4245)
          .setTitle('AutoMod Configuration')
          .setDescription(
            config.enabled ? '✅ **AutoMod is ENABLED**' : '❌ **AutoMod is DISABLED**'
          )
          .addFields(
            {
              name: '🚫 Anti-Spam',
              value: config.antiSpam.enabled
                ? `Enabled\n• Max ${config.antiSpam.maxMessages} msgs/${config.antiSpam.timeWindow / 1000}s\n• Action: ${config.antiSpam.action}`
                : 'Disabled',
              inline: true,
            },
            {
              name: '🔗 Link Filter',
              value: config.linkFilter.enabled
                ? `Enabled\n• Invites: ${config.linkFilter.blockDiscordInvites ? 'Blocked' : 'Allowed'}\n• All links: ${config.linkFilter.blockAllLinks ? 'Blocked' : 'Allowed'}\n• Action: ${config.linkFilter.action}`
                : 'Disabled',
              inline: true,
            },
            {
              name: '💬 Word Filter',
              value: config.wordFilter.enabled
                ? `Enabled\n• ${config.wordFilter.words.length} words\n• Action: ${config.wordFilter.action}`
                : 'Disabled',
              inline: true,
            },
            {
              name: '📅 Account Age',
              value: config.accountAge.enabled
                ? `Enabled\n• Min: ${config.accountAge.minAgeDays} days\n• Action: ${config.accountAge.action}`
                : 'Disabled',
              inline: true,
            },
            {
              name: '🛡️ Exempt Roles',
              value:
                config.exemptRoles.length > 0
                  ? config.exemptRoles.map((r) => `<@&${r}>`).join(', ')
                  : 'None (only admins exempt)',
              inline: false,
            }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }

      case 'antispam': {
        const enabled = interaction.options.getBoolean('enabled', true);
        const maxMessages = interaction.options.getInteger('max_messages');
        const timeWindow = interaction.options.getInteger('time_window');
        const action = interaction.options.getString('action') as
          | 'warn'
          | 'timeout'
          | 'kick'
          | null;

        const updated = {
          ...config.antiSpam,
          enabled,
          ...(maxMessages && { maxMessages }),
          ...(timeWindow && { timeWindow: timeWindow * 1000 }),
          ...(action && { action }),
        };

        updateAutomodSection(guildId, 'antiSpam', updated);
        await interaction.reply({
          content: `✅ Anti-spam ${enabled ? 'enabled' : 'disabled'}. Max ${updated.maxMessages} messages per ${updated.timeWindow / 1000}s, action: ${updated.action}`,
          ephemeral: true,
        });
        break;
      }

      case 'linkfilter': {
        const enabled = interaction.options.getBoolean('enabled', true);
        const blockInvites = interaction.options.getBoolean('block_invites');
        const blockAllLinks = interaction.options.getBoolean('block_all_links');
        const action = interaction.options.getString('action') as
          | 'delete'
          | 'warn'
          | 'timeout'
          | null;

        const updated = {
          ...config.linkFilter,
          enabled,
          ...(blockInvites !== null && { blockDiscordInvites: blockInvites }),
          ...(blockAllLinks !== null && { blockAllLinks }),
          ...(action && { action }),
        };

        updateAutomodSection(guildId, 'linkFilter', updated);
        await interaction.reply({
          content: `✅ Link filter ${enabled ? 'enabled' : 'disabled'}. Invites: ${updated.blockDiscordInvites ? 'blocked' : 'allowed'}, All links: ${updated.blockAllLinks ? 'blocked' : 'allowed'}`,
          ephemeral: true,
        });
        break;
      }

      case 'wordfilter': {
        const enabled = interaction.options.getBoolean('enabled', true);
        const action = interaction.options.getString('action') as
          | 'delete'
          | 'warn'
          | 'timeout'
          | null;

        const updated = {
          ...config.wordFilter,
          enabled,
          ...(action && { action }),
        };

        updateAutomodSection(guildId, 'wordFilter', updated);
        await interaction.reply({
          content: `✅ Word filter ${enabled ? 'enabled' : 'disabled'}. ${config.wordFilter.words.length} words configured.`,
          ephemeral: true,
        });
        break;
      }

      case 'addword': {
        const word = interaction.options.getString('word', true);
        addFilteredWord(guildId, word);
        await interaction.reply({
          content: `✅ Added "${word}" to the word filter.`,
          ephemeral: true,
        });
        break;
      }

      case 'removeword': {
        const word = interaction.options.getString('word', true);
        removeFilteredWord(guildId, word);
        await interaction.reply({
          content: `✅ Removed "${word}" from the word filter.`,
          ephemeral: true,
        });
        break;
      }

      case 'listwords': {
        const words = config.wordFilter.words;
        if (words.length === 0) {
          await interaction.reply({ content: 'No words in the filter.', ephemeral: true });
        } else {
          await interaction.reply({
            content: `**Filtered words (${words.length}):**\n||${words.join(', ')}||`,
            ephemeral: true,
          });
        }
        break;
      }

      case 'accountage': {
        const enabled = interaction.options.getBoolean('enabled', true);
        const minDays = interaction.options.getInteger('min_days');
        const action = interaction.options.getString('action') as 'kick' | 'quarantine' | null;
        const quarantineRole = interaction.options.getRole('quarantine_role');

        const updated = {
          ...config.accountAge,
          enabled,
          ...(minDays && { minAgeDays: minDays }),
          ...(action && { action }),
          ...(quarantineRole && { quarantineRoleId: quarantineRole.id }),
        };

        updateAutomodSection(guildId, 'accountAge', updated);
        await interaction.reply({
          content: `✅ Account age check ${enabled ? 'enabled' : 'disabled'}. Minimum: ${updated.minAgeDays} days, action: ${updated.action}`,
          ephemeral: true,
        });
        break;
      }

      case 'exempt': {
        const action = interaction.options.getString('action', true);
        const role = interaction.options.getRole('role');

        if (action === 'list') {
          if (config.exemptRoles.length === 0) {
            await interaction.reply({
              content: 'No exempt roles configured. Only admins are exempt.',
              ephemeral: true,
            });
          } else {
            await interaction.reply({
              content: `**Exempt roles:**\n${config.exemptRoles.map((r) => `<@&${r}>`).join('\n')}`,
              ephemeral: true,
            });
          }
        } else if (!role) {
          await interaction.reply({ content: 'Please specify a role.', ephemeral: true });
        } else if (action === 'add') {
          addExemptRole(guildId, role.id);
          await interaction.reply({
            content: `✅ Added ${role} to exempt roles.`,
            ephemeral: true,
          });
        } else {
          removeExemptRole(guildId, role.id);
          await interaction.reply({
            content: `✅ Removed ${role} from exempt roles.`,
            ephemeral: true,
          });
        }
        break;
      }

      case 'allowdomain': {
        const action = interaction.options.getString('action', true);
        const domain = interaction.options.getString('domain');

        if (action === 'list') {
          if (config.linkFilter.allowedDomains.length === 0) {
            await interaction.reply({ content: 'No allowed domains configured.', ephemeral: true });
          } else {
            await interaction.reply({
              content: `**Allowed domains:**\n${config.linkFilter.allowedDomains.join('\n')}`,
              ephemeral: true,
            });
          }
        } else if (!domain) {
          await interaction.reply({ content: 'Please specify a domain.', ephemeral: true });
        } else if (action === 'add') {
          addAllowedDomain(guildId, domain);
          await interaction.reply({
            content: `✅ Added ${domain} to allowed domains.`,
            ephemeral: true,
          });
        } else {
          removeAllowedDomain(guildId, domain);
          await interaction.reply({
            content: `✅ Removed ${domain} from allowed domains.`,
            ephemeral: true,
          });
        }
        break;
      }
    }
  },
};

export default command;
