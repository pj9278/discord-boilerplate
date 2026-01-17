import { Client, Collection, Events } from 'discord.js';
import { config } from './utils/config.js';
import { loadCommands } from './handlers/commandHandler.js';
import { loadEvents } from './handlers/eventHandler.js';
import { loadFeatures } from './features/index.js';
import { logger } from './utils/logger.js';
import type { ExtendedClient, Feature } from './types/index.js';

let features: Feature[] = [];

// Process-level error handlers to prevent silent crashes
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

async function main(): Promise<void> {
  logger.info('Starting bot...');

  const client = new Client({
    intents: config.intents,
    partials: config.partials,
  }) as ExtendedClient;

  // Discord client error handlers
  client.on(Events.Error, (error) => {
    logger.error('Discord client error:', error);
  });

  client.on(Events.ShardError, (error) => {
    logger.error('WebSocket shard error:', error);
  });

  client.commands = new Collection();

  try {
    await loadCommands(client);
    await loadEvents(client);

    // Load features
    features = loadFeatures();
    logger.info(`Loaded ${features.length} features`);

    // Initialize features after client is ready
    client.once(Events.ClientReady, async () => {
      for (const feature of features) {
        await feature.init(client);
        logger.info(`Initialized feature: ${feature.name}`);
      }
    });

    // Route messages to features
    client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot) return;
      for (const feature of features) {
        if (feature.onMessage) {
          try {
            await feature.onMessage(message);
          } catch (error) {
            logger.error(`[${feature.name}] Error in onMessage:`, error);
          }
        }
      }
    });

    // Route reaction adds to features
    client.on(Events.MessageReactionAdd, async (reaction, user) => {
      if (user.bot) return;

      try {
        const fullReaction = reaction.partial ? await reaction.fetch() : reaction;
        const fullUser = user.partial ? await user.fetch() : user;

        for (const feature of features) {
          if (feature.onReaction) {
            try {
              await feature.onReaction(fullReaction, fullUser);
            } catch (error) {
              logger.error(`[${feature.name}] Error in onReaction:`, error);
            }
          }
        }
      } catch (error) {
        logger.error('[ReactionHandler] Failed to fetch reaction/user:', error);
      }
    });

    // Route reaction removes to features
    client.on(Events.MessageReactionRemove, async (reaction, user) => {
      if (user.bot) return;

      try {
        const fullReaction = reaction.partial ? await reaction.fetch() : reaction;
        const fullUser = user.partial ? await user.fetch() : user;

        for (const feature of features) {
          if (feature.onReactionRemove) {
            try {
              await feature.onReactionRemove(fullReaction, fullUser);
            } catch (error) {
              logger.error(`[${feature.name}] Error in onReactionRemove:`, error);
            }
          }
        }
      } catch (error) {
        logger.error('[ReactionHandler] Failed to fetch reaction/user:', error);
      }
    });

    await client.login(config.token);
  } catch (error) {
    logger.error('Failed to start:', error);
    process.exit(1);
  }
}

main();
