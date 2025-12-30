import { Events } from 'discord.js';
import type { Event, ExtendedClient } from '../types/index.js';

const event: Event = {
  name: Events.ClientReady,
  once: true,
  execute(client: ExtendedClient) {
    console.log(`[Bot] Logged in as ${client.user?.tag}`);
    console.log(`[Bot] Serving ${client.guilds.cache.size} guild(s)`);
    console.log(`[Bot] Ready!`);
  },
};

export default event;
