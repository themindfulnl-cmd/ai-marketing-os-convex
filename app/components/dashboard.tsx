"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import { TrendingUp, MessageSquare, ExternalLink, Instagram } from "lucide-react";

interface DashboardProps {
    onTrendAction?: (headline: string) => void;
}

export default function Dashboard({ onTrendAction }: DashboardProps) {
    const trends = useQuery(api.queries.getTrends);
    const drafts = useQuery(api.queries.getDrafts);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Trends */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="premium-card flex flex-col"
            >
                <div className="flex items-center gap-2 mb-6 text-zinc-900 dark:text-zinc-100">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                    <h2 className="text-xl font-bold">Market Trends</h2>
                </div>

                <div className="space-y-4 flex-grow overflow-y-auto pr-2 custom-scrollbar max-h-[450px]">
                    {trends === undefined ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="space-y-2 animate-pulse mb-4">
                                <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-3/4"></div>
                                <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-1/2"></div>
                            </div>
                        ))
                    ) : trends.length === 0 ? (
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm italic">No trends found. Scanning daily...</p>
                    ) : (
                        trends.map((trend: { _id: string; url: string; headline: string; category?: string; sentiment_score: number }, idx: number) => (
                            <motion.div
                                key={trend._id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="group p-3 rounded-lg border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-all"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <a href={trend.url} target="_blank" rel="noopener noreferrer" className="font-medium text-sm text-zinc-900 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-6 line-clamp-2">
                                        {trend.headline}
                                    </a>
                                    <ExternalLink className="h-3 w-3 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400" />
                                </div>
                                <div className="mt-2 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tighter ring-1 transition-colors ${trend.category?.includes('AI') ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 ring-blue-100 dark:ring-blue-900/50' :
                                            trend.category?.includes('Parenting') ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 ring-emerald-100 dark:ring-emerald-900/50' :
                                                'bg-zinc-50 dark:bg-zinc-900/20 text-zinc-600 dark:text-zinc-400 ring-zinc-100 dark:ring-zinc-900/50'
                                            }`}>
                                            {trend.category || "General"}
                                        </span>
                                        <span className="text-[10px] text-zinc-400 font-medium whitespace-nowrap">
                                            Sentiment: {trend.sentiment_score}
                                        </span>
                                    </div>

                                    {onTrendAction && (
                                        <button
                                            onClick={() => onTrendAction(trend.headline)}
                                            className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-black uppercase transition-all hover:scale-105 active:scale-95"
                                        >
                                            <Instagram className="h-3 w-3" />
                                            Architect IG
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </motion.div>

            {/* Drafts */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="premium-card flex flex-col"
            >
                <div className="flex items-center gap-2 mb-6 text-zinc-900 dark:text-zinc-100">
                    <MessageSquare className="h-5 w-5 text-emerald-500" />
                    <h2 className="text-xl font-bold">Content Drafts</h2>
                </div>

                <div className="space-y-4 flex-grow overflow-y-auto pr-2 custom-scrollbar max-h-[450px]">
                    {drafts === undefined ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="space-y-2 animate-pulse mb-4">
                                <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-1/4"></div>
                                <div className="h-12 bg-zinc-100 dark:bg-zinc-800 rounded w-full"></div>
                            </div>
                        ))
                    ) : drafts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
                                <MessageSquare className="h-6 w-6 text-zinc-400" />
                            </div>
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm">No drafts generated yet.</p>
                        </div>
                    ) : (
                        drafts.map((draft: { _id: string; title?: string; format: string; content: string; status: string }, idx: number) => (
                            <motion.div
                                key={draft._id}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-sm"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate pr-4" title={draft.title || "Untitled"}>
                                        {draft.title || "Untitled"}
                                    </h3>
                                    <span className="text-[10px] bg-white dark:bg-zinc-900 border px-1.5 py-0.5 rounded font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">
                                        {draft.format}
                                    </span>
                                </div>
                                <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed italic">
                                    "{draft.content}"
                                </p>
                                <div className="mt-3 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <div className={`h-1.5 w-1.5 rounded-full ${draft.status === 'generated' ? 'bg-emerald-500' : 'bg-zinc-400'}`}></div>
                                        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase">{draft.status}</span>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </motion.div>
        </div>
    );
}
