import { mutation, query, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ============================================
// LINKEDIN POST QUERIES
// ============================================

// Get all posts for user
export const getPosts = query({
    args: {
        status: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return [];

        const userId = identity.subject;

        if (args.status) {
            return await ctx.db
                .query("linkedinPosts")
                .withIndex("by_status", (q) => q.eq("userId", userId).eq("status", args.status!))
                .order("desc")
                .take(50);
        }

        return await ctx.db
            .query("linkedinPosts")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .order("desc")
            .take(50);
    },
});

// ============================================
// LINKEDIN POST MUTATIONS
// ============================================

// Create a new post draft
export const createPost = mutation({
    args: {
        content: v.string(),
        topic: v.string(),
        hook: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const userId = identity.subject;

        return await ctx.db.insert("linkedinPosts", {
            userId,
            content: args.content,
            topic: args.topic,
            hook: args.hook,
            status: "draft",
            createdAt: Date.now(),
        });
    },
});

// Generate AI post
export const generatePost = mutation({
    args: {
        topic: v.string(),
        style: v.optional(v.string()), // "thought_leadership", "story", "tips", "controversial"
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const userId = identity.subject;

        // Create placeholder post
        const postId = await ctx.db.insert("linkedinPosts", {
            userId,
            content: "Generating your post...",
            topic: args.topic,
            status: "draft",
            createdAt: Date.now(),
        });

        // Generate content in background
        await ctx.scheduler.runAfter(0, internal.linkedin.generatePostContent, {
            postId,
            topic: args.topic,
            style: args.style || "thought_leadership",
        });

        return postId;
    },
});

// Update post
export const updatePost = mutation({
    args: {
        postId: v.id("linkedinPosts"),
        content: v.optional(v.string()),
        status: v.optional(v.string()),
        scheduledFor: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const updates: any = {};
        if (args.content) updates.content = args.content;
        if (args.status) updates.status = args.status;
        if (args.scheduledFor) updates.scheduledFor = args.scheduledFor;

        await ctx.db.patch(args.postId, updates);
    },
});

// Schedule post
export const schedulePost = mutation({
    args: {
        postId: v.id("linkedinPosts"),
        scheduledFor: v.number(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        await ctx.db.patch(args.postId, {
            status: "scheduled",
            scheduledFor: args.scheduledFor,
        });
    },
});

// Delete post
export const deletePost = mutation({
    args: { postId: v.id("linkedinPosts") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        await ctx.db.delete(args.postId);
    },
});

// ============================================
// INTERNAL ACTIONS
// ============================================

// Generate post content using Gemini
export const generatePostContent = internalAction({
    args: {
        postId: v.id("linkedinPosts"),
        topic: v.string(),
        style: v.string(),
    },
    handler: async (ctx, args) => {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            await ctx.runMutation(internal.linkedin.updatePostInternal, {
                postId: args.postId,
                content: "⚠️ AI not configured. Please add GEMINI_API_KEY.",
            });
            return;
        }

        const styleGuides: Record<string, string> = {
            thought_leadership: "Write as a seasoned professional sharing insights. Be bold, offer unique perspectives. Use line breaks for readability.",
            story: "Tell a personal story with a clear lesson. Start with a hook, build tension, deliver the insight.",
            tips: "Share 5-7 actionable tips. Use emojis as bullet points. Keep each tip to 1-2 lines.",
            controversial: "Take a strong stance on a debatable topic. Challenge conventional wisdom. Invite discussion.",
        };

        const prompt = `Write a viral LinkedIn post about: ${args.topic}

STYLE: ${styleGuides[args.style] || styleGuides.thought_leadership}

RULES:
1. Start with a powerful hook (first line is EVERYTHING on LinkedIn)
2. Keep paragraphs to 1-2 lines max
3. Use line breaks liberally
4. End with a question or call-to-action
5. Include 3-5 relevant hashtags at the end
6. Total length: 1200-1500 characters

Write the post now:`;

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ role: "user", parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.9, maxOutputTokens: 1024 },
                    }),
                }
            );

            const data = await response.json();
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "Failed to generate post.";

            // Extract hook (first line)
            const hook = content.split("\n")[0];

            await ctx.runMutation(internal.linkedin.updatePostInternal, {
                postId: args.postId,
                content,
                hook,
            });
        } catch (error: any) {
            await ctx.runMutation(internal.linkedin.updatePostInternal, {
                postId: args.postId,
                content: `❌ Error: ${error.message}`,
            });
        }
    },
});

// Internal mutation to update post
export const updatePostInternal = internalMutation({
    args: {
        postId: v.id("linkedinPosts"),
        content: v.string(),
        hook: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const updates: any = { content: args.content };
        if (args.hook) updates.hook = args.hook;
        await ctx.db.patch(args.postId, updates);
    },
});
