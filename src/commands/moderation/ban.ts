import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../../types/index.js';
import { createCase } from '../../utils/moderation.js';
import { sendModLog } from '../../utils/modLog.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to ban').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for the ban').setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('delete_days')
        .setDescription('Days of messages to delete (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
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
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_days') ?? 0;

    // Get the member if they're in the server
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    // Check if user can be banned
    if (targetMember) {
      if (!targetMember.bannable) {
        await interaction.reply({
          content: 'I cannot ban this user. They may have higher permissions than me.',
          ephemeral: true,
        });
        return;
      }

      // Check role hierarchy
      const moderator = await interaction.guild.members.fetch(interaction.user.id);
      if (targetMember.roles.highest.position >= moderator.roles.highest.position) {
        await interaction.reply({
          content: 'You cannot ban a member with equal or higher role than you.',
          ephemeral: true,
        });
        return;
      }
    }

    // Prevent self-ban
    if (targetUser.id === interaction.user.id) {
      await interaction.reply({ content: 'You cannot ban yourself.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      // Try to DM the user before banning
      await targetUser
        .send(`You have been banned from **${interaction.guild.name}**.\nReason: ${reason}`)
        .catch(() => null);

      // Execute the ban
      await interaction.guild.members.ban(targetUser, {
        reason: `${reason} | Banned by ${interaction.user.tag}`,
        deleteMessageSeconds: deleteDays * 86400,
      });

      // Create case record
      const modCase = createCase(
        interaction.guild.id,
        targetUser.id,
        targetUser.tag,
        interaction.user.id,
        interaction.user.tag,
        'ban',
        reason
      );

      // Send to mod log channel
      await sendModLog(interaction.client, modCase);

      await interaction.editReply(
        `**${targetUser.tag}** has been banned. (Case #${modCase.id})\nReason: ${reason}`
      );
    } catch {
      await interaction.editReply('Failed to ban the user. Please check my permissions.');
    }
  },
};

export default command;
