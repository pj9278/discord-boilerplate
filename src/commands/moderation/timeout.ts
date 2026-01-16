import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../../types/index.js';
import { createCase, parseDuration, formatDuration } from '../../utils/moderation.js';
import { sendModLog } from '../../utils/modLog.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member (prevent them from chatting)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to timeout').setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('duration')
        .setDescription('Duration (e.g., 10m, 1h, 1d). Max 28 days.')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for the timeout').setRequired(false)
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
    const durationStr = interaction.options.getString('duration', true);
    const reason = interaction.options.getString('reason') ?? 'No reason provided';

    // Parse duration
    const durationSeconds = parseDuration(durationStr);
    if (!durationSeconds) {
      await interaction.reply({
        content: 'Invalid duration format. Use: 10s, 5m, 1h, 1d (e.g., "30m" for 30 minutes)',
        ephemeral: true,
      });
      return;
    }

    // Max timeout is 28 days
    const maxTimeout = 28 * 24 * 60 * 60;
    if (durationSeconds > maxTimeout) {
      await interaction.reply({
        content: 'Maximum timeout duration is 28 days.',
        ephemeral: true,
      });
      return;
    }

    // Get the member
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      await interaction.reply({ content: 'User is not in this server.', ephemeral: true });
      return;
    }

    // Check if user can be timed out
    if (!targetMember.moderatable) {
      await interaction.reply({
        content: 'I cannot timeout this user. They may have higher permissions than me.',
        ephemeral: true,
      });
      return;
    }

    // Check role hierarchy
    const moderator = await interaction.guild.members.fetch(interaction.user.id);
    if (targetMember.roles.highest.position >= moderator.roles.highest.position) {
      await interaction.reply({
        content: 'You cannot timeout a member with equal or higher role than you.',
        ephemeral: true,
      });
      return;
    }

    // Prevent self-timeout
    if (targetUser.id === interaction.user.id) {
      await interaction.reply({ content: 'You cannot timeout yourself.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      // Execute the timeout
      await targetMember.timeout(
        durationSeconds * 1000,
        `${reason} | Timed out by ${interaction.user.tag}`
      );

      // Create case record
      const modCase = createCase(
        interaction.guild.id,
        targetUser.id,
        targetUser.tag,
        interaction.user.id,
        interaction.user.tag,
        'timeout',
        reason,
        durationSeconds
      );

      // Send to mod log channel
      await sendModLog(interaction.client, modCase);

      await interaction.editReply(
        `**${targetUser.tag}** has been timed out for ${formatDuration(durationSeconds)}. (Case #${modCase.id})\nReason: ${reason}`
      );
    } catch {
      await interaction.editReply('Failed to timeout the user. Please check my permissions.');
    }
  },
};

export default command;
