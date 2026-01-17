import 'dotenv/config';
import Parser from 'rss-parser';

const RSS_FEEDS = [
  { name: 'Buffer Blog', url: 'https://buffer.com/resources/feed/' },
  { name: 'Hootsuite Blog', url: 'https://blog.hootsuite.com/feed/' },
  { name: 'Sprout Social Insights', url: 'https://sproutsocial.com/insights/feed/' },
  { name: 'Social Media Examiner', url: 'https://www.socialmediaexaminer.com/feed/' },
  { name: 'HubSpot Marketing', url: 'https://blog.hubspot.com/marketing/rss.xml' },
  { name: 'Neil Patel', url: 'https://neilpatel.com/blog/feed/' },
];

const parser = new Parser();

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

async function testFeeds() {
  console.log('📱 Testing Content News RSS Feeds\n');
  console.log('='.repeat(60));

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  let totalArticles = 0;
  let workingSources = 0;

  for (const feed of RSS_FEEDS) {
    console.log(`\n📰 ${feed.name}`);
    console.log('-'.repeat(40));

    try {
      const rss = await parser.parseURL(feed.url);
      const recentItems = rss.items.filter((item) => {
        if (!item.pubDate) return false;
        return new Date(item.pubDate) >= oneWeekAgo;
      });

      if (recentItems.length === 0) {
        console.log('   No articles from the past week');
        continue;
      }

      workingSources++;
      const limitedItems = recentItems.slice(0, 5);

      for (const item of limitedItems) {
        const title = decodeHtmlEntities(item.title ?? 'No title');
        console.log(`   • ${title.slice(0, 60)}${title.length > 60 ? '...' : ''}`);
        totalArticles++;
      }

      if (recentItems.length > 5) {
        console.log(`   ... and ${recentItems.length - 5} more`);
      }
    } catch (error) {
      console.log(`   ❌ Failed to fetch: ${(error as Error).message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ Summary: ${totalArticles} articles from ${workingSources}/${RSS_FEEDS.length} sources`);
  console.log('\nThis is what will be posted to Discord (in embed format).');
}

testFeeds();
