import { mutation, query, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ============================================
// JOB QUERIES
// ============================================

// Get all jobs for the current user
export const getJobs = query({
    args: {
        status: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return [];

        const userId = identity.subject;

        if (args.status) {
            return await ctx.db
                .query("jobs")
                .withIndex("by_status", (q) => q.eq("userId", userId).eq("status", args.status!))
                .order("desc")
                .take(100);
        }

        return await ctx.db
            .query("jobs")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .order("desc")
            .take(100);
    },
});

// Get job by ID
export const getJob = query({
    args: { jobId: v.id("jobs") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.jobId);
    },
});

// ============================================
// JOB MUTATIONS
// ============================================

// Add a job manually
export const addJob = mutation({
    args: {
        title: v.string(),
        company: v.string(),
        location: v.string(),
        description: v.string(),
        salary: v.optional(v.string()),
        url: v.string(),
        recruiterName: v.optional(v.string()),
        recruiterLinkedIn: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const userId = identity.subject;

        // Schedule match score calculation
        const jobId = await ctx.db.insert("jobs", {
            userId,
            title: args.title,
            company: args.company,
            location: args.location,
            description: args.description,
            salary: args.salary,
            url: args.url,
            source: "manual",
            matchScore: 0, // Will be calculated
            status: "new",
            recruiterName: args.recruiterName,
            recruiterLinkedIn: args.recruiterLinkedIn,
            discoveredAt: Date.now(),
        });

        // Calculate match score in background
        await ctx.scheduler.runAfter(0, internal.jobs.calculateMatchScore, { jobId });

        return jobId;
    },
});

// Update job status
export const updateJobStatus = mutation({
    args: {
        jobId: v.id("jobs"),
        status: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const updates: any = { status: args.status };
        if (args.status === "applied") {
            updates.appliedAt = Date.now();
        }

        await ctx.db.patch(args.jobId, updates);
    },
});

// Queue job for application
export const queueJob = mutation({
    args: { jobId: v.id("jobs") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        await ctx.db.patch(args.jobId, { status: "queued" });

        // Trigger resume tailoring and outreach draft generation
        await ctx.scheduler.runAfter(0, internal.jobs.prepareApplication, { jobId: args.jobId });
    },
});

// Delete job
export const deleteJob = mutation({
    args: { jobId: v.id("jobs") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        await ctx.db.delete(args.jobId);
    },
});

// ============================================
// INTERNAL ACTIONS
// ============================================

// Calculate match score using Gemini
export const calculateMatchScore = internalAction({
    args: { jobId: v.id("jobs") },
    handler: async (ctx, args) => {
        const job = await ctx.runQuery(internal.jobs.getJobInternal, { jobId: args.jobId });
        if (!job) return;

        const userProfile = await ctx.runQuery(internal.jobs.getUserProfileInternal, { userId: job.userId });

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            await ctx.runMutation(internal.jobs.updateMatchScoreInternal, { jobId: args.jobId, score: 50 });
            return;
        }

        try {
            const prompt = `Analyze how well this job matches the candidate's profile. Return ONLY a number from 0-100.

JOB:
Title: ${job.title}
Company: ${job.company}
Description: ${job.description}

CANDIDATE:
Target Roles: ${userProfile?.targetRoles?.join(", ") || "Not specified"}
Skills: ${userProfile?.skills?.join(", ") || "Not specified"}
Experience Level: ${userProfile?.experience || "Not specified"}

Score (0-100):`;

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ role: "user", parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.1, maxOutputTokens: 10 },
                    }),
                }
            );

            const data = await response.json();
            const scoreText = data.candidates?.[0]?.content?.parts?.[0]?.text || "50";
            const score = Math.min(100, Math.max(0, parseInt(scoreText.replace(/\D/g, "")) || 50));

            await ctx.runMutation(internal.jobs.updateMatchScoreInternal, { jobId: args.jobId, score });
        } catch (error) {
            await ctx.runMutation(internal.jobs.updateMatchScoreInternal, { jobId: args.jobId, score: 50 });
        }
    },
});

// Prepare application (tailored resume + outreach draft)
export const prepareApplication = internalAction({
    args: { jobId: v.id("jobs") },
    handler: async (ctx, args) => {
        const job = await ctx.runQuery(internal.jobs.getJobInternal, { jobId: args.jobId });
        if (!job) return;

        // Get master resume
        const masterResume = await ctx.runQuery(internal.jobs.getMasterResumeInternal, { userId: job.userId });

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || !masterResume) return;

        try {
            // Generate tailored resume
            const resumePrompt = `You are an expert resume writer specializing in ATS optimization.

MASTER RESUME:
${masterResume.content}

JOB DESCRIPTION:
Title: ${job.title}
Company: ${job.company}
${job.description}

Create a tailored version of this resume that:
1. Emphasizes relevant skills and experience
2. Uses keywords from the job description
3. Maintains truthfulness (don't invent experience)
4. Is optimized for ATS systems

Return the resume in markdown format.`;

            const resumeResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ role: "user", parts: [{ text: resumePrompt }] }],
                        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
                    }),
                }
            );

            const resumeData = await resumeResponse.json();
            const tailoredContent = resumeData.candidates?.[0]?.content?.parts?.[0]?.text || masterResume.content;

            // Save tailored resume
            await ctx.runMutation(internal.jobs.saveTailoredResume, {
                userId: job.userId,
                jobId: args.jobId,
                content: tailoredContent,
                name: `Resume for ${job.company} - ${job.title}`,
            });

            // Generate outreach draft
            const outreachPrompt = `Write a personalized LinkedIn connection request message for a job application.

JOB: ${job.title} at ${job.company}
RECRUITER: ${job.recruiterName || "Hiring Manager"}

Keep it under 300 characters (LinkedIn limit for connection requests).
Be professional but personable. Express genuine interest.
Don't be generic - reference the specific role.`;

            const outreachResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ role: "user", parts: [{ text: outreachPrompt }] }],
                        generationConfig: { temperature: 0.8, maxOutputTokens: 200 },
                    }),
                }
            );

            const outreachData = await outreachResponse.json();
            const outreachBody = outreachData.candidates?.[0]?.content?.parts?.[0]?.text || "";

            // Save outreach draft
            await ctx.runMutation(internal.jobs.saveOutreachDraft, {
                userId: job.userId,
                jobId: args.jobId,
                type: "connection_request",
                recruiterName: job.recruiterName,
                body: outreachBody,
            });

        } catch (error) {
            console.error("Error preparing application:", error);
        }
    },
});

// ============================================
// INTERNAL QUERIES/MUTATIONS
// ============================================

export const getJobInternal = internalQuery({
    args: { jobId: v.id("jobs") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.jobId);
    },
});

export const getUserProfileInternal = internalQuery({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("userProfile")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .first();
    },
});

export const getMasterResumeInternal = internalQuery({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("resumes")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .filter((q) => q.eq(q.field("isMaster"), true))
            .first();
    },
});

export const updateMatchScoreInternal = internalMutation({
    args: { jobId: v.id("jobs"), score: v.number() },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.jobId, { matchScore: args.score });
    },
});

export const saveTailoredResume = internalMutation({
    args: {
        userId: v.string(),
        jobId: v.id("jobs"),
        content: v.string(),
        name: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("resumes", {
            userId: args.userId,
            name: args.name,
            content: args.content,
            targetJobId: args.jobId,
            isMaster: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    },
});

export const saveOutreachDraft = internalMutation({
    args: {
        userId: v.string(),
        jobId: v.id("jobs"),
        type: v.string(),
        recruiterName: v.optional(v.string()),
        body: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("outreachDrafts", {
            userId: args.userId,
            jobId: args.jobId,
            type: args.type,
            recruiterName: args.recruiterName,
            body: args.body,
            status: "draft",
            createdAt: Date.now(),
        });
    },
});
