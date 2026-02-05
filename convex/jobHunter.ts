import { mutation, query, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ============================================
// JOB HUNTER ENGINE - "Smart Apply" Workflow
// ============================================

/**
 * THE SMART APPLY WORKFLOW:
 * 1. User pastes job URL or description
 * 2. analyzeJob action sends JD + Master Resume to Gemini
 * 3. Returns: matchScore, gapAnalysis, tailoredResume, dmDraft
 * 4. User reviews in "Approval Gate" before any action
 */

// Query to get all tailored assets for a user
export const getTailoredAssets = query({
    args: {
        status: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        // Dev mode: use fallback user ID if not authenticated
        const userId = identity?.subject || "dev-user-1";

        if (args.status) {
            return await ctx.db
                .query("tailoredAssets")
                .withIndex("by_status", (q) => q.eq("userId", userId).eq("status", args.status!))
                .order("desc")
                .take(50);
        }

        return await ctx.db
            .query("tailoredAssets")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .order("desc")
            .take(50);
    },
});

// Query to get tailored asset for a specific job
export const getAssetForJob = query({
    args: { jobId: v.id("jobs") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("tailoredAssets")
            .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
            .first();
    },
});

// ============================================
// THE CORE "ANALYZE JOB" ACTION
// ============================================

// Mutation to start job analysis
export const analyzeJobStart = mutation({
    args: {
        jobDescription: v.string(),
        jobTitle: v.optional(v.string()),
        company: v.optional(v.string()),
        jobUrl: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const userId = identity?.subject || "dev-user-1";

        // Get user's master resume
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
            .first();

        if (!user?.masterResume) {
            throw new Error("Please add your master resume first in Profile settings");
        }

        // Create job entry
        const jobId = await ctx.db.insert("jobs", {
            userId,
            title: args.jobTitle || "Job Analysis",
            company: args.company || "Unknown Company",
            location: "Not specified",
            description: args.jobDescription,
            url: args.jobUrl || "",
            source: "manual",
            matchScore: 0,
            status: "saved",
            discoveredAt: Date.now(),
        });

        // Schedule the AI analysis
        await ctx.scheduler.runAfter(0, internal.jobHunter.runAnalysis, {
            jobId,
            userId,
            jobDescription: args.jobDescription,
            masterResume: user.masterResume,
            targetRoles: user.targetRoles || [],
        });

        return jobId;
    },
});

// Internal action - The AI "Brain"
export const runAnalysis = internalAction({
    args: {
        jobId: v.id("jobs"),
        userId: v.string(),
        jobDescription: v.string(),
        masterResume: v.string(),
        targetRoles: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            await ctx.runMutation(internal.jobHunter.saveAnalysisError, {
                jobId: args.jobId,
                error: "GEMINI_API_KEY not configured",
            });
            return;
        }

        try {
            const prompt = `### SYSTEM ROLE
You are the "Anti-Gravity" Career Architect—an Elite Technical Recruiter and Forensic Resume Analyst. Your goal is to re-engineer a Candidate's Base Resume to perfectly align with a specific Job Description (JD).

### THE PRIME DIRECTIVE
You must "twist" the narrative to make the Candidate look like the specific solution to the company's problems, BUT you must strictly adhere to the truth. 
1. NO HALLUCINATIONS: Do not invent skills, job titles, or companies. 
2. NO NEW DATES: You cannot change employment dates to hide gaps.
3. STRATEGIC REFRAMING: You are allowed to rename "Generic Titles" to "Functional Titles" IF the experience supports it (e.g., changing "Developer" to "Backend Scalability Engineer" if the user focused on scaling).

### STYLE & TONE RULES
- VOCABULARY BAN LIST: Strictly do not use these words: "Delve," "Tapestry," "Landscape," "Fostered," "Spearheaded," "Honed," "Passionate," "Crucial," "Meticulous."
- POWER VERBS: Use high-velocity commercial verbs: "Architected," "Deployed," "Engineered," "Reduced," "Accelerated," "Orchestrated," "Revamped."
- TONE: Professional, authoritative, and result-oriented.

### JOB DESCRIPTION (TARGET):
${args.jobDescription}

### CANDIDATE'S BASE RESUME:
${args.masterResume}

### EXECUTION STEPS
1. PAIN POINT ANALYSIS: Identify the top 3 technical or business problems mentioned or implied in the JD.
2. EVIDENCE MINING: Scan the Base Resume for any experience (even minor) that solves those problems.
3. THE TWIST: Rewrite the resume bullet points to focus 80% on those specific matching experiences. Move non-relevant points to the bottom or delete them.
4. ATS OPTIMIZATION: Mirror the exact keywords from the JD. If JD says "GCP" and Resume says "Google Cloud," change it to "GCP (Google Cloud)."

### REQUIRED OUTPUT FORMAT (JSON ONLY)
{
  "matchScore": <Integer 0-100 based on alignment>,
  "gapAnalysis": "<Detailed analysis of what's missing and key changes made>",
  "missingSkills": ["skill1", "skill2", "skill3"],
  "tailoredSummary": "<3 sentences: Identity + The Hook (Specific relevant win) + The Solution (How I solve your pain point)>",
  "tailoredResume": "<Full markdown resume with: Header (Name, Target Title optimized for JD), Skills section, Experience section with Action + Context + Result bullets>",
  "dmDraft": "<Max 280 chars. Pattern-interrupt style: 'I saw you need [Skill]. I just built [Project] using [Skill] that handled [Metric]. Let's chat.'>",
  "coverLetter": "<3 Paragraphs. Tone: Peer-to-Peer expert. Focus: 'I have done X before, so I can solve Y for you now.'>",
  "emailSubject": "<Short & punchy subject line>",
  "identifiedPainPoints": ["Pain Point 1", "Pain Point 2", "Pain Point 3"],
  "keyChangesLog": ["What was twisted and why"]
}

OUTPUT ONLY VALID JSON. NO MARKDOWN OUTSIDE STRINGS.`;

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite-001:generateContent?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ role: "user", parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 4096,
                            responseMimeType: "application/json"
                        },
                    }),
                }
            );

            const data = await response.json();

            // Check for API errors
            if (data.error) {
                console.error("Gemini API Error:", data.error);
                throw new Error(`Gemini API Error: ${data.error.message || JSON.stringify(data.error)}`);
            }

            const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            // console.log("Gemini Response:", textContent); // Uncomment for debugging

            // Parse JSON response
            let analysis;
            try {
                // remove markdown code blocks if present
                const cleanText = textContent.replace(/```json/g, "").replace(/```/g, "").trim();
                analysis = JSON.parse(cleanText);
            } catch (parseError) {
                console.error("Failed to parse JSON:", textContent);
                // Try to extract JSON from text
                const jsonMatch = textContent.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        analysis = JSON.parse(jsonMatch[0]);
                    } catch (e: any) {
                        throw new Error(`Failed to parse extracted JSON: ${e.message}. Raw: ${textContent.substring(0, 200)}...`);
                    }
                } else {
                    throw new Error(`Could not parse AI response as JSON. Raw length: ${textContent.length}. Content: ${textContent.substring(0, 200)}...`);
                }
            }

            // Save the analysis
            await ctx.runMutation(internal.jobHunter.saveAnalysis, {
                jobId: args.jobId,
                userId: args.userId,
                matchScore: analysis.matchScore || 50,
                gapAnalysis: analysis.gapAnalysis || "Analysis pending",
                missingSkills: analysis.missingSkills || [],
                tailoredSummary: analysis.tailoredSummary || "",
                tailoredResume: analysis.tailoredResume || args.masterResume,
                dmDraft: analysis.dmDraft || "",
                coverLetter: analysis.coverLetter || "",
            });

        } catch (error: any) {
            // Generate fallback results when AI fails (quota exceeded, etc)
            console.error("AI analysis failed, generating fallback:", error.message);

            // Extract key info from job description for basic tailoring
            const jobKeywords = args.jobDescription.substring(0, 500);

            await ctx.runMutation(internal.jobHunter.saveAnalysis, {
                jobId: args.jobId,
                userId: args.userId,
                matchScore: 75,
                gapAnalysis: `AI analysis temporarily unavailable (${error.message.includes("quota") ? "rate limit" : "error"}). Based on your resume, you appear to be a strong candidate. Review the tailored materials below and customize as needed.`,
                missingSkills: ["Review job posting for specific requirements"],
                tailoredSummary: "Experienced professional with relevant skills matching this opportunity. Review and customize the generated materials for best results.",
                tailoredResume: args.masterResume,
                dmDraft: `Hi! I noticed your posting and believe my background aligns well with what you're looking for. I'd love to connect and discuss how I can contribute to your team. Looking forward to hearing from you!`,
                coverLetter: `Dear Hiring Manager,

I am writing to express my strong interest in this position. After reviewing the job requirements, I am confident that my skills and experience make me an excellent candidate.

${args.masterResume.substring(0, 500)}...

I am excited about the opportunity to contribute to your team and would welcome the chance to discuss my qualifications further.

Thank you for considering my application.

Best regards`,
            });
        }
    },
});

// Internal mutation to save analysis results
export const saveAnalysis = internalMutation({
    args: {
        jobId: v.id("jobs"),
        userId: v.string(),
        matchScore: v.number(),
        gapAnalysis: v.string(),
        missingSkills: v.array(v.string()),
        tailoredSummary: v.string(),
        tailoredResume: v.string(),
        dmDraft: v.string(),
        coverLetter: v.string(),
    },
    handler: async (ctx, args) => {
        // Update job with match score
        await ctx.db.patch(args.jobId, { matchScore: args.matchScore });

        // Create tailored assets
        await ctx.db.insert("tailoredAssets", {
            userId: args.userId,
            jobId: args.jobId,
            matchScore: args.matchScore,
            gapAnalysis: args.gapAnalysis,
            missingSkills: args.missingSkills,
            tailoredResume: args.tailoredResume,
            tailoredSummary: args.tailoredSummary,
            dmDraft: args.dmDraft,
            coverLetter: args.coverLetter,
            status: "pending_review",
            createdAt: Date.now(),
        });
    },
});

// Internal mutation to save error
export const saveAnalysisError = internalMutation({
    args: {
        jobId: v.id("jobs"),
        error: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.jobId, {
            notes: `Analysis error: ${args.error}`,
        });
    },
});

// ============================================
// APPROVAL GATE - Human in the Loop
// ============================================

// Approve tailored assets
export const approveAsset = mutation({
    args: {
        assetId: v.id("tailoredAssets"),
        editedResume: v.optional(v.string()),
        editedDm: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        // Allow dev mode without auth

        const updates: any = {
            status: "approved",
            approvedAt: Date.now(),
        };

        // Allow user edits
        if (args.editedResume) updates.tailoredResume = args.editedResume;
        if (args.editedDm) updates.dmDraft = args.editedDm;

        await ctx.db.patch(args.assetId, updates);

        // Also update job status to "queued"
        const asset = await ctx.db.get(args.assetId);
        if (asset) {
            await ctx.db.patch(asset.jobId, { status: "queued" });
        }
    },
});

// Reject tailored assets
export const rejectAsset = mutation({
    args: { assetId: v.id("tailoredAssets") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        // Allow dev mode without auth

        await ctx.db.patch(args.assetId, { status: "rejected" });
    },
});

// Update master resume
export const updateMasterResume = mutation({
    args: {
        resume: v.string(),
        bio: v.optional(v.string()),
        targetRoles: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();

        // Dev mode: use hardcoded user ID if not authenticated (Updated: 2026-02-05 12:45)
        const userId = identity?.subject || "dev-user-1";

        let user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
            .first();

        // Auto-create user if doesn't exist (dev mode)
        if (!user) {
            const newUserId = await ctx.db.insert("users", {
                clerkId: userId,
                email: "dev@jobhunter.app",
                name: "Dev User",
                masterResume: args.resume,
                bio: args.bio || "",
                targetRoles: args.targetRoles || [],
                createdAt: Date.now(),
            });
            return newUserId;
        }

        const updates: any = { masterResume: args.resume };
        if (args.bio) updates.bio = args.bio;
        if (args.targetRoles) updates.targetRoles = args.targetRoles;
        await ctx.db.patch(user._id, updates);
        return user._id;
    },
});

// Get user profile with master resume
export const getUserProfile = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        const userId = identity?.subject || "dev-user-1";

        return await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
            .first();
    },
});
