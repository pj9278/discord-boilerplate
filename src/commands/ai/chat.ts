import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/index.js';
import { chat, isAIAvailable } from '../../utils/ai.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('chat')
    .setDescription('Chat with AI')
    .addStringOption((option) =>
      option.setName('message').setDescription('Your message').setRequired(true)
    ),

  async execute(interaction) {
    if (!isAIAvailable()) {
      await interaction.reply({ content: 'AI not configured.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const message = interaction.options.getString('message', true);

    try {
      const response = await chat(message);
      await interaction.editReply(response.slice(0, 2000)); // Discord limit
    } catch {
      await interaction.editReply('Failed to get AI response.');
    }
  },
};

export default command;
