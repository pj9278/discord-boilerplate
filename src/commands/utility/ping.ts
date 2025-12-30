import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Replies with bot latency'),

  async execute(interaction) {
    const sent = await interaction.reply({
      content: 'Pinging...',
      fetchReply: true,
    });

    const roundtripLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const wsLatency = interaction.client.ws.ping;

    await interaction.editReply(
      `Pong! Roundtrip latency: ${roundtripLatency}ms | WebSocket: ${wsLatency}ms`
    );
  },
};

export default command;
