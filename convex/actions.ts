"use node";
// @ts-nocheck
import { action } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEN_AI_API_KEY || "");

export const ingestKnowledge = action({
    args: { text: v.string(), metadata: v.any() },
    handler: async (ctx, args) => {
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.embedContent(args.text);
        const embedding = result.embedding.values;

        await ctx.runMutation(api.mutations.createDocument, {
            text: args.text,
            metadata: args.metadata,
            embedding: embedding,
        });
    },
});

export const generateContent = action({
    args: { prompt: v.string(), format: v.string() },
    handler: async (ctx, args): Promise<{ draftId: Id<"drafts">; content: string; title: string }> => {
        const apiKey = process.env.GOOGLE_GEN_AI_API_KEY;
        if (!apiKey) throw new ConvexError("API Key Missing: Set GOOGLE_GEN_AI_API_KEY.");

        let contextText = "No additional context available.";
        try {
            const modelEmbed = genAI.getGenerativeModel({ model: "text-embedding-004" });
            const embedResult = await modelEmbed.embedContent(args.prompt);
            const embedding = embedResult?.embedding?.values;

            if (embedding) {
                const searchResults = await ctx.vectorSearch("documents", "by_embedding", {
                    vector: embedding,
                    limit: 5,
                });
                const docIds = searchResults.map((r) => r._id);
                const docs = await ctx.runQuery(api.queries.getDocumentsByIds, { ids: docIds });
                contextText = docs.map((d: any) => d?.text).filter(Boolean).join("\n\n") || contextText;
            }
        } catch (embedError) {
            console.error("AI Insight: Embedding/Vector search skipped or failed.", embedError);
        }

        const modelsToTry = [
            "gemini-1.5-flash",
            "gemini-pro",
            "gemini-1.0-pro",
            "gemini-1.5-flash-latest",
            "gemini-2.0-flash-exp"
        ];

        let responseText = "";
        let lastError = "";

        for (const modelName of modelsToTry) {
            try {
                console.log(`AI Engine: Trying ${modelName}...`);
                const modelGen = genAI.getGenerativeModel({ model: modelName });
                const result = await modelGen.generateContent(`Context: ${contextText}\nTask: ${args.prompt}\nFormat: ${args.format}\nStrictly follow constraints.`);
                responseText = result.response.text();
                if (responseText) break;
            } catch (e: any) {
                lastError = e.message || String(e);
                console.error(`AI Model ${modelName} failed:`, lastError);
                if (lastError.includes("429") || lastError.includes("quota")) {
                    throw new ConvexError("Gemini Quota Reached: Daily limit hit (Free Tier). Try again tomorrow.");
                }
            }
        }

        if (!responseText) {
            throw new ConvexError(`AI Engine Failure: All attempted models failed. Last error: ${lastError}`);
        }

        const draftId = await ctx.runMutation(api.mutations.createDraft, {
            title: args.prompt.substring(0, 50),
            content: responseText,
            format: args.format,
            status: "generated",
        });

        return { draftId, content: responseText, title: args.prompt.substring(0, 50) };
    },
});

export const generateEbook = action({
    args: { title: v.string(), content: v.string() },
    handler: async (ctx, args) => {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        page.drawText(args.title, {
            x: 50,
            y: height - 50,
            size: 24,
            font: font,
            color: rgb(0, 0, 0),
        });

        // Simple text wrapping - simplistic for demo
        page.drawText(args.content.substring(0, 2000), { // Limit text to avoid overflow in demo
            x: 50,
            y: height - 100,
            size: 12,
            font: font,
            color: rgb(0, 0, 0),
            maxWidth: width - 100,
        });

        const pdfBytes = await pdfDoc.save();

        const storageId = await ctx.storage.store(new Blob([pdfBytes as any], { type: 'application/pdf' }));
        const url = await ctx.storage.getUrl(storageId);

        return url;
    }
});
