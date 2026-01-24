"use client";

import { useState } from "react";
import { useAction, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Sparkles, CheckCircle2, ChevronRight, BrainCircuit, Loader2 } from "lucide-react";

export default function WeeklyPlanner() {
    const suggest = useAction(api.planner.suggestWeeklyPlan);
    const accept = useMutation(api.planner.acceptPlan);
    const plan = useQuery(api.planner.getLatestPlan);

    const [isPlanning, setIsPlanning] = useState(false);

    const handleSuggest = async () => {
        setIsPlanning(true);
        try {
            await suggest({});
        } catch (e) {
            console.error(e);
        } finally {
            setIsPlanning(false);
        }
    };

    const handleAccept = async () => {
        if (!plan) return;
        await accept({ id: plan._id });
    };

    const isAccepted = plan?.status === "accepted";

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="premium-card overflow-hidden"
        >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                        <Calendar className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Smart Weekly Planner</h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">AI-driven strategy based on current market trends.</p>
                    </div>
                </div>

                <button
                    onClick={handleSuggest}
                    disabled={isPlanning}
                    className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-3 rounded-xl font-bold text-sm shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 group"
                >
                    {isPlanning ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <BrainCircuit className="h-4 w-4 group-hover:rotate-12 transition-transform" />
                    )}
                    <span>{plan ? "Refresh Strategy" : "Generate Strategy"}</span>
                </button>
            </div>

            <AnimatePresence mode="wait">
                {!plan && !isPlanning ? (
                    <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="py-20 flex flex-col items-center text-center space-y-4 bg-zinc-50/50 dark:bg-zinc-900/20 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800"
                    >
                        <Sparkles className="h-12 w-12 text-zinc-300 dark:text-zinc-700" />
                        <div className="max-w-xs">
                            <h3 className="font-bold text-zinc-900 dark:text-zinc-100">No active strategy</h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Let the AI scan parenting trends and draft your week.</p>
                        </div>
                    </motion.div>
                ) : isPlanning ? (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-4"
                    >
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-24 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl animate-pulse"></div>
                        ))}
                    </motion.div>
                ) : (
                    <motion.div
                        key="plan"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-6"
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {plan?.days.map((day: { day: number; topic: string; format: string; hook: string }, idx: number) => (
                                <motion.div
                                    key={day.day}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className={`relative p-5 rounded-2xl border transition-all ${isAccepted
                                        ? 'bg-white dark:bg-zinc-950 border-emerald-100 dark:border-emerald-900/30'
                                        : 'bg-zinc-50/50 dark:bg-zinc-900/20 border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/30'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Day {day.day}</span>
                                        <span className="px-1.5 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-[9px] font-bold text-zinc-600 dark:text-zinc-400 uppercase">
                                            {day.format}
                                        </span>
                                    </div>
                                    <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 mb-2 leading-snug">{day.topic}</h4>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-3 italic">"{day.hook}"</p>
                                </motion.div>
                            ))}
                            <div className="hidden lg:flex items-center justify-center p-5 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400">
                                <ChevronRight className="h-6 w-6" />
                            </div>
                        </div>

                        <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${isAccepted ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                    {isAccepted ? <CheckCircle2 className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                                </div>
                                <div>
                                    <span className="block text-xs font-bold uppercase tracking-widest text-zinc-400">Status</span>
                                    <span className={`text-sm font-bold ${isAccepted ? 'text-emerald-500' : 'text-amber-500'}`}>
                                        {isAccepted ? "Finalized Strategy" : "Awaiting Approval"}
                                    </span>
                                </div>
                            </div>

                            {!isAccepted && (
                                <button
                                    onClick={handleAccept}
                                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all transform active:scale-95"
                                >
                                    Deploy Weekly Plan
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
