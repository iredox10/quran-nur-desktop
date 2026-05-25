import React, { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { Bookmark, Info, X, Plus, Play, Pause } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { getVerseArabicText } from '../utils/quranText';


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
    isPlannerBookmark
}) => {
    const { ref, inView } = useInView({
        threshold: 0.5,
        triggerOnce: false,
    });

    const { collections, addCollection, addToCollection } = useAppStore();
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
                        backgroundColor: isAudioPlaying ? 'var(--accent-light)' : 'transparent',
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
                    backgroundColor: isAudioPlaying ? 'var(--accent-light)' : 'transparent',
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
                        <button
                            className="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 hover:bg-[var(--bg-secondary)] hover:shadow-[var(--shadow-sm)]"
                            style={{ color: bookmark?.verseKey === verse.verse_key ? 'var(--accent-primary)' : 'var(--text-muted)' }}
                            onClick={() => setBookmark(verse.verse_key, chapter ? chapter.name_simple : `Surah ${verse.verse_key.split(':')[0]}`, chapter?.id)}
                            title="Bookmark Verse"
                        >
                            <Bookmark size={18} fill={bookmark?.verseKey === verse.verse_key ? 'currentColor' : 'none'} />
                        </button>
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
                            title={isAudioPlaying ? "Playing" : "Play this Ayah"}
                            onClick={() => onPlayVerse?.(verse)}
                        >
                            {isAudioPlaying
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

                <div className="text-english" style={{
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
                                <div className="w-[calc(100vw-2rem)] max-w-[400px] rounded-[24px] border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-xl)] pointer-events-auto">
                                    <div className="mb-4 flex items-center justify-between">
                                        <h3 className="m-0 text-[1.1rem] font-bold text-[var(--text-primary)]">Add to Collection</h3>
                                        <button onClick={() => setShowCollectionModal(false)} className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-secondary)] transition-all duration-200 hover:bg-[var(--bg-secondary)] hover:text-accent hover:shadow-[var(--shadow-sm)]"><X size={18} /></button>
                                    </div>
                                    <div className="mb-4 flex max-h-[200px] flex-col gap-2 overflow-y-auto">
                                        {(collections || []).map(c => {
                                            const isInCollection = c.items?.some(item => item.verseKey === verse.verse_key);
                                            return (
                                                <button
                                                    key={c.id}
                                                    onClick={() => {
                                                        addToCollection(c.id, verse.verse_key, chapter ? chapter.name_simple : `Surah ${verse.verse_key.split(':')[0]}`, chapter?.id);
                                                        setShowCollectionModal(false);
                                                    }}
                                                    className={`flex cursor-pointer items-center justify-between rounded-xl border-none bg-[var(--bg-secondary)] px-4 py-3 text-left transition-all duration-200 ${
                                                        isInCollection ? 'font-bold text-[var(--text-primary)]' : 'font-medium text-[var(--text-primary)]'
                                                    }`}
                                                >
                                                    <span>{c.name}</span>
                                                    {isInCollection && <span className="text-[0.8rem] text-accent">Added</span>}
                                                </button>
                                            );
                                        })}
                                        {(!collections || collections.length === 0) && (
                                            <div className="py-4 text-center text-[0.9rem] text-[var(--text-muted)]">No collections yet</div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="New collection name..."
                                            value={newCollectionName}
                                            onChange={(e) => setNewCollectionName(e.target.value)}
                                            className="min-h-10 flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-primary)] outline-none"
                                        />
                                        <button
                                            className="flex cursor-pointer items-center justify-center rounded-xl bg-accent px-4 font-semibold text-white transition-all duration-200 hover:bg-[var(--accent-hover)]"
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
                                            <Plus size={18} />
                                        </button>
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
