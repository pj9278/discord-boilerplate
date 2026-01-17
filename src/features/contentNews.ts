import cron from 'node-cron';
import Parser from 'rss-parser';
import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import type { Feature } from '../types/index.js';
import { logger } from '../utils/logger.js';

const NEWS_CHANNEL_ID = process.env.CONTENT_NEWS_CHANNEL_ID ?? '';
const NEWS_SCHEDULE = process.env.CONTENT_NEWS_SCHEDULE ?? '0 9 * * 1'; // Default: Monday 9am

// Content creator focused RSS feeds
const RSS_FEEDS = [
  {
    name: 'Buffer Blog',
    url: 'https://buffer.com/resources/feed/',
  },
  {
    name: 'Hootsuite Blog',
    url: 'https://blog.hootsuite.com/feed/',
  },
  {
    name: 'Sprout Social Insights',
    url: 'https://sproutsocial.com/insights/feed/',
  },
  {
    name: 'Social Media Examiner',
    url: 'https://www.socialmediaexaminer.com/feed/',
  },
  {
    name: 'HubSpot Marketing',
    url: 'https://blog.hubspot.com/marketing/rss.xml',
  },
  {
    name: 'Neil Patel',
    url: 'https://neilpatel.com/blog/feed/',
  },
];

interface NewsItem {
  title: string;
  link: string;
  source: string;
  pubDate: Date;
}

interface FeedConfig {
  name: string;
  url: string;
}

const parser = new Parser();

// Decode HTML entities
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function fetchNewsFromFeed(feed: FeedConfig, since: Date): Promise<NewsItem[]> {
  try {
    const rss = await parser.parseURL(feed.url);
    const items: NewsItem[] = [];

    for (const item of rss.items) {
      if (!item.title || !item.link || !item.pubDate) continue;

      const pubDate = new Date(item.pubDate);
      if (pubDate >= since) {
        items.push({
          title: decodeHtmlEntities(item.title),
          link: item.link,
          source: feed.name,
          pubDate,
        });
      }
    }

    return items;
  } catch (error) {
    logger.error(`[Content News] Failed to fetch ${feed.name}:`, error);
    return [];
  }
}

async function fetchAllNews(since: Date): Promise<Map<string, NewsItem[]>> {
  const bySource = new Map<string, NewsItem[]>();

  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      const items = await fetchNewsFromFeed(feed, since);
      return { source: feed.name, items };
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.items.length > 0) {
      bySource.set(result.value.source, result.value.items);
    }
  }

  return bySource;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function createNewsEmbeds(newsBySource: Map<string, NewsItem[]>): EmbedBuilder[] {
  const embeds: EmbedBuilder[] = [];
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Count total articles
  let totalArticles = 0;
  for (const items of newsBySource.values()) {
    totalArticles += items.length;
  }

  // Header embed
  const headerEmbed = new EmbedBuilder()
    .setColor(0xff6b6b) // Coral color for content news
    .setTitle('📱 Weekly Content Creator News')
    .setDescription(
      `**${formatDate(weekAgo)} – ${formatDate(now)}**\n` +
        `${totalArticles} articles from ${newsBySource.size} sources\n\n` +
        `*Latest trends, tools, and tips for content creators*`
    )
    .setTimestamp();

  embeds.push(headerEmbed);

  // Source embeds - compact format
  for (const feed of RSS_FEEDS) {
    const items = newsBySource.get(feed.name);
    if (!items || items.length === 0) continue;

    // Limit to 5 articles per source
    const limitedItems = items.slice(0, 5);

    const links = limitedItems.map((item) => `• ${item.title} [[Link]](${item.link})`).join('\n');

    const sourceEmbed = new EmbedBuilder()
      .setColor(0xff6b6b)
      .setTitle(feed.name)
      .setDescription(links.slice(0, 4096));

    embeds.push(sourceEmbed);
  }

  return embeds;
}

async function postWeeklyNews(client: Client): Promise<void> {
  if (!NEWS_CHANNEL_ID) {
    logger.warn('[Content News] No channel ID configured, skipping post');
    return;
  }

  const channel = client.channels.cache.get(NEWS_CHANNEL_ID) as TextChannel;
  if (!channel) {
    logger.error(`[Content News] Channel not found: ${NEWS_CHANNEL_ID}`);
    return;
  }

  logger.info('[Content News] Fetching weekly news...');

  // Get news from the last 7 days
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const newsBySource = await fetchAllNews(oneWeekAgo);

  if (newsBySource.size === 0) {
    logger.info('[Content News] No news found for the past week');
    await channel.send('📱 No content creator news found for the past week.');
    return;
  }

  const embeds = createNewsEmbeds(newsBySource);

  // Discord allows max 10 embeds per message
  const embedChunks: EmbedBuilder[][] = [];
  for (let i = 0; i < embeds.length; i += 10) {
    embedChunks.push(embeds.slice(i, i + 10));
  }

  for (const chunk of embedChunks) {
    await channel.send({ embeds: chunk });
  }

  // Count total articles
  let total = 0;
  for (const items of newsBySource.values()) {
    total += items.length;
  }

  logger.info(`[Content News] Posted ${total} articles from ${newsBySource.size} sources`);
}

const feature: Feature = {
  name: 'contentNews',

  async init(client) {
    if (!NEWS_CHANNEL_ID) {
      logger.warn('[Content News] CONTENT_NEWS_CHANNEL_ID not set, feature disabled');
      return;
    }

    logger.info(`[Content News] Scheduled for: ${NEWS_SCHEDULE} (cron)`);
    logger.info(`[Content News] Posting to channel: ${NEWS_CHANNEL_ID}`);

    cron.schedule(NEWS_SCHEDULE, () => {
      postWeeklyNews(client).catch((error) => {
        logger.error('[Content News] Failed to post weekly news:', error);
      });
    });
  },
};

export default feature;

// Export for manual testing
export { postWeeklyNews, fetchAllNews };
