import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const DATA_DIR = './data';
const TICKETS_PATH = `${DATA_DIR}/tickets.json`;

export interface Ticket {
  id: number;
  guildId: string;
  channelId: string; // The thread/channel ID
  authorId: string;
  authorTag: string;
  subject: string;
  status: 'open' | 'closed';
  createdAt: string;
  closedAt?: string;
  closedBy?: string;
}

export interface TicketConfig {
  categoryId?: string; // Category to create ticket channels in
  supportRoleId?: string; // Role that can see tickets
  logChannelId?: string; // Channel to log ticket actions
}

export interface TicketsData {
  nextId: Record<string, number>; // Per-guild ticket ID counter
  tickets: Ticket[];
  config: Record<string, TicketConfig>;
}

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function load(): TicketsData {
  ensureDataDir();
  if (!existsSync(TICKETS_PATH)) {
    return { nextId: {}, tickets: [], config: {} };
  }
  return JSON.parse(readFileSync(TICKETS_PATH, 'utf-8')) as TicketsData;
}

function save(data: TicketsData): void {
  ensureDataDir();
  writeFileSync(TICKETS_PATH, JSON.stringify(data, null, 2));
}

/**
 * Create a new ticket
 */
export function createTicket(
  guildId: string,
  channelId: string,
  authorId: string,
  authorTag: string,
  subject: string
): Ticket {
  const data = load();

  const id = (data.nextId[guildId] ?? 0) + 1;
  data.nextId[guildId] = id;

  const ticket: Ticket = {
    id,
    guildId,
    channelId,
    authorId,
    authorTag,
    subject,
    status: 'open',
    createdAt: new Date().toISOString(),
  };

  data.tickets.push(ticket);
  save(data);

  return ticket;
}

/**
 * Get a ticket by channel ID
 */
export function getTicketByChannel(channelId: string): Ticket | undefined {
  const data = load();
  return data.tickets.find((t) => t.channelId === channelId);
}

/**
 * Close a ticket
 */
export function closeTicket(channelId: string, closedBy: string): Ticket | undefined {
  const data = load();
  const ticket = data.tickets.find((t) => t.channelId === channelId);

  if (ticket && ticket.status === 'open') {
    ticket.status = 'closed';
    ticket.closedAt = new Date().toISOString();
    ticket.closedBy = closedBy;
    save(data);
  }

  return ticket;
}

/**
 * Get all open tickets for a guild
 */
export function getOpenTickets(guildId: string): Ticket[] {
  const data = load();
  return data.tickets.filter((t) => t.guildId === guildId && t.status === 'open');
}

/**
 * Get all tickets for a user
 */
export function getUserTickets(guildId: string, userId: string): Ticket[] {
  const data = load();
  return data.tickets.filter((t) => t.guildId === guildId && t.authorId === userId);
}

/**
 * Get ticket config for a guild
 */
export function getTicketConfig(guildId: string): TicketConfig {
  const data = load();
  return data.config[guildId] ?? {};
}

/**
 * Update ticket config for a guild
 */
export function updateTicketConfig(guildId: string, config: Partial<TicketConfig>): TicketConfig {
  const data = load();
  data.config[guildId] = { ...data.config[guildId], ...config };
  save(data);
  return data.config[guildId];
}
