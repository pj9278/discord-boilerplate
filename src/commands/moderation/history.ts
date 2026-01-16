import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import type { Command } from '../../types/index.js';
import { getUserCases, countUserCases, formatDuration } from '../../utils/moderation.js';

const ACTION_EMOJI: Record<string, string> = {
  ban: '🔨',
  kick: '👢',
  timeout: '🔇',
  warn: '⚠️',
  unban: '🔓',
  untimeout: '🔊',
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription("View a member's moderation history")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to check').setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    const targetUser = interaction.options.getUser('user', true);

    await interaction.deferReply();

    const cases = getUserCases(interaction.guild.id, targetUser.id);
    const counts = countUserCases(interaction.guild.id, targetUser.id);

    const embed = new EmbedBuilder()
      .setColor(cases.length > 0 ? 0xffc107 : 0x28a745)
      .setTitle(`Moderation History: ${targetUser.tag}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .setFooter({ text: `User ID: ${targetUser.id}` })
      .setTimestamp();

    // Summary
    const summaryParts: string[] = [];
    if (counts.warn > 0) summaryParts.push(`${counts.warn} warning${counts.warn > 1 ? 's' : ''}`);
    if (counts.timeout > 0)
      summaryParts.push(`${counts.timeout} timeout${counts.timeout > 1 ? 's' : ''}`);
    if (counts.kick > 0) summaryParts.push(`${counts.kick} kick${counts.kick > 1 ? 's' : ''}`);
    if (counts.ban > 0) summaryParts.push(`${counts.ban} ban${counts.ban > 1 ? 's' : ''}`);

    embed.setDescription(
      summaryParts.length > 0
        ? `**Summary:** ${summaryParts.join(', ')}`
        : '**No moderation history found.** This user has a clean record.'
    );

    // Recent cases (last 10)
    if (cases.length > 0) {
      const recentCases = cases
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);

      const caseLines = recentCases.map((c) => {
        const emoji = ACTION_EMOJI[c.action] ?? '📋';
        const date = new Date(c.timestamp).toLocaleDateString();
        const duration = c.duration ? ` (${formatDuration(c.duration)})` : '';
        const reason = c.reason.length > 50 ? c.reason.slice(0, 47) + '...' : c.reason;
        return `${emoji} **#${c.id}** ${c.action.toUpperCase()}${duration} - ${date}\n└ ${reason}`;
      });

      embed.addFields({
        name: `Recent Cases (${cases.length} total)`,
        value: caseLines.join('\n\n'),
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
