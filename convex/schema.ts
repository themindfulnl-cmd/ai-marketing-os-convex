import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Existing: Knowledge base documents
  documents: defineTable({
    text: v.string(),
    metadata: v.any(),
    embedding: v.array(v.float64()),
  }).vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 768,
  }),

  // Enhanced: Viral trends from multiple platforms
  trends: defineTable({
    headline: v.string(),
    url: v.string(),
    sentiment_score: v.number(),
    category: v.optional(v.string()),
    platform: v.optional(v.string()), // "tiktok", "pinterest", "reddit", "linkedin", "etsy", "yoga"
    engagementScore: v.optional(v.number()), // 1-100
    trending: v.optional(v.boolean()),
    hashtags: v.optional(v.array(v.string())),
    contentFormat: v.optional(v.string()), // "reel", "carousel", "post", "video"
  }).index("by_platform", ["platform"])
    .index("by_trending", ["trending"])
    .index("by_category", ["category"]),

  // Enhanced: Content drafts with platform targeting
  drafts: defineTable({
    title: v.string(),
    content: v.string(),
    format: v.string(), // "reel", "carousel", "post", "tiktok", "blog", "ebook", "printable"
    status: v.string(), // "generated", "approved", "posted", "archived"
    platform: v.optional(v.string()), // "instagram", "tiktok", "both"
    hashtags: v.optional(v.array(v.string())),
    hook: v.optional(v.string()),
    visualUrl: v.optional(v.string()), // Canva/Bannerbear generated image
    performanceEstimate: v.optional(v.number()), // AI-predicted engagement score
  }).index("by_status", ["status"])
    .index("by_format", ["format"])
    .index("by_platform", ["platform"]),

  // Existing: Weekly content plans
  plans: defineTable({
    days: v.array(v.object({
      day: v.number(),
      topic: v.string(),
      format: v.string(),
      hook: v.string(),
      rationale: v.string(),
    })),
    status: v.string(), // "suggested" | "accepted"
    weekStarting: v.string(),
  }),

  // NEW: Digital products for multi-platform sales
  products: defineTable({
    name: v.string(),
    description: v.string(),
    type: v.string(), // "printable", "ebook", "template", "course", "bundle"
    price: v.number(),
    fileUrl: v.optional(v.string()), // Storage URL
    coverImageUrl: v.optional(v.string()),
    platforms: v.array(v.string()), // ["etsy", "gumroad", "teachable"]
    status: v.string(), // "draft", "published", "archived"
    tags: v.optional(v.array(v.string())),
    createdBy: v.string(), // "ai" or "manual"
  }).index("by_type", ["type"])
    .index("by_status", ["status"]),

  // NEW: Sales tracking across platforms
  sales: defineTable({
    productId: v.id("products"),
    platform: v.string(), // "etsy", "gumroad", "amazon", etc.
    amount: v.number(),
    currency: v.string(),
    customerEmail: v.optional(v.string()),
    saleDate: v.number(), // timestamp
  }).index("by_product", ["productId"])
    .index("by_platform", ["platform"])
    .index("by_date", ["saleDate"]),

  // NEW: Affiliate products database
  affiliateProducts: defineTable({
    name: v.string(),
    description: v.string(),
    category: v.string(), // "book", "toy", "course", "tool"
    affiliateLink: v.string(),
    platform: v.string(), // "amazon", "bol.com", "shareasale"
    commission: v.number(), // percentage
    imageUrl: v.optional(v.string()),
    relevantTopics: v.array(v.string()), // For AI matching
  }).index("by_category", ["category"])
    .index("by_platform", ["platform"]),

  // NEW: Affiliate performance tracking
  affiliateClicks: defineTable({
    productId: v.id("affiliateProducts"),
    contentId: v.optional(v.id("drafts")),
    platform: v.string(), // "instagram", "tiktok", "blog"
    clicks: v.number(),
    conversions: v.number(),
    revenue: v.number(),
    date: v.number(), // timestamp
  }).index("by_product", ["productId"])
    .index("by_content", ["contentId"])
    .index("by_date", ["date"]),

  // NEW: Content performance tracking
  contentPerformance: defineTable({
    contentId: v.id("drafts"),
    platform: v.string(),
    posted: v.boolean(),
    postedDate: v.optional(v.number()),
    reach: v.optional(v.number()),
    likes: v.optional(v.number()),
    comments: v.optional(v.number()),
    saves: v.optional(v.number()),
    shares: v.optional(v.number()),
    engagementRate: v.optional(v.number()),
  }).index("by_content", ["contentId"])
    .index("by_platform", ["platform"]),

  // NEW: Growth metrics tracking
  growthMetrics: defineTable({
    platform: v.string(), // "instagram", "tiktok"
    followers: v.number(),
    following: v.number(),
    posts: v.number(),
    avgEngagementRate: v.number(),
    date: v.number(), // timestamp
  }).index("by_platform", ["platform"])
    .index("by_date", ["date"]),

  // MARKETING OS: Weekly topic suggestions
  weeklyTopics: defineTable({
    topic: v.string(),
    viralScore: v.number(), // 1-100
    source: v.string(), // "tiktok", "pinterest", "reddit", "forums"
    targetAudience: v.string(),
    revenuePotential: v.string(), // "low", "medium", "high"
    category: v.string(), // "breathing", "tantrums", "sleep", "yoga"
    suggestedWeek: v.string(), // "2026-W04"
    status: v.string(), // "suggested", "selected", "completed", "archived"
    selectedDate: v.optional(v.number()),
  }).index("by_status", ["status"])
    .index("by_week", ["suggestedWeek"])
    .index("by_viral_score", ["viralScore"]),

  // MARKETING OS: Complete weekly content strategy
  contentStrategy: defineTable({
    topicId: v.id("weeklyTopics"),
    weekOf: v.string(), // "2026-W04"
    status: v.string(), // "draft", "approved", "active", "completed"

    // Individual section approval tracking
    instagramApproved: v.optional(v.boolean()),
    blogApproved: v.optional(v.boolean()),
    ebookApproved: v.optional(v.boolean()),
    etsyApproved: v.optional(v.boolean()),
    affiliatesApproved: v.optional(v.boolean()),


    // Instagram content (7 posts)
    instagramContent: v.array(v.object({
      day: v.string(), // "monday", "tuesday"
      type: v.string(), // "reel", "carousel", "post", "story"
      title: v.string(),
      caption: v.string(),
      hook: v.string(),
      hashtags: v.array(v.string()),
      canvaTemplateId: v.optional(v.string()),
      canvaDesignUrl: v.optional(v.string()),
      goal: v.string(), // "reach", "engagement", "saves"
    })),

    // Blog strategy
    blogPost: v.optional(v.object({
      title: v.string(),
      outline: v.array(v.string()),
      seoKeywords: v.array(v.string()),
      targetWordCount: v.number(),
      leadMagnet: v.optional(v.string()),
    })),

    // Ebook chapter
    ebookChapter: v.optional(v.object({
      chapterNumber: v.number(),
      title: v.string(),
      outline: v.array(v.string()),
      worksheets: v.array(v.string()),
    })),

    // Etsy products
    etsyProducts: v.array(v.object({
      name: v.string(),
      type: v.string(), // "printable", "worksheet", "chart"
      description: v.string(),
      price: v.number(),
      seoTags: v.array(v.string()),
    })),

    // Affiliate products
    affiliateProducts: v.array(v.object({
      productName: v.string(),
      link: v.string(),
      platform: v.string(),
      mentionIn: v.array(v.string()), // ["blog", "instagram_monday_story"]
    })),

    approvedBy: v.optional(v.string()),
    approvedDate: v.optional(v.number()),
  }).index("by_topic", ["topicId"])
    .index("by_week", ["weekOf"])
    .index("by_status", ["status"]),

  // MARKETING OS: Lead generation forms (yoga class signups)
  leadForms: defineTable({
    name: v.string(),
    email: v.string(),
    childAge: v.optional(v.number()),
    preferredDay: v.optional(v.string()),
    classType: v.string(), // "parent-child", "kids-only", "workshop"
    source: v.string(), // "instagram", "blog", "landing_page"
    contentId: v.optional(v.id("drafts")), // Which content brought them in
    status: v.string(), // "new", "contacted", "registered", "not_interested"
    submittedDate: v.number(),
    notes: v.optional(v.string()),
  }).index("by_status", ["status"])
    .index("by_source", ["source"])
    .index("by_date", ["submittedDate"]),

  // IMAGE GENERATION: AI-generated images from Imagen 3
  generatedImages: defineTable({
    prompt: v.string(),
    imageUrl: v.string(), // Base64 or storage URL
    aspectRatio: v.string(), // "1:1", "16:9", "9:16"
    style: v.optional(v.string()), // "photorealistic", "illustration", "soft"
    contentType: v.string(), // "instagram", "blog", "ebook", "etsy"
    strategyId: v.optional(v.id("contentStrategy")),
    status: v.string(), // "generated", "approved", "used"
    createdAt: v.number(),
  }).index("by_strategy", ["strategyId"])
    .index("by_status", ["status"])
    .index("by_content_type", ["contentType"]),

  // CANVA: OAuth tokens for Canva Connect API
  canvaTokens: defineTable({
    userId: v.string(), // User identifier
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(), // timestamp
    scope: v.string(),
  }).index("by_user", ["userId"]),
  // AGENTFLOW MOBILE: User sessions for Clerk integration (ENHANCED for Job Hunter)
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    // Job Hunter additions
    masterResume: v.optional(v.string()), // Markdown resume
    bio: v.optional(v.string()), // Professional bio
    targetRoles: v.optional(v.array(v.string())), // ["AI Engineer", "ML Lead"]
    createdAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  // AGENTFLOW MOBILE: Chat messages for AI agent
  chatMessages: defineTable({
    userId: v.string(), // Clerk ID
    role: v.string(), // "user" | "assistant"
    content: v.string(),
    timestamp: v.number(),
    isTyping: v.optional(v.boolean()),
  }).index("by_user", ["userId"])
    .index("by_timestamp", ["timestamp"]),

  // ============================================
  // LINKEDIN CAREER AGENT TABLES
  // ============================================

  // Job listings discovered by the agent
  jobs: defineTable({
    userId: v.string(),
    title: v.string(),
    company: v.string(),
    location: v.string(),
    description: v.string(),
    salary: v.optional(v.string()),
    url: v.string(),
    source: v.string(), // "linkedin", "indeed", "glassdoor", "manual"
    matchScore: v.number(), // 0-100
    status: v.string(), // "new" | "queued" | "applied" | "interview" | "rejected" | "offer"
    appliedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    recruiterName: v.optional(v.string()),
    recruiterLinkedIn: v.optional(v.string()),
    discoveredAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_status", ["userId", "status"])
    .index("by_match_score", ["userId", "matchScore"]),

  // User resumes (master + tailored versions)
  resumes: defineTable({
    userId: v.string(),
    name: v.string(), // "Master Resume" or job-specific name
    content: v.string(), // Markdown format
    atsScore: v.optional(v.number()), // 0-100
    targetJobId: v.optional(v.id("jobs")),
    keywords: v.optional(v.array(v.string())), // Extracted keywords
    isMaster: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_job", ["targetJobId"]),

  // Outreach drafts for recruiters
  outreachDrafts: defineTable({
    userId: v.string(),
    jobId: v.id("jobs"),
    type: v.string(), // "linkedin_dm" | "email" | "connection_request"
    recruiterName: v.optional(v.string()),
    subject: v.optional(v.string()), // For emails
    body: v.string(),
    status: v.string(), // "draft" | "sent" | "replied"
    sentAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_job", ["jobId"])
    .index("by_user", ["userId"]),

  // LinkedIn posts for personal branding
  linkedinPosts: defineTable({
    userId: v.string(),
    content: v.string(),
    topic: v.string(), // "career", "tech", "ai", "leadership"
    hook: v.optional(v.string()),
    scheduledFor: v.optional(v.number()),
    postedAt: v.optional(v.number()),
    status: v.string(), // "draft" | "scheduled" | "posted"
    engagementMetrics: v.optional(v.object({
      likes: v.number(),
      comments: v.number(),
      shares: v.number(),
      impressions: v.number(),
    })),
    createdAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_status", ["userId", "status"])
    .index("by_schedule", ["scheduledFor"]),

  // User profile for job matching
  userProfile: defineTable({
    userId: v.string(),
    targetRoles: v.array(v.string()), // ["AI Engineer", "ML Engineer"]
    targetCompanies: v.optional(v.array(v.string())),
    skills: v.array(v.string()),
    experience: v.string(), // "junior", "mid", "senior", "lead"
    preferredLocations: v.optional(v.array(v.string())),
    salaryExpectation: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    portfolioUrl: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // ============================================
  // JOB HUNTER BLUEPRINT TABLES
  // ============================================

  // Tailored assets per job application (Blueprint: tailored_assets)
  tailoredAssets: defineTable({
    userId: v.string(),
    jobId: v.id("jobs"),
    // AI-generated analysis
    matchScore: v.number(), // 0-100
    gapAnalysis: v.string(), // Missing skills/experience
    missingSkills: v.optional(v.array(v.string())),
    // Generated assets
    tailoredResume: v.string(), // Markdown
    tailoredSummary: v.string(), // 2-3 sentence tailored pitch
    dmDraft: v.string(), // Connection request message
    coverLetter: v.optional(v.string()),
    // Review workflow
    status: v.string(), // "pending_review" | "approved" | "rejected"
    approvedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_job", ["jobId"])
    .index("by_status", ["userId", "status"]),

  // Content ideas for personal branding (Blueprint: content_ideas)
  contentIdeas: defineTable({
    userId: v.string(),
    topic: v.string(),
    sourceUrl: v.optional(v.string()),
    // 3 post variations per blueprint
    technicalDraft: v.string(), // Technical Deep Dive
    strategicDraft: v.string(), // Strategic Insight
    networkingDraft: v.string(), // Networking Hook
    // Selected/edited version
    selectedVariant: v.optional(v.string()), // "technical" | "strategic" | "networking"
    editedContent: v.optional(v.string()), // User's edited version
    // Workflow
    status: v.string(), // "draft" | "approved" | "posted"
    postedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_status", ["userId", "status"]),

  // Trending topics feed
  trendingTopics: defineTable({
    topic: v.string(),
    category: v.string(), // "tech", "ai", "career", "industry"
    sourceUrl: v.optional(v.string()),
    viralScore: v.number(), // 1-100
    description: v.optional(v.string()),
    fetchedAt: v.number(),
  }).index("by_category", ["category"])
    .index("by_viral_score", ["viralScore"]),

});

