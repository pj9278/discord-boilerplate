import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Event, ExtendedClient } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function loadEvents(client: ExtendedClient): Promise<void> {
  const eventsPath = join(__dirname, '..', 'events');
  const eventFiles = readdirSync(eventsPath).filter(
    (file) => (file.endsWith('.js') || file.endsWith('.ts')) && !file.endsWith('.d.ts')
  );

  let loadedCount = 0;

  for (const file of eventFiles) {
    const filePath = join(eventsPath, file);
    const fileUrl = pathToFileURL(filePath).href;
    const eventModule = (await import(fileUrl)) as { default: Event };
    const event = eventModule.default;

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }

    console.log(`[Event] Loaded: ${event.name} (${event.once ? 'once' : 'on'})`);
    loadedCount++;
  }

  console.log(`[Events] Loaded ${loadedCount} events`);
}
