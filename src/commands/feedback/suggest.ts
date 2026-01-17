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
    .setName('suggest')
    .setDescription('Submit a feature suggestion')
    .addStringOption((option) =>
      option.setName('title').setDescription('Short title for your suggestion').setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('description')
        .setDescription('Detailed description of your suggestion')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    const channelId = config.channels.suggestions;
    if (!channelId) {
      await interaction.reply({
        content: 'Suggestions channel not configured. Please contact an admin.',
        ephemeral: true,
      });
      return;
    }

    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description', true);

    await interaction.deferReply({ ephemeral: true });

    try {
      const channel = (await interaction.client.channels.fetch(channelId)) as TextChannel;
      if (!channel || !channel.isTextBased()) {
        await interaction.editReply('Suggestions channel not found.');
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(getTypeColor('suggestion'))
        .setTitle(`${getTypeEmoji('suggestion')} ${title}`)
        .setDescription(description)
        .addFields(
          { name: 'Status', value: `${getStatusEmoji('new')} New`, inline: true },
          { name: 'Votes', value: '👍 0 | 👎 0', inline: true }
        )
        .setAuthor({
          name: interaction.user.tag,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp()
        .setFooter({ text: 'React to vote!' });

      // Send to suggestions channel
      const message = await channel.send({ embeds: [embed] });

      // Add voting reactions
      await message.react('👍');
      await message.react('👎');

      // Store in database
      const item = createFeedback(
        interaction.guild.id,
        'suggestion',
        interaction.user.id,
        interaction.user.tag,
        title,
        description,
        message.id,
        channelId
      );

      // Update embed with ID
      embed.setFooter({ text: `#${item.id} • React to vote!` });
      await message.edit({ embeds: [embed] });

      await interaction.editReply(
        `Your suggestion has been submitted! Check <#${channelId}> to see it.`
      );
    } catch {
      await interaction.editReply('Failed to submit suggestion. Please try again.');
    }
  },
};

export default command;
