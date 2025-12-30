import { Client, Collection } from 'discord.js';
import { config } from './config.js';
import { loadCommands } from './handlers/commandHandler.js';
import { loadEvents } from './handlers/eventHandler.js';
import type { ExtendedClient } from './types/index.js';

async function main(): Promise<void> {
  console.log('[Bot] Starting...');

  const client = new Client({
    intents: config.intents,
    partials: config.partials,
  }) as ExtendedClient;

  client.commands = new Collection();

  try {
    await loadCommands(client);
    await loadEvents(client);
    await client.login(config.token);
  } catch (error) {
    console.error('[Bot] Failed to start:', error);
    process.exit(1);
  }
}

main();
