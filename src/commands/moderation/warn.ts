import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../../types/index.js';
import { createCase, countUserCases } from '../../utils/moderation.js';
import { sendModLog } from '../../utils/modLog.js';
import { checkExactEscalation, formatEscalationDuration } from '../../utils/strikeEscalation.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a warning to a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to warn').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for the warning').setRequired(true)
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
    const reason = interaction.options.getString('reason', true);

    // Get the member
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      await interaction.reply({ content: 'User is not in this server.', ephemeral: true });
      return;
    }

    // Check role hierarchy (optional but recommended for warns)
    const moderator = await interaction.guild.members.fetch(interaction.user.id);
    if (targetMember.roles.highest.position >= moderator.roles.highest.position) {
      await interaction.reply({
        content: 'You cannot warn a member with equal or higher role than you.',
        ephemeral: true,
      });
      return;
    }

    // Prevent warning bots
    if (targetUser.bot) {
      await interaction.reply({ content: 'You cannot warn a bot.', ephemeral: true });
      return;
    }

    // Prevent self-warn
    if (targetUser.id === interaction.user.id) {
      await interaction.reply({ content: 'You cannot warn yourself.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      // Create case record
      const modCase = createCase(
        interaction.guild.id,
        targetUser.id,
        targetUser.tag,
        interaction.user.id,
        interaction.user.tag,
        'warn',
        reason
      );

      // Get total warnings for user
      const counts = countUserCases(interaction.guild.id, targetUser.id);
      const totalWarnings = counts.warn;

      // Try to DM the user
      await targetUser
        .send(
          `You have received a warning in **${interaction.guild.name}**.\n` +
            `Reason: ${reason}\n` +
            `Total warnings: ${totalWarnings}`
        )
        .catch(() => null);

      // Send to mod log channel
      await sendModLog(interaction.client, modCase);

      // Check for escalation
      const escalation = checkExactEscalation(interaction.guild.id, totalWarnings);
      let escalationMsg = '';

      if (escalation) {
        try {
          switch (escalation.action) {
            case 'timeout': {
              await targetMember.timeout(
                escalation.duration ?? 3600000,
                `Strike escalation: ${totalWarnings} warnings`
              );

              const escalationCase = createCase(
                interaction.guild.id,
                targetUser.id,
                targetUser.tag,
                interaction.client.user!.id,
                'StrikeEscalation',
                'timeout',
                `Automatic escalation: ${totalWarnings} warnings reached`,
                escalation.duration
              );
              await sendModLog(interaction.client, escalationCase);

              escalationMsg = `\n⚠️ **Escalation triggered:** Timed out for ${formatEscalationDuration(escalation.duration ?? 3600000)}`;
              break;
            }
            case 'kick': {
              await targetUser
                .send(
                  `You have been kicked from **${interaction.guild.name}** due to reaching ${totalWarnings} warnings.`
                )
                .catch(() => null);

              const escalationCase = createCase(
                interaction.guild.id,
                targetUser.id,
                targetUser.tag,
                interaction.client.user!.id,
                'StrikeEscalation',
                'kick',
                `Automatic escalation: ${totalWarnings} warnings reached`
              );

              await targetMember.kick(`Strike escalation: ${totalWarnings} warnings`);
              await sendModLog(interaction.client, escalationCase);

              escalationMsg = `\n⚠️ **Escalation triggered:** User kicked`;
              break;
            }
            case 'ban': {
              await targetUser
                .send(
                  `You have been banned from **${interaction.guild.name}** due to reaching ${totalWarnings} warnings.`
                )
                .catch(() => null);

              const escalationCase = createCase(
                interaction.guild.id,
                targetUser.id,
                targetUser.tag,
                interaction.client.user!.id,
                'StrikeEscalation',
                'ban',
                `Automatic escalation: ${totalWarnings} warnings reached`
              );

              await targetMember.ban({ reason: `Strike escalation: ${totalWarnings} warnings` });
              await sendModLog(interaction.client, escalationCase);

              escalationMsg = `\n⚠️ **Escalation triggered:** User banned`;
              break;
            }
          }
        } catch {
          escalationMsg = `\n⚠️ Escalation failed - could not ${escalation.action} user`;
        }
      }

      await interaction.editReply(
        `**${targetUser.tag}** has been warned. (Case #${modCase.id})\n` +
          `Reason: ${reason}\n` +
          `Total warnings for this user: ${totalWarnings}${escalationMsg}`
      );
    } catch {
      await interaction.editReply('Failed to warn the user.');
    }
  },
};

export default command;
