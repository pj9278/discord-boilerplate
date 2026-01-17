import { SlashCommandBuilder, EmbedBuilder, type TextChannel } from 'discord.js';
import type { Command } from '../../types/index.js';
import {
  createFeedback,
  getStatusEmoji,
  getTypeEmoji,
  getTypeColor,
} from '../../utils/feedback.js';
import { config } from '../../utils/config.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('feedback')
    .setDescription('Share general feedback')
    .addStringOption((option) =>
      option.setName('message').setDescription('Your feedback').setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('category')
        .setDescription('Category of feedback')
        .setRequired(false)
        .addChoices(
          { name: '👍 Positive - Something you love', value: 'positive' },
          { name: '💭 Neutral - General thoughts', value: 'neutral' },
          { name: '👎 Negative - Something to improve', value: 'negative' }
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

    const channelId = config.channels.feedback;
    if (!channelId) {
      await interaction.reply({
        content: 'Feedback channel not configured. Please contact an admin.',
        ephemeral: true,
      });
      return;
    }

    const message = interaction.options.getString('message', true);
    const category = interaction.options.getString('category') ?? 'neutral';

    const categoryDisplay: Record<string, string> = {
      positive: '👍 Positive',
      neutral: '💭 General',
      negative: '👎 Needs Improvement',
    };

    const categoryColors: Record<string, number> = {
      positive: 0x57f287, // Green
      neutral: 0x5865f2, // Blue
      negative: 0xfee75c, // Yellow
    };

    await interaction.deferReply({ ephemeral: true });

    try {
      const channel = (await interaction.client.channels.fetch(channelId)) as TextChannel;
      if (!channel || !channel.isTextBased()) {
        await interaction.editReply('Feedback channel not found.');
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(categoryColors[category] ?? getTypeColor('feedback'))
        .setTitle(`${getTypeEmoji('feedback')} New Feedback`)
        .setDescription(message)
        .addFields(
          { name: 'Category', value: categoryDisplay[category] ?? '💭 General', inline: true },
          { name: 'Status', value: `${getStatusEmoji('new')} New`, inline: true }
        )
        .setAuthor({
          name: interaction.user.tag,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      // Send to feedback channel
      const sentMessage = await channel.send({ embeds: [embed] });

      // Store in database
      const item = createFeedback(
        interaction.guild.id,
        'feedback',
        interaction.user.id,
        interaction.user.tag,
        `Feedback from ${interaction.user.tag}`,
        `${message}\n\n**Category:** ${categoryDisplay[category]}`,
        sentMessage.id,
        channelId
      );

      // Update embed with ID
      embed.setFooter({ text: `Feedback #${item.id}` });
      await sentMessage.edit({ embeds: [embed] });

      await interaction.editReply('Thank you for your feedback! The team will review it.');
    } catch {
      await interaction.editReply('Failed to submit feedback. Please try again.');
    }
  },
};

export default command;
