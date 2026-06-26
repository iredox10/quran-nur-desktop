import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useQuery, useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { getChapter, getVerses, getChapterAudio, getChapterTafsirs, getTajweedVerses } from '../services/api/quranApi';
import { useAppStore } from '../store/useAppStore';
import { ArrowLeft, ArrowRight, Play, Pause, BookOpen, Bookmark, Info, X, Download, CloudCheck, RefreshCw, ChevronsDown, Minus, Plus, Settings2, Target, CheckCircle2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { useSwipeable } from 'react-swipeable';
import VerseRow from '../components/VerseRow';
import AudioSetupModal from '../components/AudioSetupModal';
import AutoScroller from '../components/AutoScroller';
import { getMushafById, isTajweedEnabledForMushaf } from '../config/mushaf';
import { sanitizeTajweedHtml } from '../utils/quranText';
import { saukaService } from '../services/saukaService';

const surahScrollPositions = {};

// VerseRow is now imported from components
export default function Surah() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const didRegisterReadRef = React.useRef(null);
    
    // Sauka Context
    const { backToSauka, saukaAssignmentId, saukaPartNumber, saukaUnit } = location.state || {};
    const [isSaukaCompleting, setIsSaukaCompleting] = useState(false);

    const handleSaukaComplete = async () => {
        setIsSaukaCompleting(true);
        try {
            await saukaService.completeJuz(saukaAssignmentId, backToSauka);
            navigate(`/sauka/${backToSauka}`);
        } catch (e) {
            console.error(e);
            alert('Failed to mark complete');
            setIsSaukaCompleting(false);
        }
    };
    const {
        translationId, reciterId, fontSize, translationFontSize,
        readingMode, setReadingMode,
        bookmark, setBookmark,
        addRecentlyRead,
        setAudio, setIsPlaying, currentAudioUrl, isPlaying,
        audioPlaylist, setAudioPlaylist, audioTrackIndex,
        audioSettings, updateAudioSettings,
        mushafId,
        arabicFont, tajweedEnabled,
        tafsirId,
        downloadedSurahs, addDownloadedSurah,
        setNavHeaderTitle,
        autoScroll, setAutoScroll, autoScrollSpeed, setAutoScrollSpeed,
        isAutoScrollPaused, setIsAutoScrollPaused,
        isPlayerVisible, setIsPlayerVisible,
        playTriggerCount,
        customAudioBaseUrl,
        localAudioDirHandle,
        logReadingSession,
        hifdhHistory
    } = useAppStore();
    const mushaf = getMushafById(mushafId);
    const isTajweedActive = isTajweedEnabledForMushaf(mushafId, tajweedEnabled);

    const [showAudioSetup, setShowAudioSetup] = useState(false);
    const [pendingPlaylist, setPendingPlaylist] = useState([]);

    const { data: chapter, isLoading: isChapterLoading } = useQuery({
        queryKey: ['chapter', id],
        queryFn: () => getChapter(id),
    });

    useEffect(() => {
        if (chapter) {
            setNavHeaderTitle(chapter.name_simple);
            // Only register the read once per surah ID to avoid re-firing on every store update or re-render
            if (didRegisterReadRef.current !== chapter.id) {
                didRegisterReadRef.current = chapter.id;
                const queryParams = new URLSearchParams(location.search);
                const initialVerse = queryParams.get('verse');
                addRecentlyRead(chapter.id, chapter.name_simple, initialVerse);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chapter?.id]);

    // Cleanup header on unmount
    useEffect(() => {
        return () => setNavHeaderTitle(null);
    }, [setNavHeaderTitle]);

    // Track reading session duration
    useEffect(() => {
        const startTime = Date.now();
        return () => {
            const duration = Math.round((Date.now() - startTime) / 1000);
            if (duration >= 10) { // Only log if spent at least 10 seconds
                logReadingSession(duration, 'reading', Number(id));
            }
        };
    }, [id, logReadingSession]);

    const {
        data: versesResponse,
        isLoading: isVersesLoading,
        isFetching: isVersesFetching,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage
    } = useInfiniteQuery({
        queryKey: ['verses', id, translationId, reciterId, mushafId],
        queryFn: ({ pageParam = 1 }) => getVerses(id, translationId, reciterId, pageParam, mushafId),
        getNextPageParam: (lastPage) => {
            if (lastPage.pagination.current_page < lastPage.pagination.total_pages) {
                return lastPage.pagination.current_page + 1;
            }
            return undefined;
        },
        placeholderData: keepPreviousData,
    });

    const { data: audioData } = useQuery({
        queryKey: ['chapterAudio', id, reciterId],
        queryFn: () => getChapterAudio(id, reciterId),
    });

    const { data: tafsirs, isFetching: isTafsirFetching } = useQuery({
        queryKey: ['tafsirs', id, tafsirId],
        queryFn: () => getChapterTafsirs(id, tafsirId),
        placeholderData: keepPreviousData,
    });

    const [activeTafsir, setActiveTafsir] = useState(null); // stores { verse_key, text }

    const { data: tajweedData } = useQuery({
        queryKey: ['tajweed', id, mushafId],
        queryFn: () => getTajweedVerses(id),
        enabled: isTajweedActive && mushaf.tajweedSource === 'uthmani_html',
    });

    // Build a lookup map: verse_key -> tajweed HTML
    const tajweedMap = React.useMemo(() => {
        if (!tajweedData) return {};
        return tajweedData.reduce((acc, v) => {
            acc[v.verse_key] = sanitizeTajweedHtml(v.text_uthmani_tajweed);
            return acc;
        }, {});
    }, [tajweedData]);

    const { ref: observerRef, inView } = useInView();

    // Reset active tafsir when tafsir source changes
    useEffect(() => {
        setActiveTafsir(null);
    }, [tafsirId]);

    useEffect(() => {
        if (inView && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

    const verses = versesResponse?.pages.flatMap(page => page.verses) || [];

    // Check if the current playing playlist is from THIS surah
    const isCurrentSurahPlaying = audioPlaylist.length > 0 && String(audioPlaylist[0]?.surahId) === String(id);
    const activeAudioVerseKey = isPlayerVisible && isCurrentSurahPlaying && audioPlaylist[audioTrackIndex]
        ? audioPlaylist[audioTrackIndex].verseKey
        : null;

    const handlePlayClick = () => {
        if (!verses || verses.length === 0) return;

        if (isCurrentSurahPlaying) {
            // Already loaded — just toggle play/pause and show player
            setIsPlaying(!isPlaying);
            setIsPlayerVisible(true);
        } else {
            // Build the playlist and show the setup modal
            const playlist = verses.map(v => {
                let url = v.audio?.url ? (v.audio.url.startsWith('http') ? v.audio.url : `https://verses.quran.com/${v.audio.url}`) : null;
                const [surahNum, ayahNum] = v.verse_key.split(':');
                const fileName = `${String(surahNum).padStart(3, '0')}${String(ayahNum).padStart(3, '0')}.mp3`;

                if (localAudioDirHandle) {
                    url = `local-audio://${fileName}`;
                } else if (customAudioBaseUrl) {
                    url = `${customAudioBaseUrl.replace(/\/$/, '')}/${fileName}`;
                }

                return {
                    surahId: id,
                    verseKey: v.verse_key,
                    verseNumber: v.verse_number,
                    url
                };
            }).filter(v => v.url);

            if (playlist.length > 0) {
                setPendingPlaylist(playlist);
                // Reset range to full surah when opening setup
                updateAudioSettings({ startRange: 0, endRange: playlist.length - 1 });
                setShowAudioSetup(true);
            }
        }
    };

    const handleStartPlaying = () => {
        if (pendingPlaylist.length === 0) return;
        setAudioPlaylist(pendingPlaylist, audioSettings.startRange ?? 0);
        setIsPlaying(true);
        setIsPlayerVisible(true);
        setShowAudioSetup(false);
    };

    const handlePlayVerse = useCallback((verse) => {
        const playlist = verses.map(v => {
            let url = v.audio?.url ? (v.audio.url.startsWith('http') ? v.audio.url : `https://verses.quran.com/${v.audio.url}`) : null;
            const [surahNum, ayahNum] = v.verse_key.split(':');
            const fileName = `${String(surahNum).padStart(3, '0')}${String(ayahNum).padStart(3, '0')}.mp3`;

            if (localAudioDirHandle) {
                url = `local-audio://${fileName}`;
            } else if (customAudioBaseUrl) {
                url = `${customAudioBaseUrl.replace(/\/$/, '')}/${fileName}`;
            }

            return { surahId: id, verseKey: v.verse_key, verseNumber: v.verse_number, url };
        }).filter(v => v.url);

        if (playlist.length === 0) return;

        const startIndex = playlist.findIndex(p => p.verseKey === verse.verse_key);
        const targetIndex = startIndex >= 0 ? startIndex : 0;

        // If this verse is already the active one, toggle play/pause
        if (isCurrentSurahPlaying && audioPlaylist[audioTrackIndex]?.verseKey === verse.verse_key) {
            setIsPlaying(!isPlaying);
            setIsPlayerVisible(true);
            return;
        }

        setAudioPlaylist(playlist, targetIndex);
        updateAudioSettings({ startRange: targetIndex, endRange: playlist.length - 1 });
        setIsPlaying(true);
        setIsPlayerVisible(true);
    }, [verses, id, localAudioDirHandle, customAudioBaseUrl, isCurrentSurahPlaying, audioPlaylist, audioTrackIndex, isPlaying, setAudioPlaylist, updateAudioSettings, setIsPlaying, setIsPlayerVisible]);

    const isDownloaded = (downloadedSurahs || []).includes(id);
    const [isDownloading, setIsDownloading] = useState(false);

    // Listen for the navbar audio button — fire handlePlayClick ONLY when count truly increments
    // Store the initial value at mount time; any change after that is a real user press.
    const mountPlayTriggerRef = React.useRef(playTriggerCount);
    useEffect(() => {
        // Ignore the initial render and any re-mount that happens with the same count
        if (playTriggerCount === mountPlayTriggerRef.current) return;
        handlePlayClick();
        mountPlayTriggerRef.current = playTriggerCount;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playTriggerCount]);


    const handleDownloadSurah = async () => {
        if (!audioData?.audio_url || isDownloading) return;

        try {
            setIsDownloading(true);
            const response = await fetch(audioData.audio_url);
            if (response.ok) {
                addDownloadedSurah(id);
            }
        } catch (error) {
            console.error("Audio download failed", error);
        } finally {
            setIsDownloading(false);
        }
    };


    const isCurrentAudio = currentAudioUrl === audioData?.audio_url;

    // Removed duplicate verses declaration
    const hasScrolledRef = React.useRef(null);

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const verseKey = queryParams.get('verse');

        // Ensure we only jump to the verse once per unique verseKey, not continuously when scrolling
        if (verseKey && verses.length > 0 && hasScrolledRef.current !== verseKey) {
            const element = document.getElementById(`verse-${verseKey}`);
            if (element) {
                hasScrolledRef.current = verseKey; // Track that we've found and scrolled to it
                setTimeout(() => {
                    element.scrollIntoView({ behavior: 'instant', block: 'center' });
                    // Briefly highlight it
                    element.style.transition = 'background-color 0.5s';
                    element.style.backgroundColor = 'var(--accent-light)';
                    setTimeout(() => {
                        element.style.backgroundColor = 'transparent';
                    }, 2000);
                }, 50);
            } else if (hasNextPage && !isFetchingNextPage) {
                // If the element is not found, aggressively fetch the next page until it appears
                fetchNextPage();
            }
        }
    }, [location.search, verses, isVersesLoading, hasNextPage, isFetchingNextPage, fetchNextPage]);

    // Track swipe direction so animation knows which way to slide
    const swipeDirectionRef = React.useRef(0); // -1 = going back (right swipe), 1 = going forward (left swipe)

    const swipeHandlers = useSwipeable({
        onSwipedLeft: () => {
            if (!backToSauka && parseInt(id) < 114) {
                surahScrollPositions[id] = window.scrollY;
                swipeDirectionRef.current = 1; // forward
                navigate(`/surah/${parseInt(id) + 1}`);
            }
        },
        onSwipedRight: () => {
            if (!backToSauka && parseInt(id) > 1) {
                surahScrollPositions[id] = window.scrollY;
                swipeDirectionRef.current = -1; // backward
                navigate(`/surah/${parseInt(id) - 1}`);
            }
        },
        preventScrollOnSwipe: false,
        trackMouse: false,
        delta: 50,
    });

    const hasRestoredScroll = React.useRef(null);
    useEffect(() => {
        if (!isVersesLoading && !isChapterLoading && verses.length > 0 && hasRestoredScroll.current !== id) {
            hasRestoredScroll.current = id;
            if (new URLSearchParams(window.location.search).get('verse')) return; // Do not override if navigating to a specific verse
            setTimeout(() => {
                const savedPos = surahScrollPositions[id];
                if (savedPos !== undefined) {
                    window.scrollTo({ top: savedPos, behavior: 'instant' });
                } else if (swipeDirectionRef.current === -1) {
                    // Navigate backwards and no saved position -> jump to bottom
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
                } else {
                    window.scrollTo({ top: 0, behavior: 'instant' });
                }
            }, 50);
        }
    }, [isVersesLoading, isChapterLoading, verses.length, id]);

    // Direction-aware page variants
    const pageVariants = {
        enter: (direction) => ({
            x: direction >= 0 ? '60%' : '-60%',
            opacity: 0,
            scale: 0.96,
        }),
        center: {
            x: 0,
            opacity: 1,
            scale: 1,
        },
        exit: (direction) => ({
            x: direction >= 0 ? '-60%' : '60%',
            opacity: 0,
            scale: 0.96,
        }),
    };

    const pageTransition = {
        type: 'spring',
        stiffness: 280,
        damping: 30,
        mass: 0.8,
    };

    if (isChapterLoading || isVersesLoading) return (
        <div className="container text-center py-[10vh] text-[var(--text-muted)]">
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="inline-block w-10 h-10 border-[3px] border-[var(--border-color)] border-t-[var(--accent-primary)] rounded-full mb-4"
            />
            <h2>Loading Ayahs...</h2>
        </div>
    );

    return (
        <div
            className="container overflow-hidden"
            {...swipeHandlers}
        >
            {/* Subtle refetch indicator — only shows when re-loading in background (not initial load) */}
            {isVersesFetching && !isVersesLoading && (
                <div className="fixed top-0 left-0 right-0 h-[3px] z-[2000] overflow-hidden pointer-events-none">
                    <motion.div
                        initial={{ x: '-100%' }}
                        animate={{ x: '100%' }}
                        transition={{ duration: 0.9, ease: 'easeInOut', repeat: Infinity }}
                        className="h-full w-[40%] bg-[linear-gradient(90deg,transparent,var(--accent-primary),transparent)] rounded"
                    />
                </div>
            )}
            <Helmet>
                <title>{chapter ? `${chapter.name_simple} - The Noble Qur'an` : "Surah - The Noble Qur'an"}</title>
                <meta name="description" content={`Read and listen to ${chapter?.name_simple} (${chapter?.translated_name.name}) online with translations and Tafsir.`} />
            </Helmet>

            <AnimatePresence mode="wait" initial={false} custom={swipeDirectionRef.current}>
                <motion.div
                    key={id}
                    custom={swipeDirectionRef.current}
                    variants={pageVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={pageTransition}
                    className="will-change-[transform,opacity]"
                >



                    <div className="surah-hero-card" style={{ padding: 'clamp(2rem, 5vw, 4rem) 1.5rem' }}>
                        <div className="surah-bg-glow" />

                        {/* Subtle decorative background Arabic text */}
                        <div
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.04] pointer-events-none select-none whitespace-nowrap text-[var(--text-primary)]"
                            style={{ fontFamily: 'var(--font-arabic)', fontSize: 'clamp(8rem, 25vw, 15rem)' }}
                        >
                            {chapter?.name_arabic}
                        </div>

                        <div className="relative z-[1]">
                            <div className="inline-block px-4 py-[0.4rem] rounded-full bg-[var(--accent-light)] text-accent font-mono text-[0.7rem] font-bold tracking-[0.1em] uppercase mb-6">
                                Surah {chapter?.id}
                            </div>

                            <h1
                                className="surah-title font-ui font-extrabold mb-2 text-[var(--text-primary)] tracking-[-1px]"
                                style={{
                                    fontSize: 'clamp(2.5rem, 8vw, 4rem)',
                                }}
                            >
                                {chapter?.name_simple}
                            </h1>
                            <p
                                className="text-[var(--text-secondary)] mb-8 font-medium"
                                style={{
                                    fontSize: 'clamp(1rem, 3vw, 1.25rem)',
                                }}
                            >
                                {chapter?.translated_name.name} • {chapter?.verses_count} Ayahs • {chapter?.revelation_place}
                            </p>

                            <div className="flex justify-center gap-4 flex-wrap">
                                <button
                                    className="btn-primary flex items-center gap-2"
                                    onClick={handlePlayClick}
                                >
                                    {isCurrentAudio && isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                                    {isCurrentAudio && isPlaying ? 'Pause Audio' : 'Play Audio'}
                                </button>
                                <button
                                    className="btn-primary flex items-center gap-2 border border-[var(--border-color)]"
                                    style={{
                                        backgroundColor: isDownloaded ? 'var(--accent-light)' : 'var(--bg-primary)',
                                        color: isDownloaded ? 'var(--accent-primary)' : 'var(--text-primary)',
                                        opacity: isDownloading ? 0.7 : 1
                                    }}
                                    onClick={handleDownloadSurah}
                                    disabled={isDownloading || isDownloaded}
                                >
                                    {isDownloading ? 'Downloading...' : isDownloaded ? 'Offline Ready' : 'Download for Offline'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Sauka Context Bar */}
                    {backToSauka && saukaAssignmentId && (
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mt-4 mb-2 mx-4 p-3 sm:p-4 rounded-[14px] bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-sm)]">
                            <div className="min-w-0 w-full sm:w-auto flex-1">
                                <div className="flex items-center gap-[0.4rem] mb-[0.15rem] text-[var(--text-primary)] font-bold text-[0.88rem]">
                                    <Target size={13} aria-hidden="true" />
                                    <span>Sauka Group Reading</span>
                                </div>
                                <div className="text-[var(--text-muted)] text-[0.76rem]">
                                    Currently reading: {saukaUnit} {saukaPartNumber}
                                </div>
                            </div>
                            <div className="flex gap-2 items-center w-full sm:w-auto">
                                <button
                                    type="button"
                                    disabled={isSaukaCompleting}
                                    onClick={handleSaukaComplete}
                                    className="flex-1 sm:flex-none justify-center min-h-9 px-4 py-2 rounded-full bg-[var(--h-teal)] text-white font-bold inline-flex items-center gap-2 text-[0.82rem] border-none cursor-pointer disabled:opacity-50"
                                >
                                    {isSaukaCompleting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} aria-hidden="true" />}
                                    Mark as Complete
                                </button>
                                <Link
                                    to={`/sauka/${backToSauka}`}
                                    className="flex-1 sm:flex-none justify-center min-h-9 px-4 py-2 rounded-full bg-[var(--bg-secondary)] text-[var(--text-muted)] font-semibold inline-flex items-center gap-2 text-[0.78rem] no-underline"
                                >
                                    ← Back to Sauka
                                </Link>
                            </div>
                        </div>
                    )}

                    <div className="px-4 flex-col" style={{ display: readingMode ? 'block' : 'flex' }}>
                        {/* Bismillah before Surah text (except Fatiha and Tawbah) */}
                        {chapter?.id !== 1 && chapter?.id !== 9 && (
                            <div
                                className="quran-text text-center mb-12 text-accent"
                                style={{
                                    fontSize: `clamp(${fontSize * 0.2 + 1.2}rem, 4vw + ${fontSize * 0.2}rem, ${fontSize * 0.4 + 2}rem)`,
                                    fontFamily: arabicFont
                                }}
                            >
                                بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                            </div>
                        )}

                        <div style={{
                            display: readingMode ? 'inline-block' : 'block',
                            textAlign: readingMode ? 'justify' : 'left',
                            direction: readingMode ? 'rtl' : 'ltr',
                            lineHeight: readingMode ? 2.5 : 'inherit'
                        }}>
                            {verses.map((verse, index) => {
                                const prevVerse = index > 0 ? verses[index - 1] : null;
                                const showPageDivider = verse.page_number && (!prevVerse || prevVerse.page_number !== verse.page_number);

                                return (
                                    <VerseRow
                                        key={verse.id}
                                        verse={verse}
                                        readingMode={readingMode}
                                        chapter={chapter}
                                        bookmark={bookmark}
                                        setBookmark={setBookmark}
                                        addRecentlyRead={addRecentlyRead}
                                        fontSize={fontSize}
                                        translationFontSize={translationFontSize}
                                        arabicFont={arabicFont}
                                        tajweedEnabled={isTajweedActive}
                                        tajweedMap={tajweedMap}
                                        activeTafsir={activeTafsir}
                                        setActiveTafsir={setActiveTafsir}
                                        isTafsirFetching={isTafsirFetching}
                                        tafsirId={tafsirId}
                                        showPageDivider={showPageDivider}
                                        tafsirs={tafsirs}
                                        mushaf={mushaf}
                                        isAudioPlaying={activeAudioVerseKey === verse.verse_key}
                                        onPlayVerse={handlePlayVerse}
                                        hifdhHistory={hifdhHistory}
                                    />
                                );
                            })}
                        </div>

                        {/* Infinite Scroll trigger area */}
                        <div ref={observerRef} className="py-8 text-center">
                            {isFetchingNextPage && (
                                <div className="text-[var(--text-muted)]">Loading more Ayahs...</div>
                            )}
                        </div>

                        {/* Footer Navigation */}
                        {!hasNextPage && !isVersesLoading && !backToSauka && (
                            <div className="mt-12 pt-8 border-t border-[var(--border-color)] flex justify-between gap-4 pb-8">
                                {parseInt(id) > 1 ? (
                                    <button
                                        onClick={() => {
                                            surahScrollPositions[id] = window.scrollY;
                                            swipeDirectionRef.current = -1;
                                            navigate(`/surah/${parseInt(id) - 1}`);
                                        }}
                                        className="interactive-hover flex items-center gap-2 p-4 bg-[var(--bg-secondary)] rounded-xl text-[var(--text-primary)] font-semibold border border-[var(--border-color)] flex-1 justify-center cursor-pointer"
                                    >
                                        <ArrowLeft size={18} /> Previous Surah
                                    </button>
                                ) : <div className="flex-1" />}

                                {parseInt(id) < 114 ? (
                                    <button
                                        onClick={() => {
                                            surahScrollPositions[id] = window.scrollY;
                                            swipeDirectionRef.current = 1;
                                            navigate(`/surah/${parseInt(id) + 1}`);
                                        }}
                                        className="interactive-hover flex items-center gap-2 p-4 bg-[var(--bg-secondary)] rounded-xl text-[var(--text-primary)] font-semibold border border-[var(--border-color)] flex-1 justify-center cursor-pointer"
                                    >
                                        Next Surah <ArrowRight size={18} />
                                    </button>
                                ) : <div className="flex-1" />}
                            </div>
                        )}
                    </div>

                </motion.div>
            </AnimatePresence>

            <AutoScroller />

            {/* Tafsir Bottom Drawer */}
            <AnimatePresence>
                {activeTafsir && (
                    <>
                        {/* Overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setActiveTafsir(null)}
                            className="fixed inset-0 bg-black/50 z-[999] backdrop-blur-sm"
                        />
                        {/* Drawer */}
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed bottom-0 left-0 right-0 bg-[var(--bg-surface)] z-[1000] rounded-t-3xl p-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] max-h-[80vh] flex flex-col border-t border-[var(--border-color)]"
                        >
                            <div className="w-10 h-[5px] bg-[var(--border-color)] rounded-[3px] mx-auto mb-6" />

                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-ui text-2xl font-bold text-[var(--text-primary)] m-0">
                                    Tafsir (Ayah {activeTafsir.verse_key.split(':')[1]})
                                </h3>
                                <button
                                    className="btn-icon bg-[var(--bg-secondary)]"
                                    onClick={() => setActiveTafsir(null)}
                                    aria-label="Close Tafsir"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div
                                className="tafsir-content overflow-y-auto pr-2 text-[var(--text-secondary)] leading-[1.8] text-base"
                                dangerouslySetInnerHTML={{ __html: activeTafsir.text }}
                            />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <AudioSetupModal
                isOpen={showAudioSetup}
                onClose={() => setShowAudioSetup(false)}
                pendingPlaylist={pendingPlaylist}
                audioSettings={audioSettings}
                updateAudioSettings={updateAudioSettings}
                handleStartPlaying={handleStartPlaying}
            />
        </div>
    );
}
