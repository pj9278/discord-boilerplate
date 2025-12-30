import { Events } from 'discord.js';
import type { ChatInputCommandInteraction, Interaction } from 'discord.js';
import type { Event, ExtendedClient } from '../types/index.js';

const event: Event = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return;

    const client = interaction.client as ExtendedClient;
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`[Command] No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction as ChatInputCommandInteraction);
    } catch (error) {
      console.error(`[Command] Error executing ${interaction.commandName}:`, error);

      const errorMessage = {
        content: 'There was an error while executing this command!',
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  },
};

export default event;
