// @ts-nocheck
/**
 * Google Imagen 3 - AI Image Generation via Vertex AI
 * 
 * Generates high-quality images using Google's Imagen 3 model
 */

import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Imagen 3 model endpoint
const IMAGEN_MODEL = "imagen-3.0-generate-001";

/**
 * Generate an image using Imagen 3 via Vertex AI
 */
export const generateImage = action({
    args: {
        prompt: v.string(),
        aspectRatio: v.optional(v.string()), // "1:1", "16:9", "9:16", "4:3", "3:4"
        style: v.optional(v.string()), // Style hint for the prompt
        contentType: v.string(), // "instagram", "blog", "ebook", "etsy"
        strategyId: v.optional(v.id("contentStrategy")),
    },
    handler: async (ctx, args) => {
        const { prompt, aspectRatio = "1:1", style, contentType, strategyId } = args;

        // Get Google Cloud credentials from environment
        const projectId = process.env.GOOGLE_CLOUD_PROJECT;
        const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
        const apiKey = process.env.GEMINI_API_KEY;

        if (!projectId || !apiKey) {
            throw new Error("Missing GOOGLE_CLOUD_PROJECT or GEMINI_API_KEY environment variable");
        }

        // Enhance prompt with style if provided
        let enhancedPrompt = prompt;
        if (style) {
            enhancedPrompt = `${style} style: ${prompt}`;
        }

        // Add brand-consistent styling for @themindfulnl
        enhancedPrompt += ". Soft, warm, calming colors. Gentle parenting, mindfulness aesthetic. Clean, modern, minimalist design.";

        try {
            // Vertex AI Imagen 3 API endpoint
            const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${IMAGEN_MODEL}:predict`;

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    instances: [
                        {
                            prompt: enhancedPrompt,
                        }
                    ],
                    parameters: {
                        sampleCount: 1,
                        aspectRatio: aspectRatio,
                        safetyFilterLevel: "block_some",
                        personGeneration: "allow_adult",
                    }
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Imagen API error:", errorText);

                // Fall back to placeholder for development
                const placeholderUrl = `https://placehold.co/1024x1024/E8D5C4/6B5B4F?text=${encodeURIComponent(prompt.slice(0, 30))}`;

                // Store the placeholder image
                const imageId = await ctx.runMutation(api.imagen.storeGeneratedImage, {
                    prompt,
                    imageUrl: placeholderUrl,
                    aspectRatio,
                    style: style || "placeholder",
                    contentType,
                    strategyId,
                });

                return {
                    success: true,
                    imageUrl: placeholderUrl,
                    imageId,
                    isPlaceholder: true,
                    message: "Using placeholder (Vertex AI credentials needed for real images)",
                };
            }

            const data = await response.json();

            // Extract base64 image from response
            const imageBase64 = data.predictions?.[0]?.bytesBase64Encoded;

            if (!imageBase64) {
                throw new Error("No image returned from Imagen API");
            }

            // Convert to data URL for display
            const imageUrl = `data:image/png;base64,${imageBase64}`;

            // Store the generated image
            const imageId = await ctx.runMutation(api.imagen.storeGeneratedImage, {
                prompt,
                imageUrl,
                aspectRatio,
                style: style || "default",
                contentType,
                strategyId,
            });

            return {
                success: true,
                imageUrl,
                imageId,
                isPlaceholder: false,
            };

        } catch (error: any) {
            console.error("Image generation error:", error);

            // Return placeholder for development
            const placeholderUrl = `https://placehold.co/1024x1024/E8D5C4/6B5B4F?text=${encodeURIComponent(prompt.slice(0, 30))}`;

            const imageId = await ctx.runMutation(api.imagen.storeGeneratedImage, {
                prompt,
                imageUrl: placeholderUrl,
                aspectRatio,
                style: "placeholder",
                contentType,
                strategyId,
            });

            return {
                success: true,
                imageUrl: placeholderUrl,
                imageId,
                isPlaceholder: true,
                message: error.message || "Using placeholder image",
            };
        }
    },
});

/**
 * Store a generated image in the database
 */
export const storeGeneratedImage = mutation({
    args: {
        prompt: v.string(),
        imageUrl: v.string(),
        aspectRatio: v.string(),
        style: v.string(),
        contentType: v.string(),
        strategyId: v.optional(v.id("contentStrategy")),
    },
    handler: async (ctx, args) => {
        const imageId = await ctx.db.insert("generatedImages", {
            ...args,
            status: "generated",
            createdAt: Date.now(),
        });
        return imageId;
    },
});

/**
 * Get images for a content strategy
 */
export const getImagesForStrategy = query({
    args: {
        strategyId: v.id("contentStrategy"),
    },
    handler: async (ctx, args) => {
        const images = await ctx.db
            .query("generatedImages")
            .withIndex("by_strategy", (q) => q.eq("strategyId", args.strategyId))
            .collect();
        return images;
    },
});

/**
 * Approve an image for use
 */
export const approveImage = mutation({
    args: {
        imageId: v.id("generatedImages"),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.imageId, { status: "approved" });
        return { success: true };
    },
});

/**
 * Generate image prompts based on content strategy
 */
export const generateImagePrompts = action({
    args: {
        strategyId: v.id("contentStrategy"),
        section: v.string(), // "instagram", "blog", "ebook", "etsy"
    },
    handler: async (ctx, args) => {
        // Get the strategy
        const strategy = await ctx.runQuery(api.weeklyPlanner.getContentStrategyById, {
            strategyId: args.strategyId,
        });

        if (!strategy) {
            throw new Error("Strategy not found");
        }

        // Generate prompts based on section
        const prompts: string[] = [];

        if (args.section === "instagram" && strategy.instagramContent) {
            // Generate prompts for each Instagram post
            for (const post of strategy.instagramContent.slice(0, 3)) {
                prompts.push(`${post.title}. ${post.hook}. Mindful parenting, gentle, warm aesthetic.`);
            }
        } else if (args.section === "blog" && strategy.blogPost) {
            prompts.push(`Blog header for: ${strategy.blogPost.title}. Mindful parenting, calming, professional.`);
        } else if (args.section === "ebook" && strategy.ebookChapter) {
            prompts.push(`Ebook chapter illustration: ${strategy.ebookChapter.title}. Gentle, warm, educational.`);
        } else if (args.section === "etsy" && strategy.etsyProducts) {
            for (const product of strategy.etsyProducts.slice(0, 2)) {
                prompts.push(`Product mockup: ${product.name}. Clean, professional, Etsy listing style.`);
            }
        }

        return prompts;
    },
});
