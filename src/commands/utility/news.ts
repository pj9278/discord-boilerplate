import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../../types/index.js';
import { postWeeklyNews } from '../../features/aiNews.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('news')
    .setDescription('Manually trigger the AI news roundup')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      await postWeeklyNews(interaction.client);
      await interaction.editReply('AI news posted!');
    } catch (error) {
      console.error('[News Command] Error:', error);
      await interaction.editReply('Failed to post news. Check the logs.');
    }
  },
};

export default command;
