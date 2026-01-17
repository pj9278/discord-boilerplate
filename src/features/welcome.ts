import { EmbedBuilder, type Client, type TextChannel, type GuildMember } from 'discord.js';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import type { Feature } from '../types/index.js';

const WELCOME_COLOR = 0x5865f2; // Discord blurple
const GOODBYE_COLOR = 0xed4245; // Red

function createWelcomeEmbed(
  memberName: string,
  memberAvatar: string,
  memberCount: number
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(WELCOME_COLOR)
    .setTitle(`Welcome to Cadence, ${memberName}!`)
    .setDescription(
      `We're excited to have you here! You're member **#${memberCount}**.\n\n` +
        `Please read the rules below to ensure a great experience for everyone.`
    )
    .setThumbnail(memberAvatar)
    .addFields(
      {
        name: '🤝 Be Respectful in All Areas',
        value:
          'The purpose of this server is to create a welcoming and safe environment for everyone. ' +
          'There will be no judging, criticizing, or attacking people based on their race, sexuality, or political view. ' +
          'This is strictly prohibited and will be met with severe repercussions. Debate is allowed as long as it is kept respectful.',
      },
      {
        name: '🚫 NSFW Content is Strictly Prohibited',
        value:
          'Sharing content such as lewd pictures, gore images, shock images, and pornography will result in a **permanent ban**. ' +
          'This includes sending unsolicited pictures to other members. ' +
          'If you experience a problem with an individual, report them to any online staff member.',
      },
      {
        name: '💬 Do Not Spam',
        value:
          'This server is a way for people to express themselves and interact with others. ' +
          'Please do not spam and oversaturate the chat as this can limit meaningful interactions. ' +
          'Continuing to spam after being warned will result in mutes/bans.',
      },
      {
        name: '📜 Discord Terms of Service',
        value:
          'All members must follow the [Discord Terms of Service](https://discordapp.com/terms) and [Community Guidelines](https://discord.com/guidelines).',
      }
    )
    .setFooter({ text: 'Cadence Community • Social Media Hub' })
    .setTimestamp();
}

function createGoodbyeEmbed(member: GuildMember): EmbedBuilder {
  const joinedAt = member.joinedAt;
  const duration = joinedAt ? formatMemberDuration(Date.now() - joinedAt.getTime()) : 'Unknown';

  return new EmbedBuilder()
    .setColor(GOODBYE_COLOR)
    .setTitle('Member Left')
    .setDescription(`**${member.user.username}** has left the server.`)
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: 'Member', value: `<@${member.id}>`, inline: true },
      { name: 'Time in Server', value: duration, inline: true },
      { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true }
    )
    .setFooter({ text: `User ID: ${member.id}` })
    .setTimestamp();
}

function formatMemberDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  return `${seconds} second${seconds !== 1 ? 's' : ''}`;
}

const welcome: Feature = {
  name: 'welcome',

  async init(client: Client): Promise<void> {
    const welcomeChannelId = config.channels.welcome;
    const goodbyeChannelId = config.channels.goodbye;
    const autoRoleId = config.roles.autoRole;

    // Welcome messages
    if (welcomeChannelId) {
      client.on('guildMemberAdd', async (member) => {
        try {
          // Send welcome message
          const channel = (await client.channels.fetch(welcomeChannelId)) as TextChannel;

          if (channel && channel.isTextBased()) {
            const embed = createWelcomeEmbed(
              member.user.username,
              member.user.displayAvatarURL({ size: 256 }),
              member.guild.memberCount
            );

            await channel.send({
              content: `Hey <@${member.id}>! Welcome to the community!`,
              embeds: [embed],
            });

            logger.info(`Welcomed new member: ${member.user.tag}`);
          }

          // Auto-assign role
          if (autoRoleId) {
            try {
              await member.roles.add(autoRoleId);
              logger.info(`Auto-assigned role to: ${member.user.tag}`);
            } catch (error) {
              logger.error(`Failed to auto-assign role to ${member.user.tag}:`, error);
            }
          }
        } catch (error) {
          logger.error('Failed to send welcome message:', error);
        }
      });

      logger.info('Welcome messages enabled');
    } else {
      logger.warn('Welcome feature: No WELCOME_CHANNEL_ID configured');
    }

    // Goodbye messages
    if (goodbyeChannelId) {
      client.on('guildMemberRemove', async (member) => {
        try {
          const channel = (await client.channels.fetch(goodbyeChannelId)) as TextChannel;

          if (!channel || !channel.isTextBased()) {
            return;
          }

          // Need to cast since guildMemberRemove gives PartialGuildMember | GuildMember
          const fullMember = member as GuildMember;
          const embed = createGoodbyeEmbed(fullMember);

          await channel.send({ embeds: [embed] });

          logger.info(`Sent goodbye for: ${member.user?.tag ?? 'Unknown'}`);
        } catch (error) {
          logger.error('Failed to send goodbye message:', error);
        }
      });

      logger.info('Goodbye messages enabled');
    }

    // Log auto-role status
    if (autoRoleId) {
      logger.info(`Auto-role enabled: ${autoRoleId}`);
    }

    logger.info('Welcome/Goodbye feature initialized');
  },
};

export default welcome;
