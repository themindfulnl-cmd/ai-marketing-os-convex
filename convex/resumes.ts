import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================
// RESUME QUERIES
// ============================================

// Get all resumes for user
export const getResumes = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return [];

        const userId = identity.subject;

        return await ctx.db
            .query("resumes")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .order("desc")
            .collect();
    },
});

// Get master resume
export const getMasterResume = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return null;

        const userId = identity.subject;

        return await ctx.db
            .query("resumes")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .filter((q) => q.eq(q.field("isMaster"), true))
            .first();
    },
});

// Get resume for a specific job
export const getResumeForJob = query({
    args: { jobId: v.id("jobs") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("resumes")
            .withIndex("by_job", (q) => q.eq("targetJobId", args.jobId))
            .first();
    },
});

// ============================================
// RESUME MUTATIONS
// ============================================

// Save/update master resume
export const saveMasterResume = mutation({
    args: {
        content: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const userId = identity.subject;

        // Check if master resume exists
        const existing = await ctx.db
            .query("resumes")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .filter((q) => q.eq(q.field("isMaster"), true))
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, {
                content: args.content,
                updatedAt: Date.now(),
            });
            return existing._id;
        }

        return await ctx.db.insert("resumes", {
            userId,
            name: "Master Resume",
            content: args.content,
            isMaster: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    },
});

// Update resume
export const updateResume = mutation({
    args: {
        resumeId: v.id("resumes"),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        await ctx.db.patch(args.resumeId, {
            content: args.content,
            updatedAt: Date.now(),
        });
    },
});

// Delete resume
export const deleteResume = mutation({
    args: { resumeId: v.id("resumes") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const resume = await ctx.db.get(args.resumeId);
        if (resume?.isMaster) {
            throw new Error("Cannot delete master resume");
        }

        await ctx.db.delete(args.resumeId);
    },
});
