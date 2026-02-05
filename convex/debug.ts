import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listJobs = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("jobs").order("desc").take(5);
    },
});

export const forceCreateAsset = mutation({
    args: {
        jobId: v.id("jobs"),
        userId: v.string(),
        matchScore: v.number(),
        gapAnalysis: v.string(),
        missingSkills: v.array(v.string()),
        tailoredSummary: v.string(),
        tailoredResume: v.string(),
        dmDraft: v.string(),
        coverLetter: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.jobId, { matchScore: args.matchScore });
        await ctx.db.insert("tailoredAssets", {
            userId: args.userId,
            jobId: args.jobId,
            matchScore: args.matchScore,
            gapAnalysis: args.gapAnalysis,
            missingSkills: args.missingSkills,
            tailoredResume: args.tailoredResume,
            tailoredSummary: args.tailoredSummary,
            dmDraft: args.dmDraft,
            coverLetter: args.coverLetter,
            status: "pending_review",
            createdAt: Date.now(),
        });
    },
});

// Clear all test data
export const clearAllAssets = mutation({
    args: {},
    handler: async (ctx) => {
        const assets = await ctx.db.query("tailoredAssets").collect();
        for (const asset of assets) {
            await ctx.db.delete(asset._id);
        }
        return assets.length;
    },
});
