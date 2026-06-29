import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSwipeable } from 'react-swipeable';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import confetti from 'canvas-confetti';
import { ArrowLeft, CheckCircle2, ChevronRight, ChevronLeft, Check, Timer, Minus, Plus, Play, Pause, ArrowRight, X } from 'lucide-react';

import { getVersesByPage, getTajweedVersesByPage, getChapters, getPageTafsirs } from '../services/api/quranApi';
import { useAppStore } from '../store/useAppStore';
import { getMushafById, isTajweedEnabledForMushaf } from '../config/mushaf';
import { sanitizeTajweedHtml } from '../utils/quranText';
import { getAssignmentProgress, getAssignmentResumePageNumber } from '../utils/planner';

import VerseRow from '../components/VerseRow';
import MushafPageView from '../components/MushafPageView';
import AudioSetupModal from '../components/AudioSetupModal';
import AutoScroller from '../components/AutoScroller';

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
        planner, setNavHeaderTitle, markPlannerItemComplete, markPlannerPageRead,
        translationId, reciterId, fontSize, readingMode,
        mushafId, arabicFont, tajweedEnabled, tafsirId,
        setPlannerLastPosition,
        isPlaying, setIsPlaying, audioPlaylist, setAudioPlaylist,
        audioTrackIndex, audioSettings, updateAudioSettings,
        isPlayerVisible, setIsPlayerVisible, playTriggerCount,
        customAudioBaseUrl, localAudioDirHandle,
        bookmark, setBookmark, addRecentlyRead,
        intentionPromptEnabled,
        startPlannerTimer, stopPlannerTimer, plannerSessionTimers,
        addPlannerReflection, addPlannerBookmark, removePlannerBookmark,
        plannerBookmarks,
        autoScroll, setAutoScroll, autoScrollSpeed, setAutoScrollSpeed
    } = useAppStore();

    const [showIntention, setShowIntention] = useState(() => useAppStore.getState().intentionPromptEnabled);
    const [isScrolled, setIsScrolled] = useState(false);
    const [isFocusMode, setIsFocusMode] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 40);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

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

    const currentChapter = useMemo(() => {
        if (!chapters || !pageNumber) return null;
        return chapters.find(c => {
            if (!c.pages || !c.pages.length) return false;
            const start = c.pages[0];
            const end = c.pages[1] || start;
            return pageNumber >= start && pageNumber <= end;
        });
    }, [chapters, pageNumber]);

    const [activeTafsir, setActiveTafsir] = useState(null); // stores { verse_key, text }

    const { data: tafsirs, isFetching: isTafsirFetching } = useQuery({
        queryKey: ['tafsirs', 'page', pageNumber, tafsirId],
        queryFn: () => getPageTafsirs(pageNumber, tafsirId),
        enabled: pageNumber !== null,
        placeholderData: keepPreviousData,
    });

    useEffect(() => {
        setActiveTafsir(null);
    }, [tafsirId, pageNumber]);

    // Track the current page and verse in the planner for "Resume" functionality
    const prevTrackedRef = useRef({ page: null, day: null });
    useEffect(() => {
        if (pageNumber !== null && assignment) {
            const currentDay = assignment.dayNumber;
            if (prevTrackedRef.current.page !== pageNumber || prevTrackedRef.current.day !== currentDay) {
                if (setPlannerLastPosition) setPlannerLastPosition(pageNumber); // Will be updated with verse later by observer
                if (markPlannerPageRead) markPlannerPageRead(currentDay, pageNumber);
                
                prevTrackedRef.current = { page: pageNumber, day: currentDay };
            }
        }
    }, [pageNumber, planner, assignment, setPlannerLastPosition, markPlannerPageRead]);

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

    // Track active verse on scroll to save exactly where the user left off
    useEffect(() => {
        if (!verses || verses.length === 0 || isPageLoading) return;
        
        let timeoutId;
        const observer = new IntersectionObserver((entries) => {
            const visible = entries.filter(e => e.isIntersecting);
            if (visible.length > 0) {
                // Sort to find the top-most visible verse
                visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                const targetId = visible[0].target.id;
                if (targetId && targetId.startsWith('verse-')) {
                    const verseKey = targetId.replace('verse-', '');
                    clearTimeout(timeoutId);
                    timeoutId = setTimeout(() => {
                        if (planner && pageNumber !== null && setPlannerLastPosition) {
                            setPlannerLastPosition(pageNumber, verseKey);
                        }
                    }, 1000); // Debounce store updates
                }
            }
        }, {
            root: null,
            rootMargin: '-20% 0px -40% 0px', // Target middle-top of the screen
        });

        // Query all verse containers (VerseRow uses id="verse-XXX")
        const elements = document.querySelectorAll('[id^="verse-"]');
        elements.forEach(el => observer.observe(el));

        return () => {
            observer.disconnect();
            clearTimeout(timeoutId);
        };
    }, [verses, pageNumber, isPageLoading, planner, setPlannerLastPosition]);

    // Scroll to the last read verse on initial load
    const hasAutoScrolledRef = useRef(false);
    useEffect(() => {
        if (!isPageLoading && verses && verses.length > 0 && planner?.lastReadVerseKey && !hasAutoScrolledRef.current) {
            // Check if the saved verse is on the current page
            const verseExists = verses.some(v => v.verse_key === planner.lastReadVerseKey);
            if (verseExists) {
                setTimeout(() => {
                    const el = document.getElementById(`verse-${planner.lastReadVerseKey}`);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                    hasAutoScrolledRef.current = true;
                }, 100);
            } else {
                hasAutoScrolledRef.current = true; // Mark as done even if not found to prevent looping
            }
        }
    }, [isPageLoading, verses, planner?.lastReadVerseKey]);


    useEffect(() => {
        setNavHeaderTitle(assignment ? `Day ${assignment.dayNumber}` : 'Planner Reader');
    }, [assignment, setNavHeaderTitle]);

    // --- AUTO-SCROLL LOGIC ---
    const scrollRafRef = useRef(null);



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

            return { surahId: currentChapter?.id || Number(surahNum), verseKey: v.verse_key, verseNumber: v.verse_number, url };
        }).filter(v => v.url);

        if (playlist.length === 0) return;

        const startIndex = playlist.findIndex(p => p.verseKey === verse.verse_key);
        const targetIndex = startIndex >= 0 ? startIndex : 0;

        // If this verse is already the active one, toggle play/pause
        if (isCurrentPagePlaying && audioPlaylist[audioTrackIndex]?.verseKey === verse.verse_key) {
            setIsPlaying(!isPlaying);
            setIsPlayerVisible(true);
            return;
        }

        setAudioPlaylist(playlist, targetIndex);
        setIsPlaying(true);
        setIsPlayerVisible(true);
        updateAudioSettings({ startRange: 0, endRange: playlist.length - 1 });
    }, [verses, isCurrentPagePlaying, isPlaying, audioPlaylist, audioTrackIndex, localAudioDirHandle, customAudioBaseUrl, currentChapter, setAudioPlaylist, setIsPlaying, setIsPlayerVisible, updateAudioSettings]);

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
    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'auto' });
    };

    const handleNextPage = () => {
        if (pageNumber !== null && pageNumber < maxPageNumber) {
            // Mark current page/item as done before moving to the next
            if (assignment && progress) {
                const currentItem = assignment.items.find(item => 
                    pageNumber >= (item.pageStart || 1) && pageNumber <= (item.pageEnd || 604)
                );
                if (currentItem && !progress.completedRangeValues.includes(currentItem.rangeValue)) {
                    if (planner.unitType === 'page' || pageNumber >= currentItem.pageEnd) {
                        markPlannerItemComplete(assignment.dayNumber, currentItem.rangeValue);
                    }
                }
            }

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

    const swipeDirectionRef = useRef(0);
    const swipeHandlers = useSwipeable({
        onSwipedRight: handleNextPage,
        onSwipedLeft: handlePrevPage,
        preventDefaultTouchmoveEvent: false,
        trackTouch: true,
        trackMouse: false,
        delta: 40,
        swipeDuration: 500
    });

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

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

            {/* Planner specific header */}
            <AnimatePresence>
                {!isFocusMode && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className={`sticky top-[52px] z-50 mb-12 transition-all duration-300 ${isScrolled ? 'pt-0' : 'pt-0'}`}
                    >
                        <div className={`mx-auto rounded-[20px] backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-300 ${
                            isScrolled ? 'bg-[var(--bg-surface)]/90 py-2 px-4' : 'bg-[var(--bg-surface)]/80 p-4 sm:p-5'
                        }`}>
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-1 sm:gap-3">
                                    <div className="shrink-0 min-w-0">
                                        {planner.unitType === 'page' ? (
                                            <h2 className="m-0 font-ui text-[0.95rem] sm:text-[1.2rem] font-bold text-[var(--text-primary)] whitespace-nowrap">
                                                Page {pageNumber} / {assignment.items[assignment.items.length - 1].pageEnd || assignment.items[assignment.items.length - 1].pageStart}
                                            </h2>
                                        ) : (
                                            <>
                                                <h2 className="m-0 font-ui text-[0.95rem] sm:text-[1.1rem] font-bold text-[var(--text-primary)] whitespace-nowrap">{assignment.title}</h2>
                                                <div className="text-[0.7rem] sm:text-[0.8rem] font-medium text-[var(--text-muted)] whitespace-nowrap mt-0.5">
                                                    {assignment.subtitle ? (
                                                        <span>{assignment.subtitle.split(' · ')[0]} • </span>
                                                    ) : null}
                                                    <span>Page {pageNumber} / {assignment.items[assignment.items.length - 1].pageEnd || assignment.items[assignment.items.length - 1].pageStart}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {currentChapter && (
                                        <div className="shrink-0 flex items-center justify-center bg-[var(--plr-teal)]/10 px-2 sm:px-3 py-1 rounded-full border border-[var(--plr-teal)]/20 mx-auto sm:mx-0">
                                            <span className="font-ui text-[0.7rem] sm:text-[0.85rem] font-bold text-[var(--plr-teal)] whitespace-nowrap">
                                                {currentChapter.id}. Surah {currentChapter.name_simple}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex flex-col items-end shrink-0 min-w-0">
                                        <div className="font-ui text-[0.9rem] sm:text-[1rem] font-bold text-[var(--plr-teal)] whitespace-nowrap">
                                            {pct}% <span className="hidden sm:inline">Achieved</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-full h-[3px] rounded-full bg-black/5 overflow-hidden">
                                    <div className="h-full bg-[var(--plr-teal)] transition-all duration-500 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

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
                                    <p className="m-0 font-body text-[0.85rem] text-white/90 leading-relaxed italic">"{insightVerse.translations?.[0]?.text?.replace(/<sup[^>]*>.*?<\/sup>/g, '')?.replace(/<[^>]+>/g, '')}"</p>
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
                                                    verse={verse}
                                                    readingMode={readingMode}
                                                    chapter={chapterContext}
                                                    addRecentlyRead={addRecentlyRead}
                                                    fontSize={fontSize}
                                                    arabicFont={arabicFont}
                                                    tajweedEnabled={isTajweedActive}
                                                    tajweedMap={tajweedMap}
                                                    activeTafsir={activeTafsir}
                                                    setActiveTafsir={setActiveTafsir}
                                                    isTafsirFetching={isTafsirFetching}
                                                    tafsirs={tafsirs}
                                                    tafsirId={tafsirId}
                                                    showPageDivider={false}
                                                    mushaf={mushaf}
                                                    isAudioPlaying={activeAudioVerseKey === verse.verse_key}
                                                    onPlayVerse={handlePlayVerse}
                                                    onPlannerBookmark={handlePlannerBookmarkToggle}
                                                    isPlannerBookmark={plannerBookmarks[planner?.id]?.some(b => b.verseKey === verse.verse_key)}
                                                />
                                            </React.Fragment>
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
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-[var(--bg-surface)] rounded-t-[24px] shadow-2xl z-[1000] flex flex-col p-6"
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

            <AutoScroller />
        </div>
    );
}

