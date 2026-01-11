import cron from 'node-cron';
import Parser from 'rss-parser';
import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import type { Feature } from '../types/index.js';
import { logger } from '../utils/logger.js';

const NEWS_CHANNEL_ID = process.env.AI_NEWS_CHANNEL_ID ?? '';
const NEWS_SCHEDULE = process.env.AI_NEWS_SCHEDULE ?? '0 9 * * 5'; // Default: Friday 9am

// Non-technical, accessible AI news feeds
const RSS_FEEDS = [
  {
    name: 'The Verge AI',
    url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
  },
  { name: 'Wired AI', url: 'https://www.wired.com/feed/tag/ai/latest/rss' },
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { name: 'THE DECODER', url: 'https://the-decoder.com/feed/' },
  { name: 'One Useful Thing', url: 'https://oneusefulthing.substack.com/feed' },
];

interface NewsItem {
  title: string;
  link: string;
  source: string;
  pubDate: Date;
}

const parser = new Parser();

async function fetchNewsFromFeed(
  feedName: string,
  feedUrl: string,
  since: Date
): Promise<NewsItem[]> {
  try {
    const feed = await parser.parseURL(feedUrl);
    const items: NewsItem[] = [];

    for (const item of feed.items) {
      if (!item.title || !item.link || !item.pubDate) continue;

      const pubDate = new Date(item.pubDate);
      if (pubDate >= since) {
        items.push({
          title: item.title,
          link: item.link,
          source: feedName,
          pubDate,
        });
      }
    }

    return items;
  } catch (error) {
    logger.error(`[AI News] Failed to fetch ${feedName}:`, error);
    return [];
  }
}

async function fetchAllNews(since: Date): Promise<NewsItem[]> {
  const allItems: NewsItem[] = [];

  const results = await Promise.allSettled(
    RSS_FEEDS.map((feed) => fetchNewsFromFeed(feed.name, feed.url, since))
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allItems.push(...result.value);
    }
  }

  // Sort by date, newest first
  allItems.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return allItems;
}

function formatNewsEmbed(items: NewsItem[]): EmbedBuilder[] {
  const embeds: EmbedBuilder[] = [];

  // Group by source
  const bySource = new Map<string, NewsItem[]>();
  for (const item of items) {
    const existing = bySource.get(item.source) ?? [];
    existing.push(item);
    bySource.set(item.source, existing);
  }

  // Create main embed
  const mainEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Weekly AI News Roundup')
    .setDescription(`Here's what happened in AI this week (${items.length} articles)`)
    .setTimestamp();

  embeds.push(mainEmbed);

  // Create embed for each source (limit to avoid hitting Discord limits)
  for (const [source, sourceItems] of bySource) {
    const limitedItems = sourceItems.slice(0, 5); // Max 5 per source
    const links = limitedItems.map((item) => `• [${item.title}](${item.link})`).join('\n');

    const sourceEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(source)
      .setDescription(links.slice(0, 4096)); // Discord limit

    embeds.push(sourceEmbed);
  }

  return embeds;
}

async function postWeeklyNews(client: Client): Promise<void> {
  if (!NEWS_CHANNEL_ID) {
    logger.warn('[AI News] No channel ID configured, skipping post');
    return;
  }

  const channel = client.channels.cache.get(NEWS_CHANNEL_ID) as TextChannel;
  if (!channel) {
    logger.error(`[AI News] Channel not found: ${NEWS_CHANNEL_ID}`);
    return;
  }

  logger.info('[AI News] Fetching weekly news...');

  // Get news from the last 7 days
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const news = await fetchAllNews(oneWeekAgo);

  if (news.length === 0) {
    logger.info('[AI News] No news found for the past week');
    await channel.send('No AI news found for the past week.');
    return;
  }

  const embeds = formatNewsEmbed(news);

  // Discord allows max 10 embeds per message
  const embedChunks: EmbedBuilder[][] = [];
  for (let i = 0; i < embeds.length; i += 10) {
    embedChunks.push(embeds.slice(i, i + 10));
  }

  for (const chunk of embedChunks) {
    await channel.send({ embeds: chunk });
  }

  logger.info(`[AI News] Posted ${news.length} articles to channel`);
}

const feature: Feature = {
  name: 'aiNews',

  async init(client) {
    if (!NEWS_CHANNEL_ID) {
      logger.warn('[AI News] AI_NEWS_CHANNEL_ID not set, feature disabled');
      return;
    }

    logger.info(`[AI News] Scheduled for: ${NEWS_SCHEDULE} (cron)`);
    logger.info(`[AI News] Posting to channel: ${NEWS_CHANNEL_ID}`);

    cron.schedule(NEWS_SCHEDULE, () => {
      postWeeklyNews(client).catch((error) => {
        logger.error('[AI News] Failed to post weekly news:', error);
      });
    });
  },
};

export default feature;

// Export for manual testing
export { postWeeklyNews, fetchAllNews };
