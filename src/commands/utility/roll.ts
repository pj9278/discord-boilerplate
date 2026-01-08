import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll a dice')
    .addIntegerOption((option) =>
      option
        .setName('sides')
        .setDescription('Number of sides (default: 6)')
        .setMinValue(2)
        .setMaxValue(100)
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('count')
        .setDescription('Number of dice to roll (default: 1)')
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false)
    ),

  async execute(interaction) {
    const sides = interaction.options.getInteger('sides') ?? 6;
    const count = interaction.options.getInteger('count') ?? 1;

    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1);
    }

    const total = rolls.reduce((a, b) => a + b, 0);

    if (count === 1) {
      await interaction.reply(`🎲 You rolled a **${rolls[0]}** (d${sides})`);
    } else {
      await interaction.reply(
        `🎲 You rolled: **${rolls.join(', ')}** (${count}d${sides})\n` + `📊 Total: **${total}**`
      );
    }
  },
};

export default command;
