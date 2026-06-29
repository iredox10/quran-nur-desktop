import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getVerses, getChapter, getTajweedVerses } from '../services/api/quranApi';
import { useAppStore } from '../store/useAppStore';
import { EyeOff, Eye, Repeat, ArrowLeft, ArrowRight, X, Play, Pause, ShieldAlert, Award, Languages, Layers, RefreshCw, Clock, Bookmark, FolderPlus, Plus, Folder, Settings2, CheckCircle, ChevronLeft, ChevronRight, Type, MousePointer, Mic } from 'lucide-react';
import { getMushafById, isTajweedEnabledForMushaf } from '../config/mushaf';
import { getVerseArabicText, sanitizeTajweedHtml } from '../utils/quranText';
import { getLocalAudioUrl } from '../utils/localAudio';
import confetti from 'canvas-confetti';


const DELAY_OPTIONS = [0, 1, 2, 3, 5, 10];
const RANGE_LOOP_OPTIONS = [1, 2, 3, 5, 10, -1];
const AYAH_REPEAT_OPTIONS = [1, 2, 3, 5, 10, -1];

export default function Memorization() {
    const { id } = useParams();
    const navigate = useNavigate();
    const {
        setNavHeaderTitle, arabicFont, fontSize, translationFontSize, translationId, mushafId,
        bookmarks, toggleBookmark, collections, addCollection, addToCollection,
        tajweedEnabled, logReadingSession,
        memorizedAyahs, memorizedSurahs, toggleMemorizedAyah, toggleMemorizedSurah,
        customAudioBaseUrl, localAudioDirHandle
    } = useAppStore();
    const mushaf = getMushafById(mushafId);
    const isTajweedActive = isTajweedEnabledForMushaf(mushafId, tajweedEnabled);

    useEffect(() => {
        const startTime = Date.now();
        return () => {
            const duration = Math.round((Date.now() - startTime) / 1000);
            if (duration >= 10) {
                logReadingSession(duration, 'memorizing', Number(id));
            }
        };
    }, [id, logReadingSession]);

    const [currentVerseIndex, setCurrentVerseIndex] = useState(0);
    const [isBlurred, setIsBlurred] = useState(false);
    const [showTranslation, setShowTranslation] = useState(false);
    const [ayahsPerSwipe, setAyahsPerSwipe] = useState(1);
    const [isCollectionsOpen, setIsCollectionsOpen] = useState(false);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [showUI, setShowUI] = useState(true);
    const [isAudioSettingsOpen, setIsAudioSettingsOpen] = useState(false);

    const [hideMode, setHideMode] = useState('visible');
    const [revealedWords, setRevealedWords] = useState({});

    const [sessionSeconds, setSessionSeconds] = useState(0);
    const sessionTimerRef = useRef(null);

    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [audioVerseIndex, setAudioVerseIndex] = useState(0);
    const [rangeLoopTarget, setRangeLoopTarget] = useState(1);
    const [rangeLoopCurrent, setRangeLoopCurrent] = useState(0);
    const [ayahRepeatTarget, setAyahRepeatTarget] = useState(1);
    const [currentAyahPlayCount, setCurrentAyahPlayCount] = useState(0);
    const [ayahDelay, setAyahDelay] = useState(0);

    const [resolvedAudioUrl, setResolvedAudioUrl] = useState(null);
    const delayTimeoutRef = React.useRef(null);
    const audioRef = React.useRef(null);

    useEffect(() => {
        setIsPlayingAudio(false);
        setAudioVerseIndex(0);
        setRangeLoopCurrent(0);
        setCurrentAyahPlayCount(0);
        if (delayTimeoutRef.current) clearTimeout(delayTimeoutRef.current);
        if (audioRef.current) {
            audioRef.current.pause();
        }
        setRevealedWords({});
    }, [currentVerseIndex, ayahsPerSwipe]);

    useEffect(() => {
        if (isPlayingAudio) {
            if (resolvedAudioUrl && audioRef.current) {
                audioRef.current.play().catch(e => {
                    console.error("Audio playback error", e);
                    setIsPlayingAudio(false);
                });
            } else if (currentVerses[audioVerseIndex]) {
                const activeV = currentVerses[audioVerseIndex];
                if (!activeV?.audio?.url) {
                    handleAudioEnded();
                }
            }
        }
    }, [isPlayingAudio, audioVerseIndex, currentVerseIndex, resolvedAudioUrl]);

    function handleAudioEnded() {
        const nextAction = () => {
            if (ayahRepeatTarget === -1 || currentAyahPlayCount + 1 < ayahRepeatTarget) {
                if (ayahRepeatTarget !== -1) setCurrentAyahPlayCount(prev => prev + 1);
                if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                    audioRef.current.play().catch(e => console.error(e));
                }
                return;
            }

            setCurrentAyahPlayCount(0);

            if (audioVerseIndex < currentVerses.length - 1) {
                setAudioVerseIndex(prev => prev + 1);
            } else {
                if (rangeLoopTarget === -1) {
                    setAudioVerseIndex(0);
                } else if (rangeLoopCurrent + 1 < rangeLoopTarget) {
                    setRangeLoopCurrent(prev => prev + 1);
                    setAudioVerseIndex(0);
                } else {
                    setIsPlayingAudio(false);
                    setRangeLoopCurrent(0);
                    setAudioVerseIndex(0);
                }
            }
        };

        if (ayahDelay > 0) {
            if (delayTimeoutRef.current) clearTimeout(delayTimeoutRef.current);
            delayTimeoutRef.current = setTimeout(nextAction, ayahDelay * 1000);
        } else {
            nextAction();
        }
    };

    const toggleAudio = () => {
        if (isPlayingAudio) {
            setIsPlayingAudio(false);
            if (delayTimeoutRef.current) clearTimeout(delayTimeoutRef.current);
            if (audioRef.current) audioRef.current.pause();
        } else {
            setIsPlayingAudio(true);
            if (audioVerseIndex >= currentVerses.length) setAudioVerseIndex(0);
        }
    };

    const { data: chapter, isLoading: isChapterLoading } = useQuery({
        queryKey: ['memorizeChapter', id],
        queryFn: () => getChapter(id),
    });

    const { data: versesResponse, isLoading: isVersesLoading } = useQuery({
        queryKey: ['memorizeVerses', id, translationId, mushafId],
        queryFn: () => getVerses(id, translationId, 7, 1, mushafId, 300),
    });

    const { data: tajweedData } = useQuery({
        queryKey: ['memorizeTajweed', id, mushafId],
        queryFn: () => getTajweedVerses(id),
        enabled: isTajweedActive && mushaf.tajweedSource === 'uthmani_html',
    });

    const tajweedMap = React.useMemo(() => {
        if (!tajweedData) return {};
        return tajweedData.reduce((acc, v) => {
            acc[v.verse_key] = sanitizeTajweedHtml(v.text_uthmani_tajweed);
            return acc;
        }, {});
    }, [tajweedData]);

    useEffect(() => {
        if (chapter) {
            setNavHeaderTitle(`Hifdh Mode: ${chapter.name_simple}`);
        } else {
            setNavHeaderTitle(`Hifdh Mode: Surah ${id}`);
        }
        return () => setNavHeaderTitle(null);
    }, [id, chapter, setNavHeaderTitle]);

    useEffect(() => {
        let hideTimer;
        const handleActivity = () => {
            setShowUI(true);
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(() => setShowUI(false), 3000);
        };

        window.addEventListener('mousemove', handleActivity);
        window.addEventListener('touchstart', handleActivity);
        window.addEventListener('click', handleActivity);
        handleActivity();

        return () => {
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('touchstart', handleActivity);
            window.removeEventListener('click', handleActivity);
            if (hideTimer) clearTimeout(hideTimer);
        };
    }, []);

    useEffect(() => {
        sessionTimerRef.current = setInterval(() => setSessionSeconds(s => s + 1), 1000);
        return () => clearInterval(sessionTimerRef.current);
    }, []);

    const formatTimer = (s) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${String(sec).padStart(2, '0')}`;
    };

    const HIDE_MODES = ['visible', 'blur', 'word', 'firstletter'];
    const cycleHideMode = useCallback(() => {
        setHideMode(prev => {
            const idx = HIDE_MODES.indexOf(prev);
            const next = HIDE_MODES[(idx + 1) % HIDE_MODES.length];
            setRevealedWords({});
            setIsBlurred(next === 'blur');
            return next;
        });
    }, []);

    const toggleWordReveal = useCallback((verseKey, wordIdx) => {
        setRevealedWords(prev => ({
            ...prev,
            [`${verseKey}-${wordIdx}`]: !prev[`${verseKey}-${wordIdx}`]
        }));
    }, []);

    const getFirstLetter = (word) => {
        if (!word) return '';
        for (const ch of word) {
            if (ch.charCodeAt(0) >= 0x0621 && ch.charCodeAt(0) <= 0x064A) return ch;
            if (ch.charCodeAt(0) >= 0x0671 && ch.charCodeAt(0) <= 0x06D3) return ch;
        }
        return word[0] || '';
    };

    const prevMemorizedCountRef = useRef(0);
    useEffect(() => {
        if (!chapter || !memorizedAyahs) return;
        const surahAyahs = (memorizedAyahs || []).filter(k => k.startsWith(`${chapter.id}:`));
        const count = surahAyahs.length;
        if (count >= chapter.verses_count && prevMemorizedCountRef.current < chapter.verses_count) {
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 }, colors: ['#2E4F4A', '#B8924A', '#10b981'] });
            setTimeout(() => confetti({ particleCount: 60, spread: 120, origin: { y: 0.5 } }), 300);
        }
        prevMemorizedCountRef.current = count;
    }, [memorizedAyahs, chapter]);

    const renderVerseText = useCallback((verse, idx) => {
        const text = getVerseArabicText(verse, mushaf);
        const computedFontSize = `clamp(${0.9 + fontSize * 0.15}rem, ${fontSize * 1.2}vw, ${fontSize * 0.4 + 1.5}rem)`;
        const isTajweed = isTajweedActive && tajweedMap?.[verse.verse_key];

        if (hideMode === 'word' || hideMode === 'firstletter') {
            const words = isTajweed ? (tajweedMap[verse.verse_key].match(/(?:<[^>]*>|[^<>\s])+/g) || []) : text.split(/\s+/);
            return (
                <div
                    className={`quran-text ${isTajweed ? 'tajweed-text' : ''} leading-[2.2] text-center [direction:rtl] transition-all duration-300 ${isPlayingAudio && audioVerseIndex === idx ? 'text-[var(--mem-teal)]' : ''}`}
                    style={{ fontSize: computedFontSize, fontFamily: arabicFont, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.4em' }}
                    onClick={() => hideMode === 'blur' && setHideMode('visible')}
                >
                    {words.map((word, wi) => {
                        const key = `${verse.verse_key}-${wi}`;
                        const isRevealed = revealedWords[key];
                        const cleanWord = isTajweed ? word.replace(/<[^>]*>?/gm, '') : word;
                        if (hideMode === 'word') {
                            return (
                                <span
                                    key={wi}
                                    className={`inline-block cursor-pointer select-none rounded-md px-1 py-0.5 transition-all duration-200 ${
                                        isRevealed
                                            ? 'text-inherit'
                                            : 'min-w-[2em] rounded bg-[var(--mem-bone-dark)] text-[var(--mem-bone-dark)] text-[0.7em] tracking-[-0.15em] hover:bg-[var(--mem-teal-soft)] hover:shadow-[0_0_0_2px_rgba(46,79,74,0.15)] active:scale-95'
                                    } ${isRevealed ? 'mem-word-revealed' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); toggleWordReveal(verse.verse_key, wi); }}
                                >
                                    {isRevealed ? (isTajweed ? <span dangerouslySetInnerHTML={{ __html: word }} /> : word) : '▇'.repeat(Math.max(2, Math.ceil(cleanWord.length / 3)))}
                                </span>
                            );
                        }
                        return (
                            <span
                                key={wi}
                                className={`inline-block cursor-pointer select-none rounded-md px-1 py-0.5 transition-all duration-200 ${
                                    isRevealed
                                        ? 'text-inherit'
                                        : 'border border-dashed border-[rgba(184,146,74,0.3)] bg-[var(--mem-gold-soft)] text-[var(--mem-gold)] text-[0.85em] hover:border-[var(--mem-gold)] hover:bg-[rgba(184,146,74,0.25)]'
                                } ${isRevealed ? 'mem-word-revealed' : ''}`}
                                onClick={(e) => { e.stopPropagation(); toggleWordReveal(verse.verse_key, wi); }}
                            >
                                {isRevealed ? (isTajweed ? <span dangerouslySetInnerHTML={{ __html: word }} /> : word) : getFirstLetter(cleanWord) + '⸱'.repeat(Math.max(1, Math.ceil(cleanWord.length / 4)))}
                            </span>
                        );
                    })}
                </div>
            );
        }

        if (isTajweed) {
            return (
                <div
                    className={`quran-text tajweed-text leading-[2.2] text-center [direction:rtl] transition-all duration-300 ${isPlayingAudio && audioVerseIndex === idx ? 'text-[var(--mem-teal)]' : ''} ${hideMode === 'blur' ? 'cursor-pointer blur-[8px]' : ''}`}
                    style={{ fontSize: computedFontSize, fontFamily: arabicFont }}
                    onClick={() => hideMode === 'blur' && setHideMode('visible')}
                >
                    <span dangerouslySetInnerHTML={{ __html: tajweedMap[verse.verse_key] }} />
                </div>
            );
        }

        return (
            <div
                className={`quran-text leading-[2.2] text-center [direction:rtl] transition-all duration-300 ${isPlayingAudio && audioVerseIndex === idx ? 'text-[var(--mem-teal)]' : ''} ${hideMode === 'blur' ? 'cursor-pointer blur-[8px]' : ''}`}
                style={{ fontSize: computedFontSize, fontFamily: arabicFont }}
                onClick={() => hideMode === 'blur' && setHideMode('visible')}
            >
                {text}
            </div>
        );
    }, [hideMode, revealedWords, fontSize, arabicFont, isTajweedActive, tajweedMap, isPlayingAudio, audioVerseIndex, mushaf]);

    const verses = versesResponse?.verses || [];

    useEffect(() => {
        const queryParams = new URLSearchParams(window.location.search);
        const verseKey = queryParams.get('verse');
        if (verseKey && verses.length > 0) {
            const index = verses.findIndex(v => v.verse_key === verseKey);
            if (index !== -1) {
                setCurrentVerseIndex(index);
            }
        }
    }, [verses]);

    let currentVerses = [];
    if (verses.length > 0) {
        if (ayahsPerSwipe === -1) {
            let startIdx = currentVerseIndex;
            const currentPage = verses[startIdx].page_number;
            while (startIdx > 0 && verses[startIdx - 1].page_number === currentPage) {
                startIdx--;
            }
            let endIdx = startIdx;
            while (endIdx < verses.length && verses[endIdx].page_number === currentPage) {
                endIdx++;
            }
            currentVerses = verses.slice(startIdx, endIdx);
        } else {
            currentVerses = verses.slice(currentVerseIndex, currentVerseIndex + ayahsPerSwipe);
        }
    }

    const scrollPositionsRef = React.useRef({});

    const handleNext = () => {
        const step = ayahsPerSwipe === -1 ? currentVerses.length : ayahsPerSwipe;
        if (currentVerseIndex + step < verses.length) {
            scrollPositionsRef.current[currentVerseIndex] = window.scrollY;
            setCurrentVerseIndex(p => p + step);
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'instant' }), 0);
        }
        setIsBlurred(false);
    };

    const handlePrev = () => {
        let newIndex = currentVerseIndex;
        if (ayahsPerSwipe === -1) {
            if (currentVerseIndex > 0) {
                const prevPage = verses[currentVerseIndex - 1].page_number;
                newIndex = currentVerseIndex - 1;
                while (newIndex > 0 && verses[newIndex - 1].page_number === prevPage) {
                    newIndex--;
                }
            }
        } else {
            if (currentVerseIndex - ayahsPerSwipe >= 0) {
                newIndex = currentVerseIndex - ayahsPerSwipe;
            } else {
                newIndex = 0;
            }
        }

        if (newIndex !== currentVerseIndex) {
            setCurrentVerseIndex(newIndex);
            setTimeout(() => {
                const savedPos = scrollPositionsRef.current[newIndex];
                if (savedPos !== undefined) {
                    window.scrollTo({ top: savedPos, behavior: 'instant' });
                } else {
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
                }
            }, 0);
        }
        setIsBlurred(false);
    };

    useEffect(() => {
        const surahId = Number(id);

        const handleKeyDown = (e) => {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                handlePrev();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                handleNext();
            }
        };

        let touchStartX = 0;
        let touchStartY = 0;

        const handleTouchStart = (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        };

        const handleTouchEnd = (e) => {
            const touchEndX = e.changedTouches[0].screenX;
            const touchEndY = e.changedTouches[0].screenY;
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            const SWIPE_THRESHOLD = 50;

            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) {
                if (deltaX < 0) {
                    handleNext();
                } else {
                    handlePrev();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('touchstart', handleTouchStart);
        window.addEventListener('touchend', handleTouchEnd);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, [currentVerseIndex, verses.length, ayahsPerSwipe, id, navigate]);


    const activeAudioVerse = currentVerses[audioVerseIndex];
    let audioUrl = activeAudioVerse?.audio?.url ? (activeAudioVerse.audio.url.startsWith('http') ? activeAudioVerse.audio.url : `https://verses.quran.com/${activeAudioVerse.audio.url}`) : null;

    if (activeAudioVerse) {
        const [surahNum, ayahNum] = activeAudioVerse.verse_key.split(':');
        const fileName = `${String(surahNum).padStart(3, '0')}${String(ayahNum).padStart(3, '0')}.mp3`;

        if (localAudioDirHandle) {
            audioUrl = `local-audio://${fileName}`;
        } else if (customAudioBaseUrl) {
            audioUrl = `${customAudioBaseUrl.replace(/\/$/, '')}/${fileName}`;
        }
    }

    useEffect(() => {
        if (!audioUrl) {
            setResolvedAudioUrl(null);
            return;
        }

        if (audioUrl.startsWith('local-audio://') && localAudioDirHandle) {
            const fileName = audioUrl.replace('local-audio://', '');
            getLocalAudioUrl(localAudioDirHandle, fileName).then(url => {
                setResolvedAudioUrl(url || audioUrl);
            });
        } else {
            setResolvedAudioUrl(audioUrl);
        }
    }, [audioUrl, localAudioDirHandle]);


    if (isVersesLoading || isChapterLoading) {
        return <div className="relative flex min-h-[80vh] flex-col"><div className="pt-[10vh] text-center text-[var(--mem-ink-muted)]">Loading Hifdh Mode...</div></div>;
    }

    if (verses.length === 0) return null;

    const sessionPct = Math.round(((currentVerseIndex + currentVerses.length) / verses.length) * 100);
    const hasNonDefaultAudio = ayahRepeatTarget !== 1 || ayahDelay > 0 || rangeLoopTarget !== 1;

    return (
        <div className="relative flex min-h-[80vh] flex-col">
            <div className="fixed left-0 right-0 top-0 z-50 h-[3px] bg-[var(--mem-bone-dark)]">
                <div className="h-full rounded-r-sm bg-gradient-to-r from-[var(--mem-teal)] to-[var(--mem-green)] transition-all duration-[0.4s]" style={{ width: `${sessionPct}%` }} />
            </div>

            {resolvedAudioUrl && (
                <audio ref={audioRef} src={resolvedAudioUrl}
                    onEnded={handleAudioEnded}
                    onError={() => setIsPlayingAudio(false)} />
            )}

            <div className="relative flex w-full flex-1 items-center justify-center px-6 py-8" style={{ marginBottom: '8rem' }}>
                <motion.div
                    key={`${currentVerseIndex}-${ayahsPerSwipe}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="mx-auto flex w-full max-w-[800px] flex-col items-center gap-8 text-center"
                >
                    <div className="flex w-full flex-col gap-10">
                        {currentVerses.map((verse, idx) => (
                            <div key={verse.id} className="relative w-full">
                                <div className="relative flex w-full items-center justify-center min-h-[64px]">
                                    {renderVerseText(verse, idx)}
                                    <div className={`absolute left-0 top-0 flex flex-col gap-2 transition-opacity duration-300 ${hideMode === 'blur' ? 'opacity-0 pointer-events-none' : ''}`}>
                                        <button className="cursor-pointer border-none bg-transparent p-2 transition-colors duration-150" onClick={(e) => { e.stopPropagation(); toggleBookmark(verse.verse_key, chapter?.name_simple, chapter?.id); }}
                                            style={{ color: bookmarks?.find(b => b.verseKey === verse.verse_key) ? 'var(--mem-teal)' : 'var(--mem-ink-muted)' }}
                                            title="Bookmark">
                                            <Bookmark size={20} fill={bookmarks?.find(b => b.verseKey === verse.verse_key) ? 'currentColor' : 'none'} />
                                        </button>
                                        <button className="cursor-pointer border-none bg-transparent p-2 transition-colors duration-150" onClick={(e) => { e.stopPropagation(); toggleMemorizedAyah(verse.verse_key); }}
                                            style={{ color: (memorizedAyahs || []).includes(verse.verse_key) ? 'var(--mem-green)' : 'var(--mem-ink-muted)' }}
                                            title="Mark Memorized">
                                            <CheckCircle size={20} fill={(memorizedAyahs || []).includes(verse.verse_key) ? 'currentColor' : 'none'}
                                                color={(memorizedAyahs || []).includes(verse.verse_key) ? 'white' : 'currentColor'} />
                                        </button>
                                    </div>
                                </div>

                                <AnimatePresence>
                                    {showTranslation && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="mt-6 overflow-hidden rounded-[14px] border border-[var(--mem-bone-dark)] bg-[var(--mem-cream)] px-6 py-5 leading-[1.6] text-[var(--mem-ink-mid)] font-body"
                                            style={{ fontSize: `${(translationFontSize || 2) * 0.15 + 0.75}rem` }}
                                        >
                                            {verse.translations?.[0]?.text?.replace(/<sup[^>]*>.*?<\/sup>/g, '')?.replace(/<[^>]*>?/gm, '')}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>

            <div className={`fixed bottom-[5.5rem] left-1/2 z-30 flex -translate-x-1/2 items-center gap-[0.6rem] whitespace-nowrap font-mono text-[0.78rem] text-[var(--mem-ink-muted)] transition-opacity duration-[400ms] ${showUI ? '' : 'pointer-events-none opacity-0'}`}>
                <div className="flex items-center gap-1 font-semibold text-[var(--mem-teal)]">
                    <span>Surah {chapter?.name_simple}</span>
                    <button className="flex cursor-pointer items-center border-none bg-transparent p-0 transition-colors duration-150" onClick={() => chapter?.id && toggleMemorizedSurah(chapter.id, chapter.verses_count)}
                        style={{ color: (memorizedSurahs || []).includes(chapter?.id) ? 'var(--mem-green)' : 'var(--mem-ink-muted)' }}>
                        <Award size={16} fill={(memorizedSurahs || []).includes(chapter?.id) ? 'currentColor' : 'none'} />
                    </button>
                </div>
                <span className="opacity-40">·</span>
                <span>Page {currentVerses[0]?.page_number}</span>
                <span className="opacity-40">·</span>
                <span>Ayah {currentVerses[0]?.verse_key.split(':')[1]}{currentVerses.length > 1 ? `–${currentVerses[currentVerses.length - 1]?.verse_key.split(':')[1]}` : ''}</span>
                <span className="opacity-40">·</span>
                <span style={{ color: 'var(--mem-gold)', fontWeight: 600 }}>{formatTimer(sessionSeconds)}</span>
            </div>

            <div className={`fixed bottom-0 left-0 right-0 z-40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-all duration-[400ms] ${showUI ? '' : 'pointer-events-none translate-y-[10px] opacity-0'}`}>
                <div className="mx-auto flex w-full max-w-[480px] overflow-x-auto no-scrollbar scroll-smooth items-center justify-start sm:justify-center gap-[0.35rem] rounded-[20px] border-[1.5px] border-[var(--mem-bone-dark)] bg-[var(--mem-white)] px-[0.85rem] py-[0.65rem] shadow-[0_-4px_30px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)]" style={{ position: 'relative' }}>
                    <button className="flex h-[42px] w-[42px] shrink-0 cursor-pointer items-center justify-center rounded-xl border-none bg-transparent text-[var(--mem-ink-mid)] transition-all duration-150 hover:bg-[var(--mem-bone)] disabled:cursor-default disabled:opacity-25" onClick={handlePrev} disabled={currentVerseIndex === 0}><ChevronLeft size={20} /></button>
                    <button className={`flex h-[42px] w-[42px] shrink-0 cursor-pointer items-center justify-center rounded-xl border-none bg-transparent text-[var(--mem-ink-mid)] transition-all duration-150 hover:bg-[var(--mem-bone)] ${hideMode !== 'visible' ? 'bg-[var(--mem-teal-soft)] text-[var(--mem-teal)]' : ''}`} onClick={cycleHideMode}
                        title={hideMode === 'visible' ? 'Hide Text' : hideMode === 'blur' ? 'Word-by-Word' : hideMode === 'word' ? 'First Letter Hints' : 'Show All'}>
                        {hideMode === 'visible' ? <EyeOff size={18} /> : hideMode === 'blur' ? <MousePointer size={18} /> : hideMode === 'word' ? <Type size={18} /> : <Eye size={18} />}
                    </button>
                    <button className={`flex h-[42px] w-[42px] shrink-0 cursor-pointer items-center justify-center rounded-xl border-none bg-transparent text-[var(--mem-ink-mid)] transition-all duration-150 hover:bg-[var(--mem-bone)] ${showTranslation ? 'bg-[var(--mem-teal-soft)] text-[var(--mem-teal)]' : ''}`} onClick={() => setShowTranslation(!showTranslation)}>
                        <Languages size={18} />
                    </button>
                    <div className="mx-0.5 h-6 w-px shrink-0 bg-[var(--mem-bone-dark)]" />
                    <motion.button className={`flex h-[54px] w-[54px] shrink-0 cursor-pointer items-center justify-center rounded-full border-none text-white shadow-[0_4px_16px_rgba(46,79,74,0.25)] transition-all duration-150 mx-[0.35rem] ${
                        isPlayingAudio ? 'bg-[var(--mem-gold)] shadow-[0_4px_16px_rgba(184,146,74,0.3)]' : 'bg-[var(--mem-teal)] hover:bg-[var(--mem-teal-mid)]'
                    }`}
                        whileTap={{ scale: 0.9 }} onClick={toggleAudio}
                        animate={isPlayingAudio ? { scale: [1, 1.08, 1] } : {}}
                        transition={{ repeat: isPlayingAudio ? Infinity : 0, duration: 1.5 }}>
                        {isPlayingAudio ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" style={{ marginLeft: '2px' }} />}
                    </motion.button>
                    <div className="mx-0.5 h-6 w-px shrink-0 bg-[var(--mem-bone-dark)]" />
                    <div className="flex h-[42px] cursor-pointer items-center gap-[0.35rem] rounded-xl border-none bg-transparent px-2 text-[0.78rem] text-[var(--mem-ink-mid)] font-[inherit]">
                        <Layers size={14} />
                        <select value={ayahsPerSwipe} onChange={(e) => {
                            const val = Number(e.target.value);
                            setAyahsPerSwipe(val);
                            if (val === -1 && verses.length > 0) {
                                const pg = verses[currentVerseIndex].page_number;
                                let s = currentVerseIndex;
                                while (s > 0 && verses[s - 1].page_number === pg) s--;
                                setCurrentVerseIndex(s);
                            } else {
                                setCurrentVerseIndex(Math.floor(currentVerseIndex / val) * val);
                            }
                        }}
                            className="cursor-pointer border-none bg-transparent text-[0.78rem] text-inherit outline-none font-mono">
                            <option value={1}>1</option><option value={3}>3</option><option value={5}>5</option>
                            <option value={10}>10</option><option value={-1}>Page</option>
                        </select>
                    </div>

                    <div style={{ position: 'relative' }}>
                        <button className={`flex h-[42px] w-[42px] shrink-0 cursor-pointer items-center justify-center rounded-xl border-none bg-transparent text-[var(--mem-ink-mid)] transition-all duration-150 hover:bg-[var(--mem-bone)] ${isCollectionsOpen ? 'bg-[var(--mem-teal-soft)] text-[var(--mem-teal)]' : ''}`} onClick={() => setIsCollectionsOpen(!isCollectionsOpen)}><FolderPlus size={18} /></button>
                        <AnimatePresence>
                            {isCollectionsOpen && (
                                <motion.div className="absolute bottom-full left-1/2 z-50 mb-3 w-[240px] -translate-x-1/2 rounded-2xl border-[1.5px] border-[var(--mem-bone-dark)] bg-[var(--mem-white)] p-3.5 text-left shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
                                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                                    onClick={e => e.stopPropagation()}>
                                    <div className="mb-1 flex items-center justify-between">
                                        <span className="text-[0.82rem] font-semibold text-[var(--mem-ink)]">Add to Collection</span>
                                        <button className="cursor-pointer border-none bg-transparent p-0.5 text-[var(--mem-ink-muted)]" onClick={() => setIsCollectionsOpen(false)}><X size={14} /></button>
                                    </div>
                                    <div className="mb-3 flex max-h-[180px] flex-col gap-1 overflow-y-auto">
                                        {(collections || []).map(c => (
                                            <button key={c.id} className="flex w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-2 py-2 text-left text-[0.82rem] text-[var(--mem-ink-mid)] transition-all duration-150 hover:bg-[var(--mem-bone)]" onClick={() => {
                                                currentVerses.forEach(v => addToCollection(c.id, v.verse_key, chapter?.name_simple, chapter?.id));
                                                setIsCollectionsOpen(false);
                                            }}><Folder size={14} /> {c.name}</button>
                                        ))}
                                    </div>
                                    <div className="flex gap-1.5">
                                        <input type="text" placeholder="New…" value={newCollectionName} onChange={e => setNewCollectionName(e.target.value)}
                                            className="flex-1 rounded-lg border-[1.5px] border-[var(--mem-bone-dark)] bg-[var(--mem-bone)] px-[0.6rem] py-[0.35rem] text-xs text-[var(--mem-ink)] outline-none" />
                                        <button className="flex cursor-pointer items-center justify-center rounded-lg border-none bg-[var(--mem-teal)] p-1.5 text-white" onClick={() => {
                                            if (newCollectionName.trim()) {
                                                const nid = Date.now();
                                                addCollection(newCollectionName.trim(), nid);
                                                currentVerses.forEach(v => addToCollection(nid, v.verse_key, chapter?.name_simple, chapter?.id));
                                                setNewCollectionName(''); setIsCollectionsOpen(false);
                                            }
                                        }}><Plus size={14} /></button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div style={{ position: 'relative' }}>
                        <button className={`flex h-[42px] w-[42px] shrink-0 cursor-pointer items-center justify-center rounded-xl border-none bg-transparent text-[var(--mem-ink-mid)] transition-all duration-150 hover:bg-[var(--mem-bone)] ${hasNonDefaultAudio ? 'bg-[var(--mem-teal-soft)] text-[var(--mem-teal)]' : ''}`} onClick={() => setIsAudioSettingsOpen(!isAudioSettingsOpen)}>
                            <Settings2 size={18} />
                        </button>
                        <AnimatePresence>
                            {isAudioSettingsOpen && (
                                <motion.div className="absolute bottom-full left-1/2 z-50 mb-3 w-[220px] -translate-x-1/2 rounded-2xl border-[1.5px] border-[var(--mem-bone-dark)] bg-[var(--mem-white)] p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
                                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
                                    <div className="mb-1 flex items-center justify-between">
                                        <span className="text-[0.82rem] font-semibold text-[var(--mem-ink)]">Repeat</span>
                                        <button className="cursor-pointer border-none bg-transparent p-0.5 text-[var(--mem-ink-muted)]" onClick={() => setIsAudioSettingsOpen(false)}><X size={14} /></button>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-[0.78rem] text-[var(--mem-ink-mid)]"><RefreshCw size={13} /> Ayah</div>
                                            <select className="cursor-pointer rounded-lg border-[1.5px] border-[var(--mem-bone-dark)] bg-[var(--mem-bone)] px-1.5 py-0.5 text-xs text-[var(--mem-ink)] outline-none" value={ayahRepeatTarget}
                                                onChange={e => { setAyahRepeatTarget(Number(e.target.value)); setCurrentAyahPlayCount(0); }}>
                                                {AYAH_REPEAT_OPTIONS.map(o => <option key={o} value={o}>{o === 1 ? '1×' : o === -1 ? '∞' : `${o}×`}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-[0.78rem] text-[var(--mem-ink-mid)]"><Clock size={13} /> Delay</div>
                                            <select className="cursor-pointer rounded-lg border-[1.5px] border-[var(--mem-bone-dark)] bg-[var(--mem-bone)] px-1.5 py-0.5 text-xs text-[var(--mem-ink)] outline-none" value={ayahDelay} onChange={e => setAyahDelay(Number(e.target.value))}>
                                                {DELAY_OPTIONS.map(d => <option key={d} value={d}>{d === 0 ? 'None' : `${d}s`}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-[0.78rem] text-[var(--mem-ink-mid)]"><Repeat size={13} /> Range</div>
                                            <select className="cursor-pointer rounded-lg border-[1.5px] border-[var(--mem-bone-dark)] bg-[var(--mem-bone)] px-1.5 py-0.5 text-xs text-[var(--mem-ink)] outline-none" value={rangeLoopTarget}
                                                onChange={e => { setRangeLoopTarget(Number(e.target.value)); setRangeLoopCurrent(0); }}>
                                                {RANGE_LOOP_OPTIONS.map(o => <option key={o} value={o}>{o === 1 ? '1×' : o === -1 ? '∞' : `${o}×`}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <button className="flex h-[42px] w-[42px] shrink-0 cursor-pointer items-center justify-center rounded-xl border-none bg-transparent text-[var(--mem-ink-mid)] transition-all duration-150 hover:bg-[var(--mem-bone)] disabled:cursor-default disabled:opacity-25" onClick={handleNext} disabled={currentVerseIndex + currentVerses.length >= verses.length}>
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

        </div>
    );
}
