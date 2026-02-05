import { mutation, query, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ============================================
// CONTENT ENGINE - "Trend & Post" Workflow
// ============================================

/**
 * THE CONTENT WORKFLOW:
 * 1. User sees trending topics feed
 * 2. Clicks "Draft Post" on a trend
 * 3. AI generates 3 variants: Technical, Strategic, Networking
 * 4. User reviews, edits, and approves before copying
 */

// ============================================
// TRENDING TOPICS
// ============================================

// Get trending topics
export const getTrendingTopics = query({
    args: {
        category: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        if (args.category) {
            return await ctx.db
                .query("trendingTopics")
                .withIndex("by_category", (q) => q.eq("category", args.category!))
                .order("desc")
                .take(20);
        }
        return await ctx.db
            .query("trendingTopics")
            .order("desc")
            .take(20);
    },
});

// Add trending topic (manual or future: from RSS/API)
export const addTrendingTopic = mutation({
    args: {
        topic: v.string(),
        category: v.string(),
        sourceUrl: v.optional(v.string()),
        description: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("trendingTopics", {
            topic: args.topic,
            category: args.category,
            sourceUrl: args.sourceUrl,
            description: args.description,
            viralScore: Math.floor(Math.random() * 40) + 60, // 60-100
            fetchedAt: Date.now(),
        });
    },
});

// ============================================
// CONTENT IDEAS (3 Variants)
// ============================================

// Get all content ideas
export const getContentIdeas = query({
    args: {
        status: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return [];

        const userId = identity.subject;

        if (args.status) {
            return await ctx.db
                .query("contentIdeas")
                .withIndex("by_status", (q) => q.eq("userId", userId).eq("status", args.status!))
                .order("desc")
                .take(30);
        }

        return await ctx.db
            .query("contentIdeas")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .order("desc")
            .take(30);
    },
});

// Get single content idea
export const getContentIdea = query({
    args: { ideaId: v.id("contentIdeas") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.ideaId);
    },
});

// ============================================
// THE CORE "DRAFT CONTENT" ACTION
// ============================================

// Start content drafting
export const draftContentStart = mutation({
    args: {
        topic: v.string(),
        sourceUrl: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const userId = identity.subject;

        // Create placeholder
        const ideaId = await ctx.db.insert("contentIdeas", {
            userId,
            topic: args.topic,
            sourceUrl: args.sourceUrl,
            technicalDraft: "⏳ Generating technical deep dive...",
            strategicDraft: "⏳ Generating strategic insight...",
            networkingDraft: "⏳ Generating networking hook...",
            status: "draft",
            createdAt: Date.now(),
        });

        // Schedule AI generation
        await ctx.scheduler.runAfter(0, internal.contentLab.generateDrafts, {
            ideaId,
            topic: args.topic,
            sourceUrl: args.sourceUrl,
        });

        return ideaId;
    },
});

// Internal action - Generate 3 variants
export const generateDrafts = internalAction({
    args: {
        ideaId: v.id("contentIdeas"),
        topic: v.string(),
        sourceUrl: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            await ctx.runMutation(internal.contentLab.saveDraftsError, {
                ideaId: args.ideaId,
                error: "GEMINI_API_KEY not configured",
            });
            return;
        }

        try {
            const prompt = `You are a LinkedIn content strategist. Create 3 different post variations about this trending topic:

## TOPIC: ${args.topic}
${args.sourceUrl ? `## SOURCE: ${args.sourceUrl}` : ""}

---

Generate 3 distinct LinkedIn posts in this EXACT JSON format:
{
  "technicalDraft": "<A 'Technical Deep Dive' post. Code-focused, shows expertise. Use bullet points for key technical insights. ~800-1000 characters>",
  "strategicDraft": "<A 'Strategic Insight' post. Business/marketing angle. Focus on automation, AI trends, industry impact. ~800-1000 characters>",
  "networkingDraft": "<A 'Networking Hook' post. Casual, conversational. Asks a question to spark discussion. ~500-700 characters>"
}

RULES FOR ALL POSTS:
1. Start with a powerful hook (first line = everything on LinkedIn)
2. Use line breaks liberally (1-2 sentences per paragraph)
3. End with a question or call-to-action
4. Include 3-5 relevant hashtags
5. Sound authentic, not robotic`;

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ role: "user", parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.9,
                            maxOutputTokens: 2048,
                            responseMimeType: "application/json"
                        },
                    }),
                }
            );

            const data = await response.json();
            const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

            let drafts;
            try {
                drafts = JSON.parse(textContent);
            } catch {
                const jsonMatch = textContent.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    drafts = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error("Could not parse AI response");
                }
            }

            await ctx.runMutation(internal.contentLab.saveDrafts, {
                ideaId: args.ideaId,
                technicalDraft: drafts.technicalDraft || "Generation failed",
                strategicDraft: drafts.strategicDraft || "Generation failed",
                networkingDraft: drafts.networkingDraft || "Generation failed",
            });

        } catch (error: any) {
            await ctx.runMutation(internal.contentLab.saveDraftsError, {
                ideaId: args.ideaId,
                error: error.message,
            });
        }
    },
});

// Save drafts
export const saveDrafts = internalMutation({
    args: {
        ideaId: v.id("contentIdeas"),
        technicalDraft: v.string(),
        strategicDraft: v.string(),
        networkingDraft: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.ideaId, {
            technicalDraft: args.technicalDraft,
            strategicDraft: args.strategicDraft,
            networkingDraft: args.networkingDraft,
        });
    },
});

// Save error
export const saveDraftsError = internalMutation({
    args: {
        ideaId: v.id("contentIdeas"),
        error: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.ideaId, {
            technicalDraft: `❌ Error: ${args.error}`,
            strategicDraft: `❌ Error: ${args.error}`,
            networkingDraft: `❌ Error: ${args.error}`,
        });
    },
});

// ============================================
// APPROVAL GATE - Human in the Loop
// ============================================

// Select and approve a variant
export const approveContent = mutation({
    args: {
        ideaId: v.id("contentIdeas"),
        selectedVariant: v.string(), // "technical" | "strategic" | "networking"
        editedContent: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        await ctx.db.patch(args.ideaId, {
            selectedVariant: args.selectedVariant,
            editedContent: args.editedContent,
            status: "approved",
        });
    },
});

// Mark as posted
export const markPosted = mutation({
    args: { ideaId: v.id("contentIdeas") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        await ctx.db.patch(args.ideaId, {
            status: "posted",
            postedAt: Date.now(),
        });
    },
});

// Delete content idea
export const deleteIdea = mutation({
    args: { ideaId: v.id("contentIdeas") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        await ctx.db.delete(args.ideaId);
    },
});
