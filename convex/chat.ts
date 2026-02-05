import { mutation, query, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Send a message and trigger AI response
export const sendMessage = mutation({
    args: {
        content: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const userId = identity.subject;

        // Save user message
        await ctx.db.insert("chatMessages", {
            userId,
            role: "user",
            content: args.content,
            timestamp: Date.now(),
        });

        // Schedule the AI response action
        await ctx.scheduler.runAfter(0, internal.chat.generateAIResponse, {
            userId,
            userMessage: args.content,
        });
    },
});

// Internal mutation to save AI response
export const saveAIResponse = internalMutation({
    args: {
        userId: v.string(),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("chatMessages", {
            userId: args.userId,
            role: "assistant",
            content: args.content,
            timestamp: Date.now(),
        });
    },
});

// Internal action to call Gemini API
export const generateAIResponse = internalAction({
    args: {
        userId: v.string(),
        userMessage: v.string(),
    },
    handler: async (ctx, args) => {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            await ctx.runMutation(internal.chat.saveAIResponse, {
                userId: args.userId,
                content: "⚠️ AI is not configured. Please add GEMINI_API_KEY to your Convex environment.",
            });
            return;
        }

        const systemPrompt = `You are an AI marketing assistant for a Dutch parenting brand focused on mindfulness, gentle parenting, and children's yoga. 
    
Your capabilities:
- Generate viral content ideas for Instagram Reels and TikTok
- Find trending topics in the parenting/wellness niche
- Draft social media captions and hooks
- Suggest content calendars
- Provide parenting tips with a mindful approach

Keep responses concise, actionable, and engaging. Use emojis sparingly but effectively.`;

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [
                            { role: "user", parts: [{ text: systemPrompt }] },
                            { role: "model", parts: [{ text: "I understand! I'm ready to help with viral content ideas, trending topics, and marketing strategies for your mindful parenting brand. What would you like to work on today?" }] },
                            { role: "user", parts: [{ text: args.userMessage }] },
                        ],
                        generationConfig: {
                            temperature: 0.8,
                            maxOutputTokens: 1024,
                        },
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(`Gemini API error: ${response.statusText}`);
            }

            const data = await response.json();
            const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response. Please try again.";

            await ctx.runMutation(internal.chat.saveAIResponse, {
                userId: args.userId,
                content: aiResponse,
            });
        } catch (error: any) {
            await ctx.runMutation(internal.chat.saveAIResponse, {
                userId: args.userId,
                content: `❌ Error: ${error.message}. Please try again.`,
            });
        }
    },
});

export const getMessages = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return [];

        const userId = identity.subject;

        return await ctx.db
            .query("chatMessages")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .order("asc")
            .take(100);
    },
});
