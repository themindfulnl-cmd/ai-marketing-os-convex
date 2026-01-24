import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const createDocument = mutation({
    args: {
        text: v.string(),
        metadata: v.any(),
        embedding: v.array(v.float64()),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("documents", args);
    },
});

export const createTrend = mutation({
    args: {
        headline: v.string(),
        url: v.string(),
        sentiment_score: v.number(),
        category: v.optional(v.string()),
        platform: v.optional(v.string()),
        engagementScore: v.optional(v.number()),
        trending: v.optional(v.boolean()),
        hashtags: v.optional(v.array(v.string())),
        contentFormat: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("trends", args);
    },
});

export const createDraft = mutation({
    args: {
        title: v.string(),
        content: v.string(),
        format: v.string(),
        status: v.string(),
    },
    handler: async (ctx, args) => {
        const id = await ctx.db.insert("drafts", args);
        return id;
    },
});

export const updateDraft = mutation({
    args: {
        id: v.id("drafts"),
        content: v.optional(v.string()), // content might be partial?
        status: v.optional(v.string()),
        // Add other fields as needed
    },
    handler: async (ctx, args) => {
        const { id, ...updates } = args;
        await ctx.db.patch(id, updates);
    },
});
