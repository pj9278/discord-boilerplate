import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/index.js';
import { chatWithHistory, clearHistory, isAIAvailable } from '../../utils/ai.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Chat with AI (remembers conversation)')
    .addStringOption((option) =>
      option.setName('message').setDescription('Your message').setRequired(true)
    )
    .addBooleanOption((option) =>
      option.setName('clear').setDescription('Clear conversation history first').setRequired(false)
    ),

  async execute(interaction) {
    if (!isAIAvailable()) {
      await interaction.reply({ content: 'AI not configured.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const message = interaction.options.getString('message', true);
    const clear = interaction.options.getBoolean('clear') ?? false;

    if (clear) {
      clearHistory(interaction.user.id);
    }

    try {
      const response = await chatWithHistory(interaction.user.id, message);
      await interaction.editReply(response.slice(0, 2000));
    } catch {
      await interaction.editReply('Failed to get AI response.');
    }
  },
};

export default command;
