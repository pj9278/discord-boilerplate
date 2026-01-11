import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/index.js';
import { isAIAvailable, summarize } from '../../utils/ai.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('summarize')
    .setDescription('Summarize text into bullet points')
    .addStringOption((option) =>
      option.setName('text').setDescription('Text to summarize').setRequired(true)
    ),

  async execute(interaction) {
    if (!isAIAvailable()) {
      await interaction.reply({ content: 'AI not configured.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const text = interaction.options.getString('text', true);

    try {
      const response = await summarize(text);
      await interaction.editReply(response.slice(0, 2000));
    } catch {
      await interaction.editReply('Failed to summarize text.');
    }
  },
};

export default command;
