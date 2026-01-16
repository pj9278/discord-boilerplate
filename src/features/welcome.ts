import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import type { Feature } from '../types/index.js';

const WELCOME_COLOR = 0x5865f2; // Discord blurple

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

const welcome: Feature = {
  name: 'welcome',

  async init(client: Client): Promise<void> {
    const channelId = config.channels.welcome;

    if (!channelId) {
      logger.warn('Welcome feature: No WELCOME_CHANNEL_ID configured');
      return;
    }

    client.on('guildMemberAdd', async (member) => {
      try {
        const channel = (await client.channels.fetch(channelId)) as TextChannel;

        if (!channel || !channel.isTextBased()) {
          logger.warn('Welcome channel not found or not a text channel');
          return;
        }

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
      } catch (error) {
        logger.error('Failed to send welcome message:', error);
      }
    });

    logger.info('Welcome feature initialized');
  },
};

export default welcome;
