// @ts-nocheck
/**
 * Database cleanup utilities
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * RESET ALL APPROVALS
 * Clears all approval flags from content strategies
 */
export const resetAllApprovals = mutation({
    args: {},
    handler: async (ctx) => {
        const strategies = await ctx.db.query("contentStrategy").collect();

        for (const strategy of strategies) {
            await ctx.db.patch(strategy._id, {
                instagramApproved: false,
                blogApproved: false,
                ebookApproved: false,
                etsyApproved: false,
                affiliatesApproved: false,
                status: "draft",
            });
        }

        return { success: true, count: strategies.length };
    },
});

/**
 * DELETE ALL STRATEGIES
 * Completely removes all content strategies (use with caution!)
 */
export const deleteAllStrategies = mutation({
    args: {},
    handler: async (ctx) => {
        const strategies = await ctx.db.query("contentStrategy").collect();

        for (const strategy of strategies) {
            await ctx.db.delete(strategy._id);
        }

        return { success: true, deleted: strategies.length };
    },
});
