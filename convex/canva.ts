// @ts-nocheck
/**
 * Canva Connect API Integration
 * 
 * OAuth flow and design automation for Canva
 */

import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

const CANVA_API_BASE = "https://api.canva.com/rest/v1";

/**
 * Get authorization URL for Canva OAuth
 */
export const getAuthUrl = action({
    args: {
        userId: v.string(),
    },
    handler: async (ctx, args) => {
        const clientId = process.env.CANVA_CLIENT_ID;
        const redirectUri = process.env.CANVA_REDIRECT_URI || "http://localhost:3000/api/canva/callback";

        if (!clientId) {
            throw new Error("Missing CANVA_CLIENT_ID environment variable");
        }

        // Generate PKCE code verifier and challenge
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);

        // Store code verifier for later token exchange
        // In production, use a session store
        const state = btoa(JSON.stringify({
            userId: args.userId,
            codeVerifier,
        }));

        const scopes = [
            "design:content:read",
            "design:content:write",
            "asset:read",
            "asset:write",
        ].join(" ");

        const authUrl = new URL("https://www.canva.com/api/oauth/authorize");
        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("scope", scopes);
        authUrl.searchParams.set("state", state);
        authUrl.searchParams.set("code_challenge", codeChallenge);
        authUrl.searchParams.set("code_challenge_method", "S256");

        return {
            authUrl: authUrl.toString(),
            state,
        };
    },
});

/**
 * Exchange authorization code for access token
 */
export const exchangeToken = action({
    args: {
        code: v.string(),
        state: v.string(),
    },
    handler: async (ctx, args) => {
        const clientId = process.env.CANVA_CLIENT_ID;
        const clientSecret = process.env.CANVA_CLIENT_SECRET;
        const redirectUri = process.env.CANVA_REDIRECT_URI || "http://localhost:3000/api/canva/callback";

        if (!clientId || !clientSecret) {
            throw new Error("Missing CANVA_CLIENT_ID or CANVA_CLIENT_SECRET");
        }

        // Decode state to get user ID and code verifier
        const stateData = JSON.parse(atob(args.state));
        const { userId, codeVerifier } = stateData;

        const tokenUrl = "https://api.canva.com/rest/v1/oauth/token";

        const response = await fetch(tokenUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code: args.code,
                redirect_uri: redirectUri,
                code_verifier: codeVerifier,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Token exchange failed: ${error}`);
        }

        const tokenData = await response.json();

        // Store tokens in database
        await ctx.runMutation(api.canva.storeTokens, {
            userId,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: Date.now() + (tokenData.expires_in * 1000),
            scope: tokenData.scope,
        });

        return { success: true, userId };
    },
});

/**
 * Store OAuth tokens
 */
export const storeTokens = mutation({
    args: {
        userId: v.string(),
        accessToken: v.string(),
        refreshToken: v.string(),
        expiresAt: v.number(),
        scope: v.string(),
    },
    handler: async (ctx, args) => {
        // Check if user already has tokens
        const existing = await ctx.db
            .query("canvaTokens")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, {
                accessToken: args.accessToken,
                refreshToken: args.refreshToken,
                expiresAt: args.expiresAt,
                scope: args.scope,
            });
        } else {
            await ctx.db.insert("canvaTokens", args);
        }

        return { success: true };
    },
});

/**
 * Get stored tokens for a user
 */
export const getTokens = query({
    args: {
        userId: v.string(),
    },
    handler: async (ctx, args) => {
        const tokens = await ctx.db
            .query("canvaTokens")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .first();
        return tokens;
    },
});

/**
 * Check if user is connected to Canva
 */
export const isConnected = query({
    args: {
        userId: v.string(),
    },
    handler: async (ctx, args) => {
        const tokens = await ctx.db
            .query("canvaTokens")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .first();

        if (!tokens) return false;

        // Check if token is expired
        return tokens.expiresAt > Date.now();
    },
});

/**
 * Create a new design in Canva
 */
export const createDesign = action({
    args: {
        userId: v.string(),
        title: v.string(),
        designType: v.string(), // "instagram_post", "instagram_story", "presentation"
    },
    handler: async (ctx, args) => {
        // Get access token
        const tokens = await ctx.runQuery(api.canva.getTokens, { userId: args.userId });

        if (!tokens || tokens.expiresAt < Date.now()) {
            throw new Error("Not connected to Canva or token expired");
        }

        // Map design types to Canva format
        const designTypeMap: Record<string, { width: number; height: number }> = {
            instagram_post: { width: 1080, height: 1080 },
            instagram_story: { width: 1080, height: 1920 },
            instagram_reel: { width: 1080, height: 1920 },
            blog_header: { width: 1200, height: 630 },
            ebook_page: { width: 816, height: 1056 },
        };

        const dimensions = designTypeMap[args.designType] || { width: 1080, height: 1080 };

        const response = await fetch(`${CANVA_API_BASE}/designs`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${tokens.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                design_type: {
                    type: "custom",
                    width: dimensions.width,
                    height: dimensions.height,
                    units: "px",
                },
                title: args.title,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to create design: ${error}`);
        }

        const data = await response.json();

        return {
            designId: data.design.id,
            editUrl: data.design.urls.edit_url,
            viewUrl: data.design.urls.view_url,
        };
    },
});

/**
 * Upload an image asset to Canva
 */
export const uploadAsset = action({
    args: {
        userId: v.string(),
        imageUrl: v.string(),
        name: v.string(),
    },
    handler: async (ctx, args) => {
        const tokens = await ctx.runQuery(api.canva.getTokens, { userId: args.userId });

        if (!tokens || tokens.expiresAt < Date.now()) {
            throw new Error("Not connected to Canva or token expired");
        }

        // For base64 images, we need to convert to a blob
        let imageData: Blob;

        if (args.imageUrl.startsWith("data:")) {
            // Extract base64 data
            const base64Data = args.imageUrl.split(",")[1];
            const binaryData = Buffer.from(base64Data, "base64");
            imageData = new Blob([binaryData], { type: "image/png" });
        } else {
            // Fetch the image from URL
            const imageResponse = await fetch(args.imageUrl);
            imageData = await imageResponse.blob();
        }

        // Upload to Canva
        const formData = new FormData();
        formData.append("asset", imageData, `${args.name}.png`);

        const response = await fetch(`${CANVA_API_BASE}/assets`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${tokens.accessToken}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to upload asset: ${error}`);
        }

        const data = await response.json();

        return {
            assetId: data.asset.id,
            thumbnailUrl: data.asset.thumbnail?.url,
        };
    },
});

/**
 * Send approved content to Canva - creates a design and opens editor
 */
export const sendToCanva = action({
    args: {
        userId: v.string(),
        contentType: v.string(), // "instagram", "blog", "ebook", "etsy"
        content: v.any(), // The approved content object
        imageUrl: v.optional(v.string()), // Optional generated image to include
    },
    handler: async (ctx, args) => {
        // Get access token
        const tokens = await ctx.runQuery(api.canva.getTokens, { userId: args.userId });

        if (!tokens || tokens.expiresAt < Date.now()) {
            throw new Error("Not connected to Canva or token expired. Please reconnect to Canva.");
        }

        // Determine design type and title based on content type
        let designType: string;
        let designTitle: string;
        let dimensions: { width: number; height: number };

        switch (args.contentType) {
            case "instagram":
                designType = "instagram_post";
                designTitle = `Instagram: ${args.content[0]?.title || "Weekly Post"}`;
                dimensions = { width: 1080, height: 1080 };
                break;
            case "blog":
                designType = "blog_header";
                designTitle = `Blog: ${args.content.title || "Weekly Blog"}`;
                dimensions = { width: 1200, height: 630 };
                break;
            case "ebook":
                designType = "ebook_page";
                designTitle = `Ebook Ch.${args.content.chapterNumber}: ${args.content.title}`;
                dimensions = { width: 816, height: 1056 };
                break;
            case "etsy":
                designType = "etsy_listing";
                designTitle = `Etsy: ${args.content[0]?.name || "Product Listing"}`;
                dimensions = { width: 2000, height: 2000 };
                break;
            default:
                designType = "instagram_post";
                designTitle = "Marketing Content";
                dimensions = { width: 1080, height: 1080 };
        }

        // Create the design in Canva
        const designResponse = await fetch(`${CANVA_API_BASE}/designs`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${tokens.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                design_type: {
                    type: "custom",
                    width: dimensions.width,
                    height: dimensions.height,
                    units: "px",
                },
                title: designTitle,
            }),
        });

        if (!designResponse.ok) {
            const error = await designResponse.text();
            throw new Error(`Failed to create Canva design: ${error}`);
        }

        const designData = await designResponse.json();
        const designId = designData.design.id;
        const editUrl = designData.design.urls.edit_url;
        const viewUrl = designData.design.urls.view_url;

        // If there's an image URL, upload it as an asset
        let assetId: string | null = null;
        if (args.imageUrl) {
            try {
                // For base64 images
                let imageData: Blob;
                if (args.imageUrl.startsWith("data:")) {
                    const base64Data = args.imageUrl.split(",")[1];
                    const binaryData = Buffer.from(base64Data, "base64");
                    imageData = new Blob([binaryData], { type: "image/png" });
                } else {
                    // Fetch the image from URL
                    const imageResponse = await fetch(args.imageUrl);
                    imageData = await imageResponse.blob();
                }

                // Upload to Canva
                const formData = new FormData();
                formData.append("asset", imageData, `${designTitle.replace(/[^a-zA-Z0-9]/g, "_")}.png`);

                const assetResponse = await fetch(`${CANVA_API_BASE}/assets`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${tokens.accessToken}`,
                    },
                    body: formData,
                });

                if (assetResponse.ok) {
                    const assetData = await assetResponse.json();
                    assetId = assetData.asset.id;
                }
            } catch (error) {
                console.error("Failed to upload image to Canva:", error);
                // Continue without the image - user can add manually
            }
        }

        // Store the design info for tracking
        await ctx.runMutation(api.canva.storeDesign, {
            userId: args.userId,
            designId,
            editUrl,
            viewUrl,
            contentType: args.contentType,
            title: designTitle,
            assetId: assetId || undefined,
        });

        return {
            success: true,
            designId,
            editUrl,
            viewUrl,
            assetId,
            message: `Design created! Click to open Canva and finalize your ${args.contentType} design.`,
        };
    },
});

/**
 * Store design info for tracking
 */
export const storeDesign = mutation({
    args: {
        userId: v.string(),
        designId: v.string(),
        editUrl: v.string(),
        viewUrl: v.string(),
        contentType: v.string(),
        title: v.string(),
        assetId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // We'll store this in a simple structure - could add a canvaDesigns table later
        console.log(`Stored Canva design: ${args.designId} for ${args.contentType}`);
        return { success: true };
    },
});

/**
 * Get all designs for a user (placeholder for future enhancement)
 */
export const getUserDesigns = query({
    args: {
        userId: v.string(),
    },
    handler: async (ctx, args) => {
        // Future: query from canvaDesigns table
        return [];
    },
});

// Helper functions for PKCE (Convex runtime compatible)
function generateCodeVerifier(): string {
    // Generate a random string using Math.random (Convex compatible)
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    let result = "";
    for (let i = 0; i < 64; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

async function generateCodeChallenge(verifier: string): Promise<string> {
    // For S256, we need to SHA-256 hash the verifier and base64url encode it
    // Use Web Crypto API (available in Convex)
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = new Uint8Array(hashBuffer);

    // Convert to base64url
    let binary = "";
    for (let i = 0; i < hashArray.length; i++) {
        binary += String.fromCharCode(hashArray[i]);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
