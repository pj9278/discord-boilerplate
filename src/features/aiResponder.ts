import type { Feature } from '../types/index.js';
import { chatWithHistory, clearHistory, isAIAvailable } from '../utils/ai.js';
import { logger } from '../utils/logger.js';

const AI_CHANNEL_ID = process.env.AI_CHANNEL_ID ?? '';

const feature: Feature = {
  name: 'aiResponder',

  async init() {
    if (AI_CHANNEL_ID) {
      logger.info(`[AI Responder] Listening in channel: ${AI_CHANNEL_ID}`);
    }
    logger.info('[AI Responder] Responding to @mentions');
  },

  async onMessage(message) {
    if (!isAIAvailable()) return;
    if (message.author.bot) return;

    const isMentioned = message.mentions.has(message.client.user!);
    const isAIChannel = AI_CHANNEL_ID && message.channel.id === AI_CHANNEL_ID;

    if (!isMentioned && !isAIChannel) return;

    // Remove the bot mention from the message
    const content = message.content
      .replace(new RegExp(`<@!?${message.client.user!.id}>`, 'g'), '')
      .trim();

    // Handle "clear" command
    if (content.toLowerCase() === 'clear') {
      clearHistory(message.author.id);
      await message.reply('Conversation cleared.');
      return;
    }

    if (!content) {
      await message.reply("What's up?");
      return;
    }

    try {
      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }
      const response = await chatWithHistory(message.author.id, content);

      // Split long responses
      if (response.length > 2000) {
        const chunks = response.match(/[\s\S]{1,2000}/g) ?? [];
        for (const chunk of chunks) {
          await message.reply(chunk);
        }
      } else {
        await message.reply(response);
      }
    } catch (error) {
      logger.error('[AI Responder] Error:', error);
      await message.reply('Failed to get AI response.');
    }
  },
};

export default feature;
