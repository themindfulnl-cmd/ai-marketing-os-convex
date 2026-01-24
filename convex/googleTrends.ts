// @ts-nocheck
/**
 * Google Trends Integration
 * 
 * Fetches trending search queries for Dutch parenting topics
 */

import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Fetch trending topics from Google Trends (unofficial RSS feed)
 * This uses Google Trends' daily trends RSS feed for Netherlands
 */
export const fetchGoogleTrends = action({
    args: {
        region: v.optional(v.string()), // "NL" for Netherlands
    },
    handler: async (ctx, args) => {
        const region = args.region || "NL";

        try {
            // Google Trends Daily Trends RSS feed (unofficial but works)
            const url = `https://trends.google.com/trending/rss?geo=${region}`;

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Google Trends fetch failed: ${response.statusText}`);
            }

            const xmlText = await response.text();

            // Parse XML to extract trending topics
            const topics = parseGoogleTrendsXML(xmlText);

            return {
                success: true,
                topics,
                region,
            };
        } catch (error: any) {
            console.error("Google Trends error:", error);
            return {
                success: false,
                error: error.message,
                topics: [],
            };
        }
    },
});

/**
 * Fetch related queries for a specific keyword using Google Autocomplete API
 */
export const getRelatedQueries = action({
    args: {
        keyword: v.string(),
    },
    handler: async (ctx, args) => {
        try {
            // Google Autocomplete API (public, no auth needed)
            const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(args.keyword)}`;

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Autocomplete fetch failed: ${response.statusText}`);
            }

            const data = await response.json();

            // Response format: [query, [suggestions...]]
            const suggestions = data[1] || [];

            return {
                success: true,
                keyword: args.keyword,
                relatedQueries: suggestions,
            };
        } catch (error: any) {
            console.error("Autocomplete error:", error);
            return {
                success: false,
                error: error.message,
                relatedQueries: [],
            };
        }
    },
});

/**
 * Analyze trending topics with Gemini AI
 * Takes raw trend data and generates scored topic suggestions
 */
export const analyzeTrendsWithGemini = action({
    args: {
        trendingQueries: v.array(v.string()),
        niche: v.string(), // "mindful parenting", "children's yoga", etc.
    },
    handler: async (ctx, args) => {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.warn("GEMINI_API_KEY not configured, skipping AI analysis");
            return {
                success: false,
                error: "GEMINI_API_KEY not configured",
                topics: [],
            };
        }

        const prompt = `You are a viral content strategist for @themindfulnl, a Dutch parenting account focused on mindfulness, gentle parenting, and children's yoga.

TRENDING QUERIES (from Google Trends Netherlands):
${args.trendingQueries.join("\n")}

YOUR TASK:
Analyze these trending queries and suggest 5 viral-worthy content topics that:
1. Align with the "${args.niche}" niche
2. Have high viral potential (Instagram Reels, TikTok)
3. Can drive revenue (course/ebook sales, affiliates)
4. Target Dutch parents (ages 25-40)

For each topic, provide:
- Topic title (engaging, hook-driven)
- Viral score (1-100, based on search interest + engagement potential)
- Target audience (specific parent segment)
- Revenue potential (low/medium/high)
- Content category (sleep/tantrums/emotions/yoga/breathing)
- Why it's trending right now

Format as JSON array:
[
  {
    "topic": "5-Minute Morning Calm Routine for Toddlers",
    "viralScore": 94,
    "targetAudience": "Dutch parents with toddlers 2-5",
    "revenuePotential": "high",
    "category": "morning_routine",
    "trendingReason": "Parents searching for quick morning solutions before work"
  }
]`;

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: prompt }]
                        }],
                        generationConfig: {
                            temperature: 0.8,
                            maxOutputTokens: 2048,
                        }
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(`Gemini API error: ${response.statusText}`);
            }

            const data = await response.json();
            const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

            // Extract JSON from Gemini response
            const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error("Failed to parse Gemini response as JSON");
            }

            const topics = JSON.parse(jsonMatch[0]);

            return {
                success: true,
                topics,
            };
        } catch (error: any) {
            console.error("Gemini analysis error:", error);
            return {
                success: false,
                error: error.message,
                topics: [],
            };
        }
    },
});

// Helper function to parse Google Trends RSS XML
function parseGoogleTrendsXML(xml: string): string[] {
    const topics: string[] = [];

    // Extract <title> tags (simple regex parsing)
    const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>/g;
    let match;

    while ((match = titleRegex.exec(xml)) !== null) {
        const title = match[1].trim();
        // Skip the feed title itself
        if (title !== "Daily Search Trends") {
            topics.push(title);
        }
    }

    return topics;
}
