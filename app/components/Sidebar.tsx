"use client";

import React from "react";
import {
    LayoutDashboard,
    CalendarRange,
    Sparkles,
    LibraryBig,
    Settings,
    ChevronLeft,
    ChevronRight,
    LogOut
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { motion } from "framer-motion";

interface SidebarProps {
    activeSection: string;
    setActiveSection: (section: string) => void;
    isCollapsed: boolean;
    setIsCollapsed: (collapsed: boolean) => void;
}

const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "planner", label: "Planner", icon: CalendarRange },
    { id: "creator", label: "Creator", icon: Sparkles },
    { id: "library", label: "Library", icon: LibraryBig },
];

export default function Sidebar({
    activeSection,
    setActiveSection,
    isCollapsed,
    setIsCollapsed
}: SidebarProps) {
    return (
        <motion.aside
            initial={false}
            animate={{ width: isCollapsed ? 80 : 280 }}
            className="fixed left-0 top-0 h-screen bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col z-50 transition-all duration-300"
        >
            {/* Brand Header */}
            <div className="p-6 flex items-center justify-between border-b border-zinc-50 dark:border-zinc-900/50 h-20">
                {!isCollapsed && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2"
                    >
                        <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-xl">M</div>
                        <span className="font-extrabold text-xl tracking-tighter text-zinc-900 dark:text-zinc-50">
                            Mindful<span className="text-blue-600">NL</span>
                        </span>
                    </motion.div>
                )}
                {isCollapsed && (
                    <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-xl mx-auto">M</div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-grow p-4 space-y-2 overflow-y-auto custom-scrollbar">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all group ${activeSection === item.id
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                            }`}
                    >
                        <item.icon className={`h-5 w-5 flex-shrink-0 ${activeSection === item.id ? "scale-110" : "group-hover:scale-110 transition-transform"}`} />
                        {!isCollapsed && (
                            <span className="font-bold text-sm tracking-wide">{item.label}</span>
                        )}
                    </button>
                ))}
            </nav>

            {/* Footer Area */}
            <div className="p-4 border-t border-zinc-50 dark:border-zinc-900/50 space-y-4">
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-2`}>
                    {!isCollapsed && <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Theme</span>}
                    <ThemeToggle />
                </div>

                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="w-full flex items-center gap-4 p-3 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800"
                >
                    {isCollapsed ? <ChevronRight className="mx-auto" /> : (
                        <>
                            <ChevronLeft className="h-5 w-5" />
                            <span className="font-bold text-sm">Collapse</span>
                        </>
                    )}
                </button>
            </div>
        </motion.aside>
    );
}
