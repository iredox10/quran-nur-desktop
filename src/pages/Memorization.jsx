import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getVerses, getChapter, getTajweedVerses } from '../services/api/quranApi';
import { useAppStore } from '../store/useAppStore';
import { EyeOff, Eye, Repeat, ArrowLeft, ArrowRight, X, Play, Pause, ShieldAlert, Award, Languages, Layers, RefreshCw, Clock, Bookmark, FolderPlus, Plus, Folder, Settings2, CheckCircle, ChevronLeft, ChevronRight, Type, MousePointer } from 'lucide-react';
import { getMushafById, isTajweedEnabledForMushaf } from '../config/mushaf';
import { getVerseArabicText, sanitizeTajweedHtml } from '../utils/quranText';
import { getLocalAudioUrl } from '../utils/localAudio';
import confetti from 'canvas-confetti';
import './Memorize.css';


const DELAY_OPTIONS = [0, 1, 2, 3, 5, 10];
const RANGE_LOOP_OPTIONS = [1, 2, 3, 5, 10, -1];
const AYAH_REPEAT_OPTIONS = [1, 2, 3, 5, 10, -1];

export default function Memorization() {
    const { id } = useParams(); // Surah ID
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

    // Track memorization session duration
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
    const [isRecording, setIsRecording] = useState(false);
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [showTranslation, setShowTranslation] = useState(false);
    const [ayahsPerSwipe, setAyahsPerSwipe] = useState(1);
    const [isCollectionsOpen, setIsCollectionsOpen] = useState(false);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [showUI, setShowUI] = useState(true);
    const [isAudioSettingsOpen, setIsAudioSettingsOpen] = useState(false);

    // Hide mode: 'visible' | 'blur' | 'word' | 'firstletter'
    const [hideMode, setHideMode] = useState('visible');
    const [revealedWords, setRevealedWords] = useState({}); // { 'verseKey-wordIdx': true }

    // Session timer
    const [sessionSeconds, setSessionSeconds] = useState(0);
    const sessionTimerRef = useRef(null);

    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [audioVerseIndex, setAudioVerseIndex] = useState(0); // 0 to ayahsPerSwipe - 1
    const [rangeLoopTarget, setRangeLoopTarget] = useState(1); // 1 = play once, -1 = Infinite
    const [rangeLoopCurrent, setRangeLoopCurrent] = useState(0);
    const [ayahRepeatTarget, setAyahRepeatTarget] = useState(1); // 1 = play once, -1 = Infinite
    const [currentAyahPlayCount, setCurrentAyahPlayCount] = useState(0);
    const [ayahDelay, setAyahDelay] = useState(0); // Uses DELAY_OPTIONS values in seconds

    const [resolvedAudioUrl, setResolvedAudioUrl] = useState(null);
    const delayTimeoutRef = React.useRef(null);
    const audioRef = React.useRef(null);

    // Stop audio when user flips pages manually
    useEffect(() => {
        setIsPlayingAudio(false);
        setAudioVerseIndex(0);
        setRangeLoopCurrent(0);
        setCurrentAyahPlayCount(0);
        if (delayTimeoutRef.current) clearTimeout(delayTimeoutRef.current);
        if (audioRef.current) {
            audioRef.current.pause();
        }
        // Reset word reveals on page change
        setRevealedWords({});
    }, [currentVerseIndex, ayahsPerSwipe]);

    useEffect(() => {
        if (isPlayingAudio && audioRef.current) {
            audioRef.current.play().catch(e => {
                console.error("Audio playback error", e);
                setIsPlayingAudio(false);
            });
        }
    }, [isPlayingAudio, audioVerseIndex, currentVerseIndex]); // Depend on currentVerseIndex to ensure changes propagate

    const handleAudioEnded = () => {
        const nextAction = () => {
            // Repeat current ayah if target not reached
            if (ayahRepeatTarget === -1 || currentAyahPlayCount + 1 < ayahRepeatTarget) {
                if (ayahRepeatTarget !== -1) setCurrentAyahPlayCount(prev => prev + 1);
                if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                    audioRef.current.play().catch(e => console.error(e));
                }
                return;
            }

            // Move to next ayah, reset local play count
            setCurrentAyahPlayCount(0);

            if (audioVerseIndex < currentVerses.length - 1) {
                setAudioVerseIndex(prev => prev + 1);
            } else {
                // Reached end of selection mode range
                if (rangeLoopTarget === -1) { // Infinite Loop Range
                    setAudioVerseIndex(0);
                } else if (rangeLoopCurrent + 1 < rangeLoopTarget) { // Loop Range
                    setRangeLoopCurrent(prev => prev + 1);
                    setAudioVerseIndex(0);
                } else {
                    // Finished loops
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
        handleActivity(); // trigger immediately

        return () => {
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('touchstart', handleActivity);
            window.removeEventListener('click', handleActivity);
            if (hideTimer) clearTimeout(hideTimer);
        };
    }, []);

    // Session timer
    useEffect(() => {
        sessionTimerRef.current = setInterval(() => setSessionSeconds(s => s + 1), 1000);
        return () => clearInterval(sessionTimerRef.current);
    }, []);

    const formatTimer = (s) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${String(sec).padStart(2, '0')}`;
    };

    // Cycle hide modes: visible → blur → word → firstletter → visible
    const HIDE_MODES = ['visible', 'blur', 'word', 'firstletter'];
    const cycleHideMode = useCallback(() => {
        setHideMode(prev => {
            const idx = HIDE_MODES.indexOf(prev);
            const next = HIDE_MODES[(idx + 1) % HIDE_MODES.length];
            // Reset revealed words when switching modes
            setRevealedWords({});
            // Sync legacy blur state
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

    // Get first letter of Arabic word (skip diacritics)
    const getFirstLetter = (word) => {
        if (!word) return '';
        for (const ch of word) {
            // Arabic base letters range
            if (ch.charCodeAt(0) >= 0x0621 && ch.charCodeAt(0) <= 0x064A) return ch;
            if (ch.charCodeAt(0) >= 0x0671 && ch.charCodeAt(0) <= 0x06D3) return ch;
        }
        return word[0] || '';
    };

    // Confetti on surah completion
    const prevMemorizedCountRef = useRef(0);
    useEffect(() => {
        if (!chapter || !memorizedAyahs) return;
        const surahAyahs = (memorizedAyahs || []).filter(k => k.startsWith(`${chapter.id}:`));
        const count = surahAyahs.length;
        if (count >= chapter.verses_count && prevMemorizedCountRef.current < chapter.verses_count) {
            // All ayahs memorized — celebrate!
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 }, colors: ['#2E4F4A', '#B8924A', '#10b981'] });
            setTimeout(() => confetti({ particleCount: 60, spread: 120, origin: { y: 0.5 } }), 300);
        }
        prevMemorizedCountRef.current = count;
    }, [memorizedAyahs, chapter]);

    // Render verse text based on hide mode
    const renderVerseText = useCallback((verse, idx) => {
        const text = getVerseArabicText(verse, mushaf);
        const computedFontSize = `clamp(${0.9 + fontSize * 0.15}rem, ${fontSize * 1.2}vw, ${fontSize * 0.4 + 1.5}rem)`;

        // For tajweed mode with blur — use tajweed HTML
        // For word/firstletter modes — fall through to word splitting even with tajweed
        if (isTajweedActive && tajweedMap?.[verse.verse_key] && hideMode !== 'word' && hideMode !== 'firstletter') {
            return (
                <div
                    className={`mem-verse-arabic quran-text tajweed-text ${isPlayingAudio && audioVerseIndex === idx ? 'is-active' : ''} ${hideMode === 'blur' ? 'is-blurred' : ''}`}
                    style={{ fontSize: computedFontSize, fontFamily: arabicFont }}
                >
                    <span dangerouslySetInnerHTML={{ __html: tajweedMap[verse.verse_key] }} />
                </div>
            );
        }

        // Word-by-word or first-letter modes
        if (hideMode === 'word' || hideMode === 'firstletter') {
            const words = text.split(/\s+/);
            return (
                <div
                    className={`mem-verse-arabic quran-text ${isPlayingAudio && audioVerseIndex === idx ? 'is-active' : ''}`}
                    style={{ fontSize: computedFontSize, fontFamily: arabicFont, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.4em' }}
                >
                    {words.map((word, wi) => {
                        const key = `${verse.verse_key}-${wi}`;
                        const isRevealed = revealedWords[key];
                        if (hideMode === 'word') {
                            return (
                                <span
                                    key={wi}
                                    className={`mem-word ${isRevealed ? 'revealed' : 'hidden-word'}`}
                                    onClick={(e) => { e.stopPropagation(); toggleWordReveal(verse.verse_key, wi); }}
                                >
                                    {isRevealed ? word : '▇'.repeat(Math.max(2, Math.ceil(word.length / 3)))}
                                </span>
                            );
                        }
                        // firstletter mode
                        return (
                            <span
                                key={wi}
                                className={`mem-word ${isRevealed ? 'revealed' : 'hint-word'}`}
                                onClick={(e) => { e.stopPropagation(); toggleWordReveal(verse.verse_key, wi); }}
                            >
                                {isRevealed ? word : getFirstLetter(word) + '⸱'.repeat(Math.max(1, Math.ceil(word.length / 4)))}
                            </span>
                        );
                    })}
                </div>
            );
        }

        // Default: visible or blur
        return (
            <div
                className={`mem-verse-arabic quran-text ${isPlayingAudio && audioVerseIndex === idx ? 'is-active' : ''} ${hideMode === 'blur' ? 'is-blurred' : ''}`}
                style={{ fontSize: computedFontSize, fontFamily: arabicFont }}
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
            // Ensure we are exactly at the start of the page
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

    // Keyboard and Swipe Navigation
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
            // ArrowUp / ArrowDown are left to default browser scroll behavior
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

            // Only handle horizontal swipes — vertical is left to natural page scroll
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) {
                // Horizontal swipe → navigate ayahs
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

    const handleMicToggle = () => {
        if (isRecording) {
            setIsRecording(false);
            // Simulate processing then showing analysis modal
            setTimeout(() => {
                setShowAnalysis(true);
            }, 800);
        } else {
            setIsRecording(true);
        }
    };

    // Build the audio URL depending on custom settings
    const activeAudioVerse = currentVerses[audioVerseIndex];
    let audioUrl = activeAudioVerse?.audio?.url ? `https://verses.quran.com/${activeAudioVerse.audio.url}` : null;

    if (activeAudioVerse) {
        const [surahNum, ayahNum] = activeAudioVerse.verse_key.split(':');
        const fileName = `${String(surahNum).padStart(3, '0')}${String(ayahNum).padStart(3, '0')}.mp3`;

        if (localAudioDirHandle) {
            audioUrl = `local-audio://${fileName}`;
        } else if (customAudioBaseUrl) {
            audioUrl = `${customAudioBaseUrl.replace(/\/$/, '')}/${fileName}`;
        }
    }

    // Resolve local-audio:// to object URL if needed
    useEffect(() => {
        if (!audioUrl) {
            setResolvedAudioUrl(null);
            return;
        }

        if (audioUrl.startsWith('local-audio://') && localAudioDirHandle) {
            const fileName = audioUrl.replace('local-audio://', '');
            getLocalAudioUrl(localAudioDirHandle, fileName).then(url => {
                setResolvedAudioUrl(url || audioUrl); // fallback
            });
        } else {
            setResolvedAudioUrl(audioUrl);
        }
    }, [audioUrl, localAudioDirHandle]);


    if (isVersesLoading || isChapterLoading) {
        return <div className="mem-session"><div className="mem-loading">Loading Hifdh Mode...</div></div>;
    }

    if (verses.length === 0) return null;

    const sessionPct = Math.round(((currentVerseIndex + currentVerses.length) / verses.length) * 100);
    const hasNonDefaultAudio = ayahRepeatTarget !== 1 || ayahDelay > 0 || rangeLoopTarget !== 1;

    return (
        <div className="mem-session">
            {/* Session Progress Bar */}
            <div className="mem-progress-track">
                <div className="mem-progress-fill" style={{ width: `${sessionPct}%` }} />
            </div>

            {/* Hidden Audio */}
            {resolvedAudioUrl && (
                <audio ref={audioRef} src={resolvedAudioUrl}
                    onEnded={handleAudioEnded}
                    onError={() => setIsPlayingAudio(false)} />
            )}

            {/* Verse Display Area */}
            <div className="mem-verse-area">
                <motion.div
                    key={`${currentVerseIndex}-${ayahsPerSwipe}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="mem-verse-container"
                    onClick={() => hideMode === 'blur' && setHideMode('visible')}
                >
                    <div className="mem-verse-stack">
                        {currentVerses.map((verse, idx) => (
                            <div key={verse.id} className="mem-verse-block">
                                <div className="mem-verse-text-wrap">
                                    {renderVerseText(verse, idx)}
                                    <div className={`mem-verse-side ${hideMode === 'blur' ? 'hidden' : ''}`}>
                                        <button className="mem-verse-side-btn" onClick={(e) => { e.stopPropagation(); toggleBookmark(verse.verse_key, chapter?.name_simple, chapter?.id); }}
                                            style={{ color: bookmarks?.find(b => b.verseKey === verse.verse_key) ? 'var(--mem-teal)' : 'var(--mem-ink-muted)' }}
                                            title="Bookmark">
                                            <Bookmark size={20} fill={bookmarks?.find(b => b.verseKey === verse.verse_key) ? 'currentColor' : 'none'} />
                                        </button>
                                        <button className="mem-verse-side-btn" onClick={(e) => { e.stopPropagation(); toggleMemorizedAyah(verse.verse_key); }}
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
                                            className="mem-translation"
                                            style={{ fontSize: `${(translationFontSize || 2) * 0.15 + 0.75}rem` }}
                                        >
                                            {verse.translations?.[0]?.text?.replace(/<[^>]*>?/gm, '')}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Info Bar */}
            <div className={`mem-info-bar ${showUI ? '' : 'hidden'}`}>
                <div className="mem-info-surah">
                    <span>Surah {chapter?.name_simple}</span>
                    <button className="mem-info-surah-btn" onClick={() => chapter?.id && toggleMemorizedSurah(chapter.id)}
                        style={{ color: (memorizedSurahs || []).includes(chapter?.id) ? 'var(--mem-green)' : 'var(--mem-ink-muted)' }}>
                        <Award size={16} fill={(memorizedSurahs || []).includes(chapter?.id) ? 'currentColor' : 'none'} />
                    </button>
                </div>
                <span className="mem-info-dot">·</span>
                <span>Page {currentVerses[0]?.page_number}</span>
                <span className="mem-info-dot">·</span>
                <span>Ayah {currentVerses[0]?.verse_key.split(':')[1]}{currentVerses.length > 1 ? `–${currentVerses[currentVerses.length - 1]?.verse_key.split(':')[1]}` : ''}</span>
                <span className="mem-info-dot">·</span>
                <span style={{ color: 'var(--mem-gold)', fontWeight: 600 }}>{formatTimer(sessionSeconds)}</span>
            </div>

            {/* Bottom Control Dock */}
            <div className={`mem-dock ${showUI ? '' : 'hidden'}`}>
                <div className="mem-dock-inner" style={{ position: 'relative' }}>
                    <button className="mem-dock-btn" onClick={handlePrev} disabled={currentVerseIndex === 0}><ChevronLeft size={20} /></button>
                    <button className={`mem-dock-btn ${hideMode !== 'visible' ? 'active' : ''}`} onClick={cycleHideMode}
                        title={hideMode === 'visible' ? 'Hide Text' : hideMode === 'blur' ? 'Word-by-Word' : hideMode === 'word' ? 'First Letter Hints' : 'Show All'}>
                        {hideMode === 'visible' ? <EyeOff size={18} /> : hideMode === 'blur' ? <MousePointer size={18} /> : hideMode === 'word' ? <Type size={18} /> : <Eye size={18} />}
                    </button>
                    <button className={`mem-dock-btn ${showTranslation ? 'active' : ''}`} onClick={() => setShowTranslation(!showTranslation)}>
                        <Languages size={18} />
                    </button>
                    <div className="mem-dock-divider" />
                    <motion.button className={`mem-dock-play ${isPlayingAudio ? 'is-playing' : ''}`}
                        whileTap={{ scale: 0.9 }} onClick={toggleAudio}
                        animate={isPlayingAudio ? { scale: [1, 1.08, 1] } : {}}
                        transition={{ repeat: isPlayingAudio ? Infinity : 0, duration: 1.5 }}>
                        {isPlayingAudio ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" style={{ marginLeft: '2px' }} />}
                    </motion.button>
                    <div className="mem-dock-divider" />
                    <div className="mem-ayah-select">
                        <Layers size={14} />
                        <select value={ayahsPerSwipe} onChange={(e) => {
                            const val = Number(e.target.value);
                            setAyahsPerSwipe(val);
                            if (val === -1 && verses.length > 0) {
                                const pg = verses[currentVerseIndex].page_number;
                                let s = currentVerseIndex;
                                while (s > 0 && verses[s - 1].page_number === pg) s--;
                                setCurrentVerseIndex(s);
                            } else setCurrentVerseIndex(0);
                        }}>
                            <option value={1}>1</option><option value={3}>3</option><option value={5}>5</option>
                            <option value={10}>10</option><option value={-1}>Page</option>
                        </select>
                    </div>

                    {/* Collections popover */}
                    <div style={{ position: 'relative' }}>
                        <button className="mem-dock-btn" onClick={() => setIsCollectionsOpen(!isCollectionsOpen)}><FolderPlus size={18} /></button>
                        <AnimatePresence>
                            {isCollectionsOpen && (
                                <motion.div className="mem-collections-popover"
                                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                                    onClick={e => e.stopPropagation()}>
                                    <div className="mem-popover-header">
                                        <span className="mem-popover-title">Add to Collection</span>
                                        <button className="mem-popover-close" onClick={() => setIsCollectionsOpen(false)}><X size={14} /></button>
                                    </div>
                                    <div className="mem-collections-list">
                                        {(collections || []).map(c => (
                                            <button key={c.id} className="mem-collection-btn" onClick={() => {
                                                currentVerses.forEach(v => addToCollection(c.id, v.verse_key, chapter?.name_simple, chapter?.id));
                                                setIsCollectionsOpen(false);
                                            }}><Folder size={14} /> {c.name}</button>
                                        ))}
                                    </div>
                                    <div className="mem-new-collection">
                                        <input type="text" placeholder="New…" value={newCollectionName} onChange={e => setNewCollectionName(e.target.value)} />
                                        <button onClick={() => {
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

                    {/* Audio settings popover */}
                    <div style={{ position: 'relative' }}>
                        <button className={`mem-dock-btn ${hasNonDefaultAudio ? 'active' : ''}`} onClick={() => setIsAudioSettingsOpen(!isAudioSettingsOpen)}>
                            <Settings2 size={18} />
                        </button>
                        <AnimatePresence>
                            {isAudioSettingsOpen && (
                                <motion.div className="mem-audio-popover"
                                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
                                    <div className="mem-popover-header">
                                        <span className="mem-popover-title">Repeat</span>
                                        <button className="mem-popover-close" onClick={() => setIsAudioSettingsOpen(false)}><X size={14} /></button>
                                    </div>
                                    <div className="mem-popover-row">
                                        <div className="mem-popover-label"><RefreshCw size={13} /> Ayah</div>
                                        <select className="mem-popover-select" value={ayahRepeatTarget}
                                            onChange={e => { setAyahRepeatTarget(Number(e.target.value)); setCurrentAyahPlayCount(0); }}>
                                            {AYAH_REPEAT_OPTIONS.map(o => <option key={o} value={o}>{o === 1 ? '1×' : o === -1 ? '∞' : `${o}×`}</option>)}
                                        </select>
                                    </div>
                                    <div className="mem-popover-row">
                                        <div className="mem-popover-label"><Clock size={13} /> Delay</div>
                                        <select className="mem-popover-select" value={ayahDelay} onChange={e => setAyahDelay(Number(e.target.value))}>
                                            {DELAY_OPTIONS.map(d => <option key={d} value={d}>{d === 0 ? 'None' : `${d}s`}</option>)}
                                        </select>
                                    </div>
                                    <div className="mem-popover-row">
                                        <div className="mem-popover-label"><Repeat size={13} /> Range</div>
                                        <select className="mem-popover-select" value={rangeLoopTarget}
                                            onChange={e => { setRangeLoopTarget(Number(e.target.value)); setRangeLoopCurrent(0); }}>
                                            {RANGE_LOOP_OPTIONS.map(o => <option key={o} value={o}>{o === 1 ? '1×' : o === -1 ? '∞' : `${o}×`}</option>)}
                                        </select>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <button className="mem-dock-btn" onClick={handleNext} disabled={currentVerseIndex + currentVerses.length >= verses.length}>
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* AI Analysis Modal */}
            <AnimatePresence>
                {showAnalysis && (
                    <div className="mem-analysis-backdrop">
                        <motion.div className="mem-analysis-panel"
                            initial={{ opacity: 0, y: 50, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.95 }}>
                            <button className="mem-modal-close" onClick={() => setShowAnalysis(false)}
                                style={{ position: 'absolute', top: '1rem', right: '1rem' }}><X size={18} /></button>
                            <h3 style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: 700, color: 'var(--mem-ink)' }}>Analysis Results</h3>
                            <div className="mem-analysis-ring" style={{ background: 'conic-gradient(var(--mem-teal) 92%, var(--mem-bone) 0)' }}>
                                <div className="mem-analysis-ring-inner">
                                    <span className="mem-analysis-score">92<small>%</small></span>
                                    <span className="mem-analysis-label">Accuracy</span>
                                </div>
                            </div>
                            <div className="mem-error-card is-error">
                                <ShieldAlert size={18} color="#dc2626" style={{ marginTop: '2px', flexShrink: 0 }} />
                                <div><div className="mem-error-title">Missed Ghunnah</div>
                                <div className="mem-error-detail">Verses {currentVerses.map(v => v.verse_key.split(':')[1]).join(', ')}</div></div>
                            </div>
                            <div className="mem-error-card is-success">
                                <Award size={18} color="var(--mem-teal)" style={{ marginTop: '2px', flexShrink: 0 }} />
                                <div><div className="mem-error-title">Perfect Makhraj</div>
                                <div className="mem-error-detail">Pronunciation of 'Qaaf' was excellent.</div></div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

