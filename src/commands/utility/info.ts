import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription('Get information about the bot or server')
    .addSubcommand((subcommand) =>
      subcommand.setName('bot').setDescription('Get information about the bot')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('server').setDescription('Get information about the server')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('user')
        .setDescription('Get information about a user')
        .addUserOption((option) =>
          option.setName('target').setDescription('The user to get info about').setRequired(false)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'bot': {
        const client = interaction.client;
        const uptime = formatUptime(client.uptime ?? 0);

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('Bot Information')
          .addFields(
            { name: 'Name', value: client.user?.username ?? 'Unknown', inline: true },
            { name: 'Servers', value: String(client.guilds.cache.size), inline: true },
            { name: 'Users', value: String(client.users.cache.size), inline: true },
            { name: 'Uptime', value: uptime, inline: true },
            { name: 'Ping', value: `${client.ws.ping}ms`, inline: true },
            { name: 'Node.js', value: process.version, inline: true }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'server': {
        const guild = interaction.guild;
        if (!guild) {
          await interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true,
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(guild.name)
          .setThumbnail(guild.iconURL())
          .addFields(
            { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
            { name: 'Members', value: String(guild.memberCount), inline: true },
            { name: 'Channels', value: String(guild.channels.cache.size), inline: true },
            { name: 'Roles', value: String(guild.roles.cache.size), inline: true },
            {
              name: 'Created',
              value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
              inline: true,
            },
            { name: 'Boost Level', value: String(guild.premiumTier), inline: true }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'user': {
        const targetUser = interaction.options.getUser('target') ?? interaction.user;
        const member = interaction.guild?.members.cache.get(targetUser.id);

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(targetUser.username)
          .setThumbnail(targetUser.displayAvatarURL())
          .addFields(
            { name: 'ID', value: targetUser.id, inline: true },
            { name: 'Bot', value: targetUser.bot ? 'Yes' : 'No', inline: true },
            {
              name: 'Created',
              value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`,
              inline: true,
            }
          )
          .setTimestamp();

        if (member) {
          embed.addFields(
            {
              name: 'Joined Server',
              value: member.joinedAt
                ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>`
                : 'Unknown',
              inline: true,
            },
            { name: 'Roles', value: String(member.roles.cache.size - 1), inline: true },
            { name: 'Nickname', value: member.nickname ?? 'None', inline: true }
          );
        }

        await interaction.reply({ embeds: [embed] });
        break;
      }
    }
  },
};

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
  if (seconds % 60 > 0) parts.push(`${seconds % 60}s`);

  return parts.join(' ') || '0s';
}

export default command;
