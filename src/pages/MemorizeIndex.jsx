import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getChapters } from '../services/api/quranApi';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { Search, Award, X, ArrowRight, CheckCircle, Folder, BookOpen } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import './Memorize.css';

export default function MemorizeIndex() {
    const { setNavHeaderTitle, bookmarks, collections, memorizedSurahs, memorizedAyahs, readingSessions } = useAppStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [showOnlyMemorized, setShowOnlyMemorized] = useState(false);
    const [showSurahsModal, setShowSurahsModal] = useState(false);
    const [showAyahsModal, setShowAyahsModal] = useState(false);

    useEffect(() => {
        setNavHeaderTitle('Hifdh');
        return () => setNavHeaderTitle(null);
    }, [setNavHeaderTitle]);

    const { data: chapters, isLoading, error } = useQuery({
        queryKey: ['chapters'],
        queryFn: getChapters,
    });

    // Find last memorization session for "Continue" banner
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

    // Compute per-surah memorized counts
    const surahMemCounts = useMemo(() => {
        const counts = {};
        (memorizedAyahs || []).forEach(key => {
            const surahId = key.split(':')[0];
            counts[surahId] = (counts[surahId] || 0) + 1;
        });
        return counts;
    }, [memorizedAyahs]);

    // Group Ayahs By Surah for the Modal
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

    // Time since last session
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

    if (isLoading) return (
        <div className="mem-index">
            <div className="mem-empty">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    style={{ display: 'inline-block', width: '36px', height: '36px', border: '3px solid var(--mem-bone-dark)', borderTopColor: 'var(--mem-teal)', borderRadius: '50%', marginBottom: '1rem' }}
                />
                <p>Loading Surahs...</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="mem-index">
            <div className="mem-empty">Error fetching data. Please try again later.</div>
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
        <div className="mem-index">
            <Helmet>
                <title>Hifdh — Memorization Tracker</title>
                <meta name="description" content="Track your Quran memorization journey. Select a Surah for Hifdh." />
            </Helmet>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                {/* Eyebrow */}
                <p className="mem-eyebrow">Memorization</p>
                <h1 className="mem-page-title">Hifdh Tracker</h1>

                {/* Continue Banner */}
                {lastSessionChapter && (
                    <Link to={`/memorize/${lastSessionChapter.id}`} className="mem-continue">
                        <div className="mem-continue-icon">
                            <BookOpen size={22} />
                        </div>
                        <div className="mem-continue-info">
                            <div className="mem-continue-title">Continue: {lastSessionChapter.name_simple}</div>
                            <div className="mem-continue-sub">Last practiced {timeSince}</div>
                        </div>
                        <ArrowRight size={18} className="mem-continue-arrow" />
                    </Link>
                )}

                {/* Compact Stats */}
                <div className="mem-stats-row">
                    <div className="mem-stat-card" onClick={() => setShowSurahsModal(true)}>
                        <div className="mem-stat-value">{totalSurahs}<small>/114</small></div>
                        <div className="mem-stat-label">Surahs</div>
                    </div>
                    <div className="mem-stat-card" onClick={() => setShowAyahsModal(true)}>
                        <div className="mem-stat-value">{totalAyahs}<small>/6236</small></div>
                        <div className="mem-stat-label">Ayahs</div>
                    </div>
                    <div className="mem-stat-card">
                        <div className="mem-stat-value">{totalSurahs > 0 ? Math.round((totalAyahs / 6236) * 100) : 0}<small>%</small></div>
                        <div className="mem-stat-label">Progress</div>
                    </div>
                </div>

                {/* Quick Resume from Library */}
                {(bookmarks?.length > 0 || collections?.length > 0) && (
                    <>
                        <div className="mem-section-header">
                            <h2 className="mem-section-title">Quick Resume</h2>
                            <Link to="/library" className="mem-section-link">View Library</Link>
                        </div>
                        <div className="mem-resume-grid">
                            {bookmarks?.slice(0, 4).map((b, i) => (
                                <Link key={`b-${i}`} to={`/memorize/${b.chapterId}?verse=${b.verseKey}`} className="mem-resume-card">
                                    <div>
                                        <div className="mem-resume-name">{b.surahName}</div>
                                        <div className="mem-resume-detail">Ayah {b.verseKey.split(':')[1]}</div>
                                    </div>
                                    <ArrowRight size={14} color="var(--mem-teal)" />
                                </Link>
                            ))}
                            {collections?.slice(0, 2).map(c => (
                                <Link key={c.id} to={`/memorize/${c.items[0]?.chapterId}`} className="mem-collection-card">
                                    <Folder size={18} color="var(--mem-gold)" />
                                    <div>
                                        <div className="mem-resume-name" style={{ color: 'var(--mem-gold)' }}>{c.name}</div>
                                        <div className="mem-resume-detail">{c.items.length} verses</div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </>
                )}

                {/* Search + Filter */}
                <div className="mem-search">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search Surahs..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="mem-filter-row">
                    <button
                        className={`mem-filter-btn ${showOnlyMemorized ? 'active' : ''}`}
                        onClick={() => setShowOnlyMemorized(!showOnlyMemorized)}
                    >
                        <Award size={14} />
                        {showOnlyMemorized ? 'Memorized Only' : 'Filter Memorized'}
                    </button>
                </div>

                {/* Surah Grid */}
                <div className="mem-surah-grid">
                    {filteredChapters?.map(chapter => {
                        const isMemorized = (memorizedSurahs || []).includes(chapter.id);
                        const memCount = surahMemCounts[String(chapter.id)] || 0;
                        const memPct = Math.round((memCount / chapter.verses_count) * 100);
                        const hasPartial = !isMemorized && memCount > 0;

                        return (
                            <motion.div key={chapter.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                                <Link to={`/memorize/${chapter.id}`} className={`mem-surah-card ${isMemorized ? 'is-memorized' : ''}`}>
                                    <div className="mem-surah-num">{chapter.id}</div>
                                    <div className="mem-surah-info">
                                        <div className="mem-surah-name">
                                            {chapter.name_simple}
                                            {isMemorized && <CheckCircle size={14} className="mem-memorized-icon" />}
                                        </div>
                                        <div className="mem-surah-meta">
                                            <span>{chapter.verses_count} Ayahs</span>
                                            {hasPartial && (
                                                <span className="mem-surah-progress-pill">{memCount} memorized</span>
                                            )}
                                        </div>
                                        {(isMemorized || hasPartial) && (
                                            <div className="mem-surah-bar">
                                                <div className="mem-surah-bar-fill" style={{ width: `${isMemorized ? 100 : memPct}%` }} />
                                            </div>
                                        )}
                                    </div>
                                </Link>
                            </motion.div>
                        );
                    })}
                </div>

                {filteredChapters?.length === 0 && (
                    <div className="mem-empty">No surahs found matching your search.</div>
                )}
            </motion.div>

            {/* ─── Modals ─── */}
            <AnimatePresence>
                {showSurahsModal && (
                    <motion.div className="mem-modal-overlay"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={e => { if (e.target === e.currentTarget) setShowSurahsModal(false); }}
                    >
                        <motion.div className="mem-modal"
                            initial={{ opacity: 0, y: 30, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.96 }}
                        >
                            <div className="mem-modal-header">
                                <h3 className="mem-modal-title">
                                    <Award size={20} color="var(--mem-green)" /> Memorized Surahs
                                </h3>
                                <button className="mem-modal-close" onClick={() => setShowSurahsModal(false)}>
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="mem-modal-body">
                                {!(memorizedSurahs?.length > 0) ? (
                                    <div className="mem-empty">No surahs memorized yet. Keep going!</div>
                                ) : (
                                    memorizedSurahs.map(id => {
                                        const ch = chapters?.find(c => c.id === id);
                                        return ch ? (
                                            <Link to={`/memorize/${ch.id}`} key={`surah-${id}`}
                                                className="mem-modal-item" onClick={() => setShowSurahsModal(false)}>
                                                <div className="mem-modal-item-num">{ch.id}</div>
                                                <div>
                                                    <div className="mem-modal-item-name">{ch.name_simple}</div>
                                                    <div className="mem-modal-item-sub">{ch.verses_count} Ayahs</div>
                                                </div>
                                                <ArrowRight size={14} color="var(--mem-teal)" style={{ marginLeft: 'auto' }} />
                                            </Link>
                                        ) : null;
                                    })
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {showAyahsModal && (
                    <motion.div className="mem-modal-overlay"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={e => { if (e.target === e.currentTarget) setShowAyahsModal(false); }}
                    >
                        <motion.div className="mem-modal"
                            initial={{ opacity: 0, y: 30, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.96 }}
                        >
                            <div className="mem-modal-header">
                                <h3 className="mem-modal-title">
                                    <CheckCircle size={20} color="var(--mem-green)" /> Memorized Ayahs
                                </h3>
                                <button className="mem-modal-close" onClick={() => setShowAyahsModal(false)}>
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="mem-modal-body">
                                {!(memorizedAyahs?.length > 0) ? (
                                    <div className="mem-empty">No ayahs memorized yet. Keep going!</div>
                                ) : (
                                    Object.keys(memorizedAyahsGrouped)
                                        .sort((a, b) => Number(a) - Number(b))
                                        .map(surahId => {
                                            const ch = chapters?.find(c => String(c.id) === surahId);
                                            const ayahs = memorizedAyahsGrouped[surahId];
                                            return (
                                                <div key={`ayah-group-${surahId}`} style={{ marginBottom: '1.25rem' }}>
                                                    <div className="mem-modal-item-name" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        <Folder size={14} color="var(--mem-teal)" />
                                                        Surah {ch?.name_simple || surahId}
                                                    </div>
                                                    <div className="mem-ayah-pills">
                                                        {ayahs.map(ayahNum => (
                                                            <Link
                                                                to={`/memorize/${surahId}?verse=${surahId}:${ayahNum}`}
                                                                onClick={() => setShowAyahsModal(false)}
                                                                key={`${surahId}:${ayahNum}`}
                                                                className="mem-ayah-pill"
                                                            >
                                                                {ayahNum}
                                                            </Link>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
