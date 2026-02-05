import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const syncUser = mutation({
    args: {
        email: v.string(),
        name: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const userId = identity.subject;

        const existingUser = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
            .first();

        if (!existingUser) {
            await ctx.db.insert("users", {
                clerkId: userId,
                email: args.email,
                name: args.name,
                imageUrl: args.imageUrl,
                createdAt: Date.now(),
            });
        } else {
            // Update if needed
            await ctx.db.patch(existingUser._id, {
                name: args.name,
                imageUrl: args.imageUrl,
            });
        }
    },
});
