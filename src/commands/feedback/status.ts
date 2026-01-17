import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../../types/index.js';
import type { FeedbackStatus } from '../../types/index.js';
import {
  getFeedback,
  updateFeedbackStatus,
  getStatusEmoji,
  getStatusName,
  getTypeEmoji,
  getTypeColor,
} from '../../utils/feedback.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Update the status of a feedback item (Staff only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((option) =>
      option.setName('id').setDescription('The feedback item ID').setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('status')
        .setDescription('New status')
        .setRequired(true)
        .addChoices(
          { name: '🆕 New', value: 'new' },
          { name: '👀 Reviewing', value: 'reviewing' },
          { name: '🚧 In Progress', value: 'in_progress' },
          { name: '✅ Done', value: 'done' },
          { name: "❌ Won't Do", value: 'wont_do' }
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

    const id = interaction.options.getInteger('id', true);
    const newStatus = interaction.options.getString('status', true) as FeedbackStatus;

    await interaction.deferReply({ ephemeral: true });

    try {
      // Get the feedback item
      const item = getFeedback(interaction.guild.id, id);
      if (!item) {
        await interaction.editReply(`Feedback item #${id} not found.`);
        return;
      }

      // Update status in database
      updateFeedbackStatus(interaction.guild.id, id, newStatus);

      // Update the original message
      const channel = await interaction.client.channels.fetch(item.channelId);
      if (channel && channel.isTextBased()) {
        try {
          const message = await channel.messages.fetch(item.messageId);

          // Rebuild the embed with new status
          const oldEmbed = message.embeds[0];
          if (oldEmbed) {
            const newEmbed = new EmbedBuilder()
              .setColor(getTypeColor(item.type))
              .setTitle(oldEmbed.title ?? `${getTypeEmoji(item.type)} ${item.title}`)
              .setDescription(oldEmbed.description ?? item.description)
              .setAuthor(oldEmbed.author)
              .setTimestamp(oldEmbed.timestamp ? new Date(oldEmbed.timestamp) : new Date())
              .setFooter(oldEmbed.footer);

            // Update fields with new status
            const fields = oldEmbed.fields.map((field) => {
              if (field.name === 'Status') {
                return {
                  name: 'Status',
                  value: `${getStatusEmoji(newStatus)} ${getStatusName(newStatus)}`,
                  inline: true,
                };
              }
              return field;
            });
            newEmbed.addFields(fields);

            await message.edit({ embeds: [newEmbed] });
          }
        } catch {
          // Message might have been deleted
        }
      }

      await interaction.editReply(
        `Updated #${id} status to ${getStatusEmoji(newStatus)} **${getStatusName(newStatus)}**`
      );
    } catch {
      await interaction.editReply('Failed to update status. Please try again.');
    }
  },
};

export default command;
