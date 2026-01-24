import { cronJobs } from "convex/server";
import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import * as cheerio from "cheerio";

const TREND_SOURCES = [
    // Social Media Platforms
    { url: "https://techcrunch.com/category/artificial-intelligence/", platform: "web", category: "AI", selector: ".loop-card__title a" },
    { url: "https://theamazingmomlife.net/7-parenting-trends-experts-say-will-peak-in-2025/", platform: "web", category: "Parenting", selector: "h2" },

    // Wellness & Yoga Sources
    { url: "https://www.yogajournal.com/lifestyle/parenting-2/", platform: "yoga", category: "Kids Yoga", selector: "h3.card-title a, h2.entry-title a" },
    { url: "https://www.mindbodygreen.com/articles/category/parenting", platform: "wellness", category: "Mindful Parenting", selector: "h2.tout__headline a" },
    { url: "https://www.astrosafe.co/blog/mindfulness-for-kids-15-of-the-best-mindfulness-activities-for-kids-in-2024", platform: "wellness", category: "Mindfulness", selector: "h2" },

    // E-Commerce & Product Trends (Etsy search trends - simulated via popular items)
    { url: "https://www.etsy.com/search?q=mindfulness+kids+printable&order=most_relevant", platform: "etsy", category: "Product Trends", selector: "h3.v2-listing-card__title" },

    // LinkedIn (via RSS or scraping)
    { url: "https://www.linkedin.com/pulse/topics/parenting/", platform: "linkedin", category: "Professional Parenting", selector: "h3.article-title, h2.feed-shared-update-v2__description" },

    // Pinterest (trending pins - simulated)
    { url: "https://www.pinterest.com/search/pins/?q=mindful%20parenting&rs=typed", platform: "pinterest", category: "Visual Inspiration", selector: "h3[data-test-id='pinTitle'], div.tBJ" },

    // Reddit (hot posts)
    { url: "https://www.reddit.com/r/Parenting/hot.json", platform: "reddit", category: "Parent Community", type: "json" },
    { url: "https://www.reddit.com/r/Mindfulness/hot.json", platform: "reddit", category: "Mindfulness Community", type: "json" },
];

export const scanTrendsAction = internalAction({
    args: {},
    handler: async (ctx) => {
        for (const source of TREND_SOURCES) {
            try {
                const response = await fetch(source.url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
                });

                if (!response.ok) {
                    console.error(`Failed to fetch ${source.url}: ${response.status}`);
                    continue;
                }

                const content = await response.text();
                let items: { headline: string; url: string; platform: string; category: string; trending?: boolean }[] = [];

                // Handle JSON responses (Reddit)
                if (source.type === "json") {
                    try {
                        const data = JSON.parse(content);
                        if (data.data && data.data.children) {
                            items = data.data.children.slice(0, 10).map((post: any) => ({
                                headline: post.data.title,
                                url: `https://reddit.com${post.data.permalink}`,
                                platform: source.platform,
                                category: source.category,
                                trending: post.data.ups > 100,
                            }));
                        }
                    } catch (e) {
                        console.error(`JSON parse error for ${source.url}:`, e);
                    }
                } else {
                    // HTML scraping
                    const $ = cheerio.load(content);

                    $(source.selector).each((i, el) => {
                        if (i > 9) return; // Limit to 10 items per source

                        const headline = $(el).text().trim();
                        const href = $(el).attr('href') || source.url;
                        const cleanHeadline = headline.replace(/^\d+\.\s+/, '').trim();

                        if (cleanHeadline && cleanHeadline.length > 10 && cleanHeadline.length < 200) {
                            items.push({
                                headline: cleanHeadline,
                                url: href.startsWith('http') ? href : new URL(href, source.url).toString(),
                                platform: source.platform,
                                category: source.category,
                                trending: source.platform === "etsy" || source.platform === "pinterest",
                            });
                        }
                    });
                }

                // Save trends to database with enhanced metadata
                for (const item of items) {
                    try {
                        await ctx.runMutation(api.mutations.createTrend, {
                            headline: item.headline,
                            url: item.url,
                            sentiment_score: 0.5,
                            category: item.category,
                            platform: item.platform,
                            trending: item.trending,
                        });
                    } catch (mutationError) {
                        console.error(`Failed to save trend for ${source.url}:`, mutationError);
                    }
                }
            } catch (e) {
                console.error(`Failed to scrape ${source.url}`, e);
            }
        }
    },
});

const crons = cronJobs();

crons.daily(
    "scan-trends",
    { hourUTC: 12, minuteUTC: 0 },
    internal.crons.scanTrendsAction,
);

export default crons;

