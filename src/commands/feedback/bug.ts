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
    .setName('bug')
    .setDescription('Report a bug')
    .addStringOption((option) =>
      option.setName('title').setDescription('Short title for the bug').setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('description')
        .setDescription('Describe the bug and steps to reproduce')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('severity')
        .setDescription('How severe is this bug?')
        .setRequired(false)
        .addChoices(
          { name: '🔴 Critical - App unusable', value: 'critical' },
          { name: '🟠 High - Major feature broken', value: 'high' },
          { name: '🟡 Medium - Feature partially broken', value: 'medium' },
          { name: '🟢 Low - Minor issue', value: 'low' }
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

    const channelId = config.channels.bugs;
    if (!channelId) {
      await interaction.reply({
        content: 'Bug reports channel not configured. Please contact an admin.',
        ephemeral: true,
      });
      return;
    }

    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description', true);
    const severity = interaction.options.getString('severity') ?? 'medium';

    const severityDisplay: Record<string, string> = {
      critical: '🔴 Critical',
      high: '🟠 High',
      medium: '🟡 Medium',
      low: '🟢 Low',
    };

    await interaction.deferReply({ ephemeral: true });

    try {
      const channel = (await interaction.client.channels.fetch(channelId)) as TextChannel;
      if (!channel || !channel.isTextBased()) {
        await interaction.editReply('Bug reports channel not found.');
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(getTypeColor('bug'))
        .setTitle(`${getTypeEmoji('bug')} ${title}`)
        .setDescription(description)
        .addFields(
          { name: 'Status', value: `${getStatusEmoji('new')} New`, inline: true },
          { name: 'Severity', value: severityDisplay[severity] ?? '🟡 Medium', inline: true }
        )
        .setAuthor({
          name: interaction.user.tag,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      // Send to bugs channel
      const message = await channel.send({ embeds: [embed] });

      // Store in database
      const item = createFeedback(
        interaction.guild.id,
        'bug',
        interaction.user.id,
        interaction.user.tag,
        title,
        `${description}\n\n**Severity:** ${severityDisplay[severity]}`,
        message.id,
        channelId
      );

      // Update embed with ID
      embed.setFooter({ text: `Bug #${item.id}` });
      await message.edit({ embeds: [embed] });

      await interaction.editReply(
        `Your bug report has been submitted! Check <#${channelId}> to track it.`
      );
    } catch {
      await interaction.editReply('Failed to submit bug report. Please try again.');
    }
  },
};

export default command;
