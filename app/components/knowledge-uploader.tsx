"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import { Database, FileUp, CheckCircle, AlertCircle, Loader2, Sparkles } from "lucide-react";

export default function KnowledgeUploader() {
    const ingest = useAction(api.actions.ingestKnowledge);
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");

    const handleIngest = async () => {
        if (!text) return;
        setLoading(true);
        setStatus("");
        try {
            await ingest({ text: text, metadata: { source: "user-upload", type: "text", timestamp: new Date().toISOString() } });
            setStatus("success:Asset successfully integrated into the neural base.");
            setText("");
        } catch (e) {
            console.error(e);
            const msg = e instanceof Error ? e.message : JSON.stringify(e);
            setStatus(`error:${msg}`);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type === 'application/pdf') {
            setLoading(true);
            setStatus("info:Processing binary asset...");
            try {
                const pdfjs = await import('pdfjs-dist');
                pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

                let fullText = "";
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map((item: any) => item.str).join(' ');
                    fullText += pageText + "\n\n";
                }

                setText(fullText);
                setStatus("success:Asset decoded successfully.");
            } catch (err) {
                console.error(err);
                setStatus("error:Failed to decode asset.");
            } finally {
                setLoading(false);
            }
        } else {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                const content = evt.target?.result as string;
                setText(content);
            };
            reader.readAsText(file);
        }
    };

    const isSuccess = status.startsWith("success");
    const isError = status.startsWith("error");
    const isInfo = status.startsWith("info");
    const displayMsg = status.split(":")[1];

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="premium-card flex flex-col h-full"
        >
            <div className="flex items-center gap-2 mb-6">
                <Database className="h-5 w-5 text-indigo-500" />
                <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Knowledge Base</h2>
            </div>

            <div className="space-y-4 flex-grow">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Context Source</label>
                    <textarea
                        className="w-full p-4 border rounded-xl min-h-[200px] bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all text-xs leading-relaxed custom-scrollbar"
                        placeholder="Paste strategic documents, brand guidelines, or research here..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                    />
                </div>

                <div className="relative">
                    <input
                        type="file"
                        id="file-upload"
                        accept=".txt,.md,.json,.csv,.pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <label
                        htmlFor="file-upload"
                        className="flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all cursor-pointer group"
                    >
                        <FileUp className="h-4 w-4 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-colors" />
                        <span className="text-xs font-bold text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300">Sync Data Stream</span>
                    </label>
                </div>
            </div>

            <div className="mt-8 space-y-4">
                <button
                    onClick={handleIngest}
                    disabled={loading || !text}
                    className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 p-3.5 rounded-xl font-extrabold text-sm uppercase tracking-widest shadow-lg transition-all hover:bg-black dark:hover:bg-white active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Integrating...</span>
                        </>
                    ) : (
                        <>
                            <Sparkles className="h-4 w-4 text-amber-500" />
                            <span>Ingest Knowledge</span>
                        </>
                    )}
                </button>

                {status && (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-3 rounded-lg flex items-start gap-2 border text-[10px] font-bold uppercase tracking-tight leading-relaxed ${isSuccess ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50' :
                            isError ? 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50' :
                                'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50'
                            }`}
                    >
                        {isSuccess && <CheckCircle className="h-3 w-3 mt-0.5 shrink-0" />}
                        {isError && <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />}
                        {isInfo && <Loader2 className="h-3 w-3 mt-0.5 shrink-0 animate-spin" />}
                        <span>{displayMsg}</span>
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
}
