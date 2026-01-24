// @ts-nocheck
import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEN_AI_API_KEY || "");

export const suggestWeeklyPlan = action({
    args: {},
    handler: async (ctx): Promise<any> => {
        // 1. Get recent trends
        const trends = await ctx.runQuery(api.queries.getTrends);
        const trendsContext = trends.map((t: any) => `- ${t.headline} (${t.category})`).join("\n");

        // 2. RAG Retrieval from Knowledge Base (Search for parenting/mindfulness)
        const modelEmbed = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const embedResult = await modelEmbed.embedContent("parenting mindfulness emotional intelligence kids");

        const knowledgeResults = await ctx.vectorSearch("documents", "by_embedding", {
            vector: embedResult.embedding.values,
            limit: 10,
        });
        const docIds = knowledgeResults.map((r) => r._id);
        const docs = await ctx.runQuery(api.queries.getDocumentsByIds, { ids: docIds });
        const knowledgeContext = docs.map(d => d?.text).filter(Boolean).join("\n\n");

        // 3. Generate Weekly Plan
        const modelGen = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        const prompt = `
        You are "The Mindful NL" AI Marketing Agent.
        Your mission is to suggest a 7-day social media marketing plan based on the user's knowledge base and current market trends.
        
        Knowledge Base Context:
        ${knowledgeContext}
        
        Current Market Trends:
        ${trendsContext}
        
        Generate a 7-day plan. For each day, provide:
        - Day Number (1-7)
        - Topic (e.g., "The Power of Mindfulness in Meltdowns")
        - Format (Blog, Tweet, Carousel, Reel, Flyer, IG Caption, Viral Hooks)
        - Hook (A scroll-stopping opening)
        - Rationale (Why this topic now, based on context/trends)
        
        Format the output as a JSON array of objects. Use EXACTLY these keys: "day", "topic", "format", "hook", "rationale".
        Example:
        [
          { "day": 1, "topic": "...", "format": "...", "hook": "...", "rationale": "..." },
          ...
        ]
        
        Return ONLY the JSON array.
        `;

        const result = await modelGen.generateContent(prompt);
        let content = result.response.text();

        // Clean JSON if needed
        content = content.replace(/```json|```/g, "").trim();
        const rawDays = JSON.parse(content);

        // Normalize data to prevent ArgumentValidationError (e.g., if AI uses "ration" instead of "rationale")
        const days = rawDays.map((d: any) => ({
            day: Number(d.day) || 0,
            topic: String(d.topic || "Untitled Topic"),
            format: String(d.format || "Blog"),
            hook: String(d.hook || ""),
            rationale: String(d.rationale || d.ration || "Strategic alignment with recent trends."),
        }));

        // 4. Save Suggestion
        const planId = await ctx.runMutation(api.planner.createSuggestedPlan, {
            days,
            weekStarting: new Date().toISOString().split('T')[0],
        });

        return { planId, days };
    },
});

export const createSuggestedPlan = mutation({
    args: {
        days: v.array(v.object({
            day: v.number(),
            topic: v.string(),
            format: v.string(),
            hook: v.string(),
            rationale: v.string(),
        })),
        weekStarting: v.string(),
    },
    handler: async (ctx, args) => {
        // Delete any existing "suggested" plans to keep it clean
        const existing = await ctx.db.query("plans")
            .filter(q => q.eq(q.field("status"), "suggested"))
            .collect();
        for (const p of existing) await ctx.db.delete(p._id);

        return await ctx.db.insert("plans", {
            ...args,
            status: "suggested",
        });
    },
});

export const acceptPlan = mutation({
    args: { id: v.id("plans") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { status: "accepted" });
    },
});

export const getLatestPlan = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("plans")
            .order("desc")
            .first();
    },
});

export const getActivePlan = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("plans")
            .filter(q => q.eq(q.field("status"), "accepted"))
            .order("desc")
            .first();
    },
});
