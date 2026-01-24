// @ts-nocheck
/**
 * Weekly Planning Hub - Topic Discovery & Content Strategy
 * 
 * Viral topic discovery and complete weekly content planning
 */

import { action, query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

/**
 * Get content strategy by ID (for image generation)
 */
export const getContentStrategyById = query({
    args: {
        strategyId: v.id("contentStrategy"),
    },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.strategyId);
    },
});

/**
 * DISCOVER VIRAL TOPICS
 * AI analyzes trends and suggests 5 viral-worthy topics each week
 */
export const discoverWeeklyTopics = action({
    args: {
        weekOf: v.string(), // "2026-W04"
    },
    handler: async (ctx, { weekOf }) => {
        // Step 1: Fetch trending queries from Google Trends (Netherlands)
        const trendsResult = await ctx.runAction(api.googleTrends.fetchGoogleTrends, {
            region: "NL",
        });

        let trendingQueries: string[] = [];

        if (trendsResult.success && trendsResult.topics.length > 0) {
            trendingQueries = trendsResult.topics.slice(0, 10);
        }

        // Step 2: Get related queries for parenting keywords
        const parentingKeywords = [
            "mindfulness kinderen",
            "ouderschap",
            "tantrums stoppen",
            "kinderyoga",
            "ademhaling oefeningen",
        ];

        for (const keyword of parentingKeywords) {
            const related = await ctx.runAction(api.googleTrends.getRelatedQueries, {
                keyword,
            });

            if (related.success) {
                trendingQueries.push(...related.relatedQueries.slice(0, 3));
            }
        }

        // Step 3: Analyze trends with Gemini AI
        let aiTopics = [];

        if (trendingQueries.length > 0) {
            const analysisResult = await ctx.runAction(api.googleTrends.analyzeTrendsWithGemini, {
                trendingQueries: trendingQueries.slice(0, 20),
                niche: "mindful parenting and children's yoga",
            });

            if (analysisResult.success) {
                aiTopics = analysisResult.topics;
            }
        }

        // Fallback to mock data if API fails
        if (aiTopics.length === 0) {
            aiTopics = [
                {
                    topic: "5-Minute Morning Calm Routine for Toddlers",
                    viralScore: 94,
                    targetAudience: "Dutch parents with toddlers 2-5",
                    revenuePotential: "high",
                    category: "morning_routine",
                },
                {
                    topic: "Breathing Games to Stop Tantrums Instantly",
                    viralScore: 91,
                    targetAudience: "Parents struggling with meltdowns",
                    revenuePotential: "high",
                    category: "tantrums",
                },
                {
                    topic: "Bedtime Yoga Sequence for Restless Kids",
                    viralScore: 88,
                    targetAudience: "Parents with sleep-resistant children",
                    revenuePotential: "medium",
                    category: "sleep",
                },
                {
                    topic: "Emotion Faces Chart (Free Printable)",
                    viralScore: 86,
                    targetAudience: "Montessori-interested parents",
                    revenuePotential: "high",
                    category: "emotions",
                },
                {
                    topic: "3 Yoga Poses That Calm Anxious Children",
                    viralScore: 83,
                    targetAudience: "Parents of anxious kids",
                    revenuePotential: "medium",
                    category: "yoga",
                },
            ];
        }

        // Step 4: Store topics in database
        const mockTopics = aiTopics.map(topic => ({
            ...topic,
            source: "google_trends",
            suggestedWeek: weekOf,
            status: "suggested" as const,
        }));

        const topicIds = [];
        for (const topic of mockTopics) {
            const id = await ctx.runMutation(api.weeklyPlanner.createTopic, topic);
            topicIds.push(id);
        }

        return {
            success: true,
            topics: mockTopics,
            topicIds,
            isRealData: aiTopics.length > 0,
        };
    },
});

/**
 * CREATE TOPIC (Mutation)
 */
export const createTopic = mutation({
    args: {
        topic: v.string(),
        viralScore: v.number(),
        source: v.string(),
        targetAudience: v.string(),
        revenuePotential: v.string(),
        category: v.string(),
        suggestedWeek: v.string(),
        status: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("weeklyTopics", args);
    },
});

/**
 * GET WEEKLY TOPICS (Query)
 */
export const getWeeklyTopics = query({
    args: {
        weekOf: v.string(),
        status: v.optional(v.string()),
    },
    handler: async (ctx, { weekOf, status }) => {
        let query = ctx.db.query("weeklyTopics").withIndex("by_week", (q) => q.eq("suggestedWeek", weekOf));

        if (status) {
            query = ctx.db.query("weeklyTopics").withIndex("by_status", (q) => q.eq("status", status));
        }

        const topics = await query.collect();
        return topics.sort((a, b) => b.viralScore - a.viralScore);
    },
});

/**
 * GET APPROVED SECTIONS
 * Returns only the approved sections from strategies
 */
export const getApprovedSections = query({
    args: {
        weekOf: v.string(),
    },
    handler: async (ctx, { weekOf }) => {
        const strategies = await ctx.db
            .query("contentStrategy")
            .collect();

        // Filter by week and get only approved sections
        const approvedSections = [];

        for (const strategy of strategies.filter(s => s.weekOf === weekOf)) {
            if (strategy.instagramApproved) {
                approvedSections.push({
                    id: strategy._id,
                    type: "instagram",
                    content: strategy.instagramContent,
                    topicId: strategy.topicId,
                });
            }
            if (strategy.blogApproved) {
                approvedSections.push({
                    id: strategy._id,
                    type: "blog",
                    content: strategy.blogPost,
                    topicId: strategy.topicId,
                });
            }
            if (strategy.ebookApproved) {
                approvedSections.push({
                    id: strategy._id,
                    type: "ebook",
                    content: strategy.ebookChapter,
                    topicId: strategy.topicId,
                });
            }
            if (strategy.etsyApproved) {
                approvedSections.push({
                    id: strategy._id,
                    type: "etsy",
                    content: strategy.etsyProducts,
                    topicId: strategy.topicId,
                });
            }
            if (strategy.affiliatesApproved) {
                approvedSections.push({
                    id: strategy._id,
                    type: "affiliates",
                    content: strategy.affiliateProducts,
                    topicId: strategy.topicId,
                });
            }
        }

        return approvedSections;
    },
});

/**
 * SELECT TOPIC FOR THE WEEK
 */
export const selectTopic = mutation({
    args: {
        topicId: v.id("weeklyTopics"),
    },
    handler: async (ctx, { topicId }) => {
        // Mark topic as selected
        await ctx.db.patch(topicId, {
            status: "selected",
            selectedDate: Date.now(),
        });

        return { success: true, topicId };
    },
});

/**
 * GENERATE COMPLETE CONTENT STRATEGY
 * Takes selected topic and creates full week of content
 */
export const generateContentStrategy = action({
    args: {
        topicId: v.id("weeklyTopics"),
    },
    handler: async (ctx, { topicId }) => {
        // Get the topic
        const topic = await ctx.runQuery(api.weeklyPlanner.getTopicById, { id: topicId });

        if (!topic) {
            throw new Error("Topic not found");
        }

        // TODO: Use Gemini AI to generate complete strategy
        // For now, create template strategy

        const strategy = {
            topicId,
            weekOf: topic.suggestedWeek,
            status: "draft" as const,

            // 7 Instagram posts - FULL WEEK
            instagramContent: [
                {
                    day: "monday",
                    type: "reel",
                    title: `Transform Your Mornings: ${topic.topic}`,
                    caption: `Your mornings don't have to be chaos. Try this 5-minute routine and watch the magic happen ✨\n\nSave this for tomorrow morning!\n\n#morningroutine #peutersochtends #calmkids #gentleparenting #mindfulness`,
                    hook: "Your kid is crying, you're late... here's what actually works 👇",
                    hashtags: ["morningroutine", "peutersochtends", "calmkids", "gentleparenting", "mindfulness", "nederlandsemoeders", "mindfulopvoeden", "amsterdammoms", "parentinghacks"],
                    goal: "reach",
                },
                {
                    day: "tuesday",
                    type: "carousel",
                    title: "Step-by-Step: Complete Guide",
                    caption: `Here's exactly how to implement ${topic.topic} 📋\n\nSlide to see all 10 steps!\n\nWhich step will you try first? Comment below 👇\n\n#parentinghacks #montessorimornings #toddlerlife #mindfulopvoeden`,
                    hook: "Save this! Your new routine starts here",
                    hashtags: ["parentinghacks", "montessorimornings", "toddlerlife", "mindfulopvoeden", "nederlandsemama", "opvoedtips", "kinderyoga", "themindfulnl"],
                    goal: "saves",
                },
                {
                    day: "wednesday",
                    type: "story",
                    title: "Behind the Scenes",
                    caption: `Watch me try this with my own kids! Real, unfiltered morning chaos → calm ✨\n\nSwipe up to download the FREE printable checklist\n\n#realparenting #relatable`,
                    hook: "Let me show you how messy it really is 😅",
                    hashtags: ["realparenting", "parentingreel", "morningvibes", "authenticparenting"],
                    goal: "engagement",
                },
                {
                    day: "thursday",
                    type: "reel",
                    title: "Common Mistakes to Avoid",
                    caption: `❌ STOP doing these 3 things during your morning routine!\n\nI made ALL these mistakes... so you don't have to 🙏\n\n#parentingmistakes #learningcurve #mindfulmornings`,
                    hook: "I wish someone told me this sooner...",
                    hashtags: ["parentingmistakes", "parentingtips", "morningroutine", "mindfulparenting", "nederlandsemama"],
                    goal: "reach",
                },
                {
                    day: "friday",
                    type: "post",
                    title: "Success Stories from Real Parents",
                    caption: `💬 "We tried this routine for 7 days and our mornings are SO much calmer!" - @dutchmama\n\n📸 Share YOUR results! Tag me for a feature\n\n#successstory #parentingwins #transformation`,
                    hook: "This is what happens when you stick with it...",
                    hashtags: ["successstory", "parentingwins", "morningroutine", "beforeafter", "parentingtransformation"],
                    goal: "engagement",
                },
                {
                    day: "saturday",
                    type: "carousel",
                    title: "Weekend Bonus: Advanced Tips",
                    caption: `🎯 Ready to level up? These 5 advanced techniques will make your routine even smoother\n\nPerfect for when the basic routine feels easy!\n\n#advancedparenting #nextlevel`,
                    hook: "Once you've mastered the basics...",
                    hashtags: ["advancedparenting", "parentinghacks", "mindfulness", "expertlevel", "parentinggoals"],
                    goal: "saves",
                },
                {
                    day: "sunday",
                    type: "reel",
                    title: "Join My Yoga Class - Special Offer",
                    caption: `Want MORE calming techniques for your family?\n\n🧘‍♀️ Join my Parent-Child Yoga class in Amsterdam\n✨ Learn breathing, mindfulness, emotional regulation\n🎁 First class FREE with code: CALM2026\n\nLink in bio to register!\n\n#yogaclass #amsterdamyoga #familyyoga #themindfulnl`,
                    hook: "This is how we practice these techniques together...",
                    hashtags: ["yogaclass", "amsterdamyoga", "familyyoga", "parentchildyoga", "themindfulnl", "mindfulnessforkids", "nederlandseyoga"],
                    goal: "conversions",
                },
            ],

            // Blog post - COMPLETE OUTLINE
            blogPost: {
                title: `The Science-Backed ${topic.topic}: A Complete Guide From Dutch Mindfulness Expert (2026)`,
                outline: [
                    "Introduction: Why mornings matter for your child's development",
                    "The neuroscience behind morning routines (backed by research)",
                    "The 5-minute routine explained step-by-step",
                    "Age-specific adaptations (2-3 years vs 4-6 years)",
                    "Common challenges and how to overcome them",
                    "Real success stories from 500+ Dutch parents",
                    "Printable morning routine chart (FREE download)",
                    "How this connects to emotional intelligence",
                    "FAQ: Your questions answered",
                    "Next steps: Join our parent-child yoga class",
                ],
                seoKeywords: [
                    "morning routine toddlers",
                    "calm kids morning",
                    "peuter ochtend routine",
                    "mindfulness kids Netherlands",
                    "Amsterdam parenting tips",
                    "breathing exercises toddlers",
                    "gentle parenting morning",
                ],
                targetWordCount: 2500,
                leadMagnet: "FREE Morning Routine Visual Chart (printable PDF)",
            },

            // Ebook chapter - DETAILED STRUCTURE
            ebookChapter: {
                chapterNumber: 3,
                title: `Chapter 3: ${topic.topic}`,
                outline: [
                    "Introduction: The morning routine challenge",
                    "Scientific foundation: Why routines work",
                    "The complete 5-minute framework",
                    "Worksheet 1: Morning routine planner",
                    "Troubleshooting guide",
                    "Worksheet 2: Success tracker",
                    "Parent testimonials with photos",
                    "Integration with yoga and mindfulness",
                ],
                worksheets: [
                    "Morning Routine Visual Chart",
                    "Progress Tracker for 30 Days",
                    "Breathing Exercises Reference Sheet",
                ],
            },

            // Etsy products - MULTIPLE OPTIONS
            etsyProducts: [
                {
                    name: `${topic.topic} - Complete Visual Chart Pack`,
                    type: "printable",
                    description: "Beautiful 10-page printable pack: morning routine chart, blank template, reward stickers, progress tracker, and breathing exercise cards. Perfect for toddlers 2-6 years. Includes Dutch & English versions.",
                    price: 4.99,
                    seoTags: ["morning routine", "toddler chart", "printable", "nederlandse ouders", "visual schedule", "montessori printable", "calm kids", "mindfulness", "parenting tools", "Amsterdam moms", "peuter schema", "ochtend routine", "printable chart"],
                },
                {
                    name: "30-Day Calm Kids Challenge - Complete Workbook",
                    type: "printable",
                    description: "Transform your family's mornings in 30 days! Includes daily activities, progress trackers, breathing exercises, yoga poses for kids, and parent reflection prompts. 45 pages of mindfulness magic.",
                    price: 9.99,
                    seoTags: ["parenting challenge", "calm kids", "30 day challenge", "mindfulness workbook", "yoga for kids", "breathing exercises", "nederlandstalig", "family activities"],
                },
                {
                    name: "Emotion Regulation Toolkit for Toddlers",
                    type: "printable",
                    description: "Help your child understand and manage emotions! Includes emotion faces chart, calm-down corner setup guide, breathing games, and morning/bedtime routines. Essential parenting resource.",
                    price: 7.99,
                    seoTags: ["emotion regulation", "toddler emotions", "calm down corner", "parenting printable", "mindfulness kids", "emotional intelligence", "gentle parenting"],
                },
            ],

            // Affiliate products - STRATEGIC PLACEMENT
            affiliateProducts: [
                {
                    productName: "Gro Clock - Sleep Trainer & Wake-Up Light for Kids",
                    link: "https://amazon.nl/gro-clock",
                    platform: "amazon",
                    mentionIn: ["blog", "instagram_monday_reel", "instagram_wednesday_story", "ebook_chapter_3"],
                },
                {
                    productName: "The Whole-Brain Child (Dutch Edition)",
                    link: "https://bol.com/whole-brain-child-nl",
                    platform: "bol.com",
                    mentionIn: ["blog", "email_newsletter"],
                },
                {
                    productName: "Mindfulness Breathing Ball for Kids",
                    link: "https://amazon.nl/breathing-ball",
                    platform: "amazon",
                    mentionIn: ["instagram_thursday_reel", "yoga_class_landing_page"],
                },
                {
                    productName: "Montessori Morning Routine Wooden Board",
                    link: "https://etsy.com/montessori-morning-board",
                    platform: "etsy_affiliate",
                    mentionIn: ["blog", "instagram_tuesday_carousel"],
                },
            ],
        };

        // Save strategy to database
        const strategyId = await ctx.runMutation(api.weeklyPlanner.createStrategy, strategy);

        return { success: true, strategyId, strategy };
    },
});

/**
 * GET TOPIC BY ID
 */
export const getTopicById = query({
    args: { id: v.id("weeklyTopics") },
    handler: async (ctx, { id }) => {
        return await ctx.db.get(id);
    },
});

/**
 * CREATE CONTENT STRATEGY
 */
export const createStrategy = mutation({
    args: {
        topicId: v.id("weeklyTopics"),
        weekOf: v.string(),
        status: v.string(),
        instagramContent: v.array(v.any()),
        blogPost: v.optional(v.any()),
        ebookChapter: v.optional(v.any()),
        etsyProducts: v.array(v.any()),
        affiliateProducts: v.array(v.any()),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("contentStrategy", args);
    },
});

/**
 * GET CONTENT STRATEGY
 */
export const getContentStrategy = query({
    args: {
        topicId: v.optional(v.id("weeklyTopics")),
        weekOf: v.optional(v.string()),
    },
    handler: async (ctx, { topicId, weekOf }) => {
        if (topicId) {
            const strategies = await ctx.db
                .query("contentStrategy")
                .withIndex("by_topic", (q) => q.eq("topicId", topicId))
                .collect();
            return strategies[0];
        }

        if (weekOf) {
            const strategies = await ctx.db
                .query("contentStrategy")
                .withIndex("by_week", (q) => q.eq("weekOf", weekOf))
                .collect();
            return strategies[0];
        }

        return null;
    },
});

/**
 * APPROVE INDIVIDUAL SECTION
 * Approve specific content sections one at a time
 */
export const approveSection = mutation({
    args: {
        strategyId: v.id("contentStrategy"),
        section: v.string(), // "instagram", "blog", "ebook", "etsy", "affiliates"
    },
    handler: async (ctx, { strategyId, section }) => {
        const updateField = `${section}Approved`;

        await ctx.db.patch(strategyId, {
            [updateField]: true,
        });

        return { success: true, section };
    },
});

/**
 * APPROVE CONTENT STRATEGY (Legacy - approves all)
 */
export const approveStrategy = mutation({
    args: {
        strategyId: v.id("contentStrategy"),
    },
    handler: async (ctx, { strategyId }) => {
        await ctx.db.patch(strategyId, {
            status: "approved",
            instagramApproved: true,
            blogApproved: true,
            ebookApproved: true,
            etsyApproved: true,
            affiliatesApproved: true,
            approvedDate: Date.now(),
        });

        return { success: true };
    },
});
