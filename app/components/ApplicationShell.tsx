"use client";

import React, { useState } from "react";
import Sidebar from "./Sidebar";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Zap, Bell } from "lucide-react";

interface ApplicationShellProps {
    children: (props: { activeSection: string; setActiveSection: (s: string) => void }) => React.ReactNode;
}

export default function ApplicationShell({ children }: ApplicationShellProps) {
    const [activeSection, setActiveSection] = useState("dashboard");
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <div className="min-h-screen bg-[hsl(var(--background))] text-zinc-900 dark:text-zinc-100 selection:bg-blue-100 dark:selection:bg-blue-900/30">
            <Sidebar
                activeSection={activeSection}
                setActiveSection={setActiveSection}
                isCollapsed={isCollapsed}
                setIsCollapsed={setIsCollapsed}
            />

            <main
                className={`transition-all duration-300 min-h-screen pb-20`}
                style={{ paddingLeft: isCollapsed ? 80 : 280 }}
            >
                {/* Topbar */}
                <header className="h-20 border-b border-zinc-200 dark:border-zinc-800 px-8 flex items-center justify-between sticky top-0 bg-[hsl(var(--background))/80] backdrop-blur-xl z-40">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-extrabold uppercase tracking-tighter decoration-blue-600 decoration-2 underline-offset-8 transition-all">
                            {activeSection}
                        </h2>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Engine Live</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors relative">
                                <Bell className="h-5 w-5 text-zinc-500" />
                                <span className="absolute top-2 right-2 h-2 w-2 bg-blue-600 rounded-full border-2 border-white dark:border-zinc-950"></span>
                            </button>
                            <div className="h-8 w-8 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 border border-zinc-200 dark:border-zinc-800 shadow-sm"></div>
                        </div>
                    </div>
                </header>

                {/* Content Area */}
                <div className="p-8 max-w-7xl mx-auto">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeSection}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {children({ activeSection, setActiveSection })}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
}
