import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../../types/index.js';
import { postWeeklyNews } from '../../features/contentNews.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('content-news')
    .setDescription('Manually trigger the content creator news roundup')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      await postWeeklyNews(interaction.client);
      await interaction.editReply('Content creator news posted!');
    } catch (error) {
      console.error('[Content News Command] Error:', error);
      await interaction.editReply('Failed to post content news. Check the logs.');
    }
  },
};

export default command;
