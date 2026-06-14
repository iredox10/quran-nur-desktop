import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getChapters, getJuzs, getChapterAudio } from '../services/api/quranApi';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { Search, Award, X, ArrowRight, CheckCircle, Folder, BookOpen, Play, Target, AlertCircle, Calendar, RefreshCw } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import HifdhTestModal from '../components/HifdhTestModal';

export default function MemorizeIndex() {
    const { 
        setNavHeaderTitle, bookmarks, collections, memorizedSurahs, memorizedAyahs, 
        readingSessions, hifdhHistory, hifdhGoals, addHifdhGoal, setAudio, setIsPlaying 
    } = useAppStore();
    
    const [searchQuery, setSearchQuery] = useState('');
    const [showOnlyMemorized, setShowOnlyMemorized] = useState(false);
    const [showSurahsModal, setShowSurahsModal] = useState(false);
    const [showAyahsModal, setShowAyahsModal] = useState(false);
    const [showTestModal, setShowTestModal] = useState(false);
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [viewMode, setViewMode] = useState('surah'); // 'surah' | 'juz'

    const [goalTarget, setGoalTarget] = useState('');
    const [goalDate, setGoalDate] = useState('');

    useEffect(() => {
        setNavHeaderTitle('Hifdh');
        return () => setNavHeaderTitle(null);
    }, [setNavHeaderTitle]);

    const { data: chapters, isLoading: isLoadingChapters, error } = useQuery({
        queryKey: ['chapters'],
        queryFn: getChapters,
    });

    const { data: juzs, isLoading: isLoadingJuzs } = useQuery({
        queryKey: ['juzs'],
        queryFn: getJuzs,
        enabled: viewMode === 'juz'
    });

    const isLoading = isLoadingChapters || (viewMode === 'juz' && isLoadingJuzs);

    const lastSession = useMemo(() => {
        if (!readingSessions?.length) return null;
        const memSessions = readingSessions.filter(s => s.type === 'memorizing' && s.chapterId);
        if (!memSessions.length) return null;
        return memSessions[memSessions.length - 1];
    }, [readingSessions]);

    const lastSessionChapter = useMemo(() => {
        if (!lastSession || !chapters) return null;
        return chapters.find(c => c.id === lastSession.chapterId);
    }, [lastSession, chapters]);

    const surahMemCounts = useMemo(() => {
        const counts = {};
        (memorizedAyahs || []).forEach(key => {
            const surahId = key.split(':')[0];
            counts[surahId] = (counts[surahId] || 0) + 1;
        });
        return counts;
    }, [memorizedAyahs]);

    const needsRevision = useMemo(() => {
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const items = [];
        
        (memorizedAyahs || []).forEach(ayah => {
            const history = hifdhHistory?.[ayah];
            if (!history || (now - history.lastReviewed > SEVEN_DAYS) || history.strength === 'weak') {
                items.push(ayah);
            }
        });
        return items.slice(0, 10); // top 10 to review
    }, [memorizedAyahs, hifdhHistory]);

    const memorizedAyahsGrouped = useMemo(() => {
        const acc = {};
        (memorizedAyahs || []).forEach(key => {
            const [surahId, ayahNum] = key.split(':');
            if (!acc[surahId]) acc[surahId] = [];
            acc[surahId].push(Number(ayahNum));
        });
        Object.keys(acc).forEach(id => acc[id].sort((a, b) => a - b));
        return acc;
    }, [memorizedAyahs]);

    const timeSince = useMemo(() => {
        if (!lastSession) return '';
        const diff = Date.now() - lastSession.timestamp;
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    }, [lastSession]);

    const handlePlayAudio = async (e, chapterId) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            const audioData = await getChapterAudio(chapterId);
            setAudio(audioData.audio_url);
            setIsPlaying(true);
        } catch (err) {
            console.error("Failed to play audio", err);
        }
    };

    const handleCreateGoal = () => {
        if (!goalTarget || !goalDate) return;
        addHifdhGoal({
            targetType: 'surah',
            targetId: goalTarget,
            targetDate: goalDate,
        });
        setShowGoalModal(false);
    };

    if (isLoading && !chapters) return (
        <div className="mx-auto max-w-[1200px] px-4 pb-20">
            <div className="py-[10vh] text-center text-[var(--text-secondary)]">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="mb-4 inline-block h-9 w-9 rounded-full"
                    style={{ border: '3px solid var(--h-bone-dark)', borderTopColor: 'var(--accent-primary)' }} />
                <p>Loading...</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="mx-auto max-w-[1200px] px-4 pb-20">
            <div className="py-12 text-center text-[0.9rem] italic text-[var(--text-secondary)]">Error fetching data. Please try again later.</div>
        </div>
    );

    let filteredChapters = chapters?.filter(c =>
        c.name_simple.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.translated_name.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (showOnlyMemorized) {
        filteredChapters = filteredChapters?.filter(c => (memorizedSurahs || []).includes(c.id));
    }

    const totalSurahs = (memorizedSurahs || []).length;
    const totalAyahs = (memorizedAyahs || []).length;

    return (
        <div className="mx-auto max-w-[1200px] px-4 pb-20">
            <Helmet>
                <title>Hifdh — Memorization Tracker</title>
                <meta name="description" content="Track your Quran memorization journey. Select a Surah for Hifdh." />
            </Helmet>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <p className="mb-1 mt-4 text-center font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[var(--text-secondary)]">Memorization</p>
                <h1 className="mb-6 text-center font-ui text-[1.6rem] font-bold text-[var(--text-primary)]">Hifdh Tracker</h1>

                {lastSessionChapter && (
                    <Link to={`/memorize/${lastSessionChapter.id}`} className="mb-6 flex items-center gap-4 rounded-2xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-hover)] px-5 py-4 text-white no-underline transition-all duration-150 hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(46,79,74,0.25)] md:p-5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15"><BookOpen size={22} /></div>
                        <div className="min-w-0 flex-1">
                            <div className="mb-[0.15rem] font-ui text-base font-semibold">Continue: {lastSessionChapter.name_simple}</div>
                            <div className="font-mono text-[0.72rem] tracking-[0.02em] opacity-75">Last practiced {timeSince}</div>
                        </div>
                        <button onClick={(e) => handlePlayAudio(e, lastSessionChapter.id)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30 backdrop-blur-md">
                            <Play size={16} fill="currentColor" />
                        </button>
                    </Link>
                )}

                <div className="mb-7 flex gap-2">
                    <div className="flex-1 cursor-pointer rounded-[14px] border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-cream)] shadow-sm px-3 py-[0.85rem] text-center transition-all duration-200 hover:border-[#b8924a] hover:shadow-[0_2px_12px_rgba(184,146,74,0.12)]" onClick={() => setShowSurahsModal(true)}>
                        <div className="font-ui text-2xl font-bold leading-[1.2] text-[var(--text-primary)]">{totalSurahs}<small className="text-[0.7rem] font-normal text-[var(--text-secondary)]">/114</small></div>
                        <div className="mt-[0.2rem] font-mono text-[0.58rem] uppercase tracking-[0.1em] text-[var(--text-secondary)]">Surahs</div>
                    </div>
                    <div className="flex-1 cursor-pointer rounded-[14px] border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-cream)] shadow-sm px-3 py-[0.85rem] text-center transition-all duration-200 hover:border-[#b8924a] hover:shadow-[0_2px_12px_rgba(184,146,74,0.12)]" onClick={() => setShowAyahsModal(true)}>
                        <div className="font-ui text-2xl font-bold leading-[1.2] text-[var(--text-primary)]">{totalAyahs}<small className="text-[0.7rem] font-normal text-[var(--text-secondary)]">/6236</small></div>
                        <div className="mt-[0.2rem] font-mono text-[0.58rem] uppercase tracking-[0.1em] text-[var(--text-secondary)]">Ayahs</div>
                    </div>
                    <div className="flex-1 rounded-[14px] border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-cream)] shadow-sm px-3 py-[0.85rem] text-center">
                        <div className="font-ui text-2xl font-bold leading-[1.2] text-[var(--text-primary)]">{totalSurahs > 0 ? Math.round((totalAyahs / 6236) * 100) : 0}<small className="text-[0.7rem] font-normal text-[var(--text-secondary)]">%</small></div>
                        <div className="mt-[0.2rem] font-mono text-[0.58rem] uppercase tracking-[0.1em] text-[var(--text-secondary)]">Progress</div>
                    </div>
                </div>

                <div className="mb-7 flex gap-3">
                    <button onClick={() => setShowTestModal(true)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-3 font-semibold text-white shadow-lg transition-colors hover:bg-[var(--accent-hover)]">
                        <RefreshCw size={18} /> Test My Hifdh
                    </button>
                    <button onClick={() => setShowGoalModal(true)} className="flex flex-1 items-center justify-center gap-2 rounded-xl border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-white)] px-4 py-3 font-semibold text-[var(--text-primary)] shadow-sm transition-colors hover:border-[#b8924a]">
                        <Target size={18} /> Set Goal
                    </button>
                </div>

                {needsRevision.length > 0 && (
                    <div className="mb-7 rounded-[16px] border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/10">
                        <div className="mb-3 flex items-center gap-2 font-ui font-semibold text-red-600 dark:text-red-400">
                            <AlertCircle size={18} /> Needs Revision
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {needsRevision.map(ayah => (
                                <Link to={`/memorize/${ayah.split(':')[0]}?verse=${ayah}`} key={ayah} className="flex-shrink-0 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 no-underline shadow-sm transition-colors hover:border-red-400 dark:border-red-800/50 dark:bg-[var(--bg-surface)] dark:text-red-300">
                                    {chapters?.find(c => c.id == ayah.split(':')[0])?.name_simple} {ayah.split(':')[1]}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {(hifdhGoals?.length > 0) && (
                    <div className="mb-7 grid gap-3">
                        <div className="font-ui font-semibold text-[var(--text-primary)]">Active Goals</div>
                        {hifdhGoals.map(goal => {
                            const ch = chapters?.find(c => c.id == goal.targetId);
                            const daysLeft = Math.max(0, Math.ceil((new Date(goal.targetDate) - new Date()) / (1000 * 60 * 60 * 24)));
                            return (
                                <div key={goal.id} className="flex items-center justify-between rounded-xl border-[1.5px] border-[#b8924a] bg-[rgba(184,146,74,0.05)] p-4 shadow-sm">
                                    <div>
                                        <div className="flex items-center gap-2 font-semibold text-[#b8924a]">
                                            <Target size={16} /> Memorize {ch?.name_simple || 'Target'}
                                        </div>
                                        <div className="mt-1 text-xs text-[var(--text-secondary)]">{daysLeft} days left</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-[var(--text-primary)]">{surahMemCounts[goal.targetId] || 0} / {ch?.verses_count || 0}</div>
                                        <div className="text-xs text-[var(--text-secondary)]">Ayahs</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="mb-4 flex items-center justify-between">
                    <div className="flex rounded-lg bg-[var(--bg-secondary)] p-1">
                        <button 
                            className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-all ${viewMode === 'surah' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
                            onClick={() => setViewMode('surah')}
                        >
                            Surahs
                        </button>
                        <button 
                            className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-all ${viewMode === 'juz' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
                            onClick={() => setViewMode('juz')}
                        >
                            Ajzaa (Juz)
                        </button>
                    </div>
                </div>

                <div className="mb-4 flex items-center gap-3 rounded-[14px] border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-cream)] px-[1.15rem] py-[0.85rem] transition-colors duration-200 focus-within:border-[var(--accent-primary)] md:px-5">
                    <Search size={18} className="shrink-0 text-[var(--text-secondary)]" />
                    <input type="text" placeholder="Search..." value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full border-none bg-transparent font-[inherit] text-[0.95rem] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]" />
                </div>

                <div className="mb-5 flex justify-end gap-2">
                    <button
                        className={`flex cursor-pointer items-center gap-1.5 rounded-[20px] border-[1.5px] px-3.5 py-[7px] text-[0.78rem] font-semibold font-[inherit] transition-all duration-200 ${
                            showOnlyMemorized
                                ? 'border-[#10b981] bg-[rgba(16, 185, 129, 0.1)] text-[#10b981]'
                                : 'border-[var(--h-bone-dark)] bg-[var(--h-white)] text-[var(--text-secondary)]'
                        }`}
                        onClick={() => setShowOnlyMemorized(!showOnlyMemorized)}
                    >
                        <Award size={14} />
                        {showOnlyMemorized ? 'Memorized Only' : 'Filter Memorized'}
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
                    {viewMode === 'surah' ? (
                        filteredChapters?.map(chapter => {
                            const isMemorized = (memorizedSurahs || []).includes(chapter.id);
                            const memCount = surahMemCounts[String(chapter.id)] || 0;
                            const memPct = Math.round((memCount / chapter.verses_count) * 100);
                            const hasPartial = !isMemorized && memCount > 0;

                            return (
                                <motion.div key={chapter.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                                    <Link to={`/memorize/${chapter.id}`} className={`flex items-center gap-3 overflow-hidden rounded-[14px] border-[1.5px] bg-[var(--h-cream)] shadow-sm p-4 no-underline text-inherit transition-all duration-150 hover:-translate-y-px hover:border-[var(--accent-primary)] hover:shadow-md ${
                                        isMemorized ? 'border-[#10b981]' : 'border-[var(--h-bone-dark)]'
                                    }`}>
                                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-[0.8rem] font-bold ${
                                            isMemorized ? 'bg-[rgba(16, 185, 129, 0.1)] text-[#10b981]' : 'bg-[var(--bg-secondary)] text-[var(--accent-primary)]'
                                        }`}>{chapter.id}</div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-[0.35rem] font-ui text-[0.95rem] font-semibold text-[var(--text-primary)]">
                                                {chapter.name_simple}
                                                {isMemorized && <CheckCircle size={14} className="shrink-0 text-[#10b981]" />}
                                            </div>
                                            <div className="mt-[0.15rem] flex items-center gap-2 text-[0.72rem] text-[var(--text-secondary)]">
                                                <span>{chapter.verses_count} Ayahs</span>
                                                {hasPartial && (
                                                    <span className="rounded-lg bg-[rgba(184, 146, 74, 0.1)] px-1.5 py-0.5 text-[0.62rem] font-semibold text-[#b8924a]">{memCount} memorized</span>
                                                )}
                                            </div>
                                            {(isMemorized || hasPartial) && (
                                                <div className="mt-1.5 h-[3px] overflow-hidden rounded-sm bg-[var(--h-bone-dark)]">
                                                    <div className="h-full rounded-sm transition-all duration-[0.4s] ease-in-out"
                                                        style={{ width: `${isMemorized ? 100 : memPct}%`, background: isMemorized ? '#10b981' : 'var(--accent-primary)' }} />
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={(e) => handlePlayAudio(e, chapter.id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--accent-primary)] hover:text-white">
                                            <Play size={14} fill="currentColor" />
                                        </button>
                                    </Link>
                                </motion.div>
                            );
                        })
                    ) : (
                        juzs?.map(juz => {
                            // Simple mock juz progress for demo (proper mapping is complex without a full map)
                            // Ideally you'd parse verse_mapping e.g. {"1": "1-7", "2": "1-141"}
                            let totalJuzAyahs = 0;
                            let memJuzAyahs = 0;
                            
                            if (juz.verse_mapping) {
                                Object.keys(juz.verse_mapping).forEach(sId => {
                                    const range = juz.verse_mapping[sId].split('-');
                                    const start = Number(range[0]);
                                    const end = Number(range[1]);
                                    const count = end - start + 1;
                                    totalJuzAyahs += count;

                                    if (memorizedAyahsGrouped[sId]) {
                                        const memorizedInRange = memorizedAyahsGrouped[sId].filter(a => a >= start && a <= end).length;
                                        memJuzAyahs += memorizedInRange;
                                    }
                                });
                            }

                            const memPct = totalJuzAyahs > 0 ? Math.round((memJuzAyahs / totalJuzAyahs) * 100) : 0;
                            const isMemorized = memPct === 100;
                            
                            if (showOnlyMemorized && !isMemorized) return null;

                            return (
                                <motion.div key={juz.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                                    <div className={`flex items-center gap-3 overflow-hidden rounded-[14px] border-[1.5px] bg-[var(--h-cream)] shadow-sm p-4 text-inherit transition-all duration-150 ${
                                        isMemorized ? 'border-[#10b981]' : 'border-[var(--h-bone-dark)]'
                                    }`}>
                                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-[0.8rem] font-bold ${
                                            isMemorized ? 'bg-[rgba(16, 185, 129, 0.1)] text-[#10b981]' : 'bg-[var(--bg-secondary)] text-[var(--accent-primary)]'
                                        }`}>{juz.juz_number}</div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-[0.35rem] font-ui text-[0.95rem] font-semibold text-[var(--text-primary)]">
                                                Juz {juz.juz_number}
                                                {isMemorized && <CheckCircle size={14} className="shrink-0 text-[#10b981]" />}
                                            </div>
                                            <div className="mt-[0.15rem] flex items-center gap-2 text-[0.72rem] text-[var(--text-secondary)]">
                                                <span>{memJuzAyahs} / {totalJuzAyahs} Ayahs</span>
                                            </div>
                                            <div className="mt-1.5 h-[3px] overflow-hidden rounded-sm bg-[var(--h-bone-dark)]">
                                                <div className="h-full rounded-sm transition-all duration-[0.4s] ease-in-out"
                                                    style={{ width: `${memPct}%`, background: isMemorized ? '#10b981' : 'var(--accent-primary)' }} />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </div>

            </motion.div>

            <AnimatePresence>
                {showTestModal && <HifdhTestModal onClose={() => setShowTestModal(false)} />}
                
                {showGoalModal && (
                    <motion.div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(30,35,32,0.45)] p-4 backdrop-blur-sm"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={e => { if (e.target === e.currentTarget) setShowGoalModal(false); }}
                    >
                        <motion.div className="flex w-full max-w-[400px] flex-col overflow-hidden rounded-[20px] bg-[var(--h-cream)] p-6 shadow-xl border-[1.5px] border-[var(--h-bone-dark)]"
                            initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }}
                        >
                            <h3 className="mb-4 font-ui text-xl font-bold text-[var(--text-primary)]">Set Hifdh Goal</h3>
                            <div className="mb-4">
                                <label className="mb-2 block text-sm font-semibold text-[var(--text-secondary)]">Target Surah</label>
                                <select 
                                    className="w-full rounded-xl border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-white)] px-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                                    value={goalTarget} onChange={e => setGoalTarget(e.target.value)}
                                >
                                    <option value="">Select Surah...</option>
                                    {chapters?.map(c => <option key={c.id} value={c.id}>{c.id}. {c.name_simple}</option>)}
                                </select>
                            </div>
                            <div className="mb-6">
                                <label className="mb-2 block text-sm font-semibold text-[var(--text-secondary)]">Target Date</label>
                                <input 
                                    type="date" 
                                    className="w-full rounded-xl border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-white)] px-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                                    value={goalDate} onChange={e => setGoalDate(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                />
                            </div>
                            <button onClick={handleCreateGoal} className="w-full rounded-xl bg-[var(--accent-primary)] py-3 font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]">
                                Create Goal
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
