const cheerio = require("cheerio");

const TARGET_URLS = [
    { url: "https://theamazingmomlife.net/7-parenting-trends-experts-say-will-peak-in-2025/", category: "Parenting", selector: "h2" },
    { url: "https://www.familyeducation.com/family-life/expert-2025-parenting-trend-predictions", category: "Parenting", selector: "h3" },
    { url: "https://kidscur.com/blog/parenting-trends-in-2025/", category: "Parenting", selector: "h3" },
    { url: "https://www.astrosafe.co/blog/mindfulness-for-kids-15-of-the-best-mindfulness-activities-for-kids-in-2024", category: "Mindfulness", selector: "h2" },
];

async function test() {
    for (const target of TARGET_URLS) {
        console.log(`Checking ${target.url}...`);
        try {
            const response = await fetch(target.url);
            const html = await response.text();
            const $ = cheerio.load(html);

            const found = $(target.selector);
            console.log(`  - Found ${found.length} items with ${target.selector}`);
            found.each((i, el) => {
                const text = $(el).text().trim();
                if (text && i < 3) console.log(`    - ${text}`);
            });
        } catch (e) {
            console.error(`  - Failed to scrape ${target.url}`, e);
        }
    }
}

test();
