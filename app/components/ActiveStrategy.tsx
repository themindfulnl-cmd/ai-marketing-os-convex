"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import { CheckCircle2, CalendarDays, ExternalLink, ArrowRight } from "lucide-react";

export default function ActiveStrategy() {
    const activePlan = useQuery(api.planner.getActivePlan);

    if (!activePlan) return null;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-8 dark:border-emerald-500/10 dark:bg-emerald-500/5 mb-12"
        >
            {/* Decorative background element */}
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl"></div>

            <div className="relative">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                            <CheckCircle2 className="h-7 w-7" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Deployed Strategy</span>
                                <span className="text-zinc-400 dark:text-zinc-600">•</span>
                                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Week of {new Date(activePlan.weekStarting).toLocaleDateString()}</span>
                            </div>
                            <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 italic">Active Marketing Pulse</h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-8 w-8 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                                    <div className="h-full w-full bg-gradient-to-br from-emerald-400 to-blue-500 opacity-20"></div>
                                </div>
                            ))}
                        </div>
                        <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300">Ready for Execution</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    {activePlan.days.map((day: { day: number; topic: string; format: string }) => (
                        <div
                            key={day.day}
                            className="group relative p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-sm transition-all hover:shadow-md hover:-translate-y-1"
                        >
                            <div className="mb-3 flex justify-between items-center text-[10px] font-black uppercase tracking-tighter text-zinc-400">
                                <span>Day {day.day}</span>
                                <div className="h-1 w-1 rounded-full bg-emerald-500"></div>
                            </div>
                            <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-2 leading-tight line-clamp-2 h-8">{day.topic}</h4>
                            <div className="flex items-center gap-1.5 py-1 px-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 w-max mb-3">
                                <CalendarDays className="h-3 w-3 text-emerald-500" />
                                <span className="text-[9px] font-bold text-zinc-600 dark:text-zinc-400 uppercase">{day.format}</span>
                            </div>

                            <button className="w-full mt-auto flex items-center justify-between text-[10px] font-bold text-zinc-400 group-hover:text-emerald-500 transition-colors pt-2 border-t border-zinc-50 dark:border-zinc-800/50">
                                <span>GO TO STUDIO</span>
                                <ArrowRight className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
}
