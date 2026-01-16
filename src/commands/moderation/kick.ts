import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../../types/index.js';
import { createCase } from '../../utils/moderation.js';
import { sendModLog } from '../../utils/modLog.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to kick').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for the kick').setRequired(false)
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

    // Get the member
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      await interaction.reply({ content: 'User is not in this server.', ephemeral: true });
      return;
    }

    // Check if user can be kicked
    if (!targetMember.kickable) {
      await interaction.reply({
        content: 'I cannot kick this user. They may have higher permissions than me.',
        ephemeral: true,
      });
      return;
    }

    // Check role hierarchy
    const moderator = await interaction.guild.members.fetch(interaction.user.id);
    if (targetMember.roles.highest.position >= moderator.roles.highest.position) {
      await interaction.reply({
        content: 'You cannot kick a member with equal or higher role than you.',
        ephemeral: true,
      });
      return;
    }

    // Prevent self-kick
    if (targetUser.id === interaction.user.id) {
      await interaction.reply({ content: 'You cannot kick yourself.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      // Try to DM the user before kicking
      await targetUser
        .send(`You have been kicked from **${interaction.guild.name}**.\nReason: ${reason}`)
        .catch(() => null);

      // Execute the kick
      await targetMember.kick(`${reason} | Kicked by ${interaction.user.tag}`);

      // Create case record
      const modCase = createCase(
        interaction.guild.id,
        targetUser.id,
        targetUser.tag,
        interaction.user.id,
        interaction.user.tag,
        'kick',
        reason
      );

      // Send to mod log channel
      await sendModLog(interaction.client, modCase);

      await interaction.editReply(
        `**${targetUser.tag}** has been kicked. (Case #${modCase.id})\nReason: ${reason}`
      );
    } catch {
      await interaction.editReply('Failed to kick the user. Please check my permissions.');
    }
  },
};

export default command;
