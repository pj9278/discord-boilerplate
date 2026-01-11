import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription("Get a user's avatar")
    .addUserOption((option) =>
      option.setName('user').setDescription('User to get avatar for').setRequired(false)
    ),

  async execute(interaction) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const avatarUrl = user.displayAvatarURL({ size: 1024 });

    const embed = new EmbedBuilder()
      .setTitle(`${user.username}'s Avatar`)
      .setImage(avatarUrl)
      .setColor(0x5865f2);

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
