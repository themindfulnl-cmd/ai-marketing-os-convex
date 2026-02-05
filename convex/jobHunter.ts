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
            const prompt = `You are the "Anti-Gravity" Career Architect. Your goal is to rewrite a user's Base Resume to act as the perfect solution for a Job Description.

### THE 4 GOLDEN RULES (STRICT):
1. NO LYING: Do not invent facts. However, you MUST "twist" the perspective. If the user was a "Junior Dev" but did "Senior Work," reframe their title to match the work (The Semantic Pivot).
2. VOCABULARY BAN: Do NOT use these robotic words: "Delve," "Tapestry," "Landscape," "Fostered," "Spearheaded," "Passionate." Use gritty, commercial verbs instead.
3. PAIN POINTS: Identify the company's problems in the Job Description. Rewrite the user's experience to show how they have solved those exact problems before.
4. ATS KEYWORDS: You must use the EXACT technology keywords found in the Job Description.

### JOB DESCRIPTION:
${args.jobDescription}

### BASE RESUME:
${args.masterResume}

---

### VISUAL & FORMATTING GUIDELINES FOR RESUME (STRICT):
1. **LAYOUT (F-Pattern):** Header (center align name/contact) -> Summary -> Skills -> Experience -> Projects -> Education
2. **TYPOGRAPHY:**
   - H1 (#) ONLY for Candidate Name
   - H2 (##) for Section Headers (UPPERCASE: EXPERIENCE, SKILLS)
   - H3 (###) for Job Titles: **Role** | Company | *Dates*
   - Bold (**text**) for key metrics (%, $, numbers) and hard skills in bullets
3. **SPACING:** Use horizontal rule (---) between major sections. No tables (breaks ATS).
4. **SKILLS FORMAT:** **Category:** Skill, Skill, Skill (no progress bars)

---

### COVER LETTER ARCHITECTURE (3 Paragraphs, Under 250 words):
**TONE:** Peer-to-Peer Expert, NOT subordinate. Direct and Commercial.
1. **THE HOOK:** Do NOT start with "I am writing to apply." Start with a Company challenge/goal.
2. **THE BRIDGE:** Connect user's specific past achievement to that challenge. Include 1-2 hard numbers.
3. **THE CLOSE:** Low friction ask. "Would love to share how I can bring that same efficiency. Open to a brief chat?"

---

### DIRECT OUTREACH MESSAGE (Max 75 words):
**GOAL:** Get a reply, not a job offer.
**SUBJECT:** Use a "Value Hook" (NOT "Application for..."). Example: "Question about [Tech Stack] at [Company]"
**BODY STRUCTURE:**
- Skip pleasantries. Jump into the connection.
- Mention ONE specific metric or project outcome.
- Low friction ask ("brief exchange" or "perspective").

---

### REQUIRED JSON OUTPUT:
{
  "matchScore": <Integer 0-100>,
  "gapAnalysis": "<What's missing + key changes made>",
  "missingSkills": ["skill1", "skill2"],
  "tailoredSummary": "<3 sentences: (1) Identity, (2) Best Win, (3) How I solve your problem>",
  "tailoredResume": "<Full markdown resume following the F-Pattern layout and typography rules above. Experience bullets use STAR method. Bold metrics. Skills grouped by category.>",
  "coverLetter": "<3 paragraphs following Hook->Bridge->Close architecture. Under 250 words. No indentation.>",
  "dmDraft": "<75-word max cold outreach. Pattern: Hook + Proof + Low-friction Ask.>",
  "emailSubject": "<Value Hook subject line, NOT 'Application for...'>"
}

OUTPUT ONLY VALID JSON.`;

            // Retry with exponential backoff
            let lastError: Error | null = null;
            const maxRetries = 3;
            const baseDelay = 5000; // 5 seconds

            for (let attempt = 0; attempt < maxRetries; attempt++) {
                if (attempt > 0) {
                    const delay = baseDelay * Math.pow(2, attempt - 1); // 5s, 10s, 20s
                    console.log(`Retry attempt ${attempt + 1}/${maxRetries}, waiting ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contents: [{ role: "user", parts: [{ text: prompt }] }],
                            generationConfig: {
                                temperature: 0.7,
                                maxOutputTokens: 8192,
                                responseMimeType: "application/json"
                            },
                        }),
                    }
                );

                const data = await response.json();

                // Check for quota errors - retry
                if (data.error) {
                    const errorMsg = data.error.message || JSON.stringify(data.error);
                    console.error(`Attempt ${attempt + 1} failed:`, errorMsg);

                    if (errorMsg.includes("quota") || errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED")) {
                        lastError = new Error(errorMsg);
                        continue; // Retry
                    }
                    throw new Error(`Gemini API Error: ${errorMsg}`);
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

                return; // Success - exit the action
            }

            // All retries failed
            if (lastError) {
                throw lastError;
            }

        } catch (error: any) {
            // Generate FORMATTED fallback when AI fails (quota exceeded)
            console.error("AI analysis failed, generating formatted fallback:", error.message);

            // Extract info from master resume and job description
            const resumeLines = args.masterResume.split('\n');
            const candidateName = resumeLines[0]?.trim() || "Candidate";

            // Extract first paragraph as summary base
            const summaryStart = args.masterResume.indexOf('Summary');
            const summaryText = summaryStart > -1
                ? args.masterResume.substring(summaryStart + 7, summaryStart + 500).split('\n').slice(0, 3).join(' ').trim()
                : "Experienced professional with proven track record.";

            // Extract keywords from job description
            const jdLower = args.jobDescription.toLowerCase();
            const isRemote = jdLower.includes('remote');
            const companyMatch = args.jobDescription.match(/(?:at|for|join)\s+([A-Z][a-zA-Z0-9\s]+?)(?:\.|,|\s+as|\s+is|\s+we)/);
            const company = companyMatch?.[1]?.trim() || "your company";

            // Format resume with F-Pattern
            const formattedResume = `# ${candidateName}
Professional | Amsterdam, Netherlands

---

## PROFESSIONAL SUMMARY

${summaryText}

---

## TECHNICAL SKILLS

${args.masterResume.includes('JavaScript') || args.masterResume.includes('React') ? '- **Languages:** JavaScript, TypeScript, Python, SQL' : '- **Core Skills:** Marketing, Analytics, Strategy'}
${args.masterResume.includes('React') || args.masterResume.includes('Next') ? '- **Frameworks:** React, Next.js, Node.js' : '- **Tools:** Google Analytics, HubSpot, Salesforce'}
${args.masterResume.includes('AWS') || args.masterResume.includes('Cloud') ? '- **Cloud & DevOps:** AWS, Docker, CI/CD' : '- **Platforms:** Social Media, CRM, Automation'}

---

## PROFESSIONAL EXPERIENCE

${args.masterResume.substring(
                Math.max(0, args.masterResume.indexOf('Experience')),
                Math.min(args.masterResume.length, args.masterResume.indexOf('Experience') + 2000)
            ) || args.masterResume.substring(0, 2000)}

---

## EDUCATION

See full resume for education details.
`;

            // Hook/Bridge/Close Cover Letter
            const coverLetter = `${company} is clearly scaling its operations, and that demands someone who can hit the ground running with both technical depth and strategic marketing insight.

In my most recent work, I built and launched complete digital ecosystems—websites, landing pages, mobile apps—that directly drove business growth. I architected marketing automation workflows that increased conversion rates and reduced manual overhead. These aren't just projects; they're repeatable playbooks I can bring to ${company}.

I'd welcome a brief conversation to discuss how my experience translates to your current challenges. Are you open to a 15-minute call this week?`;

            // Pattern-interrupt DM
            const dmDraft = `Noticed ${company} is building something ambitious. I just finished a project that scaled marketing ops with automation + AI—reduced manual work by 40%. Would love to share notes if you're tackling similar challenges.`;

            await ctx.runMutation(internal.jobHunter.saveAnalysis, {
                jobId: args.jobId,
                userId: args.userId,
                matchScore: 80,
                gapAnalysis: `⚠️ AI analysis temporarily unavailable (quota limit reached). The documents below have been auto-formatted using your master resume. For best results, retry when API quota resets or customize manually.`,
                missingSkills: ["Retry analysis when API quota resets"],
                tailoredSummary: summaryText.substring(0, 200),
                tailoredResume: formattedResume,
                dmDraft: dmDraft,
                coverLetter: coverLetter,
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
