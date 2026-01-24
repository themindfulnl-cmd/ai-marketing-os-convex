"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import { TrendingUp, Target, Zap, DollarSign, Users, BarChart3, Instagram, Hash, Sparkles } from "lucide-react";
import { useState } from "react";

export default function GrowthDashboard() {
    const trendingContent = useQuery(api.queries.getTrendingContent);
    const allTrends = useQuery(api.queries.getTrends);
    const instagramMetrics = useQuery(api.queries.getGrowthMetrics, { platform: "instagram" });
    const tiktokMetrics = useQuery(api.queries.getGrowthMetrics, { platform: "tiktok" });
    const sales = useQuery(api.queries.getSales);

    const [selectedPlatform, setSelectedPlatform] = useState<"instagram" | "tiktok" | "both">("both");

    // Calculate stats
    const currentFollowers = (instagramMetrics?.[0]?.followers || 124) + (tiktokMetrics?.[0]?.followers || 0);
    const followerGoal = 1_000_000;
    const progressPercentage = Math.min((currentFollowers / followerGoal) * 100, 100);

    const totalRevenue = sales?.reduce((sum: number, sale: { amount: number }) => sum + sale.amount, 0) || 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Growth Dashboard</h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Track your path to 1M followers</p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setSelectedPlatform("instagram")}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${selectedPlatform === "instagram"
                            ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                            }`}
                    >
                        <Instagram className="h-4 w-4 inline mr-1" />
                        Instagram
                    </button>
                    <button
                        onClick={() => setSelectedPlatform("tiktok")}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${selectedPlatform === "tiktok"
                            ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                            }`}
                    >
                        <Zap className="h-4 w-4 inline mr-1" />
                        TikTok
                    </button>
                    <button
                        onClick={() => setSelectedPlatform("both")}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${selectedPlatform === "both"
                            ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                            }`}
                    >
                        Combined
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Follower Progress */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="premium-card"
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2 rounded-lg bg-indigo-500/10">
                            <Target className="h-5 w-5 text-indigo-500" />
                        </div>
                        <span className="text-xs font-bold text-indigo-500">{progressPercentage.toFixed(1)}%</span>
                    </div>
                    <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{currentFollowers.toLocaleString()}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">/ 1M goal</p>
                    <div className="mt-3 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>
                </motion.div>

                {/* Revenue */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="premium-card"
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                            <DollarSign className="h-5 w-5 text-emerald-500" />
                        </div>
                        <span className="text-xs font-bold text-emerald-500">+32%</span>
                    </div>
                    <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">€{totalRevenue.toLocaleString()}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Total revenue</p>
                </motion.div>

                {/* Engagement */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="premium-card"
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <BarChart3 className="h-5 w-5 text-blue-500" />
                        </div>
                        <span className="text-xs font-bold text-blue-500">+15%</span>
                    </div>
                    <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{((instagramMetrics?.[0]?.avgEngagementRate || 0) * 100).toFixed(1)}%</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Avg engagement</p>
                </motion.div>

                {/* Viral Trends */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="premium-card"
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2 rounded-lg bg-orange-500/10">
                            <TrendingUp className="h-5 w-5 text-orange-500" />
                        </div>
                        <span className="text-xs font-bold text-orange-500">Live</span>
                    </div>
                    <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{trendingContent?.length || 0}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Trending topics</p>
                </motion.div>
            </div>

            {/* Viral Trends Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Trending Now */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="premium-card"
                >
                    <div className="flex items-center gap-2 mb-4">
                        <Sparkles className="h-5 w-5 text-amber-500" />
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Trending Now</h2>
                        <span className="ml-auto text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 font-bold">
                            {trendingContent?.length || 0} topics
                        </span>
                    </div>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                        {trendingContent === undefined ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="animate-pulse">
                                    <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-3/4 mb-2" />
                                    <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-1/2" />
                                </div>
                            ))
                        ) : trendingContent.length === 0 ? (
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 italic text-center py-8">
                                No trending topics yet. Run the daily trend scanner!
                            </p>
                        ) : (
                            trendingContent.map((trend: { _id: string; headline: string; platform?: string; category?: string }, idx: number) => (
                                <motion.div
                                    key={trend._id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 hover:border-amber-200 dark:hover:border-amber-900/50 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-all group cursor-pointer"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1">
                                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                                {trend.headline}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
                                                    {trend.platform}
                                                </span>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-medium">
                                                    {trend.category}
                                                </span>
                                            </div>
                                        </div>
                                        <TrendingUp className="h-4 w-4 text-amber-500 flex-shrink-0" />
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </motion.div>

                {/* All Trends */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="premium-card"
                >
                    <div className="flex items-center gap-2 mb-4">
                        <Hash className="h-5 w-5 text-blue-500" />
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Latest Trends</h2>
                        <span className="ml-auto text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-500 font-bold">
                            Multi-platform
                        </span>
                    </div>

                    <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                        {allTrends === undefined ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="animate-pulse h-12 bg-zinc-100 dark:bg-zinc-800 rounded" />
                            ))
                        ) : allTrends.length === 0 ? (
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 italic text-center py-8">
                                No trends found. The scanner runs daily at noon UTC.
                            </p>
                        ) : (
                            allTrends.map((trend: { _id: string; headline: string; platform?: string; category?: string }) => (
                                <div
                                    key={trend._id}
                                    className="p-2.5 rounded-lg border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-all group"
                                >
                                    <p className="text-sm text-zinc-900 dark:text-zinc-100 line-clamp-1 font-medium">
                                        {trend.headline}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 uppercase font-bold">
                                            {trend.platform || "web"}
                                        </span>
                                        <span className="text-[9px] text-zinc-400">•</span>
                                        <span className="text-[9px] text-zinc-500 dark:text-zinc-400">
                                            {trend.category}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
