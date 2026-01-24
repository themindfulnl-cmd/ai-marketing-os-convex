import { query } from "./_generated/server";
import { v } from "convex/values";

export const getTrends = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("trends").order("desc").take(20);
    },
});

export const getTrendsByPlatform = query({
    args: { platform: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("trends")
            .withIndex("by_platform", (q) => q.eq("platform", args.platform))
            .order("desc")
            .take(20);
    },
});

export const getTrendingContent = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db
            .query("trends")
            .withIndex("by_trending", (q) => q.eq("trending", true))
            .order("desc")
            .take(30);
    },
});

export const getTrendsByCategory = query({
    args: { category: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("trends")
            .withIndex("by_category", (q) => q.eq("category", args.category))
            .order("desc")
            .take(20);
    },
});

export const getDrafts = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("drafts").order("desc").take(10);
    },
});

export const getDraftsByStatus = query({
    args: { status: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("drafts")
            .withIndex("by_status", (q) => q.eq("status", args.status))
            .order("desc")
            .collect();
    },
});

export const getDraftsByFormat = query({
    args: { format: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("drafts")
            .withIndex("by_format", (q) => q.eq("format", args.format))
            .order("desc")
            .collect();
    },
});

export const getDocumentsByIds = query({
    args: { ids: v.array(v.id("documents")) },
    handler: async (ctx, args) => {
        const docs = await Promise.all(args.ids.map((id) => ctx.db.get(id)));
        return docs.filter((doc) => doc !== null);
    },
});

export const getProducts = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db
            .query("products")
            .withIndex("by_status", (q) => q.eq("status", "published"))
            .order("desc")
            .take(50);
    },
});

export const getProductsByType = query({
    args: { type: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("products")
            .withIndex("by_type", (q) => q.eq("type", args.type))
            .order("desc")
            .collect();
    },
});

export const getSales = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db
            .query("sales")
            .order("desc")
            .take(100);
    },
});

export const getSalesByPlatform = query({
    args: { platform: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("sales")
            .withIndex("by_platform", (q) => q.eq("platform", args.platform))
            .order("desc")
            .collect();
    },
});

export const getGrowthMetrics = query({
    args: { platform: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("growthMetrics")
            .withIndex("by_platform", (q) => q.eq("platform", args.platform))
            .order("desc")
            .take(30); // Last 30 days
    },
});

export const getAffiliateProducts = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("affiliateProducts").order("desc").collect();
    },
});

export const getAffiliateProductsByCategory = query({
    args: { category: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("affiliateProducts")
            .withIndex("by_category", (q) => q.eq("category", args.category))
            .collect();
    },
});
