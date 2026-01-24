"use client";

import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import React, { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from "next/navigation";
import { toPng } from 'html-to-image';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function WeeklyPlannerPage() {
    return (
        <Suspense fallback={<div className="p-10 text-center">Loading planner...</div>}>
            <PlannerContent />
        </Suspense>
    );
}

function PlannerContent() {
    const [currentWeek] = useState(() => {
        const now = new Date();
        const year = now.getFullYear();
        const week = Math.ceil((now.getDate() + new Date(year, 0, 1).getDay()) / 7);
        return `${year}-W${week.toString().padStart(2, "0")}`;
    });

    const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
    const [expandedSection, setExpandedSection] = useState<string | null>(null);

    // Get ALL topics for this week
    const suggestedTopics = useQuery(api.weeklyPlanner.getWeeklyTopics, {
        weekOf: currentWeek,
        status: "suggested",
    });

    // Get content strategy if topic is selected
    const strategy = useQuery(
        api.weeklyPlanner.getContentStrategy,
        selectedTopicId ? { topicId: selectedTopicId as any } : "skip"
    );

    // Get approved sections - prioritize week from current strategy
    const approvedSections = useQuery(api.weeklyPlanner.getApprovedSections, {
        weekOf: strategy?.weekOf || currentWeek,
    });

    // Actions
    const discoverTopics = useAction(api.weeklyPlanner.discoverWeeklyTopics);
    const selectTopic = useMutation(api.weeklyPlanner.selectTopic);
    const generateStrategy = useAction(api.weeklyPlanner.generateContentStrategy);
    const approveSection = useMutation(api.weeklyPlanner.approveSection);
    const resetApprovals = useMutation(api.cleanup.resetAllApprovals);
    const generateImage = useAction(api.imagen.generateImage);
    const getCanvaAuthUrl = useAction(api.canva.getAuthUrl);
    const sendToCanva = useAction(api.canva.sendToCanva);
    const exchangeCanvaToken = useAction(api.canva.exchangeToken);
    const isCanvaConnected = useQuery(api.canva.isConnected, { userId: "default-user" });

    // Get URL search params for OAuth callback
    const searchParams = useSearchParams();
    const router = useRouter();

    const [isDiscovering, setIsDiscovering] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState<string | null>(null);
    const [generatedImages, setGeneratedImages] = useState<Record<string, string>>({});
    const [isSendingToCanva, setIsSendingToCanva] = useState<string | null>(null);
    const [isExchangingToken, setIsExchangingToken] = useState(false);

    // For generating design snapshots
    const [designPreview, setDesignPreview] = useState<{ type: string; content: any; imageUrl?: string } | null>(null);
    const designRef = useRef<HTMLDivElement>(null);

    // Handle Canva OAuth callback
    // Handle Canva OAuth callback
    const processedCodeRef = useRef<string | null>(null);

    useEffect(() => {
        const canvaCode = searchParams.get("canva_code");
        const canvaState = searchParams.get("canva_state");
        const error = searchParams.get("error");

        if (error) {
            alert(`Canva connection error: ${error}`);
            // Clear error from URL
            router.replace("/planner");
            return;
        }

        if (canvaCode && canvaState && !isExchangingToken) {
            // Prevent double-processing the same code (React Strict Mode fix)
            if (processedCodeRef.current === canvaCode) {
                return;
            }
            processedCodeRef.current = canvaCode;

            setIsExchangingToken(true);

            // Exchange the code for tokens
            exchangeCanvaToken({ code: canvaCode, state: canvaState })
                .then((result) => {
                    if (result.success) {
                        alert("✅ Canva connected successfully! You can now send content to Canva.");
                    }
                    // Clear the URL params
                    router.replace("/planner");
                })
                .catch((err) => {
                    console.error("Token exchange failed:", err);
                    alert(`Failed to connect Canva: ${err.message}`);
                    router.replace("/planner");
                })
                .finally(() => {
                    setIsExchangingToken(false);
                });
        }
    }, [searchParams, exchangeCanvaToken, router, isExchangingToken]);

    const handleDiscoverTopics = async () => {
        setIsDiscovering(true);
        try {
            await discoverTopics({ weekOf: currentWeek });
        } finally {
            setIsDiscovering(false);
        }
    };

    const handleSelectTopic = async (topicId: string) => {
        await selectTopic({ topicId: topicId as any });
        setSelectedTopicId(topicId);

        // Automatically generate strategy
        setIsGenerating(true);
        try {
            await generateStrategy({ topicId: topicId as any });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleApproveSection = async (section: string) => {
        if (strategy?._id) {
            await approveSection({ strategyId: strategy._id, section });
        }
    };

    const handleResetDatabase = async () => {
        if (confirm("Reset all approvals? This will clear the approved section.")) {
            await resetApprovals({});
            alert("Database reset! Approved section is now empty.");
        }
    };

    const toggleSection = (section: string) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    const handleGenerateImage = async (section: string, prompt: string) => {
        if (!strategy?._id) return;

        setIsGeneratingImage(section);
        try {
            const result = await generateImage({
                prompt,
                aspectRatio: section === "instagram" ? "1:1" : "16:9",
                contentType: section,
                strategyId: strategy._id,
            });

            if (result.success) {
                setGeneratedImages(prev => ({
                    ...prev,
                    [section]: result.imageUrl,
                }));
            }
        } catch (error) {
            console.error("Image generation failed:", error);
        } finally {
            setIsGeneratingImage(null);
        }
    };

    const handleConnectCanva = async () => {
        try {
            const result = await getCanvaAuthUrl({ userId: "default-user" });
            window.location.href = result.authUrl;
        } catch (error) {
            console.error("Failed to get Canva auth URL:", error);
            alert("Failed to connect to Canva. Check console for details.");
        }
    };

    const downloadCSV = (section: { type: string; content: any }) => {
        let csvContent = "";
        let filename = "";

        if (section.type === "instagram" && Array.isArray(section.content)) {
            // Headers
            const headers = ["Day", "Type", "Title", "Hook", "Caption", "Hashtags", "ImagePrompt"];
            csvContent += headers.join(",") + "\n";

            // Rows
            section.content.forEach((post: any) => {
                const row = [
                    post.day,
                    post.type,
                    `"${post.title.replace(/"/g, '""')}"`, // Escape quotes
                    `"${post.hook.replace(/"/g, '""')}"`,
                    `"${post.caption.replace(/"/g, '""')}"`,
                    `"${post.hashtags.join(" ")}"`,
                    `"${post.imagePrompt?.replace(/"/g, '""') || ""}"`
                ];
                csvContent += row.join(",") + "\n";
            });
            filename = `instagram_bulk_create_${currentWeek}.csv`;
        } else if (section.type === "etsy" && Array.isArray(section.content)) {
            const headers = ["Name", "Price", "Description", "SEO Tags"];
            csvContent += headers.join(",") + "\n";
            section.content.forEach((item: any) => {
                const row = [
                    `"${item.name.replace(/"/g, '""')}"`,
                    item.price,
                    `"${item.description.replace(/"/g, '""')}"`,
                    `"${item.seoTags.join(" ")}"`
                ];
                csvContent += row.join(",") + "\n";
            });
            filename = `etsy_bulk_create_${currentWeek}.csv`;
        } else {
            alert("Bulk export is best for Instagram and Etsy lists. For single items, use 'Send to Canva'.");
            return;
        }

        // Trigger Download
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            link.style.visibility = "hidden";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleSendToCanva = async (section: { type: string; content: any }) => {
        if (!isCanvaConnected) {
            alert("Please connect to Canva first using the button in the header.");
            return;
        }

        setIsSendingToCanva(section.type);
        try {
            // Check for generated image for this content type
            const imageUrl = generatedImages[section.type] || undefined;

            // Prepare text to copy to clipboard
            let textToCopy = "";
            if (section.type === "instagram" && Array.isArray(section.content)) {
                textToCopy = `${section.content[0].title}\n\n${section.content[0].caption}\n\n${section.content[0].hashtags.map((h: string) => `#${h}`).join(" ")}`;
            } else if (section.type === "blog") {
                textToCopy = `${section.content.title}\n\n${section.content.outline.join("\n")}`;
            } else if (section.type === "ebook") {
                textToCopy = `${section.content.title}\n\n${section.content.outline.join("\n")}`;
            } else if (section.type === "etsy" && Array.isArray(section.content)) {
                textToCopy = `${section.content[0].name}\n\n${section.content[0].description}`;
            }

            // Copy to clipboard
            if (textToCopy) {
                await navigator.clipboard.writeText(textToCopy);
            }

            // GENERATE DESIGN SNAPSHOT
            // Set preview data to trigger hidden render
            setDesignPreview({ type: section.type, content: section.content, imageUrl });

            // Wait for render (100ms)
            await new Promise(resolve => setTimeout(resolve, 100));

            let snapshotDataUrl = imageUrl; // Fallback to raw AI image if snapshot fails

            if (designRef.current) {
                try {
                    // Generate PNG from the hidden design element
                    snapshotDataUrl = await toPng(designRef.current, { cacheBust: true });
                } catch (snapErr) {
                    console.error("Snapshot failed:", snapErr);
                }
            }

            const result = await sendToCanva({
                userId: "default-user",
                contentType: section.type,
                content: section.content,
                imageUrl: snapshotDataUrl, // Send the composed design snapshot!
            });

            if (result.success) {
                // Open Canva editor in new tab
                window.open(result.editUrl, "_blank");
                alert(`✅ Design created!\n\n📋 Content copied to clipboard (Cmd+V to paste as text)\n🖼️ Full Design Layout uploaded to "Uploads" tab - drag it onto the canvas!`);
            }
        } catch (error: any) {
            console.error("Failed to send to Canva:", error);
            alert(`Failed to send to Canva: ${error.message || "Unknown error"}`);
        } finally {
            setIsSendingToCanva(null);
            setDesignPreview(null); // Clean up
        }
    };

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            {/* Header */}
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Weekly Planning Hub</h1>
                    <p className="text-muted-foreground mt-2">
                        AI-powered workflow: Discover → Plan → Approve
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant={isCanvaConnected ? "default" : "outline"}
                        onClick={handleConnectCanva}
                        className={isCanvaConnected ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                        {isCanvaConnected ? "✅ Canva Connected" : "🎨 Connect Canva"}
                    </Button>
                    <Button variant="outline" onClick={handleResetDatabase}>Reset DB</Button>
                    <Link href="/dashboard">
                        <Button variant="outline">Back to Dashboard</Button>
                    </Link>
                </div>
            </div>

            {/* MAIN GRID LAYOUT */}
            <div className="grid grid-cols-3 gap-6">

                {/* LEFT COLUMN: Topic Discovery */}
                <div className="col-span-1 space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">🔍 Viral Topics</CardTitle>
                            <CardDescription className="text-xs">AI-discovered trending topics</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {!suggestedTopics || suggestedTopics.length === 0 ? (
                                <Button
                                    onClick={handleDiscoverTopics}
                                    disabled={isDiscovering}
                                    size="sm"
                                    className="w-full"
                                >
                                    {isDiscovering ? "🔄 Scanning..." : "🚀 Discover Topics"}
                                </Button>
                            ) : (
                                <>
                                    {suggestedTopics.map((topic: { _id: string; topic: string; viralScore: number; source: string; targetAudience: string; revenuePotential: string; category: string }) => (
                                        <Card
                                            key={topic._id}
                                            className={`cursor-pointer transition-all ${selectedTopicId === topic._id
                                                ? "border-primary shadow-md"
                                                : "hover:border-gray-400"
                                                }`}
                                            onClick={() => handleSelectTopic(topic._id)}
                                        >
                                            <CardContent className="p-3">
                                                <div className="space-y-2">
                                                    <div className="flex gap-1 flex-wrap">
                                                        <Badge variant="default" className="text-xs">
                                                            {topic.viralScore}/100
                                                        </Badge>
                                                        <Badge variant="outline" className="text-xs">
                                                            {topic.source}
                                                        </Badge>
                                                    </div>
                                                    <h4 className="font-medium text-sm leading-tight">{topic.topic}</h4>
                                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                                        {topic.targetAudience}
                                                    </p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                    <Button
                                        onClick={handleDiscoverTopics}
                                        variant="outline"
                                        size="sm"
                                        className="w-full"
                                    >
                                        🔄 Refresh Topics
                                    </Button>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* MIDDLE COLUMN: Content Strategy by Type - FULL CONTENT */}
                <div className="col-span-1 space-y-3 max-h-[85vh] overflow-y-auto">
                    {!selectedTopicId ? (
                        <Card className="h-full flex items-center justify-center">
                            <CardContent className="text-center p-8">
                                <div className="text-4xl mb-3">👈</div>
                                <p className="text-muted-foreground text-sm">Select a topic to see the full weekly strategy</p>
                            </CardContent>
                        </Card>
                    ) : isGenerating ? (
                        <Card>
                            <CardContent className="p-6 text-center">
                                <div className="text-2xl mb-3">🤖 Generating...</div>
                                <p className="text-sm text-muted-foreground">Creating your complete strategy</p>
                            </CardContent>
                        </Card>
                    ) : strategy ? (
                        <>
                            {/* 1. INSTAGRAM SECTION - EXPANDABLE WITH FULL CONTENT */}
                            <Card className={strategy.instagramApproved ? "border-green-500 bg-green-50/30" : ""}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 flex-1">
                                            <CardTitle className="text-sm font-semibold">📱 Instagram</CardTitle>
                                            <Badge variant="secondary" className="text-xs">
                                                {strategy.instagramContent.length} posts
                                            </Badge>
                                            {strategy.instagramApproved && (
                                                <Badge className="text-xs bg-green-600">✓ Approved</Badge>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => toggleSection("instagram")}
                                                className="h-7 text-xs"
                                            >
                                                {expandedSection === "instagram" ? "Collapse" : "Expand"}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleGenerateImage("instagram", strategy.instagramContent?.[0]?.title || "Instagram post for mindful parenting")}
                                                disabled={isGeneratingImage === "instagram"}
                                                className="h-7 text-xs"
                                            >
                                                {isGeneratingImage === "instagram" ? "⏳ Generating..." : "🖼️ Generate Image"}
                                            </Button>
                                            {!strategy.instagramApproved && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleApproveSection("instagram")}
                                                    className="h-7 text-xs bg-green-600 hover:bg-green-700"
                                                >
                                                    ✓ Approve
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {expandedSection === "instagram" ? (
                                        // FULL CONTENT - All 7 posts with complete captions
                                        strategy.instagramContent.map((post: any, idx: number) => (
                                            <div key={idx} className="bg-gray-100/80 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Badge variant="outline" className="text-xs">
                                                        {post.day}
                                                    </Badge>
                                                    <Badge className="text-xs">{post.type}</Badge>
                                                    <Badge variant="secondary" className="text-xs ml-auto">
                                                        {post.goal}
                                                    </Badge>
                                                </div>
                                                <h4 className="font-semibold text-sm mb-1">{post.title}</h4>
                                                <p className="text-xs font-medium mb-1 text-blue-600">{post.hook}</p>
                                                <p className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-2">
                                                    {post.caption}
                                                </p>
                                                <div className="flex gap-1 flex-wrap">
                                                    {post.hashtags.map((tag: string) => (
                                                        <span key={tag} className="text-xs text-blue-600 dark:text-blue-400">
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        // SUMMARY VIEW
                                        <div className="text-xs text-muted-foreground">
                                            Click "Expand" to see all 7 posts with full captions, hooks, and hashtags
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* 2. BLOG POST SECTION - EXPANDABLE WITH FULL CONTENT */}
                            {strategy.blogPost && (
                                <Card className={strategy.blogApproved ? "border-green-500 bg-green-50/30" : ""}>
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 flex-1">
                                                <CardTitle className="text-sm font-semibold">📝 Blog Post</CardTitle>
                                                <Badge variant="secondary" className="text-xs">
                                                    {strategy.blogPost.targetWordCount} words
                                                </Badge>
                                                {strategy.blogApproved && (
                                                    <Badge className="text-xs bg-green-600">✓ Approved</Badge>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => toggleSection("blog")}
                                                    className="h-7 text-xs"
                                                >
                                                    {expandedSection === "blog" ? "Collapse" : "Expand"}
                                                </Button>
                                                {!strategy.blogApproved && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleApproveSection("blog")}
                                                        className="h-7 text-xs bg-green-600 hover:bg-green-700"
                                                    >
                                                        ✓ Approve
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-xs font-medium mb-2">{strategy.blogPost.title}</p>
                                        {expandedSection === "blog" ? (
                                            // FULL CONTENT - Complete outline
                                            <>
                                                <div className="text-xs mb-2">
                                                    <strong>Complete Outline:</strong>
                                                    <ol className="list-decimal list-inside mt-1 space-y-1">
                                                        {strategy.blogPost.outline.map((item: string, idx: number) => (
                                                            <li key={idx} className="text-muted-foreground">{item}</li>
                                                        ))}
                                                    </ol>
                                                </div>
                                                <div className="text-xs mb-2">
                                                    <strong>SEO Keywords:</strong>
                                                    <div className="flex gap-1 flex-wrap mt-1">
                                                        {strategy.blogPost.seoKeywords.map((keyword: string) => (
                                                            <span key={keyword} className="bg-blue-100 px-2 py-0.5 rounded text-xs">
                                                                {keyword}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                {strategy.blogPost.leadMagnet && (
                                                    <Badge variant="default" className="text-xs">
                                                        🎁 {strategy.blogPost.leadMagnet}
                                                    </Badge>
                                                )}
                                            </>
                                        ) : (
                                            <div className="text-xs text-muted-foreground">
                                                Click "Expand" to see full outline, SEO keywords, and lead magnet
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {/* 3. EBOOK CHAPTER SECTION */}
                            {strategy.ebookChapter && (
                                <Card className={strategy.ebookApproved ? "border-green-500 bg-green-50/30" : ""}>
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 flex-1">
                                                <CardTitle className="text-sm font-semibold">📖 Ebook Chapter</CardTitle>
                                                <Badge variant="secondary" className="text-xs">
                                                    Ch. {strategy.ebookChapter.chapterNumber}
                                                </Badge>
                                                {strategy.ebookApproved && (
                                                    <Badge className="text-xs bg-green-600">✓ Approved</Badge>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => toggleSection("ebook")}
                                                    className="h-7 text-xs"
                                                >
                                                    {expandedSection === "ebook" ? "Collapse" : "Expand"}
                                                </Button>
                                                {!strategy.ebookApproved && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleApproveSection("ebook")}
                                                        className="h-7 text-xs bg-green-600 hover:bg-green-700"
                                                    >
                                                        ✓ Approve
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-xs font-medium mb-2">{strategy.ebookChapter.title}</p>
                                        {expandedSection === "ebook" ? (
                                            <>
                                                <div className="text-xs mb-2">
                                                    <strong>Full Outline:</strong>
                                                    <ol className="list-decimal list-inside mt-1 space-y-1">
                                                        {strategy.ebookChapter.outline.map((item: string, idx: number) => (
                                                            <li key={idx} className="text-muted-foreground">{item}</li>
                                                        ))}
                                                    </ol>
                                                </div>
                                                <div className="text-xs">
                                                    <strong>Worksheets:</strong>
                                                    <div className="flex gap-1 flex-wrap mt-1">
                                                        {strategy.ebookChapter.worksheets.map((worksheet: string, idx: number) => (
                                                            <Badge key={idx} variant="outline" className="text-xs">
                                                                📄 {worksheet}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-xs text-muted-foreground">
                                                Click "Expand" to see full outline and worksheets
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {/* 4. ETSY PRODUCTS SECTION */}
                            <Card className={strategy.etsyApproved ? "border-green-500 bg-green-50/30" : ""}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 flex-1">
                                            <CardTitle className="text-sm font-semibold">🛍️ Etsy Products</CardTitle>
                                            <Badge variant="secondary" className="text-xs">
                                                {strategy.etsyProducts.length} items
                                            </Badge>
                                            {strategy.etsyApproved && (
                                                <Badge className="text-xs bg-green-600">✓ Approved</Badge>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => toggleSection("etsy")}
                                                className="h-7 text-xs"
                                            >
                                                {expandedSection === "etsy" ? "Collapse" : "Expand"}
                                            </Button>
                                            {!strategy.etsyApproved && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleApproveSection("etsy")}
                                                    className="h-7 text-xs bg-green-600 hover:bg-green-700"
                                                >
                                                    ✓ Approve
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {expandedSection === "etsy" ? (
                                        strategy.etsyProducts.map((product: any, idx: number) => (
                                            <div key={idx} className="bg-gray-100/80 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                                                <div className="flex justify-between items-start mb-1">
                                                    <h4 className="font-medium text-xs flex-1">{product.name}</h4>
                                                    <Badge className="ml-2 text-xs">€{product.price}</Badge>
                                                </div>
                                                <p className="text-xs text-gray-800 dark:text-gray-200 mb-2">
                                                    {product.description}
                                                </p>
                                                <div className="text-xs">
                                                    <strong>SEO Tags:</strong>
                                                    <div className="flex gap-1 flex-wrap mt-1">
                                                        {product.seoTags.map((tag: string) => (
                                                            <span key={tag} className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-xs text-muted-foreground">
                                            Click "Expand" to see all products with descriptions and SEO tags
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* 5. AFFILIATE PRODUCTS SECTION */}
                            <Card className={strategy.affiliatesApproved ? "border-green-500 bg-green-50/30" : ""}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 flex-1">
                                            <CardTitle className="text-sm font-semibold">🤝 Affiliate Products</CardTitle>
                                            <Badge variant="secondary" className="text-xs">
                                                {strategy.affiliateProducts.length} links
                                            </Badge>
                                            {strategy.affiliatesApproved && (
                                                <Badge className="text-xs bg-green-600">✓ Approved</Badge>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => toggleSection("affiliates")}
                                                className="h-7 text-xs"
                                            >
                                                {expandedSection === "affiliates" ? "Collapse" : "Expand"}
                                            </Button>
                                            {!strategy.affiliatesApproved && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleApproveSection("affiliates")}
                                                    className="h-7 text-xs bg-green-600 hover:bg-green-700"
                                                >
                                                    ✓ Approve
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {expandedSection === "affiliates" ? (
                                        strategy.affiliateProducts.map((product: any, idx: number) => (
                                            <div key={idx} className="bg-gray-100/80 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                                                <div className="flex items-start justify-between mb-1">
                                                    <h4 className="font-medium text-xs flex-1">{product.productName}</h4>
                                                    <Badge variant="outline" className="text-xs ml-2">
                                                        {product.platform}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-gray-700 dark:text-gray-300 mb-1">
                                                    {product.link}
                                                </p>
                                                <p className="text-xs text-gray-800 dark:text-gray-200">
                                                    <strong>Mention in:</strong> {product.mentionIn.join(", ")}
                                                </p>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-xs text-muted-foreground">
                                            Click "Expand" to see all products with links and placement strategy
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    ) : null}
                </div>

                {/* RIGHT COLUMN: Approved Sections Only */}
                <div className="col-span-1 space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">✅ Approved Content</CardTitle>
                            <CardDescription className="text-xs">Ready for Canva automation</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!approvedSections || approvedSections.length === 0 ? (
                                <div className="text-center py-8">
                                    <div className="text-4xl mb-2">📋</div>
                                    <p className="text-xs text-muted-foreground">
                                        No approved content yet.
                                        <br />
                                        Approve sections from the middle column!
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {approvedSections.map((section: any) => (
                                        <Card key={`${section.id}-${section.type}`} className="border-green-200 bg-green-50/50">
                                            <CardContent className="p-3">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="default" className="text-xs bg-green-600">
                                                            {section.type === "instagram" && "📱"}
                                                            {section.type === "blog" && "📝"}
                                                            {section.type === "ebook" && "📖"}
                                                            {section.type === "etsy" && "🛍️"}
                                                            {section.type === "affiliates" && "🤝"}
                                                        </Badge>
                                                        <span className="text-xs font-semibold capitalize">{section.type}</span>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        {(section.type === "instagram" || section.type === "etsy") && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-7 text-xs px-2"
                                                                onClick={() => downloadCSV(section)}
                                                                title="Export CSV for Canva Bulk Create"
                                                            >
                                                                📂 CSV
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 text-xs"
                                                            onClick={() => handleSendToCanva(section)}
                                                            disabled={isSendingToCanva === section.type || !isCanvaConnected}
                                                        >
                                                            {isSendingToCanva === section.type
                                                                ? "⏳ Creating..."
                                                                : isCanvaConnected
                                                                    ? "🎨 Send to Canva"
                                                                    : "🔗 Connect Canva first"}
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {section.type === "instagram" && `${section.content.length} posts`}
                                                    {section.type === "blog" && `${section.content.targetWordCount} words`}
                                                    {section.type === "ebook" && `Chapter ${section.content.chapterNumber}`}
                                                    {section.type === "etsy" && `${section.content.length} products`}
                                                    {section.type === "affiliates" && `${section.content.length} links`}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}                        </CardContent>
                    </Card>
                </div>
            </div>
            {/* Hidden Design Generator */}
            <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
                {designPreview && (
                    <div
                        ref={designRef}
                        style={{
                            width: designPreview.type === "instagram" ? "1080px" : "1200px",
                            height: designPreview.type === "instagram" ? "1080px" : "630px",
                            padding: "60px",
                            background: designPreview.imageUrl
                                ? `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url(${designPreview.imageUrl})`
                                : "linear-gradient(135deg, #fdfbf7 0%, #e2e8f0 100%)",
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            fontFamily: "Inter, sans-serif",
                            color: designPreview.imageUrl ? "white" : "#1a1a1a",
                            textAlign: "center",
                        }}
                    >
                        {/* Branding */}
                        <div style={{
                            position: "absolute",
                            top: "40px",
                            left: "40px",
                            fontSize: "24px",
                            fontWeight: "bold",
                            letterSpacing: "0.05em",
                            opacity: 0.8
                        }}>
                            THE MINDFUL NL
                        </div>

                        {/* Content */}
                        <div style={{ maxWidth: "80%" }}>
                            {/* Title */}
                            <h1 style={{
                                fontSize: "72px",
                                fontWeight: "800",
                                lineHeight: "1.2",
                                marginBottom: "30px",
                                textShadow: designPreview.imageUrl ? "0 4px 12px rgba(0,0,0,0.5)" : "none"
                            }}>
                                {designPreview.type === "instagram" && designPreview.content[0]?.title}
                                {designPreview.type === "blog" && designPreview.content.title}
                                {designPreview.type === "ebook" && `Chapter ${designPreview.content.chapterNumber}`}
                            </h1>

                            {/* Subtitle / Caption snippet */}
                            <p style={{
                                fontSize: "32px",
                                lineHeight: "1.5",
                                opacity: 0.9,
                                textShadow: designPreview.imageUrl ? "0 2px 4px rgba(0,0,0,0.5)" : "none"
                            }}>
                                {designPreview.type === "instagram" && designPreview.content[0]?.caption.substring(0, 150) + "..."}
                                {designPreview.type === "blog" && "Read the full guide on our blog."}
                                {designPreview.type === "ebook" && designPreview.content.title}
                            </p>
                        </div>

                        {/* Footer */}
                        <div style={{
                            position: "absolute",
                            bottom: "40px",
                            fontSize: "24px",
                            fontWeight: "500",
                            opacity: 0.7
                        }}>
                            @themindfulnl
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}
