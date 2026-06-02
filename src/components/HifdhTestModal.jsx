import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, XCircle, RefreshCw, Eye } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { getVerses } from '../services/api/quranApi';

export default function HifdhTestModal({ onClose }) {
    const { memorizedAyahs, logHifdhReview } = useAppStore();
    const [testAyah, setTestAyah] = useState(null);
    const [verseData, setVerseData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRevealed, setIsRevealed] = useState(false);
    const [result, setResult] = useState(null);

    const pickRandomAyah = async () => {
        setIsLoading(true);
        setIsRevealed(false);
        setResult(null);
        setVerseData(null);
        
        if (!memorizedAyahs || memorizedAyahs.length === 0) {
            setIsLoading(false);
            return;
        }

        const randomIndex = Math.floor(Math.random() * memorizedAyahs.length);
        const randomKey = memorizedAyahs[randomIndex];
        setTestAyah(randomKey);

        const [chapterId, ayahNum] = randomKey.split(':');
        try {
            // Fetch verses for this chapter to find the specific ayah
            const data = await getVerses(chapterId, 85, 7, 1, 'madani-standard', 286); // get all ayahs
            const verse = data.verses.find(v => v.verse_key === randomKey);
            setVerseData(verse);
        } catch (error) {
            console.error('Failed to fetch test ayah', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        pickRandomAyah();
    }, []);

    const handleResult = (success) => {
        setResult(success);
        logHifdhReview(testAyah, success ? 'strong' : 'weak');
    };

    return (
        <motion.div className="fixed inset-0 z-[2000] flex items-center justify-center bg-[rgba(30,35,32,0.45)] p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <motion.div className="flex w-full max-w-[500px] flex-col overflow-hidden rounded-[20px] bg-[var(--bg-surface)] shadow-[var(--shadow-glass)] border border-[var(--glass-border)]"
                initial={{ opacity: 0, y: 30, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.96 }}
            >
                <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-6 py-5">
                    <h3 className="flex items-center gap-2 font-ui text-[1.15rem] font-semibold text-[var(--text-primary)]">
                        Hifdh Test
                    </h3>
                    <button className="flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-full border-none bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition-all duration-150 hover:bg-[var(--glass-border)]" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>
                
                <div className="flex-1 p-6 text-center">
                    {!memorizedAyahs?.length ? (
                        <div className="py-8 italic text-[var(--text-secondary)]">You haven't memorized any ayahs yet!</div>
                    ) : isLoading ? (
                        <div className="py-12">
                            <RefreshCw className="mx-auto animate-spin text-[var(--accent-primary)] mb-4" size={32} />
                            <p className="text-[var(--text-secondary)]">Picking an ayah...</p>
                        </div>
                    ) : verseData ? (
                        <>
                            <div className="mb-4 inline-block rounded-full bg-[var(--bg-secondary)] px-4 py-1.5 font-mono text-sm font-semibold text-[var(--accent-primary)]">
                                Surah {testAyah.split(':')[0]}, Ayah {testAyah.split(':')[1]}
                            </div>
                            <p className="mb-6 text-[0.95rem] text-[var(--text-secondary)]">Recite this ayah from memory, then tap to verify.</p>
                            
                            <div 
                                className="relative mb-8 cursor-pointer overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 transition-all"
                                onClick={() => setIsRevealed(true)}
                            >
                                <div className={`font-quran text-3xl leading-[2.2] text-[var(--text-primary)] transition-all duration-500 ${!isRevealed ? 'blur-md select-none opacity-50' : ''}`} dir="rtl">
                                    {verseData.arabic_text}
                                </div>
                                {!isRevealed && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="flex items-center gap-2 rounded-full bg-[var(--accent-primary)] px-5 py-2 text-sm font-semibold text-white shadow-lg">
                                            <Eye size={16} /> Tap to Reveal
                                        </div>
                                    </div>
                                )}
                            </div>

                            {isRevealed && result === null && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
                                    <h4 className="font-ui text-lg font-semibold text-[var(--text-primary)]">Did you get it right?</h4>
                                    <div className="flex gap-3">
                                        <button onClick={() => handleResult(false)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-100 px-4 py-3 font-semibold text-red-700 transition-colors hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400">
                                            <XCircle size={18} /> Needs Work
                                        </button>
                                        <button onClick={() => handleResult(true)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-100 px-4 py-3 font-semibold text-green-700 transition-colors hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400">
                                            <CheckCircle size={18} /> Perfect
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {result !== null && (
                                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-4">
                                    <div className={`mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full ${result ? 'bg-green-100 text-green-600 dark:bg-green-900/30' : 'bg-red-100 text-red-600 dark:bg-red-900/30'}`}>
                                        {result ? <CheckCircle size={32} /> : <RefreshCw size={32} />}
                                    </div>
                                    <h4 className="mb-6 font-ui text-lg font-bold text-[var(--text-primary)]">
                                        {result ? 'Mashallah! Keep it up.' : 'Keep practicing!'}
                                    </h4>
                                    <button onClick={pickRandomAyah} className="w-full rounded-xl bg-[var(--bg-secondary)] px-4 py-3 font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--glass-border)]">
                                        Test Another Ayah
                                    </button>
                                </motion.div>
                            )}
                        </>
                    ) : (
                        <div className="py-8 text-[var(--text-secondary)]">Failed to load ayah.</div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
