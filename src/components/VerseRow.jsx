import React, { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { Bookmark, Info, X, Plus, Play, Pause, Folder, CheckCircle2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { getVerseArabicText } from '../utils/quranText';
import { State } from 'ts-fsrs';


const TAFSIR_NAMES = {
    169: 'Ibn Kathir (Abridged)',
    168: "Ma'arif al-Qur'an",
    817: 'Tazkirul Quran',
    16: 'Tafsir al-Muyassar',
    14: 'Tafsir Ibn Kathir',
    15: 'Tafsir al-Tabari',
    93: 'Al-Tafsir al-Wasit'
};

const VerseRow = ({
    verse, readingMode, chapter, bookmark, setBookmark, addRecentlyRead,
    fontSize, translationFontSize, arabicFont, tajweedEnabled, tajweedMap, activeTafsir,
    setActiveTafsir, isTafsirFetching, tafsirId, showPageDivider, tafsirs,
    isAudioPlaying,
    mushaf,
    onPlayVerse,
    onPlannerBookmark,
    isPlannerBookmark,
    isHeatmapMode,
    hifdhHistory
}) => {
    const { ref, inView } = useInView({
        threshold: 0.5,
        triggerOnce: false,
    });

    const { collections, addCollection, addToCollection, isPlaying } = useAppStore();
    const [showCollectionModal, setShowCollectionModal] = useState(false);
    const [newCollectionName, setNewCollectionName] = useState('');

    useEffect(() => {
        if (inView && chapter) {
            addRecentlyRead?.(chapter.id, chapter.name_simple, verse.verse_key);
        }
    }, [inView, chapter?.id, chapter?.name_simple, verse.verse_key, addRecentlyRead]);

    const pageDivider = showPageDivider ? (
        <div
            key={`page-${verse.page_number}`}
            data-page={verse.page_number}
            className="page-divider"
            style={{
                display: readingMode ? 'block' : 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem 0',
                margin: readingMode ? '1.5rem 0' : '0',
                direction: 'ltr',
                width: '100%'
            }}
        >
            <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, var(--accent-primary), transparent)' }} />
            <span className="whitespace-nowrap rounded-[9999px] bg-[var(--accent-light)] px-3 py-1 font-['Outfit',sans-serif] text-[0.8rem] font-semibold text-accent">
                Page {verse.page_number}
            </span>
            <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, var(--accent-primary), transparent)' }} />
        </div>
    ) : null;

    const getHeatmapColor = (verseKey) => {
        if (!isHeatmapMode || !hifdhHistory) return null;
        const history = hifdhHistory[verseKey];
        if (!history || !history.card) return 'rgba(128, 128, 128, 0.05)'; // slight gray for unmemorized
        
        const card = history.card;
        if (card.state === State.New || card.state === State.Learning || card.state === State.Relearning) {
            return 'rgba(239, 68, 68, 0.15)'; // red for learning/relearning
        }
        
        const stability = card.stability;
        if (stability < 7) {
            return 'rgba(245, 158, 11, 0.15)'; // amber for low stability
        } else if (stability < 21) {
            return 'rgba(132, 204, 22, 0.15)'; // lime for medium stability
        } else {
            return 'rgba(34, 197, 94, 0.15)'; // green for high stability
        }
    };

    if (readingMode) {
        const verseArabicText = getVerseArabicText(verse, mushaf);

        return (
            <React.Fragment key={`reading-${verse.verse_key}`}>
                {pageDivider}
                <span
                    ref={ref}
                    id={`verse-${verse.verse_key}`}
                    className="quran-text tajweed-text"
                    style={{
                        fontSize: `clamp(${0.9 + fontSize * 0.15}rem, ${fontSize * 1.2}vw, ${fontSize * 0.4 + 1.5}rem)`,
                        fontFamily: arabicFont,
                        marginRight: '0.4rem',
                        display: 'inline',
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        backgroundColor: isAudioPlaying ? 'var(--accent-light)' : (getHeatmapColor(verse.verse_key) || 'transparent'),
                        borderRadius: '8px',
                        padding: '0 0.25rem',
                        wordBreak: 'break-word'
                    }}
                >
                    {tajweedEnabled && tajweedMap?.[verse.verse_key]
                        ? <span dangerouslySetInnerHTML={{ __html: tajweedMap[verse.verse_key] }} />
                        : <>{verseArabicText}</>
                    }

                </span>
            </React.Fragment>
        );
    }

    const verseArabicText = getVerseArabicText(verse, mushaf);

    return (
        <React.Fragment key={`translation-${verse.verse_key}`}>
            {pageDivider}
            <div className="flex items-center gap-4 py-2">
                <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, var(--accent-light), var(--border-color), var(--accent-light), transparent)' }} />
                <div className="h-[6px] w-[6px] rounded-full bg-accent opacity-40" />
                <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, transparent, var(--accent-light), var(--border-color), var(--accent-light), transparent)' }} />
            </div>
            <div
                ref={ref}
                id={`verse-${verse.verse_key}`}
                className="verse-container"
                style={{
                    padding: '1.5rem',
                    margin: '0.5rem 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    backgroundColor: isAudioPlaying ? 'var(--accent-light)' : (getHeatmapColor(verse.verse_key) || 'transparent'),
                    transform: isAudioPlaying ? 'scale(1.01)' : 'scale(1)',
                    boxShadow: isAudioPlaying ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                    borderRadius: '16px'
                }}
            >
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="rounded-[999px] border bg-[var(--accent-light)] px-3 py-[0.35rem] font-['Outfit',sans-serif] text-[0.85rem] font-bold tracking-[0.05em] text-accent"
                        style={{ borderColor: 'rgba(198, 168, 124, 0.2)' }}
                    >
                        {verse.verse_key}
                    </div>

                    <div className="verse-actions-row flex flex-wrap items-center gap-2">
                        <button
                            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] transition-all duration-200 hover:bg-[var(--bg-secondary)] hover:text-accent hover:shadow-[var(--shadow-sm)]"
                            onClick={() => setShowCollectionModal(true)}
                            title="Add to Collection"
                        >
                            <Plus size={18} />
                        </button>
                        {setBookmark && (
                            <button
                                className="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 hover:bg-[var(--bg-secondary)] hover:shadow-[var(--shadow-sm)]"
                                style={{ color: bookmark?.verseKey === verse.verse_key ? 'var(--accent-primary)' : 'var(--text-muted)' }}
                                onClick={() => setBookmark(verse.verse_key, chapter ? chapter.name_simple : `Surah ${verse.verse_key.split(':')[0]}`, chapter?.id)}
                                title="Bookmark Verse"
                            >
                                <Bookmark size={18} fill={bookmark?.verseKey === verse.verse_key ? 'currentColor' : 'none'} />
                            </button>
                        )}
                        {onPlannerBookmark && (
                            <button
                                className="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 hover:bg-[var(--bg-secondary)] hover:shadow-[var(--shadow-sm)]"
                                style={{ color: isPlannerBookmark ? 'var(--plr-gold)' : 'var(--text-muted)' }}
                                onClick={() => onPlannerBookmark(verse.verse_key, chapter ? chapter.name_simple : `Surah ${verse.verse_key.split(':')[0]}`)}
                                title="Add to Plan Highlights"
                            >
                                <Bookmark size={18} fill={isPlannerBookmark ? 'currentColor' : 'none'} strokeWidth={isPlannerBookmark ? 2 : 1.5} />
                            </button>
                        )}
                        <button
                            className="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200"
                            style={{
                                color: isAudioPlaying ? 'var(--accent-primary)' : 'var(--text-muted)',
                                backgroundColor: isAudioPlaying ? 'var(--accent-light)' : 'transparent',
                            }}
                            title={isAudioPlaying && isPlaying ? "Playing" : "Play this Ayah"}
                            onClick={() => onPlayVerse?.(verse)}
                        >
                            {isAudioPlaying && isPlaying
                                ? <Pause size={18} fill="currentColor" />
                                : <Play size={18} fill="currentColor" />
                            }
                        </button>
                        <button
                            className="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 hover:bg-[var(--bg-secondary)] hover:shadow-[var(--shadow-sm)]"
                            style={{ color: activeTafsir?.verse_key === verse.verse_key ? 'var(--accent-primary)' : 'var(--text-muted)' }}
                            title="Read Tafsir"
                            onClick={() => {
                                if (activeTafsir?.verse_key === verse.verse_key) {
                                    setActiveTafsir(null);
                                } else if (isTafsirFetching) {
                                    setActiveTafsir({
                                        verse_key: verse.verse_key,
                                        text: '<p>Loading tafsir...</p>'
                                    });
                                } else {
                                    const tafsirObj = tafsirs?.find((t) => t.verse_key === verse.verse_key);
                                    setActiveTafsir({
                                        verse_key: verse.verse_key,
                                        text: tafsirObj ? tafsirObj.text : '<p>Tafsir is not available for this verse in the selected source.</p>'
                                    });
                                }
                            }}
                        >
                            <Info size={18} />
                        </button>
                    </div>
                </div>

                <div
                    className="quran-text tajweed-text"
                    style={{
                        textAlign: 'right',
                        fontSize: `clamp(${0.9 + fontSize * 0.15}rem, ${fontSize * 1.2}vw, ${fontSize * 0.4 + 1.5}rem)`,
                        lineHeight: 2.0,
                        fontFamily: arabicFont,
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere'
                    }}
                >
                    {tajweedEnabled && tajweedMap?.[verse.verse_key]
                        ? <span dangerouslySetInnerHTML={{ __html: tajweedMap[verse.verse_key] }} />
                        : <>{verseArabicText}</>
                    }

                </div>

                <div className="text-english font-body" style={{
                    fontSize: `${(translationFontSize || 2) * 0.15 + 0.75}rem`,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6
                }}>
                    {verse.translations?.[0]?.text?.replace(/<[^>]*>?/gm, '')}
                </div>

                <AnimatePresence>
                    {activeTafsir?.verse_key === verse.verse_key && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            style={{ overflow: 'hidden' }}
                        >
                            <div className="relative mt-6 rounded-xl bg-[var(--bg-secondary)] p-6"
                                style={{ borderLeft: '4px solid var(--accent-primary)' }}
                            >
                                <button
                                    onClick={() => setActiveTafsir(null)}
                                    className="absolute right-4 top-4 cursor-pointer border-none bg-transparent text-[var(--text-muted)]"
                                >
                                    <X size={18} />
                                </button>
                                <h4 className="mb-4 text-[1.1rem] font-semibold text-[var(--text-primary)]">
                                    📖 {TAFSIR_NAMES[tafsirId] || 'Tafsir'}
                                </h4>
                                <div
                                    className="tafsir-content quran-tafsir-html"
                                    style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.8 }}
                                    dangerouslySetInnerHTML={{ __html: activeTafsir.text }}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {showCollectionModal && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                onClick={() => setShowCollectionModal(false)}
                                className="fixed inset-0 z-[1100] bg-black/50 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                className="fixed inset-0 z-[1101] flex items-center justify-center pointer-events-none"
                            >
                                <div className="w-[calc(100vw-2rem)] max-w-[420px] rounded-[28px] border border-[var(--glass-border)] bg-[var(--bg-surface)] p-6 shadow-2xl pointer-events-auto backdrop-blur-xl flex flex-col">
                                    <div className="mb-5 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-light)] text-[var(--accent-primary)]">
                                                <Folder size={18} fill="currentColor" opacity={0.2} />
                                            </div>
                                            <h3 className="m-0 text-[1.15rem] font-bold text-[var(--text-primary)] tracking-tight">Save to Collection</h3>
                                        </div>
                                        <button onClick={() => setShowCollectionModal(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition-all duration-200 hover:bg-[var(--border-color)] hover:text-[var(--text-primary)]">
                                            <X size={18} />
                                        </button>
                                    </div>

                                    {/* Existing Collections List */}
                                    <div className="mb-5 flex max-h-[260px] flex-col gap-[0.4rem] overflow-y-auto pr-2 custom-scrollbar">
                                        {(collections || []).map(c => {
                                            const isInCollection = c.items?.some(item => item.verseKey === verse.verse_key);
                                            return (
                                                <button
                                                    key={c.id}
                                                    onClick={() => {
                                                        addToCollection(c.id, verse.verse_key, chapter ? chapter.name_simple : `Surah ${verse.verse_key.split(':')[0]}`, chapter?.id);
                                                        setShowCollectionModal(false);
                                                    }}
                                                    className={`group relative flex w-full cursor-pointer items-center justify-between overflow-hidden rounded-xl border p-3 text-left transition-all duration-300 ${
                                                        isInCollection 
                                                            ? 'border-[var(--accent-primary)] bg-[var(--accent-light)] shadow-[0_4px_12px_rgba(var(--accent-rgb),0.1)]' 
                                                            : 'border-transparent bg-[var(--bg-secondary)] hover:border-[var(--glass-border)] hover:bg-[var(--glass-bg)] hover:shadow-md'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3 relative z-10">
                                                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${isInCollection ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--border-color)] text-[var(--text-muted)] group-hover:bg-[var(--accent-light)] group-hover:text-[var(--accent-primary)]'}`}>
                                                            {isInCollection ? <Check size={16} strokeWidth={3} /> : <Folder size={16} />}
                                                        </div>
                                                        <span className={`text-[0.95rem] transition-colors ${isInCollection ? 'font-semibold text-[var(--accent-primary)]' : 'font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]'}`}>
                                                            {c.name}
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                        {(!collections || collections.length === 0) && (
                                            <div className="flex flex-col items-center justify-center py-8 text-center opacity-70">
                                                <Folder size={32} className="mb-3 text-[var(--text-muted)]" />
                                                <div className="text-[0.9rem] font-medium text-[var(--text-primary)]">No collections yet</div>
                                                <div className="text-[0.8rem] text-[var(--text-muted)]">Create your first one below</div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="h-px w-full bg-[var(--border-color)] mb-5 opacity-60" />

                                    {/* Create New Collection */}
                                    <div>
                                        <label className="mb-2 block text-[0.8rem] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)] ml-1">
                                            New Collection
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Enter name..."
                                                value={newCollectionName}
                                                onChange={(e) => setNewCollectionName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && newCollectionName.trim()) {
                                                        const newId = Date.now();
                                                        addCollection(newCollectionName.trim(), newId);
                                                        addToCollection(newId, verse.verse_key, chapter ? chapter.name_simple : `Surah ${verse.verse_key.split(':')[0]}`, chapter?.id);
                                                        setNewCollectionName('');
                                                        setShowCollectionModal(false);
                                                    }
                                                }}
                                                className="min-h-12 flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3 text-[0.95rem] text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] focus:shadow-[0_0_0_4px_var(--accent-light)]"
                                            />
                                            <button
                                                className={`flex w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl font-bold transition-all duration-300 ${newCollectionName.trim() ? 'bg-[var(--accent-primary)] text-white shadow-[0_4px_14px_rgba(var(--accent-rgb),0.3)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(var(--accent-rgb),0.4)] hover:bg-[var(--accent-hover)]' : 'bg-[var(--border-color)] text-[var(--text-muted)] cursor-not-allowed opacity-70'}`}
                                                disabled={!newCollectionName.trim()}
                                                onClick={() => {
                                                    if (newCollectionName.trim()) {
                                                        const newId = Date.now();
                                                        addCollection(newCollectionName.trim(), newId);
                                                        addToCollection(newId, verse.verse_key, chapter ? chapter.name_simple : `Surah ${verse.verse_key.split(':')[0]}`, chapter?.id);
                                                        setNewCollectionName('');
                                                        setShowCollectionModal(false);
                                                    }
                                                }}
                                            >
                                                <Plus size={20} strokeWidth={2.5} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>
        </React.Fragment>
    );
};

export default VerseRow;
