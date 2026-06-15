import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSwipeable } from 'react-swipeable';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, ChevronLeft, Minus, Pause, Play, Plus, Target, X } from 'lucide-react';

import { getVersesByPage, getTajweedVersesByPage, getChapters } from '../services/api/quranApi';
import { useAppStore } from '../store/useAppStore';
import { getMushafById, isTajweedEnabledForMushaf } from '../config/mushaf';
import { sanitizeTajweedHtml } from '../utils/quranText';
import { getAssignmentProgress, getPlannerPageContext } from '../utils/planner';

import VerseRow from '../components/VerseRow';
import MushafPageView from '../components/MushafPageView';
import AudioSetupModal from '../components/AudioSetupModal';

const pageTransition = {
    type: 'spring',
    stiffness: 300,
    damping: 30,
    mass: 1,
};

const pageVariants = {
    enter: (direction) => ({
        x: direction > 0 ? '100%' : '-100%',
        opacity: 0,
        position: 'absolute',
        width: '100%',
    }),
    center: {
        x: 0,
        opacity: 1,
        position: 'relative',
    },
    exit: (direction) => ({
        x: direction > 0 ? '-100%' : '100%',
        opacity: 0,
        position: 'absolute',
        width: '100%',
    }),
};

export default function Page() {
    const { id } = useParams();
    const pageNumber = parseInt(id) || 1;
    const location = useLocation();
    const navigate = useNavigate();

    // App State
    const {
        translationId, reciterId, fontSize,
        readingMode,
        bookmark, setBookmark, addRecentlyRead,
        mushafId, arabicFont, tajweedEnabled, tafsirId,
        setNavHeaderTitle,
        autoScroll, setAutoScroll, autoScrollSpeed, setAutoScrollSpeed,
        isAutoScrollPaused, setIsAutoScrollPaused,
        planner, markPlannerItemComplete, togglePlannerDayComplete,
        setPlannerLastPage,
        setIsPlaying, isPlaying, audioPlaylist, setAudioPlaylist,
        audioTrackIndex, audioSettings, updateAudioSettings,
        isPlayerVisible, setIsPlayerVisible, playTriggerCount,
        customAudioBaseUrl, localAudioDirHandle
    } = useAppStore();
    const mushaf = getMushafById(mushafId);
    const isTajweedActive = isTajweedEnabledForMushaf(mushafId, tajweedEnabled);

    // Queries
    const { data: pageData, isLoading: isPageLoading } = useQuery({
        queryKey: ['pageVerses', pageNumber, translationId, reciterId, mushafId],
        queryFn: () => getVersesByPage(pageNumber, translationId, reciterId, mushafId),
        placeholderData: keepPreviousData,
    });

    const { data: tajweedData } = useQuery({
        queryKey: ['tajweedPage', pageNumber, mushafId],
        queryFn: () => getTajweedVersesByPage(pageNumber),
        enabled: isTajweedActive && mushaf.tajweedSource === 'uthmani_html',
    });

    const { data: chapters } = useQuery({
        queryKey: ['chapters'],
        queryFn: getChapters,
        staleTime: Infinity,
    });

    const tajweedMap = React.useMemo(() => {
        if (!tajweedData) return {};
        return tajweedData.reduce((acc, v) => {
            acc[v.verse_key] = sanitizeTajweedHtml(v.text_uthmani_tajweed);
            return acc;
        }, {});
    }, [tajweedData]);

    const verses = pageData?.verses || [];
    const maxPageNumber = mushaf.pageCount || 604;
    const plannerPageContext = React.useMemo(() => getPlannerPageContext(planner, pageNumber, chapters || []), [planner, pageNumber, chapters]);
    const plannerAssignmentProgress = plannerPageContext
        ? getAssignmentProgress(planner, plannerPageContext.assignment)
        : null;

    // Track the current page in the planner for "Resume" functionality
    // Only fire on pageNumber change — NOT on plannerPageContext (which depends on planner, creating a loop)
    const lastTrackedPageRef = React.useRef(null);
    useEffect(() => {
        if (lastTrackedPageRef.current === pageNumber) return;
        lastTrackedPageRef.current = pageNumber;
        // Check planner context at call time to avoid stale closure
        const { planner: p, setPlannerLastPage: setPage } = useAppStore.getState();
        if (p && setPage) {
            setPage(pageNumber);
        }
    }, [pageNumber]);

    // Auto-mark current page as read when the user navigates to a new page
    const prevPageRef = React.useRef(pageNumber);
    useEffect(() => {
        const leavingPage = prevPageRef.current;
        prevPageRef.current = pageNumber;
        if (leavingPage === pageNumber) return; // initial mount, no change
        // Use getState() to get fresh planner data at the moment of navigation
        const { planner: currentPlanner, markPlannerItemComplete: markDone } = useAppStore.getState();
        if (!currentPlanner) return;
        const leftCtx = getPlannerPageContext(currentPlanner, leavingPage, chapters || []);
        if (!leftCtx || !leftCtx.currentItem) return;
        const leftProgress = getAssignmentProgress(currentPlanner, leftCtx.assignment);
        if (!leftProgress.completedRangeValues.includes(leftCtx.currentItem.rangeValue)) {
            markDone(leftCtx.assignment.dayNumber, leftCtx.currentItem.rangeValue);
        }
    }, [pageNumber, chapters]);

    const activeSurahId = verses.length > 0 ? verses[0].verse_key.split(':')[0] : null;
    const activeSurah = chapters?.find(c => c.id.toString() === activeSurahId);

    useEffect(() => {
        if (activeSurah) {
            setNavHeaderTitle(`${activeSurah.name_simple} • Page ${pageNumber}`);
        } else {
            setNavHeaderTitle(`Page ${pageNumber}`);
        }
    }, [activeSurah, pageNumber, setNavHeaderTitle]);

    // Audio Playback State Let's setup modal
    const [showAudioSetup, setShowAudioSetup] = useState(false);
    const [pendingPlaylist, setPendingPlaylist] = useState([]);

    const isCurrentPagePlaying = audioPlaylist.length > 0 && String(audioPlaylist[0]?.pageNumber) === String(pageNumber);
    const activeAudioVerseKey = isPlayerVisible && isCurrentPagePlaying && audioPlaylist[audioTrackIndex]
        ? audioPlaylist[audioTrackIndex].verseKey
        : null;

    const handlePlayClick = useCallback(() => {
        if (!verses || verses.length === 0) return;

        if (isCurrentPagePlaying) {
            // Already playing this page— toggle play/pause and show player
            setIsPlaying(!isPlaying);
            setIsPlayerVisible(true);
        } else {
            // Setup the playlist for this page's verses
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
                    pageNumber: pageNumber,
                    surahId: parseInt(surahNum),
                    verseKey: v.verse_key,
                    verseNumber: v.verse_number,
                    url
                };
            }).filter(v => v.url);

            if (playlist.length > 0) {
                setPendingPlaylist(playlist);
                updateAudioSettings({ startRange: 0, endRange: playlist.length - 1 });
                setShowAudioSetup(true);
            }
        }
    }, [verses, isCurrentPagePlaying, isPlaying, pageNumber, localAudioDirHandle, customAudioBaseUrl, setIsPlaying, setIsPlayerVisible, updateAudioSettings]);

    const handleStartPlaying = () => {
        if (pendingPlaylist.length === 0) return;
        setAudioPlaylist(pendingPlaylist, audioSettings.startRange ?? 0);
        setIsPlaying(true);
        setIsPlayerVisible(true);
        setShowAudioSetup(false);
    };

    const mountPlayTriggerRef = useRef(playTriggerCount);
    useEffect(() => {
        if (playTriggerCount === mountPlayTriggerRef.current) return;
        handlePlayClick();
        mountPlayTriggerRef.current = playTriggerCount;
    }, [playTriggerCount, handlePlayClick]);

    // Handle Top Level Keyboard
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight' && pageNumber > 1) navigate(`/page/${pageNumber - 1}`);
            if (e.key === 'ArrowLeft' && pageNumber < maxPageNumber) navigate(`/page/${pageNumber + 1}`);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [pageNumber, maxPageNumber, navigate]);

    const scrollRafRef = useRef(null);
    const lastScrollTimestampRef = useRef(null);
    const scrollRemainderRef = useRef(0);

    useEffect(() => {
        if (!autoScroll) {
            if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
            lastScrollTimestampRef.current = null;
            scrollRemainderRef.current = 0;
            return;
        }

        const speedMap = { 1: 5, 2: 10, 3: 18, 4: 36, 5: 60, 6: 108, 7: 180 };
        const pxPerSecond = speedMap[autoScrollSpeed] || 60;

        const tick = (timestamp) => {
            if (lastScrollTimestampRef.current == null) {
                lastScrollTimestampRef.current = timestamp;
            }

            const deltaMs = timestamp - lastScrollTimestampRef.current;
            lastScrollTimestampRef.current = timestamp;

            if (!isAutoScrollPaused) {
                const nextDistance = scrollRemainderRef.current + (pxPerSecond * deltaMs) / 1000;
                const wholePixels = Math.trunc(nextDistance);

                scrollRemainderRef.current = nextDistance - wholePixels;

                if (wholePixels !== 0) {
                    window.scrollBy(0, wholePixels);
                }
            }

            if ((window.innerHeight + window.scrollY) >= document.body.scrollHeight - 10) {
                setAutoScroll(false);
                return;
            }

            scrollRafRef.current = requestAnimationFrame(tick);
        };

        scrollRafRef.current = requestAnimationFrame(tick);

        return () => {
            if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
            lastScrollTimestampRef.current = null;
            scrollRemainderRef.current = 0;
        };
    }, [autoScroll, autoScrollSpeed, isAutoScrollPaused, setAutoScroll]);

    useEffect(() => {
        return () => setAutoScroll(false);
    }, [setAutoScroll]);

    // Swipe gestures
    const swipeDirectionRef = useRef(0);
    const swipeHandlers = useSwipeable({
        onSwipedLeft: () => {
            if (pageNumber < maxPageNumber) {
                swipeDirectionRef.current = 1;
                navigate(`/page/${pageNumber + 1}`);
            }
        },
        onSwipedRight: () => {
            if (pageNumber > 1) {
                swipeDirectionRef.current = -1;
                navigate(`/page/${pageNumber - 1}`);
            }
        },
        preventDefaultTouchmoveEvent: false,
        trackTouch: true,
        trackMouse: false,
        delta: 40,
        swipeDuration: 500
    });

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'auto' });
    };

    const handleNextPage = () => {
        if (pageNumber < maxPageNumber) {
            scrollToTop();
            swipeDirectionRef.current = 1;
            navigate(`/page/${pageNumber + 1}`);
        }
    };

    const handlePrevPage = () => {
        if (pageNumber > 1) {
            scrollToTop();
            swipeDirectionRef.current = -1;
            navigate(`/page/${pageNumber - 1}`);
        }
    };

    // Auto-smooth top-scroll when verses change (avoids jank)
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pageNumber]);

    return (
        <div
            {...swipeHandlers}
            className="surah-container container stretch-reading overflow-hidden"
        >
            <Helmet>
                <title>{`Page ${pageNumber} - ${mushaf?.name || ''} - The Noble Qur'an`}</title>
            </Helmet>

            <AnimatePresence mode="wait" initial={false} custom={swipeDirectionRef.current}>
                <motion.div
                    key={pageNumber}
                    custom={swipeDirectionRef.current}
                    variants={pageVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={pageTransition}
                    className="will-change-[transform,opacity]"
                >
                    <div className="surah-hero-card mb-8" style={{ padding: 'clamp(1rem, 3vw, 2rem) 1.5rem' }}>
                        <div className="surah-bg-glow" />
                        <div className="relative z-[1] text-center">
                            <div className="inline-block px-4 py-[0.4rem] rounded-full bg-[var(--accent-light)] text-[var(--accent-primary)] font-mono text-[0.7rem] font-bold tracking-[0.1em] uppercase mb-2">
                                {mushaf.name} Mushaf
                            </div>
                            <h1 className="font-ui font-extrabold m-0 leading-[1.2] text-[var(--text-primary)] tracking-[-1px]" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)' }}>
                                Page {pageNumber}
                            </h1>
                            <p className="text-[var(--text-muted)] mt-[0.8rem] text-[1.1rem] font-medium">
                                {activeSurah ? `${activeSurah.name_simple} (${activeSurah.translated_name.name})` : 'Loading...'}
                            </p>
                        </div>
                    </div>

                    {/* Planner context bar — shown at top when reading from a plan */}
                    {plannerPageContext && plannerAssignmentProgress && (
                        <div className="flex justify-between items-center gap-3 mb-5 p-3 px-4 rounded-[14px] bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] flex-wrap">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-[0.4rem] mb-[0.15rem] text-[var(--text-primary)] font-bold text-[0.88rem]">
                                    <Target size={13} aria-hidden="true" />
                                    <span>{plannerPageContext.assignment.title}</span>
                                    {plannerAssignmentProgress.isComplete && (
                                        <span className="ml-[0.3rem] text-[#22c55e] text-[0.78rem] font-semibold">✓ Done</span>
                                    )}
                                </div>
                                <div className="text-[var(--text-muted)] text-[0.76rem]">
                                    {plannerAssignmentProgress.isComplete
                                        ? 'Day completed 🎉'
                                        : `Page ${plannerAssignmentProgress.completedCount + 1} of ${plannerAssignmentProgress.totalCount} · ${plannerAssignmentProgress.remainingCount} remaining`}
                                </div>
                            </div>
                            <div className="flex gap-[0.4rem] items-center flex-wrap">
                                {!plannerAssignmentProgress.isComplete && !plannerPageContext.isCurrentItemComplete && (
                                    <button
                                        type="button"
                                        onClick={() => markPlannerItemComplete(plannerPageContext.assignment.dayNumber, plannerPageContext.currentItem?.rangeValue)}
                                        className="min-h-9 px-[0.8rem] py-2 rounded-full bg-[var(--accent-light)] text-[var(--accent-primary)] font-bold inline-flex items-center gap-[0.35rem] text-[0.82rem] border-none cursor-pointer"
                                    >
                                        <CheckCircle2 size={13} aria-hidden="true" />
                                        Mark done
                                    </button>
                                )}
                                <Link
                                    to="/planner"
                                    className="min-h-9 px-[0.8rem] py-2 rounded-full bg-[var(--bg-secondary)] text-[var(--text-muted)] font-semibold inline-flex items-center gap-[0.3rem] text-[0.78rem] no-underline"
                                >
                                    ← Planner
                                </Link>
                            </div>
                        </div>
                    )}

                    <div className="relative z-[5] pb-16">
                        {mushaf.renderMode === 'qcf-page' && !readingMode ? (
                            isPageLoading && verses.length === 0 ? (
                                <div className="text-center py-[10vh] text-[var(--text-muted)]">
                                    <span className="ui-text">Loading page {pageNumber}...</span>
                                </div>
                            ) : (
                                <MushafPageView
                                    verses={verses}
                                    mushaf={mushaf}
                                    arabicFont={arabicFont}
                                    fontSize={fontSize}
                                    activeAudioVerseKey={activeAudioVerseKey}
                                />
                            )
                        ) : (
                            <div className="w-full" style={{
                                display: readingMode ? 'inline-block' : 'block',
                                textAlign: readingMode ? 'justify' : 'left',
                                direction: readingMode ? 'rtl' : 'ltr',
                            }}>
                                {isPageLoading && verses.length === 0 ? (
                                    <div className="text-center py-[10vh] text-[var(--text-muted)]">
                                        <span className="ui-text">Loading page {pageNumber}...</span>
                                    </div>
                                ) : (
                                    verses.map((verse) => {
                                        const chId = verse.verse_key.split(':')[0];
                                        const chapterContext = chapters?.find(c => c.id.toString() === chId) || { id: parseInt(chId), name_simple: `Surah ${chId}` };

                                        return (
                                            <React.Fragment key={verse.id}>
                                                {verse.verse_number === 1 && (
                                                    <div style={{ display: 'block', width: '100%', textAlign: 'center', direction: 'ltr' }} className="my-12">
                                                        <div className="inline-flex flex-col items-center justify-center rounded-[24px] bg-[var(--bg-secondary)] px-10 py-8 border border-[var(--border-color)] relative overflow-hidden shadow-sm">
                                                            <div className="absolute top-0 left-0 w-full h-1 bg-[var(--accent-primary)] opacity-50"></div>
                                                            <div className="inline-block px-4 py-1 rounded-full bg-[var(--accent-light)] text-[var(--accent-primary)] font-mono text-[0.7rem] font-bold tracking-[0.1em] uppercase mb-4">
                                                                Surah {chapterContext.id}
                                                            </div>
                                                            <h3 className="font-ui text-3xl font-extrabold text-[var(--text-primary)] m-0 mb-2">{chapterContext.name_simple}</h3>
                                                            {chapterContext.translated_name?.name && (
                                                                <p className="font-ui text-[0.95rem] text-[var(--text-muted)] m-0 font-medium">
                                                                    {chapterContext.translated_name.name} • {chapterContext.verses_count} Ayahs
                                                                </p>
                                                            )}
                                                        </div>
                                                        {chapterContext.id !== 1 && chapterContext.id !== 9 && (
                                                            <div
                                                                className="quran-text text-center mt-10 mb-4 text-[var(--accent-primary)]"
                                                                style={{
                                                                    fontSize: `clamp(1.5rem, ${fontSize * 0.4 + 1.5}rem, 4rem)`,
                                                                    fontFamily: arabicFont,
                                                                    direction: 'rtl'
                                                                }}
                                                            >
                                                                بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                <VerseRow
                                                    key={verse.id}
                                                    verse={verse}
                                                    readingMode={readingMode}
                                                    chapter={chapterContext}
                                                    bookmark={bookmark}
                                                    setBookmark={setBookmark}
                                                    addRecentlyRead={addRecentlyRead}
                                                    fontSize={fontSize}
                                                    arabicFont={arabicFont}
                                                    tajweedEnabled={isTajweedActive}
                                                    tajweedMap={tajweedMap}
                                                    activeTafsir={null}
                                                    setActiveTafsir={() => { }}
                                                    isTafsirFetching={false}
                                                    tafsirs={[]}
                                                    tafsirId={tafsirId}
                                                    showPageDivider={false} // since it's exactly 1 page
                                                    mushaf={mushaf}
                                                    isAudioPlaying={activeAudioVerseKey === verse.verse_key}
                                                />
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Old planner bar removed — now shown at top */}

            <div className="flex justify-between items-center mt-4 border-t border-[var(--border-color)] pt-12 pb-8">
                <button
                    onClick={handleNextPage}
                    disabled={pageNumber >= maxPageNumber}
                    className="interactive-hover flex items-center gap-2 p-4 px-6 rounded-2xl border-none bg-[var(--bg-secondary)] text-[var(--text-primary)] font-semibold text-[0.95rem] transition-all duration-200"
                    style={{
                        cursor: pageNumber >= maxPageNumber ? 'not-allowed' : 'pointer',
                        opacity: pageNumber >= maxPageNumber ? 0.5 : 1,
                    }}
                >
                    <ChevronLeft size={20} />
                    <div className="flex flex-col items-start text-left">
                        <span className="font-mono text-[0.65rem] font-semibold text-[var(--text-muted)] uppercase tracking-[0.1em]">Next</span>
                        <span>Page {pageNumber + 1 > maxPageNumber ? maxPageNumber : pageNumber + 1}</span>
                    </div>
                </button>

                <div className="text-center font-mono text-[0.75rem] font-semibold text-[var(--text-muted)]">
                    {pageNumber} / {maxPageNumber}
                </div>

                <button
                    onClick={handlePrevPage}
                    disabled={pageNumber <= 1}
                    className="interactive-hover flex items-center gap-2 p-4 px-6 rounded-2xl border-none bg-[var(--bg-secondary)] text-[var(--text-primary)] font-semibold text-[0.95rem] transition-all duration-200"
                    style={{
                        cursor: pageNumber <= 1 ? 'not-allowed' : 'pointer',
                        opacity: pageNumber <= 1 ? 0.5 : 1,
                    }}
                >
                    <div className="flex flex-col items-end text-right">
                        <span className="font-mono text-[0.65rem] font-semibold text-[var(--text-muted)] uppercase tracking-[0.1em]">Previous</span>
                        <span>Page {pageNumber - 1 < 1 ? 1 : pageNumber - 1}</span>
                    </div>
                    <ChevronRight size={20} />
                </button>
            </div>

            <AudioSetupModal
                isOpen={showAudioSetup}
                onClose={() => setShowAudioSetup(false)}
                pendingPlaylist={pendingPlaylist}
                audioSettings={audioSettings}
                updateAudioSettings={updateAudioSettings}
                handleStartPlaying={handleStartPlaying}
            />

            <AnimatePresence>
                {autoScroll && (
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 40 }}
                        transition={{ duration: 0.25 }}
                        className="fixed left-0 right-0 mx-auto w-fit z-[100]"
                        style={{
                            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
                        }}
                    >
                        <div className="flex items-center gap-3 px-4 py-[0.6rem] rounded-full bg-[var(--glass-bg)] backdrop-blur-lg border-[var(--glass-border)] shadow-[var(--shadow-lg)]">
                            <div className="flex gap-1">
                                <button
                                    className="btn-icon w-7 h-7 bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                                    onClick={() => window.scrollBy({ top: -200, behavior: 'smooth' })}
                                    aria-label="Scroll up"
                                >
                                    <ArrowLeft size={14} className="rotate-90" />
                                </button>
                                <button
                                    className="btn-icon w-7 h-7 bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                                    onClick={() => window.scrollBy({ top: 200, behavior: 'smooth' })}
                                    aria-label="Scroll down"
                                >
                                    <ArrowRight size={14} className="rotate-90" />
                                </button>
                            </div>

                            <div className="w-px h-6 bg-[var(--border-color)]" />

                            <button
                                className="btn-icon w-7 h-7 border border-[var(--border-color)] rounded-full"
                                onClick={() => setAutoScrollSpeed(Math.max(1, autoScrollSpeed - 1))}
                                aria-label="Decrease auto-scroll speed"
                            >
                                <Minus size={14} />
                            </button>
                            <span className="font-mono text-[0.8rem] font-bold text-[var(--text-primary)] min-w-[40px] text-center">
                                {autoScrollSpeed}x
                            </span>
                            <button
                                className="btn-icon w-7 h-7 border border-[var(--border-color)] rounded-full"
                                onClick={() => setAutoScrollSpeed(Math.min(7, autoScrollSpeed + 1))}
                                aria-label="Increase auto-scroll speed"
                            >
                                <Plus size={14} />
                            </button>

                            <button
                                className="btn-icon w-8 h-8 text-[var(--accent-primary)]"
                                style={{
                                    background: isAutoScrollPaused ? 'var(--accent-light)' : 'transparent',
                                }}
                                onClick={() => setIsAutoScrollPaused(!isAutoScrollPaused)}
                                aria-label={isAutoScrollPaused ? 'Resume auto-scroll' : 'Pause auto-scroll'}
                            >
                                {isAutoScrollPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
                            </button>

                            <div className="w-px h-6 bg-[var(--border-color)]" />

                            <button
                                onClick={() => setAutoScroll(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-[rgba(239,68,68,0.1)] text-[rgb(239,68,68)] border-none cursor-pointer"
                                aria-label="Stop auto-scroll"
                                title="Stop auto-scroll"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
