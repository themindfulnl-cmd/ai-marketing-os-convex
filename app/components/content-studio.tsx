"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, FileText, Send, Download } from "lucide-react";

import { useEffect } from "react";

interface ContentStudioProps {
    preFilledPrompt?: string;
    onClearPrompt?: () => void;
}

export default function ContentStudio({ preFilledPrompt, onClearPrompt }: ContentStudioProps) {
    const generate = useAction(api.actions.generateContent);
    const createEbook = useAction(api.actions.generateEbook);

    const [prompt, setPrompt] = useState("");
    const [format, setFormat] = useState("blog");

    useEffect(() => {
        if (preFilledPrompt) {
            setPrompt(preFilledPrompt);
        }
    }, [preFilledPrompt]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentDraftId, setCurrentDraftId] = useState<Id<"drafts"> | null>(null);
    const [error, setError] = useState<string | null>(null);

    const draft = useQuery(api.queries.getDraft, currentDraftId ? { id: currentDraftId } : "skip");

    const handleGenerate = async () => {
        if (!prompt) return;
        setIsGenerating(true);
        setCurrentDraftId(null);
        setError(null);
        try {
            const result = await generate({ prompt, format });
            setCurrentDraftId(result.draftId);
        } catch (e: any) {
            console.error(e);
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownloadEbook = async () => {
        if (!draft) return;
        const url = await createEbook({ title: draft.title, content: draft.content });
        if (url) {
            window.open(url, '_blank');
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="premium-card space-y-8"
        >
            <div className="space-y-6">
                <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                    <Sparkles className="h-5 w-5 text-amber-500" />
                    <h2 className="text-2xl font-bold tracking-tight">Content Studio</h2>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="block text-sm font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Campaign Objective</label>
                        {preFilledPrompt && onClearPrompt && (
                            <button
                                onClick={onClearPrompt}
                                className="text-[10px] bg-blue-500/10 text-blue-500 px-2 py-1 rounded-md font-bold uppercase tracking-wider hover:bg-blue-500/20 transition-all"
                            >
                                Clear Trend Context
                            </button>
                        )}
                    </div>
                    <textarea
                        className="w-full p-4 border rounded-xl min-h-[120px] bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all resize-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 leading-relaxed"
                        placeholder="Example: 'Write a blog post about the benefits of AI in small business marketing...'"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                    />
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-3">
                        <label className="block text-sm font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Output Format</label>
                        <div className="flex flex-wrap p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 gap-1">
                            {[
                                { id: 'blog', label: 'Blog' },
                                { id: 'tweet', label: 'Tweet' },
                                { id: 'carousel', label: 'Carousel' },
                                { id: 'reel', label: 'Reel' },
                                { id: 'flyer', label: 'Flyer' },
                                { id: 'ig_caption', label: 'IG Caption' },
                                { id: 'viral_hooks', label: 'Viral Hooks' },
                                { id: 'ebook', label: 'Ebook' }
                            ].map((f) => (
                                <button
                                    key={f.id}
                                    onClick={() => setFormat(f.id)}
                                    className={`relative px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${format === f.id
                                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700'
                                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                                        }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:grayscale shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                    >
                        {isGenerating ? (
                            <>
                                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>Thinking...</span>
                            </>
                        ) : (
                            <>
                                <Send className="h-4 w-4" />
                                <span>Architect Content</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-medium flex items-center gap-3"
                    >
                        <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0"></div>
                        <p className="flex-grow">{error}</p>
                        <button
                            onClick={() => setError(null)}
                            className="text-[10px] uppercase font-black tracking-widest opacity-60 hover:opacity-100 transition-opacity"
                        >
                            Dismiss
                        </button>
                    </motion.div>
                )}

                {(draft || isGenerating) && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="border-t border-zinc-100 dark:border-zinc-800 pt-8"
                    >
                        {isGenerating && (
                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center animate-pulse">
                                        <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="h-4 w-32 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse"></div>
                                        <div className="h-3 w-48 bg-zinc-50 dark:bg-zinc-900 rounded animate-pulse"></div>
                                    </div>
                                </div>
                                <div className="h-48 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 animate-pulse"></div>
                            </div>
                        )}

                        {draft && !isGenerating && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="space-y-6"
                            >
                                <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-lg bg-white dark:bg-zinc-800 flex items-center justify-center border shadow-sm">
                                            <FileText className="h-5 w-5 text-blue-500" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{draft.title}</h3>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Generated Asset</p>
                                        </div>
                                    </div>
                                    {draft.format === 'ebook' && (
                                        <button
                                            onClick={handleDownloadEbook}
                                            className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-lg text-sm font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                                        >
                                            <Download className="h-4 w-4" />
                                            Export PDF
                                        </button>
                                    )}
                                </div>
                                <div className="p-6 bg-white dark:bg-zinc-950 border rounded-xl text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-loose shadow-sm text-base">
                                    {draft.content}
                                </div>
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
