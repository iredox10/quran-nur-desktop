import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSwipeable } from 'react-swipeable';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import confetti from 'canvas-confetti';
import { ArrowLeft, CheckCircle2, ChevronRight, ChevronLeft, Check, Timer } from 'lucide-react';

import { getVersesByPage, getTajweedVersesByPage, getChapters } from '../services/api/quranApi';
import { useAppStore } from '../store/useAppStore';
import { getMushafById, isTajweedEnabledForMushaf } from '../config/mushaf';
import { sanitizeTajweedHtml } from '../utils/quranText';
import { getAssignmentProgress, getAssignmentResumePageNumber } from '../utils/planner';

import VerseRow from '../components/VerseRow';
import MushafPageView from '../components/MushafPageView';
import AudioSetupModal from '../components/AudioSetupModal';

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

export default function PlannerReader() {
    const { dayNumber: dayNumberParam } = useParams();
    const navigate = useNavigate();
    const dayNumber = parseInt(dayNumberParam) || 1;

    const {
        planner, setNavHeaderTitle, markPlannerItemComplete,
        translationId, reciterId, fontSize, readingMode,
        mushafId, arabicFont, tajweedEnabled, tafsirId,
        setPlannerLastPage,
        isPlaying, setIsPlaying, audioPlaylist, setAudioPlaylist,
        audioTrackIndex, audioSettings, updateAudioSettings,
        isPlayerVisible, setIsPlayerVisible, playTriggerCount,
        customAudioBaseUrl, localAudioDirHandle,
        bookmark, setBookmark, addRecentlyRead,
        intentionPromptEnabled,
        startPlannerTimer, stopPlannerTimer, plannerSessionTimers,
        addPlannerReflection, addPlannerBookmark, removePlannerBookmark,
        plannerBookmarks
    } = useAppStore();

    const [showIntention, setShowIntention] = useState(() => useAppStore.getState().intentionPromptEnabled);

    const mushaf = getMushafById(mushafId);
    const isTajweedActive = isTajweedEnabledForMushaf(mushafId, tajweedEnabled);

    const { data: chapters } = useQuery({
        queryKey: ['chapters'],
        queryFn: getChapters,
        staleTime: Infinity,
    });

    const assignment = useMemo(() => {
        if (!planner) return null;
        return planner.assignments.find(a => a.dayNumber === dayNumber);
    }, [planner, dayNumber]);

    const progress = useMemo(() => {
        if (!planner || !assignment) return null;
        return getAssignmentProgress(planner, assignment);
    }, [planner, assignment]);

    // Initialize page number based on resume helper
    const [pageNumber, setPageNumber] = useState(null);
    useEffect(() => {
        if (pageNumber === null && assignment && planner && chapters) {
            // First check if planner has a lastReadPage that fits in this assignment
            if (planner.lastReadPage && planner.lastReadPage >= assignment.pageStart && planner.lastReadPage <= assignment.pageEnd) {
                setPageNumber(planner.lastReadPage);
            } else {
                setPageNumber(getAssignmentResumePageNumber(planner, assignment, chapters));
            }
        }
    }, [assignment, planner, chapters, pageNumber]);

    // Track the current page in the planner for "Resume" functionality
    useEffect(() => {
        if (pageNumber !== null && setPlannerLastPage) {
            setPlannerLastPage(pageNumber);
        }
    }, [pageNumber, setPlannerLastPage]);

    // Data fetching
    const { data: pageData, isLoading: isPageLoading } = useQuery({
        queryKey: ['pageVerses', pageNumber, translationId, reciterId, mushafId],
        queryFn: () => getVersesByPage(pageNumber, translationId, reciterId, mushafId),
        enabled: pageNumber !== null,
        placeholderData: keepPreviousData,
    });

    const { data: tajweedData } = useQuery({
        queryKey: ['tajweedPage', pageNumber, mushafId],
        queryFn: () => getTajweedVersesByPage(pageNumber),
        enabled: isTajweedActive && mushaf.tajweedSource === 'uthmani_html' && pageNumber !== null,
    });

    const tajweedMap = useMemo(() => {
        if (!tajweedData) return {};
        return tajweedData.reduce((acc, v) => {
            acc[v.verse_key] = sanitizeTajweedHtml(v.text_uthmani_tajweed);
            return acc;
        }, {});
    }, [tajweedData]);

    const verses = pageData?.verses || [];
    const maxPageNumber = assignment?.pageEnd || 604;
    const minPageNumber = assignment?.pageStart || 1;

    useEffect(() => {
        setNavHeaderTitle(assignment ? `Day ${assignment.dayNumber}` : 'Planner Reader');
    }, [assignment, setNavHeaderTitle]);

    // Auto-mark current page/item as read when user navigates away
    const prevPageRef = useRef(pageNumber);
    useEffect(() => {
        const leavingPage = prevPageRef.current;
        prevPageRef.current = pageNumber;
        if (leavingPage === pageNumber || leavingPage === null || !assignment) return;
        
        // Find which item the leavingPage belonged to
        const leftItem = assignment.items.find(item => 
            leavingPage >= (item.pageStart || 1) && leavingPage <= (item.pageEnd || 604)
        );
        if (leftItem && progress) {
            if (!progress.completedRangeValues.includes(leftItem.rangeValue)) {
                // If it's a page unit or if they reached the end of the item's page bounds
                if (planner.unitType === 'page' || leavingPage >= leftItem.pageEnd) {
                    markPlannerItemComplete(assignment.dayNumber, leftItem.rangeValue);
                }
            }
        }
    }, [pageNumber, assignment, progress, planner, markPlannerItemComplete]);

    // Timer logic
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(true);

    useEffect(() => {
        if (!planner || !assignment) return;
        startPlannerTimer(planner.id, assignment.dayNumber);
    }, [planner?.id, assignment?.dayNumber, startPlannerTimer]);

    useEffect(() => {
        if (!isTimerRunning) return;
        const interval = setInterval(() => {
            setTimerSeconds(s => s + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [isTimerRunning]);

    const timerSecondsRef = useRef(timerSeconds);
    useEffect(() => {
        timerSecondsRef.current = timerSeconds;
    }, [timerSeconds]);

    useEffect(() => {
        if (!planner || !assignment) return;
        const pid = planner.id;
        const dnum = assignment.dayNumber;
        return () => {
            if (timerSecondsRef.current > 0) {
               useAppStore.getState().stopPlannerTimer(pid, dnum, timerSecondsRef.current);
            }
        };
    }, [planner?.id, assignment?.dayNumber]);

    const formatTimer = (totalSec) => {
        const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
        const s = (totalSec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // Bookmarks and Reflections logic
    const handlePlannerBookmarkToggle = useCallback((verseKey, surahName) => {
        if (!planner) return;
        const bookmarks = plannerBookmarks[planner.id] || [];
        const isBookmarked = bookmarks.some(b => b.verseKey === verseKey);
        if (isBookmarked) {
            removePlannerBookmark(planner.id, verseKey);
        } else {
            addPlannerBookmark(planner.id, verseKey, surahName, '');
        }
    }, [planner, plannerBookmarks, addPlannerBookmark, removePlannerBookmark]);

    const [reflectionText, setReflectionText] = useState('');
    const handleSaveReflection = () => {
        if (reflectionText.trim() && planner && assignment) {
            addPlannerReflection(planner.id, assignment.dayNumber, reflectionText.trim());
        }
        navigate('/planner');
    };

    // Day completion effect
    const prevIsCompleteRef = useRef(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [insightVerse, setInsightVerse] = useState(null);
    
    useEffect(() => {
        if (progress?.isComplete && !prevIsCompleteRef.current) {
            setShowConfetti(true);
            
            if (verses && verses.length > 0) {
                const randIdx = Math.floor(Math.random() * verses.length);
                setInsightVerse(verses[randIdx]);
            }

            const duration = 3000;
            const end = Date.now() + duration;

            const frame = () => {
                confetti({
                    particleCount: 5,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: ['#2E4F4A', '#B8924A', '#FAF7F0']
                });
                confetti({
                    particleCount: 5,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: ['#2E4F4A', '#B8924A', '#FAF7F0']
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            };
            frame();
        }
        prevIsCompleteRef.current = progress?.isComplete || false;
    }, [progress?.isComplete, verses]);

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
            setIsPlaying(!isPlaying);
            setIsPlayerVisible(true);
        } else {
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

    // Seamless Audio Autoplay
    const prevIsPlayingRef = useRef(isPlaying);
    const shouldAutoPlayNextRef = useRef(false);

    useEffect(() => {
        const wasPlaying = prevIsPlayingRef.current;
        prevIsPlayingRef.current = isPlaying;

        if (wasPlaying && !isPlaying && isCurrentPagePlaying) {
            const endIdx = audioSettings.endRange ?? (audioPlaylist.length - 1);
            if (audioTrackIndex >= endIdx) {
                if (pageNumber !== null && pageNumber < maxPageNumber) {
                    shouldAutoPlayNextRef.current = true;
                    swipeDirectionRef.current = 1;
                    setPageNumber(pageNumber + 1);
                }
            }
        }
    }, [isPlaying, isCurrentPagePlaying, audioTrackIndex, audioSettings.endRange, audioPlaylist, pageNumber, maxPageNumber]);

    useEffect(() => {
        if (shouldAutoPlayNextRef.current && verses.length > 0 && !isPageLoading) {
            shouldAutoPlayNextRef.current = false;
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
                setAudioPlaylist(playlist, 0);
                setIsPlaying(true);
                setIsPlayerVisible(true);
                updateAudioSettings({ startRange: 0, endRange: playlist.length - 1 });
            }
        }
    }, [verses, isPageLoading, pageNumber, setAudioPlaylist, setIsPlaying, setIsPlayerVisible, updateAudioSettings, localAudioDirHandle, customAudioBaseUrl]);

    // Swipe gestures
    const swipeDirectionRef = useRef(0);
    const swipeHandlers = useSwipeable({
        onSwipedLeft: () => {
            if (pageNumber !== null && pageNumber < maxPageNumber) {
                swipeDirectionRef.current = 1;
                setPageNumber(pageNumber + 1);
            }
        },
        onSwipedRight: () => {
            if (pageNumber !== null && pageNumber > minPageNumber) {
                swipeDirectionRef.current = -1;
                setPageNumber(pageNumber - 1);
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
        if (pageNumber !== null && pageNumber < maxPageNumber) {
            scrollToTop();
            swipeDirectionRef.current = 1;
            setPageNumber(pageNumber + 1);
        }
    };

    const handlePrevPage = () => {
        if (pageNumber !== null && pageNumber > minPageNumber) {
            scrollToTop();
            swipeDirectionRef.current = -1;
            setPageNumber(pageNumber - 1);
        }
    };

    // Auto-smooth top-scroll when verses change
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pageNumber]);

    // Keyboard support
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight' && pageNumber > minPageNumber) setPageNumber(pageNumber - 1);
            if (e.key === 'ArrowLeft' && pageNumber < maxPageNumber) setPageNumber(pageNumber + 1);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [pageNumber, maxPageNumber, minPageNumber]);

    const totalPagesInAssignment = useMemo(() => {
        if (!assignment) return 0;
        return assignment.items.reduce((acc, item) => acc + ((item.pageEnd || 1) - (item.pageStart || 1) + 1), 0);
    }, [assignment]);
    const estimatedTimeMins = Math.ceil(totalPagesInAssignment * 2.5);

    if (!planner || !assignment || pageNumber === null) {
        return (
            <div className="container py-16 text-center text-[var(--text-muted)]">
                Loading planner data...
            </div>
        );
    }

    const currentItem = assignment.items.find(item => 
        pageNumber >= (item.pageStart || 1) && pageNumber <= (item.pageEnd || 604)
    ) || assignment.items[0];

    const isCurrentItemComplete = progress.completedRangeValues.includes(currentItem.rangeValue);
    const pct = Math.round((progress.completedCount / progress.totalCount) * 100);

    return (
        <div {...swipeHandlers} className="surah-container container stretch-reading overflow-hidden font-body pb-24">
            <Helmet>
                <title>{`Day ${assignment.dayNumber} Planner Reader - The Noble Qur'an`}</title>
            </Helmet>

            {/* Planner specific header */}
            <div className="mb-6 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] overflow-hidden">
                <div className="p-4 sm:p-5">
                    <div className="flex items-center gap-4 mb-3">
                        <Link to="/planner" className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--accent-light)] transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <div className="flex-1">
                            <h2 className="m-0 font-ui text-[1.2rem] font-bold text-[var(--text-primary)]">{assignment.title}</h2>
                            <div className="flex items-center gap-2 m-0 text-[0.85rem] text-[var(--text-muted)]">
                                <span>{assignment.subtitle}</span>
                                <span>•</span>
                                <span>⏱️ ~{estimatedTimeMins} mins</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-center px-3 py-1.5 rounded-full bg-[var(--plr-teal-light)] text-[var(--plr-teal)] font-mono text-sm font-bold opacity-80"
                             onClick={() => setIsTimerRunning(prev => !prev)}
                             title={isTimerRunning ? "Pause Timer" : "Resume Timer"}
                             style={{ cursor: 'pointer' }}
                        >
                            <Timer size={14} className="mr-1" />
                            {formatTimer(timerSeconds)}
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                            <div className="h-full bg-[var(--plr-teal)] transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="font-ui text-[0.85rem] font-semibold text-[var(--plr-teal)]">{pct}%</span>
                    </div>
                </div>
                
                {/* Item Checklist */}
                <div className="bg-[var(--bg-surface)] px-4 py-3 flex overflow-x-auto gap-2 scrollbar-hide border-t border-[var(--border-color)]">
                    {assignment.items.map((item, idx) => {
                        const isDone = progress.completedRangeValues.includes(item.rangeValue);
                        const isCurrent = currentItem.rangeValue === item.rangeValue;
                        return (
                            <button
                                key={item.rangeValue}
                                onClick={() => setPageNumber(item.pageStart)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full whitespace-nowrap text-[0.8rem] font-semibold transition-colors border-none cursor-pointer ${
                                    isCurrent 
                                        ? 'bg-[var(--plr-gold-soft)] text-[var(--plr-gold)] shadow-[0_0_0_2px_var(--plr-gold)]' 
                                        : isDone 
                                            ? 'bg-[var(--plr-teal)] text-white' 
                                            : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--border-color)]'
                                }`}
                            >
                                {isDone && <Check size={14} />}
                                {item.title}
                            </button>
                        );
                    })}
                </div>
                
                {/* Prayer Slots mini-indicator */}
                <div className="bg-[var(--bg-surface)] px-4 pb-3 flex items-center justify-between gap-1 text-[0.7rem] font-ui text-[var(--text-muted)] uppercase tracking-wider">
                    {(useAppStore.getState().prayerSettings?.activePrayers || ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']).map((name, i, arr) => {
                        const slotEnd = Math.floor(((i + 1) / arr.length) * assignment.items.length);
                        const done = progress.completedCount;
                        const isDone = done >= slotEnd && slotEnd > 0;
                        return (
                            <div key={name} className={`flex items-center gap-1 ${isDone ? 'text-[var(--plr-teal)] font-bold' : ''}`}>
                                <span>{name}</span>
                                {isDone && <Check size={12} />}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Confetti / Success Modal */}
            <AnimatePresence>
                {showConfetti && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="mb-8 rounded-2xl bg-[var(--plr-teal)] p-6 text-white text-center shadow-lg relative overflow-hidden"
                    >
                        <div className="relative z-10">
                            <h2 className="m-0 mb-2 font-ui text-2xl font-bold">Alhamdulillah! 🎉</h2>
                            <p className="m-0 mb-4 opacity-90 text-[0.95rem]">You have completed Day {assignment.dayNumber}.</p>
                            
                            {insightVerse && (
                                <div className="bg-black/10 rounded-xl p-4 mb-5 text-left backdrop-blur-sm border border-white/10 shadow-inner">
                                    <p className="m-0 font-ui text-[0.7rem] uppercase tracking-wider text-white/80 mb-2 font-semibold">Takeaway of the Day</p>
                                    <p className="m-0 font-quran text-[1.3rem] text-white text-right leading-loose mb-3" dir="rtl">{insightVerse.text_uthmani}</p>
                                    <p className="m-0 font-body text-[0.85rem] text-white/90 leading-relaxed italic">"{insightVerse.translations?.[0]?.text?.replace(/<[^>]+>/g, '')}"</p>
                                    <p className="m-0 text-[0.75rem] text-white/60 mt-2 font-medium">— Surah {insightVerse.verse_key.replace(':', ', Ayah ')}</p>
                                </div>
                            )}

                            <div className="mb-6 text-left">
                                <label className="block text-white/90 text-sm font-semibold mb-2">Daily Reflection (Optional)</label>
                                <textarea 
                                    className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-white placeholder-white/40 focus:outline-none focus:border-white/50 resize-none font-body text-sm"
                                    rows={3}
                                    placeholder="Write a brief reflection for today's reading..."
                                    value={reflectionText}
                                    onChange={(e) => setReflectionText(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-3 justify-center">
                                <button onClick={handleSaveReflection} className="px-6 py-2.5 rounded-full bg-white text-[var(--plr-teal)] font-bold text-sm border-none cursor-pointer hover:bg-white/90 transition-colors">
                                    {reflectionText.trim() ? 'Save & Return' : 'Return to Planner'}
                                </button>
                            </div>
                        </div>
                        <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
                            <CheckCircle2 size={120} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Quran Content */}
            <AnimatePresence mode="wait" initial={false} custom={swipeDirectionRef.current}>
                <motion.div
                    key={pageNumber}
                    custom={swipeDirectionRef.current}
                    variants={pageVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="will-change-[transform,opacity]"
                >
                    <div className="relative z-[5] pb-6">
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
                                                showPageDivider={false}
                                                mushaf={mushaf}
                                                isAudioPlaying={activeAudioVerseKey === verse.verse_key}
                                                onPlannerBookmark={handlePlannerBookmarkToggle}
                                                isPlannerBookmark={plannerBookmarks[planner?.id]?.some(b => b.verseKey === verse.verse_key)}
                                            />
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                    
                    {/* Mark Item Done Button (if not auto-marked or explicitly requested) */}
                    {!isCurrentItemComplete && !progress.isComplete && (
                        <div className="flex justify-center mb-8">
                            <button
                                onClick={() => markPlannerItemComplete(assignment.dayNumber, currentItem.rangeValue)}
                                className="flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--plr-teal)] text-white font-bold cursor-pointer hover:bg-[var(--plr-teal-mid)] transition-colors border-none shadow-md"
                            >
                                <CheckCircle2 size={18} />
                                Mark {currentItem.title} Done
                            </button>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Pagination restricted to assignment bounds */}
            <div className="flex justify-between items-center mt-4 border-t border-[var(--border-color)] pt-8 pb-8">
                <button
                    onClick={handleNextPage}
                    disabled={pageNumber >= maxPageNumber}
                    className="interactive-hover flex items-center gap-2 p-3 px-5 rounded-2xl border-none bg-[var(--bg-secondary)] text-[var(--text-primary)] font-semibold text-[0.95rem] transition-all duration-200"
                    style={{
                        cursor: pageNumber >= maxPageNumber ? 'not-allowed' : 'pointer',
                        opacity: pageNumber >= maxPageNumber ? 0.3 : 1,
                    }}
                >
                    <ChevronLeft size={18} />
                    <div className="flex flex-col items-start text-left">
                        <span className="text-xs text-[var(--text-muted)] uppercase tracking-[0.5px]">Next</span>
                        <span className="text-sm">Page {pageNumber + 1 > maxPageNumber ? maxPageNumber : pageNumber + 1}</span>
                    </div>
                </button>

                <div className="text-center text-[var(--text-muted)] text-[0.85rem] font-medium font-mono">
                    {pageNumber} / {maxPageNumber}
                </div>

                <button
                    onClick={handlePrevPage}
                    disabled={pageNumber <= minPageNumber}
                    className="interactive-hover flex items-center gap-2 p-3 px-5 rounded-2xl border-none bg-[var(--bg-secondary)] text-[var(--text-primary)] font-semibold text-[0.95rem] transition-all duration-200"
                    style={{
                        cursor: pageNumber <= minPageNumber ? 'not-allowed' : 'pointer',
                        opacity: pageNumber <= minPageNumber ? 0.3 : 1,
                    }}
                >
                    <div className="flex flex-col items-end text-right">
                        <span className="text-xs text-[var(--text-muted)] uppercase tracking-[0.5px]">Prev</span>
                        <span className="text-sm">Page {pageNumber - 1 < minPageNumber ? minPageNumber : pageNumber - 1}</span>
                    </div>
                    <ChevronRight size={18} />
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
        </div>
    );
}
